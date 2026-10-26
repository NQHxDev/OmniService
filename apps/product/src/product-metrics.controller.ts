import { Controller, Get, Header, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ProductMetricsService } from '@product/services/product-metrics.service';

@Controller('metrics')
export class ProductMetricsController {
   constructor(private readonly metricsService: ProductMetricsService) {}

   @Get()
   @Header('Cache-Control', 'no-cache, no-store, must-revalidate')
   async getMetrics(@Res() res: Response): Promise<void> {
      res.setHeader('Content-Type', this.metricsService.getContentType());
      const metrics = await this.metricsService.getMetrics();
      res.send(metrics);
   }
}
