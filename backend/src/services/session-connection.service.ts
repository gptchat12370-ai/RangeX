import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EnvironmentSession } from '../entities/environment-session.entity';
import { EnvironmentMachine } from '../entities/environment-machine.entity';
import { Machine } from '../entities/machine.entity';
import { GatewayProxyService } from './gateway-proxy.service';

export interface MachineEntrypoint {
  name: string;
  protocol: string;
  containerPort: number;
  description?: string;
  exposedToSolver: boolean;
  proxyPath?: string;
  connectionUrl?: string;
  sshCommand?: string;
}

export interface MachineConnectionDetails {
  machineId: string;
  machineName: string;
  role: string;
  status: string;
  privateIp?: string;
  entrypoints: MachineEntrypoint[];
  credentials?: {
    username: string;
    password: string;
  };
  canAccess: boolean;
}

export interface SessionConnectionInfo {
  sessionId: string;
  status: string;
  gatewayIp?: string;
  sessionToken: string;
  machines: MachineConnectionDetails[];
}

@Injectable()
export class SessionConnectionService {
  private readonly logger = new Logger(SessionConnectionService.name);

  constructor(
    @InjectRepository(EnvironmentSession)
    private sessionRepo: Repository<EnvironmentSession>,
    @InjectRepository(EnvironmentMachine)
    private envMachineRepo: Repository<EnvironmentMachine>,
    @InjectRepository(Machine)
    private machineRepo: Repository<Machine>,
    private gatewayProxyService: GatewayProxyService,
  ) {}

  /**
   * Get connection details for all machines in a session
   * SECURITY: Caller must validate session ownership before calling this
   */
  async getSessionConnectionDetails(sessionId: string): Promise<SessionConnectionInfo> {
    // Validate sessionId format
    if (!sessionId || typeof sessionId !== 'string') {
      throw new NotFoundException('Invalid session ID');
    }

    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
      relations: ['environmentMachines'],
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    // SECURITY: Validate session is in a state where connections are allowed
    if (session.status !== 'running') {
      this.logger.warn(`Attempted to get connections for non-running session ${sessionId} (status: ${session.status})`);
      throw new NotFoundException(`Session is ${session.status}, connections only available for running sessions`);
    }

    // Get gateway proxy public IP
    let gatewayIp: string | undefined;
    try {
      const gatewayInfo = await this.gatewayProxyService.discoverGatewayProxy();
      gatewayIp = gatewayInfo.publicIp;
    } catch (error) {
      this.logger.warn(`Failed to discover gateway proxy: ${error instanceof Error ? error.message : String(error)}`);
      // Continue without gateway IP - connection details will show but won't be accessible
    }

    // Load machine templates with entrypoints
    const machineTemplateIds = session.machines?.map(m => m.machineTemplateId) || [];
    const machineTemplates = await this.machineRepo.findByIds(machineTemplateIds);

    const machineDetails: MachineConnectionDetails[] = [];

    for (const envMachine of session.machines || []) {
      const template = machineTemplates.find(t => t.id === envMachine.machineTemplateId);
      if (!template) {
        this.logger.warn(`Machine template ${envMachine.machineTemplateId} not found for env machine ${envMachine.id}`);
        continue;
      }

      const entrypoints = this.buildEntrypoints(
        template,
        session.gatewaySessionToken,
        gatewayIp,
        envMachine.privateIp,
      );

      const canAccess = !!gatewayIp && template.allowSolverEntry && entrypoints.some(e => e.exposedToSolver);

      machineDetails.push({
        machineId: envMachine.machineId, // Use template ID, not instance ID
        machineName: template.name,
        role: envMachine.role,
        status: this.getMachineStatus(envMachine),
        privateIp: envMachine.privateIp,
        entrypoints,
        credentials: canAccess ? {
          username: template.sshUsername || 'root',
          password: template.sshPassword || 'vncpassword',
        } : undefined,
        canAccess,
      });
    }

    return {
      sessionId: session.id,
      status: session.status,
      gatewayIp,
      sessionToken: session.gatewaySessionToken,
      machines: machineDetails,
    };
  }

  /**
   * Get connection details for a specific machine in a session
   */
  async getMachineConnectionDetails(
    sessionId: string,
    machineId: string,
  ): Promise<MachineConnectionDetails> {
    const sessionInfo = await this.getSessionConnectionDetails(sessionId);
    const machine = sessionInfo.machines.find(m => m.machineId === machineId);

    if (!machine) {
      throw new NotFoundException('Machine not found in session');
    }

    return machine;
  }

