import { Injectable, Optional } from '@nestjs/common';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';
import type { IGrpcMetricsCollector } from '@common';

export const ORDER_METRICS_SERVICE = Symbol('ORDER_METRICS_SERVICE');

@Injectable()
export class OrderMetricsService implements IGrpcMetricsCollector {
   private readonly registry: Registry;
   private readonly grpcRequestsCounter: Counter<string>;
   private readonly grpcDurationHistogram: Histogram<string>;
   private readonly ordersCounter: Counter<string>;

   constructor(@Optional() customRegistry?: Registry) {
      this.registry = customRegistry || new Registry();

      collectDefaultMetrics({
         register: this.registry,
         prefix: 'order_',
      });

      this.grpcRequestsCounter = new Counter({
         name: 'order_grpc_requests_total',
         help: 'Total number of gRPC requests handled by Order Service',
         labelNames: ['service', 'method', 'status'],
         registers: [this.registry],
      });

      this.grpcDurationHistogram = new Histogram({
         name: 'order_grpc_request_duration_seconds',
         help: 'Duration of gRPC requests handled by Order Service',
         labelNames: ['service', 'method', 'status'],
         buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
         registers: [this.registry],
      });

      this.ordersCounter = new Counter({
         name: 'order_lifecycle_events_total',
         help: 'Total number of order lifecycle status transitions',
         labelNames: ['status', 'payment_method'],
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

   recordOrderEvent(status: string, paymentMethod: string): void {
      this.ordersCounter.inc({ status, payment_method: paymentMethod });
   }

   async getMetrics(): Promise<string> {
      return this.registry.metrics();
   }

   getContentType(): string {
      return this.registry.contentType;
   }
}
