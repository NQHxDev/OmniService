import { Inject, Injectable } from '@nestjs/common';
import { uuidv7 } from '@common';
import { type SagaStatus, type SagaType } from '@common/saga';
import type {
   CreateSagaInstanceDto,
   CreateSagaStepLogDto,
   ISagaInstance,
   ISagaRepository,
   UpdateSagaOptions,
} from '@common/saga';
import { PrismaService, type PrismaClientOrTransaction } from '@auth/prisma';
import { SagaStatus as PrismaSagaStatus, type Prisma, type SagaInstance } from '@auth/prisma-client';

@Injectable()
export class PrismaSagaRepository implements ISagaRepository {
   constructor(@Inject(PrismaService) private readonly prisma: PrismaClientOrTransaction) {}

   private toInstanceEntity<T>(model: SagaInstance): ISagaInstance<T> {
      return {
         sagaId: model.sagaId,
         sagaType: model.sagaType,
         aggregateId: model.aggregateId,
         currentState: model.currentState,
         currentStep: model.currentStep,
         payload: (model.payload ?? {}) as T,
         retryCount: model.retryCount,
         maxRetries: model.maxRetries,
         timeoutAt: model.timeoutAt,
         lastError: model.lastError,
         createdAt: model.createdAt,
         updatedAt: model.updatedAt,
      };
   }

   async createInstance<T>(dto: CreateSagaInstanceDto<T>): Promise<ISagaInstance<T>> {
      const sagaId = dto.sagaId ?? uuidv7();
      const now = new Date();
      const timeoutMs = dto.timeoutMs ?? 30000;
      const timeoutAt = new Date(now.getTime() + timeoutMs);

      const created = await this.prisma.sagaInstance.create({
         data: {
            sagaId,
            sagaType: dto.sagaType,
            aggregateId: dto.aggregateId,
            currentState: PrismaSagaStatus.STARTED,
            currentStep: null,
            payload: (dto.initialPayload as unknown as Prisma.InputJsonValue) ?? {},
            retryCount: 0,
            maxRetries: dto.maxRetries ?? 3,
            timeoutAt,
         },
      });

      return this.toInstanceEntity<T>(created);
   }

   async findInstanceById<T>(sagaId: string): Promise<ISagaInstance<T> | null> {
      const instance = await this.prisma.sagaInstance.findUnique({
         where: { sagaId },
      });
      return instance ? this.toInstanceEntity<T>(instance) : null;
   }

   async findInstanceByAggregateId<T>(aggregateId: string, sagaType: SagaType): Promise<ISagaInstance<T> | null> {
      const instance = await this.prisma.sagaInstance.findFirst({
         where: { aggregateId, sagaType },
         orderBy: { createdAt: 'desc' },
      });
      return instance ? this.toInstanceEntity<T>(instance) : null;
   }

   async updateInstanceStatus<T>(sagaId: string, status: SagaStatus, options?: UpdateSagaOptions<T>): Promise<void> {
      const data: Prisma.SagaInstanceUpdateInput = {
         currentState: status,
      };

      if (options?.step !== undefined) {
         data.currentStep = options.step;
      }
      if (options?.payload !== undefined) {
         data.payload = options.payload as unknown as Prisma.InputJsonValue;
      }
      if (options?.error !== undefined) {
         data.lastError = options.error;
      }
      if (options?.retryCount !== undefined) {
         data.retryCount = options.retryCount;
      }
      if (options?.timeoutAt !== undefined) {
         data.timeoutAt = options.timeoutAt;
      }

      await this.prisma.sagaInstance.update({
         where: { sagaId },
         data,
      });
   }

   async recordStepLog(dto: CreateSagaStepLogDto): Promise<void> {
      await this.prisma.sagaStepLog.create({
         data: {
            stepLogId: uuidv7(),
            sagaId: dto.sagaId,
            stepName: dto.stepName,
            status: dto.status,
            payload: dto.payload !== undefined ? (dto.payload as unknown as Prisma.InputJsonValue) : undefined,
            error: dto.error ?? null,
            durationMs: dto.durationMs ?? null,
         },
      });
   }

   async findStuckSagas(threshold: Date, limit = 50): Promise<ISagaInstance[]> {
      const terminalStates: PrismaSagaStatus[] = [
         PrismaSagaStatus.COMPLETED,
         PrismaSagaStatus.COMPENSATED,
         PrismaSagaStatus.FAILED,
      ];

      const stuckModels = await this.prisma.sagaInstance.findMany({
         where: {
            currentState: { notIn: terminalStates },
            timeoutAt: { lt: threshold },
         },
         take: limit,
         orderBy: { timeoutAt: 'asc' },
      });

      return stuckModels.map((m) => this.toInstanceEntity(m));
   }
}
