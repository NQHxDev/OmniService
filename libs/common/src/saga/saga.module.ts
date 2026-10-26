import { DynamicModule, Global, Module, Provider, Type } from '@nestjs/common';
import { SAGA_REPOSITORY, type ISagaRepository } from '@common/saga/saga.interface';
import { InMemorySagaRepository } from '@common/saga/in-memory-saga.repository';
import { PersistentSagaCoordinator } from '@common/saga/persistent-saga-coordinator';
import { SagaRecoveryWorker } from '@common/saga/saga-recovery.worker';

export interface SagaModuleOptions {
   repository?: Type<ISagaRepository> | ISagaRepository;
   enableRecoveryWorker?: boolean;
}

@Global()
@Module({})
export class SagaModule {
   static forRoot(options?: SagaModuleOptions): DynamicModule {
      const providers: Provider[] = [
         PersistentSagaCoordinator,
         ...(options?.enableRecoveryWorker !== false ? [SagaRecoveryWorker] : []),
      ];

      if (options?.repository) {
         if (typeof options.repository === 'function') {
            providers.push({
               provide: SAGA_REPOSITORY,
               useClass: options.repository,
            });
         } else {
            providers.push({
               provide: SAGA_REPOSITORY,
               useValue: options.repository,
            });
         }
      } else {
         providers.push({
            provide: SAGA_REPOSITORY,
            useClass: InMemorySagaRepository,
         });
      }

      return {
         module: SagaModule,
         providers,
         exports: [
            PersistentSagaCoordinator,
            SAGA_REPOSITORY,
            ...(options?.enableRecoveryWorker !== false ? [SagaRecoveryWorker] : []),
         ],
      };
   }

   static forFeature(): DynamicModule {
      return {
         module: SagaModule,
         providers: [PersistentSagaCoordinator],
         exports: [PersistentSagaCoordinator],
      };
   }
}
