import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SessionSecurityGroup } from '../entities/session-security-group.entity';
import { NetworkPivotPoint } from '../entities/network-pivot-point.entity';
import { v4 as uuidv4 } from 'uuid';

interface SecurityGroupRule {
  protocol: string;
  fromPort?: number;
  toPort?: number;
  source?: string; // CIDR or sg-xxx
  destination?: string; // For egress
  description: string;
}

interface NetworkGroupConfig {
  name: string;
  ingressRules: SecurityGroupRule[];
  egressRules: SecurityGroupRule[];
}

@Injectable()
export class SecurityGroupManagerService implements OnModuleInit {
  private readonly logger = new Logger(SecurityGroupManagerService.name);
  private ec2Client: any;
  private vpcId: string;
  private gatewayProxySgId: string;
  private ec2Ready = false;

  constructor(
    @InjectRepository(SessionSecurityGroup)
    private readonly sessionSgRepo: Repository<SessionSecurityGroup>,
    @InjectRepository(NetworkPivotPoint)
    private readonly pivotRepo: Repository<NetworkPivotPoint>,
  ) {
    this.vpcId = process.env.AWS_VPC_ID!;
    this.gatewayProxySgId = process.env.AWS_GATEWAY_PROXY_SG_ID!; // Gateway proxy SG
  }

  async onModuleInit() {
    await this.initAWS();
  }

  private async initAWS() {
    if (this.ec2Ready) return;
    const { EC2Client } = await import('@aws-sdk/client-ec2');
    this.ec2Client = new EC2Client({ region: process.env.AWS_REGION || 'us-east-1' });
    this.ec2Ready = true;
  }

  private async ensureEc2() {
    if (!this.ec2Ready) await this.initAWS();
  }

  /**
   * Create security groups for a session based on network groups
   * Returns map: networkGroup → securityGroupId
   */
  async createSessionSecurityGroups(
    sessionId: string,
    networkGroups: string[],
    pivotPoints: NetworkPivotPoint[],
    exposedEntrypoints?: Array<{ networkGroup: string; protocol: string; port: number }>,
  ): Promise<Map<string, string>> {
    await this.ensureEc2();
    const sgMap = new Map<string, string>();

    // Step 1: Create all security groups
    for (const networkGroup of networkGroups) {
      const sgId = await this.createSecurityGroup(sessionId, networkGroup);
      sgMap.set(networkGroup, sgId);

      // Save to database
      await this.sessionSgRepo.save({
        id: uuidv4(),
        sessionId,
        networkGroup,
        securityGroupId: sgId,
        securityGroupName: `rangex-session-${sessionId}-${networkGroup}`,
        status: 'creating',
      });
    }

    // Step 2: Apply base rules to each group
    for (const [networkGroup, sgId] of sgMap.entries()) {
      await this.applyBaseRules(sgId, networkGroup, sgMap);
    }

    // Step 2.5: Apply gateway ingress for exposed entrypoints
    if (exposedEntrypoints && exposedEntrypoints.length > 0) {
      for (const entrypoint of exposedEntrypoints) {
        const sgId = sgMap.get(entrypoint.networkGroup);
        if (sgId) {
          await this.addGatewayIngressForPort(sgId, entrypoint.protocol, entrypoint.port);
        }
      }
    }

    // Step 3: Apply pivot point rules (cross-group communication)
    for (const pivot of pivotPoints) {
      const sourceSgId = sgMap.get(pivot.sourceNetworkGroup);
      const targetSgId = sgMap.get(pivot.targetNetworkGroup);
      
      if (sourceSgId && targetSgId) {
        await this.applyPivotRule(sourceSgId, targetSgId, pivot);
      }
    }

    // Step 4: Mark all as active
    await this.sessionSgRepo.update(
      { sessionId },
      { status: 'active' },
    );

    this.logger.log(`[SG] Created ${sgMap.size} security groups for session ${sessionId}`);
    return sgMap;
  }