  /**
   * Build SSH command for SSH entrypoints
   * SECURITY: Only generate SSH commands for authenticated sessions
   */
  private buildSshCommand(gatewayIp: string, entrypoint: any, username: string): string | undefined {
    if (entrypoint.protocol === 'tcp' && entrypoint.containerPort === 22 && gatewayIp) {
      // Validate gatewayIp is not localhost or private IP (should be public)
      if (gatewayIp.startsWith('127.') || gatewayIp.startsWith('192.168.') || gatewayIp.startsWith('10.')) {
        this.logger.warn(`Gateway IP is private/localhost: ${gatewayIp}. SSH command may not work from external clients.`);
      }

      // TODO: Implement proper SSH tunnel through gateway WebSocket
      // Current command is placeholder - real implementation needs gateway WebSocket bridge
      return `ssh ${username}@${gatewayIp} -p 8022 -o "ProxyCommand=nc -X connect -x ${gatewayIp}:8080 %h %p"`;
    }
    return undefined;
  }

  /**
   * Build entrypoint connection details
   * SECURITY: Validate all inputs, never trust machine template data blindly
   */
  private buildEntrypoints(
    machine: Machine,
    sessionToken: string,
    gatewayIp?: string,
    machinePrivateIp?: string,
  ): MachineEntrypoint[] {
    if (!machine.entrypoints || machine.entrypoints.length === 0) {
      return [];
    }

    // Validate sessionToken format (should be hex string)
    if (!/^[a-f0-9]{48}$/.test(sessionToken)) {
      this.logger.error(`Invalid session token format: ${sessionToken.substring(0, 10)}...`);
      throw new Error('Invalid session token');
    }

    const validEntrypoints: MachineEntrypoint[] = [];

    for (const entrypoint of machine.entrypoints) {
      // Validate entrypoint data
      if (!entrypoint.protocol || !entrypoint.containerPort) {
        this.logger.warn(`Invalid entrypoint data for machine ${machine.name}`);
        continue; // Skip invalid entrypoints
      }

      const sanitizedMachineName = this.sanitizeName(machine.name);
      // Use description as name if available, otherwise use protocol
      const rawEntrypointName = entrypoint.description || entrypoint.protocol;
      const sanitizedEntrypointName = this.sanitizeName(rawEntrypointName);
      
      // Create unique entrypoint slug (name + port to prevent collisions)
      const entrypointSlug = `${sanitizedEntrypointName}-${entrypoint.containerPort}`;
      
      // Build proxy path - use machine's private IP for gateway proxy (hostnames don't resolve across ECS tasks)
      const destination = machinePrivateIp || sanitizedMachineName;
      const proxyPath = entrypoint.protocol === 'vnc' 
        ? `/ws?dst=${destination}&port=${entrypoint.containerPort}&token=${sessionToken}`
        : `/http?dst=${destination}&port=${entrypoint.containerPort}&path=/&token=${sessionToken}`;
      
      // Build connection URL if gateway IP is available
      // Use ws:// for VNC WebSocket, http:// for HTTP proxy
      // Note: In production with HTTPS, the frontend should upgrade ws:// to wss://
      // For VNC, include default password parameter (will be customizable per machine in future)
      const connectionUrl = gatewayIp 
        ? entrypoint.protocol === 'vnc'
          ? `ws://${gatewayIp}:8080${proxyPath}` // Password passed separately via frontend URL param
          : `http://${gatewayIp}:8080${proxyPath}` 
        : undefined;

      // Build SSH command for SSH entrypoints
      const sshCommand = this.buildSshCommand(gatewayIp || '', entrypoint, 'root');

      validEntrypoints.push({
        name: rawEntrypointName, // Display name (unsanitized for UI)
        protocol: entrypoint.protocol,
        containerPort: entrypoint.containerPort,
        description: entrypoint.description,
        exposedToSolver: entrypoint.exposedToSolver !== false, // Default true
        proxyPath,
        connectionUrl,
        sshCommand,
      });
    }

    return validEntrypoints;
  }

  /**
   * Get machine status from environment machine
   */
  private getMachineStatus(envMachine: EnvironmentMachine): string {
    if (!envMachine.taskArn) {
      return 'pending';
    }
    if (!envMachine.privateIp) {
      return 'starting';
    }
    return 'running';
  }

  /**
   * Sanitize machine name for URL paths
   * SECURITY: Prevent path traversal and injection attacks
   */
  private sanitizeName(name: string): string {
    // Remove all non-alphanumeric characters except hyphens and underscores
    // Convert to lowercase for consistency
    return name
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/--+/g, '-') // Replace multiple hyphens with single
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
  }
}
