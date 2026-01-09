import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

interface DeploymentProgressUpdate {
  deploymentId: string;
  status: string;
  progress?: any;
  networkInterfaces?: any[];
  estimatedCostPerHour?: number;
}

@WebSocketGateway({
  cors: {
    origin: '*', // TODO: Restrict to frontend URL in production
  },
  namespace: '/test-deployments',
})
export class TestDeploymentGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TestDeploymentGateway.name);
  private deploymentSubscriptions = new Map<string, Set<string>>(); // deploymentId -> Set<socketId>

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);

    // Remove client from all subscriptions
    for (const [deploymentId, subscribers] of this.deploymentSubscriptions.entries()) {
      subscribers.delete(client.id);
      if (subscribers.size === 0) {
        this.deploymentSubscriptions.delete(deploymentId);
      }
    }
  }

  /**
   * Subscribe to deployment progress updates
   */
  @SubscribeMessage('subscribe')
  handleSubscribe(
    @MessageBody() data: { deploymentId: string },
    @ConnectedSocket() client: Socket,
  ): void {
    const { deploymentId } = data;

    if (!this.deploymentSubscriptions.has(deploymentId)) {
      this.deploymentSubscriptions.set(deploymentId, new Set());
    }

    this.deploymentSubscriptions.get(deploymentId)!.add(client.id);

    this.logger.log(`Client ${client.id} subscribed to deployment ${deploymentId}`);

    // Send acknowledgment
    client.emit('subscribed', { deploymentId });
  }

  /**
   * Unsubscribe from deployment progress updates
   */
  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @MessageBody() data: { deploymentId: string },
    @ConnectedSocket() client: Socket,
  ): void {
    const { deploymentId } = data;

    const subscribers = this.deploymentSubscriptions.get(deploymentId);
    if (subscribers) {
      subscribers.delete(client.id);

      if (subscribers.size === 0) {
        this.deploymentSubscriptions.delete(deploymentId);
      }

      this.logger.log(`Client ${client.id} unsubscribed from deployment ${deploymentId}`);
    }

    // Send acknowledgment
    client.emit('unsubscribed', { deploymentId });
  }

  /**
   * Send progress update to all subscribed clients
   */
  sendProgressUpdate(deploymentId: string, update: DeploymentProgressUpdate): void {
    const subscribers = this.deploymentSubscriptions.get(deploymentId);

    if (!subscribers || subscribers.size === 0) {
      return; // No subscribers for this deployment
    }

    this.logger.log(
      `Sending progress update for deployment ${deploymentId} to ${subscribers.size} clients`,
    );

    // Emit to all subscribed clients
    for (const socketId of subscribers) {
      const client = this.server.sockets.sockets.get(socketId);
      if (client) {
        client.emit('progress', update);
      }
    }
  }

  /**
   * Send deployment completion notification
   */
  sendDeploymentComplete(deploymentId: string, success: boolean, message?: string): void {
    const subscribers = this.deploymentSubscriptions.get(deploymentId);

    if (!subscribers || subscribers.size === 0) {
      return;
    }

    this.logger.log(`Deployment ${deploymentId} ${success ? 'succeeded' : 'failed'}`);

    for (const socketId of subscribers) {
      const client = this.server.sockets.sockets.get(socketId);
      if (client) {
        client.emit('deploymentComplete', {
          deploymentId,
          success,
          message,
        });
      }
    }
  }

  /**
   * Send deployment cleanup notification
   */
  sendDeploymentCleaned(deploymentId: string): void {
    const subscribers = this.deploymentSubscriptions.get(deploymentId);

    if (!subscribers || subscribers.size === 0) {
      return;
    }

    this.logger.log(`Deployment ${deploymentId} cleaned up`);

    for (const socketId of subscribers) {
      const client = this.server.sockets.sockets.get(socketId);
      if (client) {
        client.emit('deploymentCleaned', { deploymentId });
      }
    }
  }
}