  /**
   * Create a single security group
   */
  private async createSecurityGroup(sessionId: string, networkGroup: string): Promise<string> {
    const { CreateSecurityGroupCommand } = await import('@aws-sdk/client-ec2');

    const sgName = `rangex-session-${sessionId}-${networkGroup}`;
    const command = new CreateSecurityGroupCommand({
      GroupName: sgName,
      Description: `RangeX session ${sessionId} - ${networkGroup} network group`,
      VpcId: this.vpcId,
      TagSpecifications: [{
        ResourceType: 'security-group',
        Tags: [
          { Key: 'Name', Value: sgName },
          { Key: 'ManagedBy', Value: 'RangeX' },
          { Key: 'SessionId', Value: sessionId },
          { Key: 'NetworkGroup', Value: networkGroup },
        ],
      }],
    });

    const response = await this.ec2Client.send(command);
    const sgId = response.GroupId!;

    // Remove default egress rule (allow all)
    await this.removeDefaultEgressRule(sgId);

    return sgId;
  }

  /**
   * Remove default allow-all egress rules (IPv4 and IPv6)
   */
  private async removeDefaultEgressRule(sgId: string): Promise<void> {
    const { RevokeSecurityGroupEgressCommand } = await import('@aws-sdk/client-ec2');

    // Remove IPv4 default egress
    try {
      const ipv4Command = new RevokeSecurityGroupEgressCommand({
        GroupId: sgId,
        IpPermissions: [{
          IpProtocol: '-1',
          IpRanges: [{ CidrIp: '0.0.0.0/0' }],
        }],
      });
      await this.ec2Client.send(ipv4Command);
      this.logger.debug(`[SG] Removed default IPv4 egress rule from ${sgId}`);
    } catch (error: any) {
      if (!error.message?.includes('does not exist')) {
        throw error;
      }
    }

    // Remove IPv6 default egress (if present)
    try {
      const ipv6Command = new RevokeSecurityGroupEgressCommand({
        GroupId: sgId,
        IpPermissions: [{
          IpProtocol: '-1',
          Ipv6Ranges: [{ CidrIpv6: '::/0' }],
        }],
      });
      await this.ec2Client.send(ipv6Command);
      this.logger.debug(`[SG] Removed default IPv6 egress rule from ${sgId}`);
    } catch (error: any) {
      // IPv6 rule might not exist, that's okay
      if (!error.message?.includes('does not exist')) {
        this.logger.warn(`[SG] Failed to remove IPv6 egress: ${error.message}`);
      }
    }
  }

  /**
   * Add gateway proxy ingress for a specific port (solver-exposed entrypoints)
   */
  private async addGatewayIngressForPort(sgId: string, protocol: string, port: number): Promise<void> {
    try {
      // Convert application-layer protocols to transport-layer protocols for AWS
      let ipProtocol = protocol.toLowerCase();
      if (['http', 'https', 'ssh', 'rdp', 'vnc'].includes(ipProtocol)) {
        ipProtocol = 'tcp';
      }
      
      await this.applyIngressRules(sgId, [{
        protocol: ipProtocol,
        fromPort: port,
        toPort: port,
        source: this.gatewayProxySgId,
        description: `Gateway proxy → ${protocol}:${port} (solver access)`,
      }]);
      this.logger.debug(`[SG] Added gateway ingress for ${protocol}:${port} to ${sgId}`);
    } catch (error: any) {
      // If rule already exists, that's okay
      if (!error.message?.includes('already exists')) {
        this.logger.warn(`[SG] Failed to add gateway ingress: ${error.message}`);
      }
    }
  }

  /**
   * Apply base security rules to a network group
   */
  private async applyBaseRules(
    sgId: string,
    networkGroup: string,
    allSessionSgs: Map<string, string>,
  ): Promise<void> {
    const config = this.getNetworkGroupConfig(networkGroup, allSessionSgs);

    // Apply ingress rules
    if (config.ingressRules.length > 0) {
      await this.applyIngressRules(sgId, config.ingressRules);
    }

    // Apply egress rules
    if (config.egressRules.length > 0) {
      await this.applyEgressRules(sgId, config.egressRules);
    }
  }

