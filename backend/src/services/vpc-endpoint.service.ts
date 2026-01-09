import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EC2Client,
  CreateVpcEndpointCommand,
  DeleteVpcEndpointsCommand,
  DescribeVpcEndpointsCommand,
  VpcEndpointType,
  ModifyVpcEndpointCommand,
} from '@aws-sdk/client-ec2';

/**
 * VPC Endpoint Lifecycle Service
 * Manages creation/deletion of VPC endpoints for cost optimization
 * 
 * Use cases:
 * - Create endpoints on platform startup
 * - Delete endpoints on platform shutdown (save costs when not in use)
 * - Validate existing endpoints are properly configured
 */
@Injectable()
export class VpcEndpointService implements OnModuleInit {
  private readonly logger = new Logger(VpcEndpointService.name);
  private ec2Client: EC2Client;
  private autoManage: boolean;
  private vpcId: string;
  private subnetIds: string[];
  private endpointSecurityGroupId: string;
  private routeTableIds: string[];

  constructor(private configService: ConfigService) {
    const credentials = {
      accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID') || '',
      secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || '',
    };

    this.ec2Client = new EC2Client({
      region: this.configService.get<string>('AWS_REGION') || 'ap-south-2',
      credentials,
    });

    this.autoManage = this.configService.get<string>('AWS_AUTO_MANAGE_ENDPOINTS') === 'true';
    this.vpcId = this.configService.get<string>('AWS_VPC_ID') || '';
    this.subnetIds = (this.configService.get<string>('AWS_ECS_SUBNET_IDS') || '').split(',');
    this.endpointSecurityGroupId = this.configService.get<string>('AWS_ENDPOINT_SECURITY_GROUP_ID') || '';
    this.routeTableIds = (this.configService.get<string>('AWS_ROUTE_TABLE_IDS') || '').split(',').filter(Boolean);
  }

  async onModuleInit() {
    if (this.autoManage) {
      this.logger.log('Auto-manage VPC endpoints is ENABLED');
      await this.ensureEndpointsExist();
    } else {
      this.logger.log('Auto-manage VPC endpoints is DISABLED - using existing endpoints');
    }
  }

