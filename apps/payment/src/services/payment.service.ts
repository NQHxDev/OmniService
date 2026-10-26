import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { checkOwnershipOrAdmin, checkRoles, DEFAULT_ROLES, SERVICES } from '@common';
import { PAYMENT_EVENTS } from '@contracts/payment';
import type {
   IInitiatePaymentRequest,
   IInitiatePaymentResponse,
   IPaymentTransactionProto,
   IProcessWebhookRequest,
   IProcessWebhookResponse,
   IRefundPaymentRequest,
   IRefundPaymentResponse,
} from '@contracts/payment';
import { PrismaService } from '@payment/prisma/prisma.service';
import { PaymentRepository } from '@payment/repositories/payment.repository';
import { PaymentProviderFactory } from '@payment/providers/payment-provider.factory';
import { PaymentMetricsService } from '@payment/services/payment-metrics.service';
import type { PaymentMethodEnum, PaymentTransaction } from '@payment/prisma-client';

export function mapTransactionToProto(tx: PaymentTransaction): IPaymentTransactionProto {
   return {
      transactionId: tx.transactionId,
      orderId: tx.orderId,
      userId: tx.userId,
      amount: Number(tx.amount),
      currency: tx.currency,
      paymentMethod: tx.paymentMethod,
      paymentStatus: tx.paymentStatus,
      providerTransactionId: tx.providerTransactionId ?? '',
      paymentUrl: tx.paymentUrl ?? '',
      failureReason: tx.failureReason ?? '',
      createdAt: tx.createdAt.toISOString(),
      updatedAt: tx.updatedAt.toISOString(),
   };
}

@Injectable()
export class PaymentService {
   private readonly logger = new Logger(PaymentService.name);

   constructor(
      private readonly prisma: PrismaService,
      private readonly paymentRepository: PaymentRepository,
      private readonly providerFactory: PaymentProviderFactory,
      private readonly metricsService: PaymentMetricsService,
      @Inject(SERVICES.ORDER_SERVICE)
      private readonly orderClient: ClientProxy,
   ) {}

   async initiatePayment(dto: IInitiatePaymentRequest): Promise<IInitiatePaymentResponse> {
      if (!dto.orderId || !dto.userId || dto.amount <= 0) {
         throw new RpcException({
            code: 3, // INVALID_ARGUMENT
            message: 'PAYMENT.INVALID_REQUEST_PARAMETERS',
         });
      }

      const method = dto.paymentMethod as PaymentMethodEnum;
      const provider = this.providerFactory.getProvider(method);

      // Create initial payment transaction in DB
      let transaction = await this.paymentRepository.create({
         orderId: dto.orderId,
         userId: dto.userId,
         amount: dto.amount,
         currency: dto.currency || 'VND',
         paymentMethod: method,
         paymentStatus: 'PENDING',
      });

      // Call payment provider strategy
      const providerResult = await provider.initiatePayment({
         transactionId: transaction.transactionId,
         orderId: dto.orderId,
         userId: dto.userId,
         amount: dto.amount,
         currency: dto.currency || 'VND',
         returnUrl: dto.returnUrl,
         ipAddress: dto.ipAddress,
         orderDescription: dto.orderDescription,
      });

      // Update transaction with URL or provider reference
      if (providerResult.paymentUrl || providerResult.providerTransactionId) {
         transaction = await this.prisma.paymentTransaction.update({
            where: { transactionId: transaction.transactionId },
            data: {
               paymentUrl: providerResult.paymentUrl,
               providerTransactionId: providerResult.providerTransactionId,
            },
         });
      }

      // Record Outbox event for choreography saga
      await this.prisma.outboxEvent.create({
         data: {
            aggregateType: 'Payment',
            aggregateId: transaction.transactionId,
            eventType: PAYMENT_EVENTS.PAYMENT_INITIATED,
            payload: {
               transactionId: transaction.transactionId,
               orderId: transaction.orderId,
               userId: transaction.userId,
               amount: Number(transaction.amount),
               currency: transaction.currency,
               paymentMethod: transaction.paymentMethod,
            },
         },
      });

      // For COD payments, immediately inform Order service that COD payment is confirmed pending delivery
      if (method === 'COD') {
         this.orderClient.emit(PAYMENT_EVENTS.PAYMENT_COD_PENDING, {
            orderId: transaction.orderId,
            transactionId: transaction.transactionId,
            userId: transaction.userId,
            amount: Number(transaction.amount),
            paymentMethod: transaction.paymentMethod,
         });
      }

      this.metricsService.recordPaymentEvent(method, 'INITIATED');
      this.logger.log(`Initiated payment ${transaction.transactionId} for order ${dto.orderId} via ${method}`);

      return {
         transaction: mapTransactionToProto(transaction),
         paymentUrl: providerResult.paymentUrl ?? '',
         requiresRedirect: providerResult.requiresRedirect,
      };
   }