  /**
   * Get security configuration for a network group
   */
  private getNetworkGroupConfig(
    networkGroup: string,
    allSessionSgs: Map<string, string>,
  ): NetworkGroupConfig {
    const config: NetworkGroupConfig = {
      name: networkGroup,
      ingressRules: [],
      egressRules: [],
    };

    switch (networkGroup) {
      case 'attacker':
      case 'mgmt':
        // Allow SSH/RDP from gateway proxy for solver access
        config.ingressRules.push({
          protocol: 'tcp',
          fromPort: 22,
          toPort: 22,
          source: this.gatewayProxySgId,
          description: 'SSH from gateway proxy',
        });
        config.ingressRules.push({
          protocol: 'tcp',
          fromPort: 3389,
          toPort: 3389,
          source: this.gatewayProxySgId,
          description: 'RDP from gateway proxy',
        });

        // CRITICAL FIX: Attacker egress is NOT automatic to all groups
        // Only DMZ/web tier is always accessible for scanning
        const dmzSgId = allSessionSgs.get('dmz') || allSessionSgs.get('web');
        if (dmzSgId) {
          config.egressRules.push({
            protocol: '-1', // All protocols
            destination: dmzSgId,
            description: `Allow ${networkGroup} → dmz (scanning)`,
          });
        }

        // Internal/database access will be added via pivot points ONLY
        // This prevents accidental bypass of "pivot required" challenges
        break;

      case 'dmz':
      case 'web':
        // Allow HTTP/HTTPS from attacker
        const attackerSgId = allSessionSgs.get('attacker');
        if (attackerSgId) {
          config.ingressRules.push({
            protocol: 'tcp',
            fromPort: 80,
            toPort: 80,
            source: attackerSgId,
            description: 'HTTP from attacker',
          });
          config.ingressRules.push({
            protocol: 'tcp',
            fromPort: 443,
            toPort: 443,
            source: attackerSgId,
            description: 'HTTPS from attacker',
          });
          config.ingressRules.push({
            protocol: 'tcp',
            fromPort: 8080,
            toPort: 8080,
            source: attackerSgId,
            description: 'Alt HTTP from attacker',
          });
        }

        // Allow outbound to internal (if exists) for database connections
        const internalSgId = allSessionSgs.get('internal');
        if (internalSgId) {
          config.egressRules.push({
            protocol: 'tcp',
            fromPort: 3306,
            toPort: 3306,
            destination: internalSgId,
            description: 'MySQL to internal',
          });
          config.egressRules.push({
            protocol: 'tcp',
            fromPort: 5432,
            toPort: 5432,
            destination: internalSgId,
            description: 'PostgreSQL to internal',
          });
          config.egressRules.push({
            protocol: 'tcp',
            fromPort: 6379,
            toPort: 6379,
            destination: internalSgId,
            description: 'Redis to internal',
          });
        }
        break;

      case 'internal':
      case 'database':
        // Only allow connections from DMZ/web
        const webSgId = allSessionSgs.get('dmz') || allSessionSgs.get('web');
        if (webSgId) {
          config.ingressRules.push({
            protocol: 'tcp',
            fromPort: 3306,
            toPort: 3306,
            source: webSgId,
            description: 'MySQL from DMZ',
          });
          config.ingressRules.push({
            protocol: 'tcp',
            fromPort: 5432,
            toPort: 5432,
            source: webSgId,
            description: 'PostgreSQL from DMZ',
          });
          config.ingressRules.push({
            protocol: 'tcp',
            fromPort: 6379,
            toPort: 6379,
            source: webSgId,
            description: 'Redis from DMZ',
          });
        }

        // CRITICAL FIX: Internal egress is configurable, not hardcoded "none"
        // Default is no egress, but machines can override via networkEgressPolicy
        // This allows: repo updates, DNS, reverse shells, C2 beaconing
        // Implementation: check machine.networkEgressPolicy in phase 3
        // For now, add no egress (will be overridden per-machine in environment.service)
        break;

      default:
        // Custom network groups get minimal rules
        this.logger.warn(`[SG] Unknown network group: ${networkGroup}, applying minimal rules`);
        break;
    }

    return config;
  }

