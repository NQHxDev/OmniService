import { Controller, Get, Header } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { OrderMetricsService } from '@order/services/order-metrics.service';

@Controller()
export class OrderMetricsController {
   constructor(private readonly metricsService: OrderMetricsService) {}

   @Get('metrics')
   @ApiExcludeEndpoint()
   @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
   async getMetrics(): Promise<string> {
      return this.metricsService.getMetrics();
   }
}