   async getPaymentById(transactionId: string, metadata?: unknown): Promise<IPaymentTransactionProto> {
      const transaction = await this.paymentRepository.findById(transactionId);
      if (!transaction) {
         throw new RpcException({
            code: 5, // NOT_FOUND
            message: 'PAYMENT.TRANSACTION_NOT_FOUND',
         });
      }
      checkOwnershipOrAdmin(metadata, transaction.userId);
      return mapTransactionToProto(transaction);
   }

   async getPaymentByOrderId(orderId: string, metadata?: unknown): Promise<IPaymentTransactionProto> {
      const transaction = await this.paymentRepository.findByOrderId(orderId);
      if (!transaction) {
         throw new RpcException({
            code: 5, // NOT_FOUND
            message: 'PAYMENT.TRANSACTION_NOT_FOUND_FOR_ORDER',
         });
      }
      checkOwnershipOrAdmin(metadata, transaction.userId);
      return mapTransactionToProto(transaction);
   }

   async processWebhook(dto: IProcessWebhookRequest): Promise<IProcessWebhookResponse> {
      const provider = this.providerFactory.getProvider(dto.provider);
      const verifyResult = await provider.verifyWebhook({
         rawPayload: dto.rawPayload,
         signature: dto.signature,
         queryParams: dto.queryParams,
      });

      if (!verifyResult.isValid) {
         this.logger.warn(`Invalid webhook received for provider ${dto.provider}`);
         return {
            success: false,
            message: 'PAYMENT.INVALID_WEBHOOK_SIGNATURE',
            transactionId: '',
            paymentStatus: 'FAILED',
         };
      }

      // Find transaction by transactionId, or providerTransactionId
      let transaction: PaymentTransaction | null = null;
      if (verifyResult.transactionId) {
         transaction = await this.prisma.paymentTransaction.findUnique({
            where: { transactionId: verifyResult.transactionId },
         });
      }
      if (!transaction && verifyResult.providerTransactionId) {
         transaction = await this.prisma.paymentTransaction.findFirst({
            where: { providerTransactionId: verifyResult.providerTransactionId },
         });
      }

      if (!transaction) {
         this.logger.error(`Webhook transaction not found for ID: ${verifyResult.transactionId}`);
         return {
            success: false,
            message: 'PAYMENT.TRANSACTION_NOT_FOUND',
            transactionId: verifyResult.transactionId ?? '',
            paymentStatus: 'FAILED',
         };
      }

      // Prevent redundant status updates if already completed
      if (transaction.paymentStatus === 'SUCCESS') {
         return {
            success: true,
            message: 'PAYMENT.ALREADY_PROCESSED',
            transactionId: transaction.transactionId,
            paymentStatus: transaction.paymentStatus,
         };
      }

      const updated = await this.paymentRepository.updateStatus(transaction.transactionId, {
         paymentStatus: verifyResult.status,
         providerTransactionId: verifyResult.providerTransactionId,
         failureReason: verifyResult.failureReason,
         metadata: verifyResult.metadata,
      });

      if (verifyResult.status === 'SUCCESS') {
         // Emit saga event to notify Order Service
         this.orderClient.emit(PAYMENT_EVENTS.PAYMENT_SUCCEEDED, {
            orderId: updated.orderId,
            transactionId: updated.transactionId,
            userId: updated.userId,
            amount: Number(updated.amount),
            paymentMethod: updated.paymentMethod,
         });

         await this.prisma.outboxEvent.create({
            data: {
               aggregateType: 'Payment',
               aggregateId: updated.transactionId,
               eventType: PAYMENT_EVENTS.PAYMENT_SUCCEEDED,
               payload: {
                  orderId: updated.orderId,
                  transactionId: updated.transactionId,
                  userId: updated.userId,
                  amount: Number(updated.amount),
                  paymentMethod: updated.paymentMethod,
               },
            },
         });

         this.metricsService.recordPaymentEvent(updated.paymentMethod, 'SUCCESS');
         this.logger.log(`Payment ${updated.transactionId} SUCCEEDED for order ${updated.orderId}`);
      } else {
         this.orderClient.emit(PAYMENT_EVENTS.PAYMENT_FAILED, {
            orderId: updated.orderId,
            transactionId: updated.transactionId,
            userId: updated.userId,
            reason: verifyResult.failureReason || 'Payment failed',
         });

         await this.prisma.outboxEvent.create({
            data: {
               aggregateType: 'Payment',
               aggregateId: updated.transactionId,
               eventType: PAYMENT_EVENTS.PAYMENT_FAILED,
               payload: {
                  orderId: updated.orderId,
                  transactionId: updated.transactionId,
                  reason: verifyResult.failureReason,
               },
            },
         });

         this.metricsService.recordPaymentEvent(updated.paymentMethod, 'FAILED');
         this.logger.warn(`Payment ${updated.transactionId} FAILED for order ${updated.orderId}`);
      }

      return {
         success: true,
         message: 'PAYMENT.WEBHOOK_PROCESSED_SUCCESSFULLY',
         transactionId: updated.transactionId,
         paymentStatus: updated.paymentStatus,
      };
   }