  /**
   * Apply ingress rules to security group
   */
  private async applyIngressRules(sgId: string, rules: SecurityGroupRule[]): Promise<void> {
    const { AuthorizeSecurityGroupIngressCommand } = await import('@aws-sdk/client-ec2');

    const ipPermissions = rules.map(rule => {
      const permission: any = {
        IpProtocol: rule.protocol,
      };

      // Only set ports when meaningful (not for protocol -1)
      if (rule.protocol !== '-1' && rule.fromPort !== undefined) {
        permission.FromPort = rule.fromPort;
        permission.ToPort = rule.toPort ?? rule.fromPort;
      }

      if (rule.source?.startsWith('sg-')) {
        permission.UserIdGroupPairs = [{ GroupId: rule.source, Description: rule.description }];
      } else if (rule.source) {
        permission.IpRanges = [{ CidrIp: rule.source, Description: rule.description }];
      }

      return permission;
    });

    const command = new AuthorizeSecurityGroupIngressCommand({
      GroupId: sgId,
      IpPermissions: ipPermissions,
    });

    await this.ec2Client.send(command);
    this.logger.debug(`[SG] Applied ${rules.length} ingress rules to ${sgId}`);
  }

  /**
   * Apply egress rules to security group
   */
  private async applyEgressRules(sgId: string, rules: SecurityGroupRule[]): Promise<void> {
    const { AuthorizeSecurityGroupEgressCommand } = await import('@aws-sdk/client-ec2');

    const ipPermissions = rules.map(rule => {
      const permission: any = {
        IpProtocol: rule.protocol,
      };

      if (rule.fromPort !== undefined) {
        permission.FromPort = rule.fromPort;
        permission.ToPort = rule.toPort;
      }

      if (rule.destination?.startsWith('sg-')) {
        permission.UserIdGroupPairs = [{ GroupId: rule.destination, Description: rule.description }];
      } else if (rule.destination) {
        permission.IpRanges = [{ CidrIp: rule.destination, Description: rule.description }];
      }

      return permission;
    });

    const command = new AuthorizeSecurityGroupEgressCommand({
      GroupId: sgId,
      IpPermissions: ipPermissions,
    });

    await this.ec2Client.send(command);
    this.logger.debug(`[SG] Applied ${rules.length} egress rules to ${sgId}`);
  }

  /**
   * Apply pivot point rule (allow source group to reach target group)
   */
  private async applyPivotRule(
    sourceSgId: string,
    targetSgId: string,
    pivot: NetworkPivotPoint,
  ): Promise<void> {
    const { AuthorizeSecurityGroupEgressCommand, AuthorizeSecurityGroupIngressCommand } = await import('@aws-sdk/client-ec2');

    // Add egress rule to source (allow all protocols to target)
    const egressCommand = new AuthorizeSecurityGroupEgressCommand({
      GroupId: sourceSgId,
      IpPermissions: [{
        IpProtocol: '-1',
        UserIdGroupPairs: [{
          GroupId: targetSgId,
          Description: `Pivot: ${pivot.sourceNetworkGroup} → ${pivot.targetNetworkGroup}`,
        }],
      }],
    });

    // Add ingress rule to target (allow all protocols from source)
    const ingressCommand = new AuthorizeSecurityGroupIngressCommand({
      GroupId: targetSgId,
      IpPermissions: [{
        IpProtocol: '-1',
        UserIdGroupPairs: [{
          GroupId: sourceSgId,
          Description: `Pivot: ${pivot.sourceNetworkGroup} → ${pivot.targetNetworkGroup}`,
        }],
      }],
    });

    await Promise.all([
      this.ec2Client.send(egressCommand),
      this.ec2Client.send(ingressCommand),
    ]);

    this.logger.log(`[SG] Applied pivot rule: ${pivot.sourceNetworkGroup} → ${pivot.targetNetworkGroup}`);
  }

