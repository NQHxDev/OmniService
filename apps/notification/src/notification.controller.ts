import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { QUEUES, RmqService } from '@common';
import {
   NOTIFICATION_EVENTS,
   NOTIFICATION_PATTERNS,
   SendEmailDto,
   SendOtpEmailDto,
   SendResetPasswordEmailDto,
   SendSupplierWelcomeEmailDto,
   SendVerificationEmailDto,
   SendWelcomeEmailDto,
   SendChangePasswordOtpEmailDto,
} from '@contracts/notification';
import { PRODUCT_EVENTS, type ProductModeratedEventPayload } from '@contracts/product';
import { NotificationService } from '@notification/notification.service';

@Controller()
export class NotificationController {
   private readonly logger = new Logger(NotificationController.name);

   constructor(
      private readonly notificationService: NotificationService,
      private readonly rmqService: RmqService,
   ) {}

   private async handleConsumerMessage<T>(context: RmqContext, handler: () => Promise<T>): Promise<T> {
      try {
         const result = await handler();
         this.rmqService.ack(context);
         return result;
      } catch (error) {
         await this.rmqService.handleError(error, context, { queue: QUEUES.NOTIFICATION });
         throw error;
      }
   }

   @EventPattern(NOTIFICATION_PATTERNS.SEND_EMAIL)
   async sendEmail(@Payload() data: SendEmailDto, @Ctx() context: RmqContext) {
      this.logger.log(`Received sendEmail message for: ${Array.isArray(data.to) ? data.to.join(', ') : data.to}`);
      const eventId = data.eventId || this.rmqService.getEventId(context);
      return this.handleConsumerMessage(context, () => this.notificationService.sendEmail(data, eventId));
   }

   @EventPattern(NOTIFICATION_PATTERNS.SEND_WELCOME_EMAIL)
   async sendWelcomeEmail(@Payload() data: SendWelcomeEmailDto, @Ctx() context: RmqContext) {
      this.logger.log(`Received sendWelcomeEmail message for: ${data.to}`);
      const eventId = data.eventId || this.rmqService.getEventId(context);
      return this.handleConsumerMessage(context, () => this.notificationService.sendWelcomeEmail(data, eventId));
   }

   @EventPattern(NOTIFICATION_PATTERNS.SEND_SUPPLIER_WELCOME_EMAIL)
   async sendSupplierWelcomeEmail(@Payload() data: SendSupplierWelcomeEmailDto, @Ctx() context: RmqContext) {
      this.logger.log(`Received sendSupplierWelcomeEmail message for: ${data.to}`);
      const eventId = data.eventId || this.rmqService.getEventId(context);
      return this.handleConsumerMessage(context, () =>
         this.notificationService.sendSupplierWelcomeEmail(data, eventId),
      );
   }

   @EventPattern(NOTIFICATION_PATTERNS.SEND_VERIFICATION_EMAIL)
   async sendVerificationEmail(@Payload() data: SendVerificationEmailDto, @Ctx() context: RmqContext) {
      this.logger.log(`Received sendVerificationEmail message for: ${data.to}`);
      const eventId = data.eventId || this.rmqService.getEventId(context);
      return this.handleConsumerMessage(context, () => this.notificationService.sendVerificationEmail(data, eventId));
   }

   @EventPattern(NOTIFICATION_PATTERNS.SEND_RESET_PASSWORD_EMAIL)
   async sendResetPasswordEmail(@Payload() data: SendResetPasswordEmailDto, @Ctx() context: RmqContext) {
      this.logger.log(`Received sendResetPasswordEmail message for: ${data.to}`);
      const eventId = data.eventId || this.rmqService.getEventId(context);
      return this.handleConsumerMessage(context, () => this.notificationService.sendResetPasswordEmail(data, eventId));
   }

