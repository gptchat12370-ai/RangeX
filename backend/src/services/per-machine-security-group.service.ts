import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MachineSecurityGroup, IngressSource, EgressTarget } from '../entities/machine-security-group.entity';
import { EnvironmentMachine } from '../entities/environment-machine.entity';
import {
  EC2Client,
  CreateSecurityGroupCommand,
  AuthorizeSecurityGroupIngressCommand,
  AuthorizeSecurityGroupEgressCommand,
  DeleteSecurityGroupCommand,
  RevokeSecurityGroupIngressCommand,
  RevokeSecurityGroupEgressCommand,
  IpPermission,
} from '@aws-sdk/client-ec2';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';

interface MachineNetworkConfig {
  machineId: string;
  machineName: string;
  networkGroup: string;
  networkEgressPolicy: 'none' | 'session-only' | 'internet';
  allowSolverEntry: boolean;
  allowFromAttacker: boolean;
  allowInternalConnections: boolean;
  isPivotHost: boolean;
  entrypoints?: Array<{
    protocol: string;
    containerPort: number;
    exposedToSolver: boolean;
  }>;
}

@Injectable()
export class PerMachineSecurityGroupService {
  private readonly logger = new Logger(PerMachineSecurityGroupService.name);
  private readonly ec2Client: EC2Client;
  private readonly region: string;
  private readonly vpcId: string;
  private readonly gatewayProxySgId: string;
  private readonly enabled: boolean;

  constructor(
    @InjectRepository(MachineSecurityGroup)
    private readonly machineSgRepo: Repository<MachineSecurityGroup>,
    private readonly configService: ConfigService,
  ) {
    this.region = this.configService.get<string>('AWS_REGION', 'ap-south-2')!;
    this.vpcId = this.configService.get<string>('AWS_VPC_ID')!;
    this.gatewayProxySgId = this.configService.get<string>('RANGEX_GATEWAY_PROXY_SG_ID')!;
    this.enabled = this.configService.get<string>('RANGEX_PER_MACHINE_SECURITY_GROUPS', 'true') === 'true';
    
    this.ec2Client = new EC2Client({ region: this.region });
    
    this.logger.log(`Per-Machine SG Service initialized (enabled: ${this.enabled})`);
  }

  /**
   * Create security groups for all machines in a session
   * Returns map: machineId → securityGroupId
   */
  async createMachineSecurityGroups(
    sessionId: string,
    machines: MachineNetworkConfig[],
  ): Promise<Map<string, string>> {
    if (!this.enabled) {
      this.logger.warn('Per-machine security groups disabled, using shared session SG');
      return new Map();
    }

    const sgMap = new Map<string, string>();
    const machineMap = new Map(machines.map(m => [m.machineId, m]));

    this.logger.log(`Creating ${machines.length} machine security groups for session ${sessionId}`);

    // Step 1: Create all security groups
    for (const machine of machines) {
      try {
        const sgId = await this.createMachineSg(sessionId, machine);
        sgMap.set(machine.machineId, sgId);

        // Save to database
        const machineSg = this.machineSgRepo.create({
          id: uuidv4(),
          sessionId,
          machineId: machine.machineId,
          machineName: machine.machineName,
          networkGroup: machine.networkGroup,
          securityGroupId: sgId,
          securityGroupName: `rangex-${sessionId}-${machine.machineName}`,
          status: 'creating',
          allowedIngressSources: [],
          allowedEgressTargets: [],
          exposedPorts: machine.entrypoints?.map(e => ({
            protocol: e.protocol as 'http' | 'https' | 'ssh' | 'rdp' | 'vnc' | 'tcp' | 'udp',
            containerPort: e.containerPort,
            exposedToSolver: e.exposedToSolver,
          })) || [],
          awsMetadata: {
            vpcId: this.vpcId,
            region: this.region,
            ingressRuleIds: [],
            egressRuleIds: [],
          },
        });

        await this.machineSgRepo.save(machineSg);
        this.logger.log(`Created SG ${sgId} for machine ${machine.machineName}`);
      } catch (error) {
        this.logger.error(`Failed to create SG for machine ${machine.machineName}:`, error);
        throw error;
      }
    }

    // Step 2: Configure ingress/egress rules based on machine relationships
    for (const machine of machines) {
      const sgId = sgMap.get(machine.machineId);
      if (!sgId) continue;

      try {
        await this.configureSecurityGroupRules(sessionId, machine, sgId, sgMap, machineMap);
      } catch (error) {
        this.logger.error(`Failed to configure rules for machine ${machine.machineName}:`, error);
      }
    }

    // Step 3: Mark all as active
    await this.machineSgRepo.update({ sessionId }, { status: 'active' });

    this.logger.log(`✅ Created and configured ${sgMap.size} machine security groups`);
    return sgMap;
  }

