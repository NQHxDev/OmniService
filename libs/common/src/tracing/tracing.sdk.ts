import { NodeSDK } from '@opentelemetry/sdk-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { GrpcInstrumentation } from '@opentelemetry/instrumentation-grpc';
import { AmqplibInstrumentation } from '@opentelemetry/instrumentation-amqplib';
import { TraceExporterFactory } from '@common/tracing/strategies/trace-exporter.strategy';
import { SHUTDOWN_SIGNALS, TraceExporterType, TRACING_DEFAULTS } from '@common/tracing/tracing.constants';
import { validateTracingEnv } from '@common/config';

export interface ITracingSdkOptions {
   serviceName: string;
   serviceVersion?: string;
   endpoint?: string;
   enabled?: boolean;
   exporterType?: TraceExporterType;
}

/**
 * Singleton Pattern: TracingSDK manages the OpenTelemetry NodeSDK lifecycle.
 * Ensures the SDK is initialized only once per process, configuring auto-instrumentation
 * and graceful process termination handlers.
 *
 * All environment variables are validated through Zod (validateTracingEnv) rather
 * than accessing raw process.env.
 */
export class TracingSDK {
   private static instance: TracingSDK | null = null;
   private sdk: NodeSDK | null = null;
   private isInitialized = false;

   private constructor(private readonly options: ITracingSdkOptions) {}

   /**
    * Initializes or retrieves the singleton TracingSDK instance.
    */
   public static init(options: ITracingSdkOptions): TracingSDK {
      if (TracingSDK.instance) {
         return TracingSDK.instance;
      }

      const instance = new TracingSDK(options);
      instance.start();
      TracingSDK.instance = instance;
      return instance;
   }

   /**
    * Returns the active singleton instance, if initialized.
    */
   public static getInstance(): TracingSDK | null {
      return TracingSDK.instance;
   }

   private start(): void {
      if (this.isInitialized) {
         return;
      }

      // Validated strictly via Zod
      const validatedEnv = validateTracingEnv(process.env);

      const enabled =
         this.options.enabled !== undefined
            ? this.options.enabled
            : validatedEnv.OTEL_ENABLED && validatedEnv.NODE_ENV !== 'test';

      const serviceName = this.options.serviceName || validatedEnv.SERVICE_NAME;
      const serviceVersion = this.options.serviceVersion || String(TRACING_DEFAULTS.DEFAULT_VERSION);
      const endpoint = this.options.endpoint || validatedEnv.OTEL_EXPORTER_OTLP_ENDPOINT;
      const exporterType: TraceExporterType = this.options.exporterType || validatedEnv.OTEL_EXPORTER_TYPE;

      const exporterStrategy = TraceExporterFactory.createStrategy({
         enabled,
         endpoint,
         exporterType,
      });

      const resource = resourceFromAttributes({
         [ATTR_SERVICE_NAME]: serviceName,
         [ATTR_SERVICE_VERSION]: serviceVersion,
         'deployment.environment': validatedEnv.NODE_ENV,
      });

      this.sdk = new NodeSDK({
         resource,
         traceExporter: exporterStrategy.createExporter(),
         instrumentations: [
            new HttpInstrumentation({
               ignoreIncomingRequestHook: (req) => {
                  const url = req.url || '';
                  return url.includes('/health') || url === '/';
               },
            }),
            new ExpressInstrumentation(),
            new NestInstrumentation(),
            new IORedisInstrumentation(),
            new GrpcInstrumentation(),
            new AmqplibInstrumentation(),
         ],
      });

      try {
         this.sdk.start();
         this.isInitialized = true;
         this.registerProcessHandlers();
      } catch {
         // Silently fail or ignore in environments where tracing fails to bind
      }
   }

   private registerProcessHandlers(): void {
      const shutdownHandler = () => {
         void this.shutdown();
      };

      for (const signal of SHUTDOWN_SIGNALS) {
         process.once(signal, shutdownHandler);
      }
   }

   /**
    * Gracefully flushes remaining spans and shuts down the SDK.
    */
   public async shutdown(): Promise<void> {
      if (this.sdk) {
         try {
            await this.sdk.shutdown();
         } catch {
            // Ignore shutdown errors during exit
         } finally {
            this.sdk = null;
            this.isInitialized = false;
            TracingSDK.instance = null;
         }
      }
   }
}
