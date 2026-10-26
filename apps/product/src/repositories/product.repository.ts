import { Injectable } from '@nestjs/common';
import { PrismaService } from '@product/prisma';
import { ProductEntity } from '@product/entities';
import type { Prisma } from '@product/prisma-client';
import type {
   CreateProductInput,
   FindProductsParams,
   IProductRepository,
   UpdateProductInput,
} from './product.repository.interface';

@Injectable()
export class ProductRepository implements IProductRepository {
   constructor(private readonly prisma: PrismaService) {}

   private mapToEntity(item: Record<string, unknown>): ProductEntity {
      return {
         productId: item.productId as string,
         supplierId: item.supplierId as string,
         whoCategoryCode: item.whoCategoryCode as string,
         productName: item.productName as string,
         normalizedName: item.normalizedName as string,
         productSlug: item.productSlug as string,
         description: item.description as string,
         origin: (item.origin as string) || null,
         storageCondition: (item.storageCondition as string) || null,
         shelfLifeDays: (item.shelfLifeDays as number) || null,
         images: (item.images as string[]) || [],
         status: item.status as string,
         moderationStatus: item.moderationStatus as string,
         rejectionReason: (item.rejectionReason as string) || null,
         moderatedBy: (item.moderatedBy as string) || null,
         moderatedAt: (item.moderatedAt as Date) || null,
         version: item.version as number,
         deletedAt: (item.deletedAt as Date) || null,
         createdAt: item.createdAt as Date,
         updatedAt: item.updatedAt as Date,
         whoCategory: item.whoCategory as never,
         variants: Array.isArray(item.variants)
            ? item.variants.map((v: Record<string, unknown>) => ({
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
              }))
            : undefined,
      };
   }

   async findById(productId: string): Promise<ProductEntity | null> {
      const found = await this.prisma.product.findFirst({
         where: { productId, deletedAt: null },
         include: {
            whoCategory: true,
            variants: {
               where: { deletedAt: null },
               orderBy: { isDefault: 'desc' },
            },
         },
      });
      return found ? this.mapToEntity(found) : null;
   }

   async findByIds(productIds: string[]): Promise<ProductEntity[]> {
      if (!productIds.length) {
         return [];
      }
      const found = await this.prisma.product.findMany({
         where: {
            productId: { in: productIds },
            deletedAt: null,
         },
         include: {
            whoCategory: true,
            variants: {
               where: { deletedAt: null },
               orderBy: { isDefault: 'desc' },
            },
         },
      });
      return found.map((f) => this.mapToEntity(f as unknown as Record<string, unknown>));
   }

   async findBySlug(productSlug: string): Promise<ProductEntity | null> {
      const found = await this.prisma.product.findFirst({
         where: { productSlug, deletedAt: null },
         include: {
            whoCategory: true,
            variants: {
               where: { deletedAt: null },
            },
         },
      });
      return found ? this.mapToEntity(found) : null;
   }

   async findMany(params: FindProductsParams): Promise<{ items: ProductEntity[]; total: number }> {
      const where: Prisma.ProductWhereInput = {
         deletedAt: null,
      };

      if (params.supplierId) {
         where.supplierId = params.supplierId;
      }
      if (params.whoCategoryCode) {
         where.whoCategoryCode = params.whoCategoryCode;
      }
      if (params.status) {
         where.status = params.status;
      }
      if (params.moderationStatus) {
         where.moderationStatus = params.moderationStatus;
      }
      if (params.search) {
         where.OR = [
            { productName: { contains: params.search, mode: 'insensitive' } },
            { normalizedName: { contains: params.search, mode: 'insensitive' } },
            { description: { contains: params.search, mode: 'insensitive' } },
         ];
      }

      const [items, total] = await Promise.all([
         this.prisma.product.findMany({
            where,
            include: {
               whoCategory: true,
               variants: {
                  where: { deletedAt: null },
                  orderBy: { isDefault: 'desc' },
               },
            },
            take: params.limit ?? 20,
            skip: params.offset ?? 0,
            orderBy: { createdAt: 'desc' },
         }),
         this.prisma.product.count({ where }),
      ]);

      return {
         items: items.map((item) => this.mapToEntity(item as unknown as Record<string, unknown>)),
         total,
      };
   }

   async create(input: CreateProductInput): Promise<ProductEntity> {
      const created = await this.prisma.product.create({
         data: {
            productId: input.productId,
            supplierId: input.supplierId,
            whoCategoryCode: input.whoCategoryCode,
            productName: input.productName,
            normalizedName: input.normalizedName,
            productSlug: input.productSlug,
            description: input.description,
            origin: input.origin,
            storageCondition: input.storageCondition,
            shelfLifeDays: input.shelfLifeDays,
            images: input.images || [],
            status: input.status || 'DRAFT',
            moderationStatus: input.moderationStatus || 'PENDING_APPROVAL',
         },
         include: {
            whoCategory: true,
            variants: true,
         },
      });
      return this.mapToEntity(created);
   }

   async update(productId: string, input: UpdateProductInput): Promise<ProductEntity> {
      const updated = await this.prisma.product.update({
         where: { productId },
         data: {
            ...input,
            version: { increment: 1 },
         },
         include: {
            whoCategory: true,
            variants: {
               where: { deletedAt: null },
            },
         },
      });
      return this.mapToEntity(updated);
   }

   async softDelete(productId: string): Promise<void> {
      await this.prisma.product.update({
         where: { productId },
         data: { deletedAt: new Date() },
      });
   }
}