  /**
   * Delete all security groups for a session
   */
  async deleteSessionSecurityGroups(sessionId: string): Promise<void> {
    await this.ensureEc2();
    const sessionSgs = await this.sessionSgRepo.find({ where: { sessionId } });

    if (sessionSgs.length === 0) {
      this.logger.warn(`[SG] No security groups found for session ${sessionId}`);
      return;
    }

    // Mark as deleting
    await this.sessionSgRepo.update({ sessionId }, { status: 'deleting' });

    const { DeleteSecurityGroupCommand } = await import('@aws-sdk/client-ec2');

    for (const sg of sessionSgs) {
      try {
        const command = new DeleteSecurityGroupCommand({
          GroupId: sg.securityGroupId,
        });
        await this.ec2Client.send(command);

        // Mark as deleted
        await this.sessionSgRepo.update(sg.id, {
          status: 'deleted',
          deletedAt: new Date(),
        });

        this.logger.log(`[SG] Deleted security group ${sg.securityGroupId} (${sg.networkGroup})`);
      } catch (error: any) {
        if (error.name === 'DependencyViolation') {
          this.logger.warn(`[SG] Security group ${sg.securityGroupId} still in use, will retry later`);
        } else {
          this.logger.error(`[SG] Failed to delete ${sg.securityGroupId}: ${error.message}`);
        }
      }
    }
  }

  /**
   * Cleanup orphaned security groups (periodic sweeper job)
   */
  async cleanupOrphanedSecurityGroups(): Promise<number> {
    const { DescribeSecurityGroupsCommand, DeleteSecurityGroupCommand } = await import('@aws-sdk/client-ec2');

    // Find all RangeX session security groups in AWS
    const describeCommand = new DescribeSecurityGroupsCommand({
      Filters: [
        { Name: 'tag:ManagedBy', Values: ['RangeX'] },
        { Name: 'group-name', Values: ['rangex-session-*'] },
      ],
    });

    const awsSgs = await this.ec2Client.send(describeCommand);
    if (!awsSgs.SecurityGroups || awsSgs.SecurityGroups.length === 0) {
      return 0;
    }

    // Find session IDs that no longer exist in database
    const awsSgIds = awsSgs.SecurityGroups.map((sg: any) => sg.GroupId!);
    const dbSgs = await this.sessionSgRepo.find({
      where: { securityGroupId: awsSgIds as any },
    });

    const dbSgIdSet = new Set(dbSgs.map(sg => sg.securityGroupId));
    const orphanedSgIds = awsSgIds.filter((id: string) => !dbSgIdSet.has(id));

    let deletedCount = 0;

    for (const sgId of orphanedSgIds) {
      try {
        const deleteCommand = new DeleteSecurityGroupCommand({ GroupId: sgId });
        await this.ec2Client.send(deleteCommand);
        deletedCount++;
        this.logger.log(`[SG] Deleted orphaned security group ${sgId}`);
      } catch (error: any) {
        if (error.name === 'DependencyViolation') {
          this.logger.debug(`[SG] Orphaned SG ${sgId} still in use, skipping`);
        } else {
          this.logger.error(`[SG] Failed to delete orphaned ${sgId}: ${error.message}`);
        }
      }
    }

    return deletedCount;
  }

