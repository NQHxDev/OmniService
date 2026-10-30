import { Injectable } from '@nestjs/common';
import { Prisma } from '@order/prisma-client';
import { PrismaService } from '@order/prisma/prisma.service';
import {
   SOLD_ORDER_STATUSES,
   type IGetProductOrderStatsRequest,
   type IGetProductOrderStatsResponse,
} from '@contracts/order';

interface ProductOrderStatsRow {
   product_id: string;
   order_count: bigint;
   sold_count: bigint | null;
}

const MAX_PRODUCT_IDS = 100;

@Injectable()
export class GetProductOrderStatsQueryHandler {
   constructor(private readonly prisma: PrismaService) {}

   /**
    * Aggregates, per product, the number of distinct successfully delivered/completed orders
    * and the total quantity sold.
    */
   async execute(dto: IGetProductOrderStatsRequest): Promise<IGetProductOrderStatsResponse> {
      const productIds = Array.from(new Set(dto.productIds ?? [])).slice(0, MAX_PRODUCT_IDS);
      if (productIds.length === 0) {
         return { stats: [] };
      }

      const statuses = [...SOLD_ORDER_STATUSES] as string[];
      const rows = await this.prisma.$queryRaw<ProductOrderStatsRow[]>(Prisma.sql`
         SELECT oi.product_id::text AS product_id,
                COUNT(DISTINCT oi.order_id) AS order_count,
                SUM(oi.quantity) AS sold_count
         FROM order_items oi
         INNER JOIN orders o ON o.order_id = oi.order_id
         WHERE oi.product_id::text IN (${Prisma.join(productIds)})
           AND o.order_status::text IN (${Prisma.join(statuses)})
           AND o.deleted_at IS NULL
         GROUP BY oi.product_id
      `);

      const byProduct = new Map(rows.map((r) => [r.product_id, r]));
      return {
         stats: productIds.map((productId) => {
            const row = byProduct.get(productId);
            return {
               productId,
               orderCount: Number(row?.order_count ?? 0),
               soldCount: Number(row?.sold_count ?? 0),
            };
         }),
      };
   }
}
