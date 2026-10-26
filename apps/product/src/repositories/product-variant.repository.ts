import { Injectable } from '@nestjs/common';
import { PrismaService } from '@product/prisma';
import { ProductVariantEntity } from '@product/entities';
import type { Prisma } from '@product/prisma-client';
import type {
   CreateVariantInput,
   IProductVariantRepository,
   UpdateVariantInput,
} from './product-variant.repository.interface';

@Injectable()
export class ProductVariantRepository implements IProductVariantRepository {
   constructor(private readonly prisma: PrismaService) {}

   private mapToEntity(v: Record<string, unknown>): ProductVariantEntity {
      return {
         variantId: v.variantId as string,
         productId: v.productId as string,
         sku: v.sku as string,
         variantName: v.variantName as string,
         unit: v.unit as string,
         packSize: (v.packSize as string) || null,
         price: Number(v.price),
         originalPrice: v.originalPrice ? Number(v.originalPrice) : null,
         currency: v.currency as string,
         stockQuantity: v.stockQuantity as number,
         reservedQuantity: v.reservedQuantity as number,
         lowStockThreshold: v.lowStockThreshold as number,
         isDefault: v.isDefault as boolean,
         status: v.status as string,
         version: v.version as number,
         deletedAt: (v.deletedAt as Date) || null,
         createdAt: v.createdAt as Date,
         updatedAt: v.updatedAt as Date,
      };
   }

   async findById(variantId: string): Promise<ProductVariantEntity | null> {
      const found = await this.prisma.productVariant.findFirst({
         where: { variantId, deletedAt: null },
      });
      return found ? this.mapToEntity(found) : null;
   }

   async findByIds(variantIds: string[]): Promise<ProductVariantEntity[]> {
      if (!variantIds.length) {
         return [];
      }
      const found = await this.prisma.productVariant.findMany({
         where: {
            variantId: { in: variantIds },
            deletedAt: null,
         },
      });
      return found.map((f) => this.mapToEntity(f as unknown as Record<string, unknown>));
   }

   async findBySku(sku: string): Promise<ProductVariantEntity | null> {
      const found = await this.prisma.productVariant.findFirst({
         where: { sku, deletedAt: null },
      });
      return found ? this.mapToEntity(found) : null;
   }

   async findByProductId(productId: string): Promise<ProductVariantEntity[]> {
      const found = await this.prisma.productVariant.findMany({
         where: { productId, deletedAt: null },
         orderBy: { isDefault: 'desc' },
      });
      return found.map((f) => this.mapToEntity(f as unknown as Record<string, unknown>));
   }

   async create(input: CreateVariantInput): Promise<ProductVariantEntity> {
      const created = await this.prisma.productVariant.create({
         data: {
            variantId: input.variantId,
            productId: input.productId,
            sku: input.sku,
            variantName: input.variantName,
            unit: input.unit,
            packSize: input.packSize,
            price: input.price,
            originalPrice: input.originalPrice,
            currency: input.currency || 'VND',
            stockQuantity: input.stockQuantity,
            lowStockThreshold: input.lowStockThreshold ?? 10,
            isDefault: input.isDefault ?? false,
            status: input.status || 'AVAILABLE',
         },
      });
      return this.mapToEntity(created);
   }

   async createMany(inputs: CreateVariantInput[]): Promise<ProductVariantEntity[]> {
      const results: ProductVariantEntity[] = [];
      for (const input of inputs) {
         const res = await this.create(input);
         results.push(res);
      }
      return results;
   }

   async update(variantId: string, input: UpdateVariantInput): Promise<ProductVariantEntity> {
      const data: Prisma.ProductVariantUpdateInput = {
         ...input,
         version: { increment: 1 },
      };
      const updated = await this.prisma.productVariant.update({
         where: { variantId },
         data,
      });
      return this.mapToEntity(updated);
   }

   async adjustStock(variantId: string, quantityDelta: number): Promise<ProductVariantEntity> {
      const updated = await this.prisma.productVariant.update({
         where: { variantId },
         data: {
            stockQuantity: { increment: quantityDelta },
            version: { increment: 1 },
         },
      });
      return this.mapToEntity(updated);
   }

   async reserveStock(variantId: string, quantity: number): Promise<ProductVariantEntity | null> {
      const current = await this.findById(variantId);
      if (!current || current.stockQuantity < quantity) {
         return null;
      }
      const updated = await this.prisma.productVariant.update({
         where: { variantId },
         data: {
            stockQuantity: { decrement: quantity },
            reservedQuantity: { increment: quantity },
            version: { increment: 1 },
         },
      });
      return this.mapToEntity(updated);
   }

   async releaseStock(variantId: string, quantity: number): Promise<ProductVariantEntity> {
      const updated = await this.prisma.productVariant.update({
         where: { variantId },
         data: {
            stockQuantity: { increment: quantity },
            reservedQuantity: { decrement: quantity },
            version: { increment: 1 },
         },
      });
      return this.mapToEntity(updated);
   }
}
