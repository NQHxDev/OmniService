import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { TracingSDK } from '@common/tracing/tracing.sdk';
import {
   context,
   propagation,
   trace,
   Context,
   Span,
   SpanOptions,
   SpanStatusCode,
   Tracer,
   AttributeValue,
   isSpanContextValid,
} from '@opentelemetry/api';
import { TRACING_ATTRIBUTES, TRACING_HEADERS, TRACING_SERVICES } from '@common/tracing/tracing.constants';

/**
 * Facade Pattern: TracingService exposes a clean, high-level API over OpenTelemetry
 * for creating spans, extracting/injecting context, and correlating traces.
 */
@Injectable()
export class TracingService implements OnApplicationShutdown {
   private readonly defaultTracer: Tracer;

   async onApplicationShutdown(): Promise<void> {
      const sdk = TracingSDK.getInstance();
      if (sdk) {
         await sdk.shutdown();
      }
   }

   constructor() {
      this.defaultTracer = trace.getTracer(TRACING_SERVICES.TRACER_NAME);
   }

   /**
    * Returns the active tracer or creates a named tracer.
    */
   getTracer(name?: string): Tracer {
      return name ? trace.getTracer(name) : this.defaultTracer;
   }

   /**
    * Returns the active span in the current context, if any.
    */
   getActiveSpan(): Span | undefined {
      return trace.getActiveSpan();
   }

   /**
    * Retrieves the 32-character hexadecimal trace ID of the active span.
    */
   getActiveTraceId(): string | undefined {
      const span = this.getActiveSpan();
      if (!span) return undefined;
      const spanContext = span.spanContext();
      return isSpanContextValid(spanContext) ? spanContext.traceId : undefined;
   }

   /**
    * Retrieves the 16-character hexadecimal span ID of the active span.
    */
   getActiveSpanId(): string | undefined {
      const span = this.getActiveSpan();
      if (!span) return undefined;
      const spanContext = span.spanContext();
      return isSpanContextValid(spanContext) ? spanContext.spanId : undefined;
   }

   /**
    * Executes an async or sync callback within a new active span.
    * Automatically ends the span and records unhandled exceptions.
    */
   async startActiveSpan<T>(
      name: string,
      fn: (span: Span) => Promise<T> | T,
      options?: SpanOptions,
      parentContext?: Context,
   ): Promise<T> {
      const targetContext = parentContext || context.active();
      return this.defaultTracer.startActiveSpan(name, options || {}, targetContext, async (span: Span) => {
         try {
            const result = await fn(span);
            span.setStatus({ code: SpanStatusCode.OK });
            return result;
         } catch (error: unknown) {
            this.recordException(error, span);
            span.setStatus({
               code: SpanStatusCode.ERROR,
               message: error instanceof Error ? error.message : String(error),
            });
            throw error;
         } finally {
            span.end();
         }
      });
   }

   /**
    * Records an exception on a span with proper error attributes.
    */
   recordException(error: unknown, targetSpan?: Span): void {
      const span = targetSpan || this.getActiveSpan();
      if (!span) return;

      if (error instanceof Error) {
         span.recordException(error);
      } else {
         span.recordException({
            name: 'Error',
            message: String(error),
         });
      }
   }

   /**
    * Sets custom attributes on the active or provided span.
    */
   setAttributes(attributes: Record<string, AttributeValue | undefined>, targetSpan?: Span): void {
      const span = targetSpan || this.getActiveSpan();
      if (!span) return;

      for (const [key, value] of Object.entries(attributes)) {
         if (value !== undefined) {
            span.setAttribute(key, value);
         }
      }
   }

   /**
    * Sets business correlation ID on the active span.
    */
   setCorrelationId(correlationId: string, targetSpan?: Span): void {
      this.setAttributes({ [TRACING_ATTRIBUTES.CORRELATION_ID]: correlationId }, targetSpan);
   }

   /**
    * Sets user ID on the active span.
    */
   setUserId(userId: string, targetSpan?: Span): void {
      this.setAttributes({ [TRACING_ATTRIBUTES.USER_ID]: userId }, targetSpan);
   }

   /**
    * Injects the active OpenTelemetry trace context (W3C traceparent, tracestate)
    * into a carrier object (e.g. HTTP headers, AMQP headers, gRPC metadata).
    */
   inject(carrier: Record<string, unknown> = {}, activeContext?: Context): Record<string, unknown> {
      const ctx = activeContext || context.active();
      propagation.inject(ctx, carrier);

      const traceId = this.getActiveTraceId();
      if (traceId && !carrier[TRACING_HEADERS.TRACE_ID]) {
         carrier[TRACING_HEADERS.TRACE_ID] = traceId;
      }

      return carrier;
   }

   /**
    * Extracts trace context from a carrier object and returns the resulting Context.
    */
   extract(carrier: Record<string, unknown>, parentContext?: Context): Context {
      const baseContext = parentContext || context.active();
      return propagation.extract(baseContext, carrier);
   }
}
