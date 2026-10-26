import { Injectable, Optional } from '@nestjs/common';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';
import type { IGrpcMetricsCollector } from '@common';
import {
   PRODUCT_METRICS_BUCKETS,
   PRODUCT_METRICS_HELP,
   PRODUCT_METRICS_LABELS,
   PRODUCT_METRICS_NAMES,
   PRODUCT_METRICS_PREFIX,
} from '@contracts/product';

export const PRODUCT_METRICS_SERVICE = Symbol('PRODUCT_METRICS_SERVICE');

@Injectable()
export class ProductMetricsService implements IGrpcMetricsCollector {
   private readonly registry: Registry;
   private readonly grpcRequestsCounter: Counter<string>;
   private readonly grpcDurationHistogram: Histogram<string>;
   private readonly stockReservationsCounter: Counter<string>;
   private readonly stockAdjustmentsCounter: Counter<string>;

   constructor(@Optional() customRegistry?: Registry) {
      this.registry = customRegistry || new Registry();

      collectDefaultMetrics({
         register: this.registry,
         prefix: PRODUCT_METRICS_PREFIX,
      });

      this.grpcRequestsCounter = new Counter({
         name: PRODUCT_METRICS_NAMES.GRPC_REQUESTS,
         help: PRODUCT_METRICS_HELP.GRPC_REQUESTS,
         labelNames: [PRODUCT_METRICS_LABELS.SERVICE, PRODUCT_METRICS_LABELS.METHOD, PRODUCT_METRICS_LABELS.STATUS],
         registers: [this.registry],
      });

      this.grpcDurationHistogram = new Histogram({
         name: PRODUCT_METRICS_NAMES.GRPC_REQUEST_DURATION,
         help: PRODUCT_METRICS_HELP.GRPC_REQUEST_DURATION,
         labelNames: [PRODUCT_METRICS_LABELS.SERVICE, PRODUCT_METRICS_LABELS.METHOD, PRODUCT_METRICS_LABELS.STATUS],
         buckets: [...PRODUCT_METRICS_BUCKETS.GRPC_REQUEST_DURATION],
         registers: [this.registry],
      });

      this.stockReservationsCounter = new Counter({
         name: PRODUCT_METRICS_NAMES.STOCK_RESERVATIONS,
         help: PRODUCT_METRICS_HELP.STOCK_RESERVATIONS,
         labelNames: [PRODUCT_METRICS_LABELS.ACTION, PRODUCT_METRICS_LABELS.STATUS],
         registers: [this.registry],
      });

      this.stockAdjustmentsCounter = new Counter({
         name: PRODUCT_METRICS_NAMES.STOCK_ADJUSTMENTS,
         help: PRODUCT_METRICS_HELP.STOCK_ADJUSTMENTS,
         labelNames: [PRODUCT_METRICS_LABELS.STATUS],
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

   recordStockReservation(action: 'reserve' | 'release', status: 'success' | 'failed'): void {
      this.stockReservationsCounter.inc({ action, status });
   }

   recordStockAdjustment(status: 'success' | 'failed'): void {
      this.stockAdjustmentsCounter.inc({ status });
   }

   async getMetrics(): Promise<string> {
      return this.registry.metrics();
   }

   getContentType(): string {
      return this.registry.contentType;
   }
}