   @EventPattern(NOTIFICATION_PATTERNS.SEND_OTP_EMAIL)
   async sendOtpEmail(@Payload() data: SendOtpEmailDto, @Ctx() context: RmqContext) {
      this.logger.log(`Received sendOtpEmail message for: ${data.to}`);
      const eventId = data.eventId || this.rmqService.getEventId(context);
      return this.handleConsumerMessage(context, () => this.notificationService.sendOtpEmail(data, eventId));
   }

   @EventPattern(NOTIFICATION_PATTERNS.SEND_CHANGE_PASSWORD_OTP_EMAIL)
   async sendChangePasswordOtpEmail(@Payload() data: SendChangePasswordOtpEmailDto, @Ctx() context: RmqContext) {
      this.logger.log(`Received sendChangePasswordOtpEmail message for: ${data.to}`);
      const eventId = data.eventId || this.rmqService.getEventId(context);
      return this.handleConsumerMessage(context, () =>
         this.notificationService.sendChangePasswordOtpEmail(data, eventId),
      );
   }

   @EventPattern(NOTIFICATION_EVENTS.USER_REGISTERED)
   async handleUserRegistered(
      @Payload() data: { email: string; fullName: string; eventId?: string },
      @Ctx() context: RmqContext,
   ) {
      this.logger.log(`Received USER_REGISTERED event for email: ${data?.email} (${data?.fullName})`);
      const eventId = data.eventId || this.rmqService.getEventId(context);
      return this.handleConsumerMessage(context, () =>
         this.notificationService.sendWelcomeEmail(
            {
               to: data.email,
               fullName: data.fullName,
               eventId,
            },
            eventId,
         ),
      );
   }

   @EventPattern(NOTIFICATION_EVENTS.SUPPLIER_REGISTERED)
   async handleSupplierRegistered(
      @Payload()
      data: {
         email: string;
         accountId?: string;
         role?: string;
         supplierName?: string;
         fullName?: string;
         eventId?: string;
      },
      @Ctx() context: RmqContext,
   ) {
      this.logger.log(`Received SUPPLIER_REGISTERED event for account ${data?.accountId} (${data?.email})`);
      const eventId = data.eventId || this.rmqService.getEventId(context);
      const displayName = data.fullName || data.supplierName || data.email?.split('@')[0] || 'Partner';
      return this.handleConsumerMessage(context, () =>
         this.notificationService.sendSupplierWelcomeEmail(
            {
               to: data.email,
               fullName: displayName,
               supplierName: data.supplierName,
               eventId,
            },
            eventId,
         ),
      );
   }

   @EventPattern(PRODUCT_EVENTS.APPROVED)
   async handleProductApproved(@Payload() data: ProductModeratedEventPayload, @Ctx() context: RmqContext) {
      this.logger.log(`Received PRODUCT_APPROVED event for product ${data?.productId} (${data?.productName})`);
      return this.handleConsumerMessage(context, () => {
         this.logger.log(`Product ${data?.productId} approved by moderator ${data?.moderatedBy}`);
         return Promise.resolve();
      });
   }

   @EventPattern(PRODUCT_EVENTS.REJECTED)
   async handleProductRejected(@Payload() data: ProductModeratedEventPayload, @Ctx() context: RmqContext) {
      this.logger.log(
         `Received PRODUCT_REJECTED event for product ${data?.productId}: reason=${data?.rejectionReason}`,
      );
      return this.handleConsumerMessage(context, () => {
         this.logger.log(`Product ${data?.productId} rejected by moderator ${data?.moderatedBy}`);
         return Promise.resolve();
      });
   }

   @EventPattern(PRODUCT_EVENTS.SUSPENDED)
   async handleProductSuspended(@Payload() data: ProductModeratedEventPayload, @Ctx() context: RmqContext) {
      this.logger.log(
         `Received PRODUCT_SUSPENDED event for product ${data?.productId}: notes=${data?.moderationNotes}`,
      );
      return this.handleConsumerMessage(context, () => {
         this.logger.log(`Product ${data?.productId} suspended by moderator ${data?.moderatedBy}`);
         return Promise.resolve();
      });
   }
}