  /**
   * Create per-machine security groups for fine-grained network control
   * Returns map: machineId → securityGroupId
   */
  async createMachineSecurityGroups(
    sessionId: string,
    machines: Array<{
      machineId: string;
      machineName: string;
      networkGroup: string;
      networkEgressPolicy: 'none' | 'session-only' | 'internet';
      allowSolverEntry: boolean;
      allowFromAttacker: boolean;
      allowInternalConnections: boolean;
      isPivotHost: boolean;
      exposedPorts?: Array<{ protocol: string; port: number }>;
    }>,
  ): Promise<Map<string, string>> {
    await this.ensureEc2();
    const sgMap = new Map<string, string>();

    this.logger.log(`[SG] Creating ${machines.length} per-machine security groups for session ${sessionId}`);

    // Step 1: Create security group for each machine
    for (const machine of machines) {
      const sgId = await this.createMachineSG(sessionId, machine.machineId, machine.machineName, machine.networkGroup);
      sgMap.set(machine.machineId, sgId);

      // Save to database
      await this.sessionSgRepo.save({
        id: uuidv4(),
        sessionId,
        networkGroup: machine.networkGroup,
        machineId: machine.machineId,
        securityGroupId: sgId,
        securityGroupName: `rangex-session-${sessionId}-${machine.machineName}`,
        status: 'creating',
      });
    }

    // Step 2: Apply rules to each machine's SG
    for (const machine of machines) {
      const sgId = sgMap.get(machine.machineId)!;
      await this.applyMachineRules(sgId, machine, sgMap, machines);
    }

    // Step 3: Mark all as active (update each record individually)
    for (const machine of machines) {
      await this.sessionSgRepo.update(
        { sessionId, machineId: machine.machineId },
        { status: 'active' },
      );
    }

    this.logger.log(`[SG] Created ${sgMap.size} machine security groups for session ${sessionId}`);
    return sgMap;
  }

  /**
   * Create a single security group for a machine
   */
  private async createMachineSG(
    sessionId: string,
    machineId: string,
    machineName: string,
    networkGroup: string,
  ): Promise<string> {
    const { CreateSecurityGroupCommand } = await import('@aws-sdk/client-ec2');

    const sgName = `rangex-${sessionId.substring(0, 8)}-${machineName}`;
    const command = new CreateSecurityGroupCommand({
      GroupName: sgName,
      Description: `RangeX session ${sessionId} - machine ${machineName} (${networkGroup})`,
      VpcId: this.vpcId,
      TagSpecifications: [{
        ResourceType: 'security-group',
        Tags: [
          { Key: 'Name', Value: sgName },
          { Key: 'ManagedBy', Value: 'RangeX' },
          { Key: 'SessionId', Value: sessionId },
          { Key: 'MachineId', Value: machineId },
          { Key: 'NetworkGroup', Value: networkGroup },
        ],
      }],
    });

    const response = await this.ec2Client.send(command);
    const sgId = response.GroupId!;

    // Remove default egress rule (zero-trust)
    await this.removeDefaultEgressRule(sgId);

    return sgId;
  }

