import { Injectable, Logger } from '@nestjs/common';
import { Client, ClientChannel } from 'ssh2';

export interface SshConnection {
  stream: ClientChannel;
  client: Client;
  write: (data: string) => void;
  resize: (rows: number, cols: number) => void;
  close: () => void;
}

@Injectable()
export class SshGatewayService {
  private readonly logger = new Logger(SshGatewayService.name);

  async createSshConnection(
    host: string,
    port: number,
    username: string,
    password: string,
    onData: (data: Buffer) => void,
    onClose: () => void,
  ): Promise<SshConnection> {
    const client = new Client();

    return new Promise<SshConnection>((resolve, reject) => {
      const timeout = setTimeout(() => {
        client.end();
        reject(new Error('SSH connection timeout after 10 seconds'));
      }, 10000);

      client
        .on('ready', () => {
          clearTimeout(timeout);
          this.logger.log(`SSH connection established to ${host}:${port}`);

          client.shell({ term: 'xterm-256color' }, (err, stream) => {
            if (err) {
              client.end();
              reject(err);
              return;
            }

            stream.on('data', (data: Buffer) => {
              onData(data);
            });

            stream.on('close', () => {
              this.logger.log('SSH stream closed');
              client.end();
              onClose();
            });

            stream.stderr.on('data', (data: Buffer) => {
              this.logger.warn(`SSH stderr: ${data.toString()}`);
              onData(data);
            });

            resolve({
              stream,
              client,
              write: (data: string) => {
                stream.write(data);
              },
              resize: (rows: number, cols: number) => {
                stream.setWindow(rows, cols, 0, 0);
              },
              close: () => {
                stream.close();
                client.end();
              },
            });
          });
        })
        .on('error', (err) => {
          clearTimeout(timeout);
          this.logger.error(`SSH connection error: ${err.message}`);
          reject(err);
        })
        .connect({
          host,
          port,
          username,
          password,
          readyTimeout: 10000,
          keepaliveInterval: 5000,
        });
    });
  }
}
