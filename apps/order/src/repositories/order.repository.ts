import { Injectable } from '@nestjs/common';
import { PrismaService } from '@order/prisma/prisma.service';
import type { OrderStatusEnum, PaymentStatusEnum } from '@order/prisma-client';
import type { CreateOrderData, OrderWithItems } from '@order/entities/order.entity';
import type { IOrderRepository } from '@order/repositories/order.repository.interface';

@Injectable()
export class OrderRepository implements IOrderRepository {
   constructor(private readonly prisma: PrismaService) {}

   async create(data: CreateOrderData): Promise<OrderWithItems> {
      return this.prisma.order.create({
         data: {
            userId: data.userId,
            orderNumber: data.orderNumber,
            orderStatus: data.orderStatus,
            paymentMethod: data.paymentMethod,
            paymentStatus: data.paymentStatus,
            totalAmount: data.totalAmount,
            shippingFee: data.shippingFee,
            shippingAddress: data.shippingAddress,
            receiverName: data.receiverName,
            receiverPhone: data.receiverPhone,
            note: data.note,
            items: {
               create: data.items.map((item) => ({
                  productId: item.productId,
                  productName: item.productName,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  totalPrice: item.totalPrice,
               })),
            },
         },
         include: { items: true },
      });
   }

   async findById(orderId: string): Promise<OrderWithItems | null> {
      return this.prisma.order.findUnique({
         where: { orderId },
         include: { items: true },
      });
   }

   async findByOrderNumber(orderNumber: string): Promise<OrderWithItems | null> {
      return this.prisma.order.findUnique({
         where: { orderNumber },
         include: { items: true },
      });
   }

   async findByUserId(
      userId: string,
      page: number,
      limit: number,
   ): Promise<{ orders: OrderWithItems[]; total: number }> {
      const skip = (page - 1) * limit;
      const [orders, total] = await Promise.all([
         this.prisma.order.findMany({
            where: { userId },
            include: { items: true },
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
         }),
         this.prisma.order.count({ where: { userId } }),
      ]);

      return { orders, total };
   }

   async updateStatus(
      orderId: string,
      status: OrderStatusEnum,
      paymentStatus?: PaymentStatusEnum,
   ): Promise<OrderWithItems> {
      return this.prisma.order.update({
         where: { orderId },
         data: {
            orderStatus: status,
            ...(paymentStatus ? { paymentStatus } : {}),
         },
         include: { items: true },
      });
   }

   async cancel(orderId: string, reason?: string): Promise<OrderWithItems> {
      return this.prisma.order.update({
         where: { orderId },
         data: {
            orderStatus: 'CANCELLED',
            ...(reason ? { note: reason } : {}),
         },
         include: { items: true },
      });
   }
}
