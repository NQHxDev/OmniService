import { Global, Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { AppLogger, DEFAULT_PINO_REDACT_OPTIONS, uuidv7 } from '@common';
import { ProductConfigModule, ProductConfigService } from '@product/config';

interface RabbitMQContext {
   queue?: string;
   pattern?: string;
   correlationId?: string;
   userId?: string;
   action?: string;
}

interface ExtendedError extends Error {
   type?: string;
   code?: string | number;
   statusCode?: number;
   status?: number;
   params?: Record<string, unknown>;
}

@Global()
@Module({
   imports: [
      ProductConfigModule,
      PinoLoggerModule.forRootAsync({
         imports: [ProductConfigModule],
         inject: [ProductConfigService],
         useFactory: (config: ProductConfigService) => {
            const nodeEnv = config.nodeEnv;
            const isProduction = config.isProduction;
            const isDevelopment = config.isDevelopment;
            const serviceName = config.serviceName;
            const logLevel = config.logLevel;

            let logFilePath: string | undefined;
            if (isDevelopment) {
               const logsDir = join(process.cwd(), 'apps/product/logs');
               logFilePath = join(logsDir, 'product.log');

               if (!existsSync(logsDir)) {
                  mkdirSync(logsDir, { recursive: true });
               }

               if (existsSync(logFilePath)) {
                  writeFileSync(logFilePath, '');
               }
            }

            return {
               pinoHttp: {
                  level: logLevel,
                  base: {
                     service: serviceName,
                     env: nodeEnv,
                  },
                  genReqId: () => uuidv7(),
                  customProps: (req: unknown) => {
                     const context = req as RabbitMQContext;
                     const correlationId = context?.correlationId || uuidv7();
                     const userId = context?.userId;
                     const action = context?.action;
                     const pattern = context?.pattern;

                     return {
                        correlationId,
                        ...(userId ? { userId } : {}),
                        ...(action ? { action } : {}),
                        ...(pattern ? { pattern } : {}),
                     };
                  },
                  customAttributeKeys: {
                     req: 'context',
                     res: 'result',
                     err: 'error',
                     responseTime: 'durationMs',
                  },
                  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
                  redact: DEFAULT_PINO_REDACT_OPTIONS,
                  transport:
                     isDevelopment && logFilePath
                        ? {
                             targets: [
                                {
                                   target: 'pino-pretty',
                                   level: logLevel,
                                   options: {
                                      colorize: true,
                                      singleLine: true,
                                      translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
                                      ignore: 'pid,hostname',
                                   },
                                },
                                {
                                   target: 'pino/file',
                                   level: logLevel,
                                   options: {
                                      destination: logFilePath,
                                      mkdir: true,
                                   },
                                },
                             ],
                          }
                        : !isProduction
                          ? {
                               target: 'pino-pretty',
                               options: {
                                  colorize: true,
                                  singleLine: true,
                                  translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
                                  ignore: 'pid,hostname',
                               },
                            }
                          : undefined,
                  serializers: {
                     context(rawContext: unknown) {
                        const ctx = rawContext as RabbitMQContext;
                        return {
                           pattern: ctx?.pattern,
                           queue: ctx?.queue,
                           correlationId: ctx?.correlationId,
                           ...(ctx?.userId ? { userId: ctx.userId } : {}),
                           ...(ctx?.action ? { action: ctx.action } : {}),
                        };
                     },
                     result(rawResult: unknown) {
                        if (rawResult && typeof rawResult === 'object') {
                           return {
                              success: true,
                              type: (rawResult as Record<string, unknown>).constructor?.name || 'Object',
                           };
                        }
                        return rawResult;
                     },
                     error(rawErr: unknown) {
                        const err = rawErr as ExtendedError;
                        return {
                           type: err.type || err.name || 'Error',
                           message: err.message,
                           stack: err.stack,
                           code: err.code,
                           statusCode: err.statusCode || err.status,
                           params: err.params,
                        };
                     },
                  },
               },
            };
         },
      }),
   ],
   providers: [AppLogger],
   exports: [PinoLoggerModule, AppLogger],
})
export class ProductLoggerModule {}
