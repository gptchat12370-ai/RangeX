import {
  All,
  Controller,
  Param,
  Req,
  Res,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EnvironmentSession } from '../entities/environment-session.entity';
import { EnvironmentMachine } from '../entities/environment-machine.entity';
import { Machine, MachineEntrypoint } from '../entities/machine.entity';

@Controller('proxy')
export class ProxyController {
  private readonly logger = new Logger(ProxyController.name);

  constructor(
    @InjectRepository(EnvironmentSession)
    private readonly sessionRepo: Repository<EnvironmentSession>,
    @InjectRepository(EnvironmentMachine)
    private readonly envMachineRepo: Repository<EnvironmentMachine>,
    @InjectRepository(Machine)
    private readonly machineRepo: Repository<Machine>,
  ) {}

  @All(':sessionToken/:machineName/:entrypoint/*')
  async proxyRequest(
    @Param('sessionToken') sessionToken: string,
    @Param('machineName') machineName: string,
    @Param('entrypoint') entrypointName: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      // 1. Validate session token and get session
      const session = await this.sessionRepo.findOne({
        where: { gatewaySessionToken: sessionToken },
        relations: ['machines'],
      });

      if (!session) {
        throw new HttpException('Invalid session token', HttpStatus.UNAUTHORIZED);
      }

      // 2. Check session is running
      if (session.status !== 'running') {
        throw new HttpException(
          `Session is ${session.status}, not running`,
          HttpStatus.FORBIDDEN,
        );
      }

      // 3. Check session not expired
      if (session.expiresAt && new Date() > session.expiresAt) {
        throw new HttpException('Session has expired', HttpStatus.FORBIDDEN);
      }

      // 4. Find machine by name in this session
      const envMachine = await this.envMachineRepo.findOne({
        where: {
          environmentSessionId: session.id,
        },
      });

      if (!envMachine) {
        throw new HttpException(
          `Machine ${machineName} not found in session`,
          HttpStatus.NOT_FOUND,
        );
      }

      // Load the machine template
      const template = await this.machineRepo.findOne({
        where: { id: envMachine.machineTemplateId },
      });

      if (!template) {
        throw new HttpException(
          `Machine template not found`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // Check machine name matches
      if (template.name !== machineName) {
        throw new HttpException(
          `Machine ${machineName} not found in session`,
          HttpStatus.NOT_FOUND,
        );
      }

      // 5. Verify entrypoint exists and is exposed to solver
      const entrypoints = template.entrypoints || [];
      const entrypoint = entrypoints.find(
        (ep: MachineEntrypoint) => ep.protocol === entrypointName || ep.description === entrypointName,
      );

      if (!entrypoint) {
        throw new HttpException(
          `Entrypoint ${entrypointName} not found on machine ${machineName}`,
          HttpStatus.NOT_FOUND,
        );
      }

      if (!entrypoint.exposedToSolver) {
        throw new HttpException(
          `Entrypoint ${entrypointName} is not accessible to solvers`,
          HttpStatus.FORBIDDEN,
        );
      }

      // 6. Get machine private IP
      if (!envMachine.privateIp) {
        throw new HttpException(
          `Machine ${machineName} does not have a private IP yet (still starting)`,
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      // 7. Update last activity timestamp
      session.lastActivityAt = new Date();
      await this.sessionRepo.save(session);

      // 8. Build target URL
      const protocol = entrypoint.protocol === 'https' ? 'https' : 'http';
      const targetUrl = `${protocol}://${envMachine.privateIp}:${entrypoint.containerPort}`;

      this.logger.log(
        `Proxying request to ${targetUrl} for session ${session.id.substring(0, 8)}...`,
      );

      // 9. Create and use proxy middleware
      const proxyOptions: Options = {
        target: targetUrl,
        changeOrigin: true,
        ws: true, // Enable WebSocket support
        pathRewrite: (path) => {
          // Remove the proxy prefix from the path
          const prefix = `/proxy/${sessionToken}/${machineName}/${entrypointName}`;
          return path.replace(prefix, '');
        },
        on: {
          error: (err: Error, req: any, res: any) => {
            this.logger.error(`Proxy error: ${err.message}`);
            if (!res.headersSent) {
              res.writeHead(502, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  error: 'Bad Gateway',
                  message: 'Unable to connect to machine',
                }),
              );
            }
          },
          proxyReq: (proxyReq: any, req: any, res: any) => {
            this.logger.debug(
              `Proxying ${req.method} ${req.url} to ${targetUrl}${proxyReq.path}`,
            );
          },
        },
      };

      const proxy = createProxyMiddleware(proxyOptions);

      // Execute proxy
      proxy(req, res, (err: any) => {
        if (err) {
          this.logger.error(`Proxy middleware error: ${err.message}`);
          if (!res.headersSent) {
            res.status(500).json({
              error: 'Proxy Error',
              message: err.message,
            });
          }
        }
      });
    } catch (error: any) {
      this.logger.error(`Proxy request failed: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }

      if (!res.headersSent) {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Failed to process proxy request',
        });
      }
    }
  }
}