  /**
   * Create a single machine security group
   */
  private async createMachineSg(sessionId: string, machine: MachineNetworkConfig): Promise<string> {
    const sgName = `rangex-${sessionId}-${machine.machineName}`;
    
    const command = new CreateSecurityGroupCommand({
      GroupName: sgName,
      Description: `RangeX machine ${machine.machineName} in session ${sessionId}`,
      VpcId: this.vpcId,
      TagSpecifications: [
        {
          ResourceType: 'security-group',
          Tags: [
            { Key: 'Name', Value: sgName },
            { Key: 'ManagedBy', Value: 'RangeX' },
            { Key: 'SessionId', Value: sessionId },
            { Key: 'MachineId', Value: machine.machineId },
            { Key: 'MachineName', Value: machine.machineName },
            { Key: 'NetworkGroup', Value: machine.networkGroup },
          ],
        },
      ],
    });

    const response = await this.ec2Client.send(command);
    const sgId = response.GroupId!;

    // Remove default egress rule (deny all by default, then allow specific)
    await this.removeDefaultEgressRule(sgId);

    return sgId;
  }

  /**
   * Configure ingress and egress rules for a machine
   */
  private async configureSecurityGroupRules(
    sessionId: string,
    machine: MachineNetworkConfig,
    sgId: string,
    sgMap: Map<string, string>,
    machineMap: Map<string, MachineNetworkConfig>,
  ): Promise<void> {
    const ingressRules: IpPermission[] = [];
    const egressRules: IpPermission[] = [];
    const ingressSources: IngressSource[] = [];
    const egressTargets: EgressTarget[] = [];

    // Rule 1: Gateway proxy access for exposed entrypoints
    if (machine.allowSolverEntry && machine.entrypoints) {
      for (const entrypoint of machine.entrypoints.filter(e => e.exposedToSolver)) {
        ingressRules.push({
          IpProtocol: 'tcp',
          FromPort: entrypoint.containerPort,
          ToPort: entrypoint.containerPort,
          UserIdGroupPairs: [{ GroupId: this.gatewayProxySgId, Description: 'Gateway proxy access' }],
        });
        ingressSources.push({
          cidr: 'gateway-proxy',
          protocol: 'tcp',
          fromPort: entrypoint.containerPort,
          toPort: entrypoint.containerPort,
          description: `Gateway access to ${entrypoint.protocol} port`,
        });
      }
    }

    // Rule 2: Allow traffic from attacker machines (if allowFromAttacker=true)
    if (machine.allowFromAttacker) {
      for (const [otherId, otherMachine] of machineMap) {
        if (otherMachine.networkGroup === 'attacker' || otherMachine.networkGroup === 'attack') {
          const attackerSgId = sgMap.get(otherId);
          if (attackerSgId && attackerSgId !== sgId) {
            ingressRules.push({
              IpProtocol: '-1', // All protocols
              UserIdGroupPairs: [{ GroupId: attackerSgId, Description: `From ${otherMachine.machineName}` }],
            });
            ingressSources.push({
              machineId: otherId,
              machineName: otherMachine.machineName,
              protocol: 'all',
              description: `Allow from attacker ${otherMachine.machineName}`,
            });
          }
        }
      }
    }

    // Rule 3: Allow internal connections within same network group
    if (machine.allowInternalConnections) {
      for (const [otherId, otherMachine] of machineMap) {
        if (otherMachine.networkGroup === machine.networkGroup && otherId !== machine.machineId) {
          const peerSgId = sgMap.get(otherId);
          if (peerSgId) {
            ingressRules.push({
              IpProtocol: '-1',
              UserIdGroupPairs: [{ GroupId: peerSgId, Description: `Internal from ${otherMachine.machineName}` }],
            });
            ingressSources.push({
              machineId: otherId,
              machineName: otherMachine.machineName,
              protocol: 'all',
              description: `Internal peer ${otherMachine.machineName}`,
            });
          }
        }
      }
    }

    // Rule 4: Pivot host - allow from one network group, egress to another
    if (machine.isPivotHost) {
      // Allow all machines to reach pivot host
      for (const [otherId, otherMachine] of machineMap) {
        if (otherId !== machine.machineId) {
          const otherSgId = sgMap.get(otherId);
          if (otherSgId) {
            ingressRules.push({
              IpProtocol: '-1',
              UserIdGroupPairs: [{ GroupId: otherSgId, Description: `Pivot from ${otherMachine.machineName}` }],
            });
            ingressSources.push({
              machineId: otherId,
              machineName: otherMachine.machineName,
              protocol: 'all',
              description: `Pivot ingress from ${otherMachine.machineName}`,
            });
          }
        }
      }
    }

    // Egress Rules based on networkEgressPolicy
    switch (machine.networkEgressPolicy) {
      case 'internet':
        // Allow all outbound traffic
        egressRules.push({
          IpProtocol: '-1',
          IpRanges: [{ CidrIp: '0.0.0.0/0', Description: 'Internet access' }],
        });
        egressTargets.push({
          cidr: '0.0.0.0/0',
          protocol: 'all',
          description: 'Full internet access',
        });
        break;

      case 'session-only':
        // Allow egress only to other machines in session
        for (const [otherId, otherMachine] of machineMap) {
          if (otherId !== machine.machineId) {
            const targetSgId = sgMap.get(otherId);
            if (targetSgId) {
              egressRules.push({
                IpProtocol: '-1',
                UserIdGroupPairs: [{ GroupId: targetSgId, Description: `To ${otherMachine.machineName}` }],
              });
              egressTargets.push({
                machineId: otherId,
                machineName: otherMachine.machineName,
                protocol: 'all',
                description: `Session peer ${otherMachine.machineName}`,
              });
            }
          }
        }
        break;

      case 'none':
        // No egress allowed (empty rules)
        break;
    }

    // DNS resolution for all (needed for container orchestration)
    egressRules.push({
      IpProtocol: 'udp',
      FromPort: 53,
      ToPort: 53,
      IpRanges: [{ CidrIp: '0.0.0.0/0', Description: 'DNS resolution' }],
    });
    egressTargets.push({
      cidr: '0.0.0.0/0',
      protocol: 'udp',
      fromPort: 53,
      toPort: 53,
      description: 'DNS resolution',
    });

    // Apply ingress rules
    if (ingressRules.length > 0) {
      const ingressCommand = new AuthorizeSecurityGroupIngressCommand({
        GroupId: sgId,
        IpPermissions: ingressRules,
      });
      await this.ec2Client.send(ingressCommand);
      this.logger.log(`Applied ${ingressRules.length} ingress rules to ${machine.machineName}`);
    }

    // Apply egress rules
    if (egressRules.length > 0) {
      const egressCommand = new AuthorizeSecurityGroupEgressCommand({
        GroupId: sgId,
        IpPermissions: egressRules,
      });
      await this.ec2Client.send(egressCommand);
      this.logger.log(`Applied ${egressRules.length} egress rules to ${machine.machineName}`);
    }

    // Update database with configured rules
    await this.machineSgRepo.update(
      { sessionId, machineId: machine.machineId },
      {
        allowedIngressSources: ingressSources,
        allowedEgressTargets: egressTargets,
      },
    );
  }