  /**
   * Apply security rules to a machine's security group
   */
  private async applyMachineRules(
    sgId: string,
    machine: {
      machineId: string;
      machineName: string;
      networkGroup: string;
      networkEgressPolicy: 'none' | 'session-only' | 'internet';
      allowSolverEntry: boolean;
      allowFromAttacker: boolean;
      allowInternalConnections: boolean;
      isPivotHost: boolean;
      exposedPorts?: Array<{ protocol: string; port: number }>;
    },
    allMachineSgs: Map<string, string>,
    allMachines: Array<{
      machineId: string;
      machineName: string;
      networkGroup: string;
      networkEgressPolicy: 'none' | 'session-only' | 'internet';
      allowSolverEntry: boolean;
      allowFromAttacker: boolean;
      allowInternalConnections: boolean;
      isPivotHost: boolean;
      exposedPorts?: Array<{ protocol: string; port: number }>;
    }>,
  ): Promise<void> {
    const ingressRules: SecurityGroupRule[] = [];
    const egressRules: SecurityGroupRule[] = [];

    // 1. Solver entry (SSH/RDP access via gateway proxy)
    if (machine.allowSolverEntry) {
      ingressRules.push({
        protocol: 'tcp',
        fromPort: 22,
        toPort: 22,
        source: this.gatewayProxySgId,
        description: `SSH from gateway proxy (solver entry)`,
      });
      ingressRules.push({
        protocol: 'tcp',
        fromPort: 3389,
        toPort: 3389,
        source: this.gatewayProxySgId,
        description: `RDP from gateway proxy (solver entry)`,
      });
    }

    // 2. Exposed ports for solver access (HTTP/HTTPS/custom)
    if (machine.exposedPorts && machine.exposedPorts.length > 0) {
      for (const portConfig of machine.exposedPorts) {
        // Convert application-layer protocols to transport-layer protocols for AWS
        let ipProtocol = portConfig.protocol.toLowerCase();
        if (['http', 'https', 'ssh', 'rdp', 'vnc'].includes(ipProtocol)) {
          ipProtocol = 'tcp';
        }
        
        ingressRules.push({
          protocol: ipProtocol,
          fromPort: portConfig.port,
          toPort: portConfig.port,
          source: this.gatewayProxySgId,
          description: `${portConfig.protocol}:${portConfig.port} from gateway (solver access)`,
        });
      }
    }

    // 3. Allow from attacker machines (all protocols)
    if (machine.allowFromAttacker) {
      const attackerMachines = allMachines.filter(
        m => (m.networkGroup === 'attacker' || m.networkGroup === 'mgmt') && m.machineId !== machine.machineId,
      );

      for (const attackerMachine of attackerMachines) {
        const attackerSgId = allMachineSgs.get(attackerMachine.machineId);
        if (attackerSgId) {
          ingressRules.push({
            protocol: '-1', // All protocols
            source: attackerSgId,
            description: `All traffic from attacker machine: ${attackerMachine.machineName}`,
          });
        }
      }

      this.logger.debug(
        `[SG] Machine ${machine.machineName} allows traffic from ${attackerMachines.length} attacker machines`,
      );
    }

    // 4. Allow internal connections (same network group)
    if (machine.allowInternalConnections) {
      const sameGroupMachines = allMachines.filter(
        m => m.networkGroup === machine.networkGroup && m.machineId !== machine.machineId,
      );

      for (const peerMachine of sameGroupMachines) {
        const peerSgId = allMachineSgs.get(peerMachine.machineId);
        if (peerSgId) {
          ingressRules.push({
            protocol: '-1', // All protocols
            source: peerSgId,
            description: `All traffic from peer: ${peerMachine.machineName} (same network group)`,
          });
        }
      }

      this.logger.debug(
        `[SG] Machine ${machine.machineName} allows traffic from ${sameGroupMachines.length} peer machines`,
      );
    }

    // 5. Network egress policy
    switch (machine.networkEgressPolicy) {
      case 'internet':
        // Allow outbound to internet (for updates, downloads, C2, etc.)
        egressRules.push({
          protocol: '-1',
          destination: '0.0.0.0/0',
          description: 'Internet access (egress policy: internet)',
        });
        break;

      case 'session-only':
        // Allow outbound to all machines in this session
        for (const targetMachine of allMachines) {
          if (targetMachine.machineId === machine.machineId) continue; // Skip self

          const targetSgId = allMachineSgs.get(targetMachine.machineId);
          if (targetSgId) {
            egressRules.push({
              protocol: '-1', // All protocols
              destination: targetSgId,
              description: `Session-only egress to: ${targetMachine.machineName}`,
            });
          }
        }

        this.logger.debug(
          `[SG] Machine ${machine.machineName} egress: session-only (${allMachines.length - 1} targets)`,
        );
        break;

      case 'none':
        // No egress rules (zero-trust, isolated)
        this.logger.debug(`[SG] Machine ${machine.machineName} egress: none (fully isolated)`);
        break;
    }

    // Apply ingress rules
    if (ingressRules.length > 0) {
      await this.applyIngressRules(sgId, ingressRules);
      this.logger.debug(`[SG] Applied ${ingressRules.length} ingress rules to ${machine.machineName}`);
    }

    // Apply egress rules
    if (egressRules.length > 0) {
      await this.applyEgressRules(sgId, egressRules);
      this.logger.debug(`[SG] Applied ${egressRules.length} egress rules to ${machine.machineName}`);
    }
  }
}
