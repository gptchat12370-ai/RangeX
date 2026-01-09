import { Injectable, Logger } from '@nestjs/common';
import { spawn, ChildProcess } from 'child_process';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

export type GUIProtocol = 'vnc' | 'rdp' | 'screen-sharing';
export type OSType = 'linux' | 'windows' | 'macos';

interface GUISession {
  sessionId: string;
  osType: OSType;
  protocol: GUIProtocol;
  containerIp: string;
  port: number;
  proxy: ChildProcess;
  localPort: number;
  createdAt: Date;
}

/**
 * Multi-OS GUI Connection Service
 * 
 * Supports browser-based GUI access to:
 * - Linux containers (VNC - port 5900)
 * - Windows containers (RDP - port 3389)
 * - macOS containers (VNC/Screen Sharing - port 5900)
 * 
 * All proxied through WebSocket for browser access
 */
@Injectable()
export class MultiOsGuiService {
  private readonly logger = new Logger(MultiOsGuiService.name);
  private activeSessions = new Map<string, GUISession>();

  /**
   * Create GUI session based on OS type
   */
  async createGUISession(
    sessionId: string,
    osType: OSType,
    containerIp: string
  ): Promise<{ guiUrl: string; protocol: GUIProtocol; credentials?: any }> {
    this.logger.log(`Creating GUI session for ${osType} container: ${sessionId}`);

    let protocol: GUIProtocol;
    let port: number;
    let credentials: any;

    switch (osType) {
      case 'linux':
        protocol = 'vnc';
        port = 5900;
        credentials = await this.getVNCPassword(sessionId);
        break;

      case 'windows':
        protocol = 'rdp';
        port = 3389;
        credentials = await this.getRDPCredentials(sessionId);
        break;

      case 'macos':
        protocol = 'vnc'; // macOS uses VNC for screen sharing
        port = 5900;
        credentials = await this.getVNCPassword(sessionId);
        break;

      default:
        throw new Error(`Unsupported OS type: ${osType}`);
    }

    // Start appropriate proxy
    const localPort = await this.getAvailablePort();
    const proxy = await this.startProxy(protocol, containerIp, port, localPort);

    const session: GUISession = {
      sessionId,
      osType,
      protocol,
      containerIp,
      port,
      proxy,
      localPort,
      createdAt: new Date(),
    };

    this.activeSessions.set(sessionId, session);

    return {
      guiUrl: `https://yourdomain.com/gui/${sessionId}`,
      protocol,
      credentials,
    };
  }

  /**
   * Start protocol-specific proxy
   */
  private async startProxy(
    protocol: GUIProtocol,
    containerIp: string,
    containerPort: number,
    localPort: number
  ): Promise<ChildProcess> {
    let proxy: ChildProcess;

    switch (protocol) {
      case 'vnc':
        // websockify for VNC → WebSocket
        proxy = spawn('websockify', [
          '--web', '/usr/share/novnc',
          `${localPort}`,
          `${containerIp}:${containerPort}`,
        ]);
        this.logger.log(`Started VNC proxy on port ${localPort}`);
        break;

      case 'rdp':
        // Use guacamole-lite or FreeRDP with WebSocket bridge
        proxy = spawn('guacd', [
          '-b', '0.0.0.0',
          '-l', `${localPort}`,
          '-L', 'info',
        ]);
        this.logger.log(`Started RDP proxy on port ${localPort}`);
        break;

      case 'screen-sharing':
        // macOS screen sharing (also VNC-based)
        proxy = spawn('websockify', [
          '--web', '/usr/share/novnc',
          `${localPort}`,
          `${containerIp}:${containerPort}`,
        ]);
        this.logger.log(`Started Screen Sharing proxy on port ${localPort}`);
        break;
    }

    // Handle proxy errors
    proxy.stderr?.on('data', (data) => {
      this.logger.error(`Proxy error: ${data.toString()}`);
    });

    proxy.on('exit', (code) => {
      this.logger.warn(`Proxy exited with code ${code}`);
    });

    return proxy;
  }

  /**
   * Get VNC password from encrypted database
   * Public for controller access to return credentials
   */
  async getVNCPassword(sessionId: string): Promise<{ password: string }> {
    // In production: Fetch from encrypted secrets table
    // For now: Use default VNC password (consol/debian-xfce-vnc default)
    // TODO: Generate per-session password and configure in container
    const password = 'vncpassword'; // Default for consol/debian-xfce-vnc
    
    // Store in DB for later retrieval
    // await this.secretsRepo.save({ sessionId, vncPassword: this.encrypt(password) });

    return { password };
  }

  /**
   * Get RDP credentials for Windows containers
   * Public for controller access to return credentials
   */
  async getRDPCredentials(sessionId: string): Promise<{ username: string; password: string; domain?: string }> {
    // In production: Fetch from encrypted secrets
    // For Windows containers, credentials are set in Dockerfile
    return {
      username: 'Administrator',
      password: await this.getWindowsPassword(sessionId),
      domain: 'WORKGROUP',
    };
  }

  /**
   * Get Windows container password
   */
  private async getWindowsPassword(sessionId: string): Promise<string> {
    // Fetch from encrypted DB or use session-specific password
    const password = this.generateSecurePassword(16);
    // await this.secretsRepo.save({ sessionId, windowsPassword: this.encrypt(password) });
    return password;
  }

  /**
   * Close GUI session
   */
  async closeSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      this.logger.warn(`GUI session not found: ${sessionId}`);
      return;
    }

    this.logger.log(`Closing GUI session: ${sessionId}`);

    // Kill proxy process
    session.proxy.kill('SIGTERM');

    // Wait for graceful shutdown
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Force kill if still running
    if (!session.proxy.killed) {
      session.proxy.kill('SIGKILL');
    }

    this.activeSessions.delete(sessionId);
  }

  /**
   * Get session info
   */
  getSession(sessionId: string): GUISession | undefined {
    return this.activeSessions.get(sessionId);
  }

  /**
   * Helper: Generate secure random password
   */
  private generateSecurePassword(length: number): string {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    const crypto = require('crypto');
    
    for (let i = 0; i < length; i++) {
      const randomIndex = crypto.randomInt(0, charset.length);
      password += charset[randomIndex];
    }
    
    return password;
  }

  /**
   * Helper: Find available local port
   */
  private async getAvailablePort(): Promise<number> {
    const net = require('net');
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      server.listen(0, () => {
        const port = server.address().port;
        server.close(() => resolve(port));
      });
      server.on('error', reject);
    });
  }

  /**
   * Health check: Test if GUI is accessible
   */
  async healthCheck(sessionId: string): Promise<boolean> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return false;

    try {
      // Security: Validate port is in safe range (10000-65535)
      const port = session.localPort;
      if (port < 10000 || port > 65535) {
        this.logger.warn(`Blocked connection to unsafe port: ${port}`);
        return false;
      }
      
      // Try to connect to local proxy port (only localhost)
      const net = require('net');
      const socket = new net.Socket();

      return new Promise((resolve) => {
        socket.setTimeout(3000);
        socket.on('connect', () => {
          socket.destroy();
          resolve(true);
        });
        socket.on('timeout', () => {
          socket.destroy();
          resolve(false);
        });
        socket.on('error', () => {
          resolve(false);
        });
        // SECURITY: Only connect to localhost, never external IPs
        socket.connect(port, '127.0.0.1');
      });
    } catch {
      return false;
    }
  }
}
