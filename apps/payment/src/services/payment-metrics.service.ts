import { Injectable, Optional } from '@nestjs/common';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';
import type { IGrpcMetricsCollector } from '@common';

export const PAYMENT_METRICS_SERVICE = Symbol('PAYMENT_METRICS_SERVICE');

@Injectable()
export class PaymentMetricsService implements IGrpcMetricsCollector {
   private readonly registry: Registry;
   private readonly grpcRequestsCounter: Counter<string>;
   private readonly grpcDurationHistogram: Histogram<string>;
   private readonly paymentsCounter: Counter<string>;

   constructor(@Optional() customRegistry?: Registry) {
      this.registry = customRegistry || new Registry();

      collectDefaultMetrics({
         register: this.registry,
         prefix: 'payment_',
      });

      this.grpcRequestsCounter = new Counter({
         name: 'payment_grpc_requests_total',
         help: 'Total number of gRPC requests handled by Payment Service',
         labelNames: ['service', 'method', 'status'],
         registers: [this.registry],
      });

      this.grpcDurationHistogram = new Histogram({
         name: 'payment_grpc_request_duration_seconds',
         help: 'Duration of gRPC requests handled by Payment Service',
         labelNames: ['service', 'method', 'status'],
         buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
         registers: [this.registry],
      });

      this.paymentsCounter = new Counter({
         name: 'payment_transactions_total',
         help: 'Total number of payment transactions processed',
         labelNames: ['method', 'status'],
         registers: [this.registry],
      });
   }

   recordGrpcCall(params: { service: string; method: string; status: string; durationSeconds: number }): void {
      this.grpcRequestsCounter.inc({
         service: params.service,
         method: params.method,
         status: params.status,
      });
      this.grpcDurationHistogram.observe(
         {
            service: params.service,
            method: params.method,
            status: params.status,
         },
         params.durationSeconds,
      );
   }

   recordPaymentEvent(method: string, status: string): void {
      this.paymentsCounter.inc({ method, status });
   }

   async getMetrics(): Promise<string> {
      return this.registry.metrics();
   }

   getContentType(): string {
      return this.registry.contentType;
   }
}