   async refundPayment(dto: IRefundPaymentRequest, metadata?: unknown): Promise<IRefundPaymentResponse> {
      checkRoles(metadata, [DEFAULT_ROLES.ADMIN]);

      const transaction = await this.paymentRepository.findById(dto.transactionId);
      if (!transaction) {
         throw new RpcException({
            code: 5,
            message: 'PAYMENT.TRANSACTION_NOT_FOUND',
         });
      }

      if (transaction.paymentStatus !== 'SUCCESS') {
         throw new RpcException({
            code: 9, // FAILED_PRECONDITION
            message: 'PAYMENT.CANNOT_REFUND_NON_SUCCESSFUL_TRANSACTION',
         });
      }

      const provider = this.providerFactory.getProvider(transaction.paymentMethod);
      const refundResult = await provider.refund({
         transactionId: transaction.transactionId,
         providerTransactionId: transaction.providerTransactionId ?? undefined,
         amount: dto.amount,
         reason: dto.reason,
      });

      if (!refundResult.success) {
         throw new RpcException({
            code: 13, // INTERNAL
            message: refundResult.message || 'PAYMENT.REFUND_FAILED',
         });
      }

      const refund = await this.paymentRepository.createRefund({
         transactionId: transaction.transactionId,
         amount: dto.amount,
         reason: dto.reason,
      });

      await this.paymentRepository.updateStatus(transaction.transactionId, {
         paymentStatus: 'REFUNDED',
      });

      this.orderClient.emit(PAYMENT_EVENTS.PAYMENT_REFUNDED, {
         orderId: transaction.orderId,
         transactionId: transaction.transactionId,
         userId: transaction.userId,
         amount: dto.amount,
      });

      await this.prisma.outboxEvent.create({
         data: {
            aggregateType: 'Payment',
            aggregateId: transaction.transactionId,
            eventType: PAYMENT_EVENTS.PAYMENT_REFUNDED,
            payload: {
               orderId: transaction.orderId,
               transactionId: transaction.transactionId,
               refundId: refund.refundId,
               amount: dto.amount,
            },
         },
      });

      this.metricsService.recordPaymentEvent(transaction.paymentMethod, 'REFUNDED');
      this.logger.log(`Refunded ${dto.amount} for payment ${transaction.transactionId}`);

      return {
         success: true,
         message: 'PAYMENT.REFUND_SUCCESS',
         refundId: refund.refundId,
      };
   }
}
