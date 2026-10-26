import { Controller, Get, Header } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { PaymentMetricsService } from '@payment/services/payment-metrics.service';

@Controller()
export class PaymentMetricsController {
   constructor(private readonly metricsService: PaymentMetricsService) {}

   @Get('metrics')
   @ApiExcludeEndpoint()
   @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
   async getMetrics(): Promise<string> {
      return this.metricsService.getMetrics();
   }
}
