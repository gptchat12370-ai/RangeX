import { Injectable, Logger } from '@nestjs/common';
import {
  EC2Client,
  CreateSecurityGroupCommand,
  AuthorizeSecurityGroupIngressCommand,
  AuthorizeSecurityGroupEgressCommand,
  DeleteSecurityGroupCommand,
  DescribeSecurityGroupsCommand,
  RevokeSecurityGroupIngressCommand,
  RevokeSecurityGroupEgressCommand,
  IpPermission,
} from '@aws-sdk/client-ec2';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SessionSecurityGroupService {
  private readonly logger = new Logger(SessionSecurityGroupService.name);
  private readonly ec2Client: EC2Client;
  
  private readonly region: string;
  private readonly vpcId: string;
  private readonly gatewayProxySgId: string;
  private readonly endpointSgId: string;
  private readonly allowedPorts: number[];
  private readonly usePerSessionSg: boolean;
  
  // Track created session SGs for cleanup
  private readonly sessionSgMap = new Map<string, string>(); // sessionId -> sgId

  constructor(private readonly configService: ConfigService) {
    this.region = this.configService.get<string>('AWS_REGION')!;
    this.vpcId = this.configService.get<string>('AWS_VPC_ID')!;
    this.gatewayProxySgId = this.configService.get<string>(
      'RANGEX_GATEWAY_PROXY_SG_ID',
    )!;
    this.endpointSgId = this.configService.get<string>(
      'AWS_ENDPOINT_SECURITY_GROUP_ID',
    )!;
    this.allowedPorts = (
      this.configService.get<string>(
        'RANGEX_ALLOWED_ENTRYPOINT_PORTS',
        '22,80,443,3389,8080,3000',
      ) || ''
    )
      .split(',')
      .map((p) => parseInt(p.trim(), 10))
      .filter(Boolean);
    
    this.usePerSessionSg = this.configService.get<string>(
      'RANGEX_USE_PER_SESSION_SECURITY_GROUP',
      'true',
    ) === 'true';

    this.ec2Client = new EC2Client({ region: this.region });
    
    this.logger.log(
      `Session SG Service initialized (per-session SGs: ${this.usePerSessionSg})`,
    );
  }

  /**
   * Creates a security group for a session
   * Returns the security group ID
   */
  async createSessionSecurityGroup(sessionId: string): Promise<string> {
    if (!this.usePerSessionSg) {
      // Return base challenge tasks SG if per-session SGs disabled
      const baseSgId = this.configService.get<string>(
        'RANGEX_CHALLENGE_TASKS_BASE_SG_ID',
      );
      if (!baseSgId) {
        throw new Error(
          'RANGEX_CHALLENGE_TASKS_BASE_SG_ID not configured and per-session SGs disabled',
        );
      }
      this.logger.log(
        `Per-session SGs disabled, using base SG: ${baseSgId}`,
      );
      return baseSgId;
    }

    this.logger.log(`Creating security group for session: ${sessionId}`);

    try {
      // Step 1: Create the security group
      const sgName = `rangex-session-${sessionId}`;
      const createSgCommand = new CreateSecurityGroupCommand({
        GroupName: sgName,
        Description: `RangeX session ${sessionId} - Isolated challenge machines`,
        VpcId: this.vpcId,
        TagSpecifications: [
          {
            ResourceType: 'security-group',
            Tags: [
              { Key: 'Name', Value: sgName },
              { Key: 'ManagedBy', Value: 'RangeX' },
              { Key: 'SessionId', Value: sessionId },
              { Key: 'Environment', Value: 'production' },
            ],
          },
        ],
      });

      const createResponse = await this.ec2Client.send(createSgCommand);
      const sgId = createResponse.GroupId!;

      this.logger.log(`✅ Created security group: ${sgId} for session ${sessionId}`);

      // Step 2: Configure inbound rules
      await this.configureInboundRules(sgId, sessionId);

      // Step 3: Configure outbound rules
      await this.configureOutboundRules(sgId, sessionId);

      // Track the session SG
      this.sessionSgMap.set(sessionId, sgId);

      this.logger.log(`✅ Session security group configured: ${sgId}`);

      return sgId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to create session security group: ${errorMessage}`,
      );
      throw error;
    }
  }

  /**
   * Configures inbound rules for session security group
   */
  private async configureInboundRules(
    sgId: string,
    sessionId: string,
  ): Promise<void> {
    const inboundRules: IpPermission[] = [];

    // Rule 1: Allow specific ports from Gateway Proxy SG
    for (const port of this.allowedPorts) {
      inboundRules.push({
        IpProtocol: 'tcp',
        FromPort: port,
        ToPort: port,
        UserIdGroupPairs: [
          {
            GroupId: this.gatewayProxySgId,
            Description: `Gateway proxy → session ${sessionId} port ${port}`,
          },
        ],
      });
    }

    // Rule 2: Allow all traffic from self (inter-machine communication within session)
    inboundRules.push({
      IpProtocol: '-1', // All protocols
      UserIdGroupPairs: [
        {
          GroupId: sgId,
          Description: `Inter-machine communication within session ${sessionId}`,
        },
      ],
    });

    // Apply inbound rules
    const authorizeIngressCommand = new AuthorizeSecurityGroupIngressCommand({
      GroupId: sgId,
      IpPermissions: inboundRules,
    });

    await this.ec2Client.send(authorizeIngressCommand);
    this.logger.log(
      `✅ Configured ${inboundRules.length} inbound rules for ${sgId}`,
    );
  }

  /**
   * Configures outbound rules for session security group
   */
  private async configureOutboundRules(
    sgId: string,
    sessionId: string,
  ): Promise<void> {
    // First, revoke default "allow all" outbound rule
    try {
      const revokeEgressCommand = new RevokeSecurityGroupEgressCommand({
        GroupId: sgId,
        IpPermissions: [
          {
            IpProtocol: '-1',
            IpRanges: [{ CidrIp: '0.0.0.0/0' }],
          },
        ],
      });
      await this.ec2Client.send(revokeEgressCommand);
    } catch (error) {
      // Ignore errors if default rule doesn't exist
      this.logger.debug('Default outbound rule already removed or not present');
    }

    const outboundRules: IpPermission[] = [];

    // Rule 1: Allow HTTPS to VPC endpoints (for ECR pulls)
    outboundRules.push({
      IpProtocol: 'tcp',
      FromPort: 443,
      ToPort: 443,
      UserIdGroupPairs: [
        {
          GroupId: this.endpointSgId,
          Description: `Session ${sessionId} → VPC endpoints (ECR)`,
        },
      ],
    });

    // Rule 2: Allow all traffic to self (inter-machine communication)
    outboundRules.push({
      IpProtocol: '-1', // All protocols
      UserIdGroupPairs: [
        {
          GroupId: sgId,
          Description: `Inter-machine communication within session ${sessionId}`,
        },
      ],
    });

    // Rule 3: Allow DNS (UDP 53) to VPC resolver
    outboundRules.push({
      IpProtocol: 'udp',
      FromPort: 53,
      ToPort: 53,
      IpRanges: [
        {
          CidrIp: '0.0.0.0/0', // VPC resolver is accessible via VPC CIDR
          Description: `Session ${sessionId} → DNS resolution`,
        },
      ],
    });

    // Rule 4: Allow TCP DNS (some resolvers use TCP)
    outboundRules.push({
      IpProtocol: 'tcp',
      FromPort: 53,
      ToPort: 53,
      IpRanges: [
        {
          CidrIp: '0.0.0.0/0',
          Description: `Session ${sessionId} → DNS resolution (TCP)`,
        },
      ],
    });

    // Apply outbound rules
    const authorizeEgressCommand = new AuthorizeSecurityGroupEgressCommand({
      GroupId: sgId,
      IpPermissions: outboundRules,
    });

    await this.ec2Client.send(authorizeEgressCommand);
    this.logger.log(
      `✅ Configured ${outboundRules.length} outbound rules for ${sgId}`,
    );
  }

  /**
   * Deletes a session security group
   */
  async deleteSessionSecurityGroup(sessionId: string): Promise<void> {
    if (!this.usePerSessionSg) {
      this.logger.log(
        `Per-session SGs disabled, skipping deletion for session ${sessionId}`,
      );
      return;
    }

    const sgId = this.sessionSgMap.get(sessionId);
    if (!sgId) {
      this.logger.warn(
        `No security group found for session ${sessionId} (may have already been deleted)`,
      );
      return;
    }

    this.logger.log(
      `Deleting security group ${sgId} for session ${sessionId}`,
    );

    try {
      // Retry deletion with exponential backoff (SG may be in use)
      let retries = 3;
      while (retries > 0) {
        try {
          const deleteSgCommand = new DeleteSecurityGroupCommand({
            GroupId: sgId,
          });
          await this.ec2Client.send(deleteSgCommand);
          
          this.logger.log(`✅ Deleted security group: ${sgId}`);
          this.sessionSgMap.delete(sessionId);
          return;
        } catch (error) {
          const err = error as any;
          if (err.name === 'DependencyViolation') {
            // SG still in use by tasks
            this.logger.warn(
              `Security group ${sgId} still in use, retrying in 10s... (${retries} retries left)`,
            );
            await new Promise((resolve) => setTimeout(resolve, 10000));
            retries--;
          } else {
            throw error;
          }
        }
      }

      this.logger.error(
        `Failed to delete security group ${sgId} after multiple retries - may need manual cleanup`,
      );
    } catch (error) {
      const err = error as any;
      if (err.name === 'InvalidGroup.NotFound') {
        this.logger.log(
          `Security group ${sgId} already deleted`,
        );
        this.sessionSgMap.delete(sessionId);
      } else {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Failed to delete session security group: ${errorMessage}`,
        );
        throw error;
      }
    }
  }

  /**
   * Gets the security group ID for a session
   */
  getSessionSecurityGroupId(sessionId: string): string | undefined {
    return this.sessionSgMap.get(sessionId);
  }

  /**
   * Checks if a session security group exists
   */
  async sessionSecurityGroupExists(sessionId: string): Promise<boolean> {
    const sgId = this.sessionSgMap.get(sessionId);
    if (!sgId) {
      return false;
    }

    try {
      const describeCommand = new DescribeSecurityGroupsCommand({
        GroupIds: [sgId],
      });
      const response = await this.ec2Client.send(describeCommand);
      return (response.SecurityGroups?.length || 0) > 0;
    } catch (error) {
      const err = error as any;
      if (err.name === 'InvalidGroup.NotFound') {
        this.sessionSgMap.delete(sessionId);
        return false;
      }
      throw error;
    }
  }

  /**
   * Lists all RangeX-managed session security groups
   */
  async listSessionSecurityGroups(): Promise<Array<{
    sessionId: string;
    sgId: string;
    sgName: string;
  }>> {
    try {
      const describeCommand = new DescribeSecurityGroupsCommand({
        Filters: [
          { Name: 'vpc-id', Values: [this.vpcId] },
          { Name: 'tag:ManagedBy', Values: ['RangeX'] },
          { Name: 'tag-key', Values: ['SessionId'] },
        ],
      });

      const response = await this.ec2Client.send(describeCommand);
      const securityGroups = response.SecurityGroups || [];

      return securityGroups.map((sg) => {
        const sessionIdTag = sg.Tags?.find((tag) => tag.Key === 'SessionId');
        return {
          sessionId: sessionIdTag?.Value || 'unknown',
          sgId: sg.GroupId!,
          sgName: sg.GroupName!,
        };
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to list session security groups: ${errorMessage}`,
      );
      return [];
    }
  }

  /**
   * Cleanup orphaned session security groups (sessions that no longer exist)
   */
  async cleanupOrphanedSecurityGroups(
    activeSessionIds: string[],
  ): Promise<number> {
    const allSessionSgs = await this.listSessionSecurityGroups();
    let deletedCount = 0;

    for (const sg of allSessionSgs) {
      if (!activeSessionIds.includes(sg.sessionId)) {
        this.logger.log(
          `Found orphaned security group ${sg.sgId} for session ${sg.sessionId}`,
        );
        try {
          await this.deleteSessionSecurityGroup(sg.sessionId);
          deletedCount++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.logger.error(
            `Failed to cleanup orphaned SG ${sg.sgId}: ${errorMessage}`,
          );
        }
      }
    }

    if (deletedCount > 0) {
      this.logger.log(`✅ Cleaned up ${deletedCount} orphaned security groups`);
    }

    return deletedCount;
  }
}
