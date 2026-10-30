import '@/tracing';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import express, { type Request, type Response } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import {
   AllExceptionsFilter,
   ErrorResponseDto,
   TimeoutInterceptor,
   TracingInterceptor,
   TransformInterceptor,
} from '@common';
import { GatewayConfigService } from '@/config';
import { GatewayModule } from '@/gateway.module';

async function bootstrap() {
   const app = await NestFactory.create(GatewayModule, {
      bodyParser: false, // Disable default body parser to set custom limits
      bufferLogs: true,
   });

   app.enableShutdownHooks();

   const logger = app.get(Logger);
   app.useLogger(logger);

   const config = app.get(GatewayConfigService);
   const reflector = app.get(Reflector);
   const port = config.port;
   const globalPrefix = config.globalPrefix;
   const allowedOrigins = config.corsOrigins;

   const isDev = !config.isProduction;

   // Configure body parser with increased limits for base64 file uploads (default is 100kb)
   // 50MB limit allows uploading ~5-10 high-quality images as base64
   app.use(express.json({ limit: '50mb' }));
   app.use(express.urlencoded({ limit: '50mb', extended: true }));

   // Security headers
   app.use(
      helmet({
         crossOriginEmbedderPolicy: false,
         crossOriginResourcePolicy: { policy: 'cross-origin' },
         hsts: isDev ? false : { maxAge: 31536000, includeSubDomains: true },
         contentSecurityPolicy: isDev
            ? false
            : {
                 directives: {
                    defaultSrc: [`'self'`],
                    styleSrc: [`'self'`, `'unsafe-inline'`],
                    imgSrc: [`'self'`, 'data:', 'validator.swagger.io'],
                    scriptSrc: [`'self'`, `'unsafe-inline'`, `'unsafe-eval'`],
                 },
              },
      }),
   );

   // Cookie Parser Middleware
   app.use(cookieParser());

   // CORS Configuration with strict whitelist
   app.enableCors({
      origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
         if (!origin) {
            return callback(null, true);
         }

         if (allowedOrigins.includes(origin)) {
            return callback(null, true);
         }

         // In development mode, allow localhost, IPv6 localhost, LAN IP networks (192.168.x.x, 10.x.x.x, 172.16-31.x.x), and *.local
         if (isDev) {
            const isLocalOrLan =
               /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+|[a-zA-Z0-9-]+\.local)(:\d+)?\/?$/.test(
                  origin,
               );
            if (isLocalOrLan) {
               return callback(null, true);
            }
         }

         logger.warn(`Origin '${origin}' not allowed by CORS whitelist`);
         return callback(null, false);
      },
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
         'Content-Type',
         'Authorization',
         'Accept',
         'X-Requested-With',
         'Cookie',
         'X-Correlation-Id',
         'X-Client-Type',
         'X-Device-Id',
         'X-Refresh-Token',
         'X-App-Version',
         'Idempotency-Key',
         'X-Idempotency-Key',
      ],
      exposedHeaders: ['Set-Cookie', 'X-Correlation-Id'],
      credentials: true,
      maxAge: 86400,
   });

   // Global prefix with exclusions for root probe and health checks
   app.setGlobalPrefix(globalPrefix, {
      exclude: [
         '/',
         'health',
         `${globalPrefix}/health`,
         'health/redis',
         `${globalPrefix}/health/redis`,
         'health/grpc',
         `${globalPrefix}/health/grpc`,
      ],
   });

   // Global filters & interceptors
   app.useGlobalFilters(new AllExceptionsFilter());
   app.useGlobalInterceptors(
      new TracingInterceptor(),
      new TimeoutInterceptor(15000),
      new TransformInterceptor(reflector),
   );

   // Global pipes
   app.useGlobalPipes(
      new ValidationPipe({
         whitelist: true,
         transform: true,
         forbidNonWhitelisted: true,
         transformOptions: {
            enableImplicitConversion: true,
         },
      }),
   );

   // Swagger Documentation Setup
   const swaggerConfig = new DocumentBuilder()
      .setTitle('OmniServices API Gateway')
      .setDescription('Microservices API Gateway documentation...')
      .setVersion('1.0')
      .addBearerAuth()
      .addCookieAuth('access_token', {
         type: 'apiKey',
         in: 'cookie',
         name: 'access_token',
         description: 'HTTP Only JWT access token cookie',
      })
      .build();

   const document = SwaggerModule.createDocument(app, swaggerConfig, {
      extraModels: [ErrorResponseDto],
   });
   SwaggerModule.setup('docs', app, document);

   await app.listen(port);
   logger.log(`API Gateway is running on: http://localhost:${port}/${globalPrefix}`);
   logger.log(`Swagger documentation available at: http://localhost:${port}/docs`);
}

void bootstrap();
