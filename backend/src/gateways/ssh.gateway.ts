import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { SshGatewayService, SshConnection } from '../services/ssh-gateway.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EnvironmentSession } from '../entities/environment-session.entity';
import { EnvironmentMachine } from '../entities/environment-machine.entity';
import { Machine } from '../entities/machine.entity';

@WebSocketGateway({
  namespace: '/ssh',
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
  },
})
export class SshGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(SshGateway.name);
  private connections = new Map<string, SshConnection>();

  constructor(
    private sshGatewayService: SshGatewayService,
    @InjectRepository(EnvironmentSession)
    private sessionRepo: Repository<EnvironmentSession>,
    @InjectRepository(EnvironmentMachine)
    private envMachineRepo: Repository<EnvironmentMachine>,
    @InjectRepository(Machine)
    private machineRepo: Repository<Machine>,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`SSH WebSocket client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    const connection = this.connections.get(client.id);
    if (connection) {
      this.logger.log(`Closing SSH connection for client: ${client.id}`);
      connection.close();
      this.connections.delete(client.id);
    }
  }

  @SubscribeMessage('ssh-connect')
  async handleSshConnect(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      sessionId: string;
      machineId: string;
      username?: string;
      password?: string;
    },
  ) {
    try {
      this.logger.log(
        `SSH connect request for session ${data.sessionId}, machine ${data.machineId}`,
      );

      // Verify session exists and is running
      const session = await this.sessionRepo.findOne({
        where: { id: data.sessionId },
      });

      if (!session) {
        client.emit('ssh-error', { message: 'Session not found' });
        return;
      }

      if (session.status !== 'running') {
        client.emit('ssh-error', {
          message: `Session is ${session.status}, not running`,
        });
        return;
      }

      // Get environment machine (to get private IP)
      const envMachine = await this.envMachineRepo.findOne({
        where: {
          environmentSessionId: data.sessionId,
          id: data.machineId,
        },
      });

      if (!envMachine) {
        client.emit('ssh-error', { message: 'Machine not found in session' });
        return;
      }

      if (!envMachine.privateIp) {
        client.emit('ssh-error', {
          message: 'Machine IP not available yet (still starting)',
        });
        return;
      }

      // Get machine template for entrypoints and credentials
      const machineTemplate = await this.machineRepo.findOne({
        where: { id: envMachine.machineTemplateId },
      });

      if (!machineTemplate) {
        client.emit('ssh-error', { message: 'Machine template not found' });
        return;
      }

      // Find SSH entrypoint
      const entrypoints = machineTemplate.entrypoints || [];
      const sshEntrypoint = entrypoints.find(
        (ep: any) => ep.protocol === 'ssh' || ep.containerPort === 22,
      );

      if (!sshEntrypoint) {
        client.emit('ssh-error', {
          message: 'SSH not available on this machine',
        });
        return;
      }

      // Use machine credentials or provided credentials or defaults
      const username =
        data.username ||
        machineTemplate.sshUsername ||
        'root';
      const password =
        data.password ||
        machineTemplate.sshPassword ||
        'vncpassword';

      this.logger.log(
        `Attempting SSH connection to ${envMachine.privateIp}:${sshEntrypoint.containerPort} as ${username}`,
      );

      // Create SSH connection
      const connection = await this.sshGatewayService.createSshConnection(
        envMachine.privateIp,
        sshEntrypoint.containerPort,
        username,
        password,
        (data: Buffer) => {
          // Send terminal output to client
          client.emit('ssh-data', data.toString('utf-8'));
        },
        () => {
          // SSH connection closed
          this.logger.log(`SSH connection closed for client: ${client.id}`);
          client.emit('ssh-close');
          this.connections.delete(client.id);
        },
      );

      this.connections.set(client.id, connection);
      client.emit('ssh-ready');
      this.logger.log(`SSH connection ready for client: ${client.id}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`SSH connection error: ${errorMessage}`, errorStack);
      client.emit('ssh-error', { message: errorMessage });
    }
  }

  @SubscribeMessage('ssh-data')
  handleSshData(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: string,
  ) {
    const connection = this.connections.get(client.id);
    if (connection) {
      connection.write(data);
    }
  }

  @SubscribeMessage('ssh-resize')
  handleSshResize(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { rows: number; cols: number },
  ) {
    const connection = this.connections.get(client.id);
    if (connection) {
      connection.resize(data.rows, data.cols);
    }
  }

  @SubscribeMessage('ssh-disconnect')
  handleSshDisconnect(@ConnectedSocket() client: Socket) {
    const connection = this.connections.get(client.id);
    if (connection) {
      connection.close();
      this.connections.delete(client.id);
      client.emit('ssh-close');
    }
  }
}
