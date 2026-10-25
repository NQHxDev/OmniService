import { Injectable } from '@nestjs/common';
import { PrismaService } from '@payment/prisma/prisma.service';
import type {
   CreatePaymentRefundData,
   CreatePaymentTransactionData,
   IPaymentRepository,
   UpdatePaymentStatusData,
} from '@payment/repositories/payment.repository.interface';
import { Prisma, type PaymentRefund, type PaymentTransaction } from '@payment/prisma-client';

@Injectable()
export class PaymentRepository implements IPaymentRepository {
   constructor(private readonly prisma: PrismaService) {}

   async create(data: CreatePaymentTransactionData): Promise<PaymentTransaction> {
      return this.prisma.paymentTransaction.create({
         data: {
            orderId: data.orderId,
            userId: data.userId,
            amount: new Prisma.Decimal(data.amount),
            currency: data.currency || 'VND',
            paymentMethod: data.paymentMethod,
            paymentStatus: data.paymentStatus ?? 'PENDING',
            paymentUrl: data.paymentUrl,
            providerTransactionId: data.providerTransactionId,
            metadata: (data.metadata as Prisma.InputJsonValue) ?? undefined,
         },
      });
   }

   async findById(transactionId: string): Promise<PaymentTransaction | null> {
      return this.prisma.paymentTransaction.findUnique({
         where: { transactionId },
         include: { refunds: true },
      });
   }

   async findByOrderId(orderId: string): Promise<PaymentTransaction | null> {
      return this.prisma.paymentTransaction.findFirst({
         where: { orderId },
         orderBy: { createdAt: 'desc' },
         include: { refunds: true },
      });
   }

   async updateStatus(transactionId: string, data: UpdatePaymentStatusData): Promise<PaymentTransaction> {
      return this.prisma.paymentTransaction.update({
         where: { transactionId },
         data: {
            paymentStatus: data.paymentStatus,
            providerTransactionId: data.providerTransactionId ?? undefined,
            failureReason: data.failureReason ?? undefined,
            metadata: (data.metadata as Prisma.InputJsonValue) ?? undefined,
         },
      });
   }

   async createRefund(data: CreatePaymentRefundData): Promise<PaymentRefund> {
      return this.prisma.paymentRefund.create({
         data: {
            transactionId: data.transactionId,
            amount: new Prisma.Decimal(data.amount),
            reason: data.reason,
            status: 'SUCCESS',
         },
      });
   }
}
