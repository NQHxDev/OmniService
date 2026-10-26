import { DynamicModule, Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import { AppConfigModule, AppConfigService } from '@common/config';
import { RmqService } from '@common/rmq/rmq.service';
import { IRmqQueueOptions } from '@common/rmq/rmq.types';

export interface RmqModuleOptions {
   name: string;
   options?: IRmqQueueOptions;
}

@Module({
   imports: [AppConfigModule],
   providers: [RmqService],
   exports: [RmqService],
})
export class RmqModule {
   static register({ name, options }: RmqModuleOptions): DynamicModule {
      return {
         module: RmqModule,
         imports: [
            ClientsModule.registerAsync([
               {
                  name,
                  imports: [AppConfigModule],
                  useFactory: (config: AppConfigService) => {
                     const rmqService = new RmqService(config);
                     return rmqService.getOptions(name, options);
                  },
                  inject: [AppConfigService],
               },
            ]),
         ],
         exports: [ClientsModule, RmqService],
      };
   }
}