  /**
   * Create all required VPC endpoints if they don't exist
   */
  async ensureEndpointsExist(): Promise<void> {
    this.logger.log('Checking VPC endpoints...');

    try {
      // Check for ECR API endpoint
      const ecrApiExists = await this.endpointExists('com.amazonaws.ap-south-2.ecr.api');
      if (!ecrApiExists) {
        this.logger.log('Creating ECR API endpoint...');
        await this.createInterfaceEndpoint(
          'com.amazonaws.ap-south-2.ecr.api',
          'rangex-ecr-api-endpoint',
        );
      }

      // Check for ECR DKR endpoint
      const ecrDkrExists = await this.endpointExists('com.amazonaws.ap-south-2.ecr.dkr');
      if (!ecrDkrExists) {
        this.logger.log('Creating ECR DKR endpoint...');
        await this.createInterfaceEndpoint(
          'com.amazonaws.ap-south-2.ecr.dkr',
          'rangex-ecr-dkr-endpoint',
        );
      }

      // Check for S3 endpoint
      const s3Exists = await this.endpointExists('com.amazonaws.ap-south-2.s3');
      if (!s3Exists) {
        this.logger.log('Creating S3 gateway endpoint...');
        await this.createGatewayEndpoint(
          'com.amazonaws.ap-south-2.s3',
          'rangex-vpce-s3',
        );
      }

      this.logger.log('All VPC endpoints are available');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to ensure endpoints exist: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Check if an endpoint exists
   */
  private async endpointExists(serviceName: string): Promise<boolean> {
    const command = new DescribeVpcEndpointsCommand({
      Filters: [
        { Name: 'vpc-id', Values: [this.vpcId] },
        { Name: 'service-name', Values: [serviceName] },
      ],
    });

    const response = await this.ec2Client.send(command);
    return (response.VpcEndpoints?.length || 0) > 0;
  }

  /**
   * Create an interface VPC endpoint (for ECR)
   */
  private async createInterfaceEndpoint(
    serviceName: string,
    tagName: string,
  ): Promise<string> {
    const command = new CreateVpcEndpointCommand({
      VpcId: this.vpcId,
      ServiceName: serviceName,
      VpcEndpointType: VpcEndpointType.Interface,
      SubnetIds: this.subnetIds,
      SecurityGroupIds: [this.endpointSecurityGroupId],
      PrivateDnsEnabled: true, // Critical for ECR
      TagSpecifications: [
        {
          ResourceType: 'vpc-endpoint',
          Tags: [
            { Key: 'Name', Value: tagName },
            { Key: 'ManagedBy', Value: 'RangeX' },
            { Key: 'Environment', Value: 'production' },
          ],
        },
      ],
    });

    const response = await this.ec2Client.send(command);
    const endpointId = response.VpcEndpoint?.VpcEndpointId || '';

    this.logger.log(`Created interface endpoint: ${endpointId} (${serviceName})`);

    return endpointId;
  }

  /**
   * Create a gateway VPC endpoint (for S3)
   */
  private async createGatewayEndpoint(
    serviceName: string,
    tagName: string,
  ): Promise<string> {
    const command = new CreateVpcEndpointCommand({
      VpcId: this.vpcId,
      ServiceName: serviceName,
      VpcEndpointType: VpcEndpointType.Gateway,
      RouteTableIds: this.routeTableIds,
      TagSpecifications: [
        {
          ResourceType: 'vpc-endpoint',
          Tags: [
            { Key: 'Name', Value: tagName },
            { Key: 'ManagedBy', Value: 'RangeX' },
            { Key: 'Environment', Value: 'production' },
          ],
        },
      ],
    });

    const response = await this.ec2Client.send(command);
    const endpointId = response.VpcEndpoint?.VpcEndpointId || '';

    this.logger.log(`Created gateway endpoint: ${endpointId} (${serviceName})`);

    return endpointId;
  }

  /**
   * Delete all RangeX-managed VPC endpoints
   * Call this on platform shutdown to save costs
   */
  async deleteAllEndpoints(): Promise<void> {
    this.logger.log('Deleting all RangeX VPC endpoints...');

    try {
      // Find all RangeX-managed endpoints
      const command = new DescribeVpcEndpointsCommand({
        Filters: [
          { Name: 'vpc-id', Values: [this.vpcId] },
          { Name: 'tag:ManagedBy', Values: ['RangeX'] },
        ],
      });

      const response = await this.ec2Client.send(command);
      const endpoints = response.VpcEndpoints || [];

      if (endpoints.length === 0) {
        this.logger.log('No RangeX-managed endpoints found');
        return;
      }

      for (const endpoint of endpoints) {
        const endpointId = endpoint.VpcEndpointId!;
        const serviceName = endpoint.ServiceName || 'unknown';

        this.logger.log(`Deleting endpoint: ${endpointId} (${serviceName})`);

        await this.ec2Client.send(
          new DeleteVpcEndpointsCommand({
            VpcEndpointIds: [endpointId],
          }),
        );

        this.logger.log(`Deleted endpoint: ${endpointId}`);
      }

      this.logger.log(`Deleted ${endpoints.length} VPC endpoints`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to delete endpoints: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Update endpoint security groups (for tightening security)
   */
  async updateEndpointSecurityGroups(
    endpointId: string,
    securityGroupIds: string[],
  ): Promise<void> {
    this.logger.log(`Updating security groups for endpoint ${endpointId}`);

    const command = new ModifyVpcEndpointCommand({
      VpcEndpointId: endpointId,
      AddSecurityGroupIds: securityGroupIds,
    });

    await this.ec2Client.send(command);

    this.logger.log(`Updated security groups for ${endpointId}`);
  }

  /**
   * List all VPC endpoints in the VPC
   */
  async listEndpoints(): Promise<any[]> {
    const command = new DescribeVpcEndpointsCommand({
      Filters: [{ Name: 'vpc-id', Values: [this.vpcId] }],
    });

    const response = await this.ec2Client.send(command);

    return (response.VpcEndpoints || []).map((endpoint) => ({
      id: endpoint.VpcEndpointId,
      serviceName: endpoint.ServiceName,
      type: endpoint.VpcEndpointType,
      state: endpoint.State,
      privateDnsEnabled: endpoint.PrivateDnsEnabled,
      subnetIds: endpoint.SubnetIds,
      securityGroupIds: endpoint.Groups?.map((g) => g.GroupId),
      routeTableIds: endpoint.RouteTableIds,
    }));
  }
}