  /**
   * Remove default egress rule (allow all)
   */
  private async removeDefaultEgressRule(sgId: string): Promise<void> {
    try {
      const revokeCommand = new RevokeSecurityGroupEgressCommand({
        GroupId: sgId,
        IpPermissions: [
          {
            IpProtocol: '-1',
            IpRanges: [{ CidrIp: '0.0.0.0/0' }],
          },
        ],
      });
      await this.ec2Client.send(revokeCommand);
    } catch (error: any) {
      // Ignore if rule doesn't exist
      if (!error.message?.includes('does not exist')) {
        this.logger.warn(`Failed to remove default egress rule from ${sgId}: ${error.message}`);
      }
    }
  }

  /**
   * Delete all machine security groups for a session
   */
  async deleteMachineSecurityGroups(sessionId: string): Promise<void> {
    const machineSgs = await this.machineSgRepo.find({ where: { sessionId } });
    
    if (machineSgs.length === 0) {
      this.logger.log(`No machine security groups to delete for session ${sessionId}`);
      return;
    }

    this.logger.log(`Deleting ${machineSgs.length} machine security groups for session ${sessionId}`);

    // Mark as deleting
    await this.machineSgRepo.update({ sessionId }, { status: 'deleting' });

    // Delete from AWS
    for (const machineSg of machineSgs) {
      try {
        const deleteCommand = new DeleteSecurityGroupCommand({
          GroupId: machineSg.securityGroupId,
        });
        await this.ec2Client.send(deleteCommand);
        this.logger.log(`Deleted SG ${machineSg.securityGroupId} for machine ${machineSg.machineName}`);
      } catch (error: any) {
        this.logger.error(`Failed to delete SG ${machineSg.securityGroupId}: ${error.message}`);
        await this.machineSgRepo.update({ id: machineSg.id }, { status: 'failed' });
      }
    }

    // Soft delete from database
    await this.machineSgRepo.softDelete({ sessionId });
    
    this.logger.log(`✅ Deleted all machine security groups for session ${sessionId}`);
  }

  /**
   * Get machine security group details
   */
  async getMachineSecurityGroup(sessionId: string, machineId: string): Promise<MachineSecurityGroup | null> {
    return this.machineSgRepo.findOne({ where: { sessionId, machineId } });
  }

  /**
   * Get all machine security groups for a session
   */
  async getSessionMachineSecurityGroups(sessionId: string): Promise<MachineSecurityGroup[]> {
    return this.machineSgRepo.find({ where: { sessionId } });
  }
}
