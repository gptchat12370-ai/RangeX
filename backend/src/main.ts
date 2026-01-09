import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import compression from 'compression';
import * as bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import { CsrfGuard } from './common/guards/csrf.guard';
import { isAllowedOrigin, SECURITY_CONFIG } from './config/security.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Cookie parser for CSRF tokens
  app.use(cookieParser());

  // Increase body size limit to 50MB for large image uploads
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

  // Chrome Private Network Access (PNA) support + Vary header for caching
  app.use((req: any, res: any, next: any) => {
    // Add Vary header for proper cache behavior with dynamic CORS
    res.setHeader('Vary', 'Origin, Access-Control-Request-Private-Network');
    
    // PNA preflight support
    if (req.method === 'OPTIONS' && req.headers['access-control-request-private-network'] === 'true') {
      res.setHeader('Access-Control-Allow-Private-Network', 'true');
    }
    next();
  });

  // Security & Performance Middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "blob:"], // Images via proxy and blob URLs for cropping
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "https:", "'unsafe-inline'"],
        fontSrc: ["'self'", "https:", "data:"],
      },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow images to be loaded cross-origin
  }));
  app.use(compression());

  // CORS with dynamic origin validation (supports LAN IPs in dev)
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    credentials: SECURITY_CONFIG.CORS.CREDENTIALS,
    methods: SECURITY_CONFIG.CORS.METHODS.join(','),
    allowedHeaders: SECURITY_CONFIG.CORS.ALLOWED_HEADERS,
    exposedHeaders: ['X-CSRF-Token', 'Content-Type', 'Content-Length', 'Cache-Control'],
    maxAge: SECURITY_CONFIG.CORS.MAX_AGE,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // Global Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip away non-whitelisted properties
      forbidNonWhitelisted: true, // Throw an error if non-whitelisted properties are provided
      transform: true, // Automatically transform payloads to DTO instances
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // API Prefix
  app.setGlobalPrefix('api');

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`Application is running on: http://0.0.0.0:${port}`);
  console.log(`Application is running on: ${await app.getUrl()}`);
}

bootstrap();
