import { Injectable, Logger } from '@nestjs/common';

export interface PartitionMaintenanceOptions {
   weeksAhead?: number;
   retentionDays?: number;
}

export interface SqlExecutor {
   $executeRawUnsafe(query: string, ...values: unknown[]): Promise<unknown>;
}

@Injectable()
export class OutboxPartitionMaintenanceService {
   private readonly logger = new Logger(OutboxPartitionMaintenanceService.name);

   /**
    * Builds partition name from date in format 'outbox_events_yYYYYwWW'.
    */
   computePartitionName(date: Date): string {
      const target = new Date(date.valueOf());
      const dayNr = (date.getDay() + 6) % 7;
      target.setDate(target.getDate() - dayNr + 3);
      const firstThursday = target.valueOf();
      target.setMonth(0, 1);
      if (target.getDay() !== 4) {
         target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
      }
      const weekNumber = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
      const year = new Date(firstThursday).getFullYear();
      const paddedWeek = String(weekNumber).padStart(2, '0');
      return `outbox_events_y${year}w${paddedWeek}`;
   }

   /**
    * Executes the PostgreSQL stored procedure maintain_outbox_partitions
    * to ensure seamless weekly partition pre-allocation and retention dropping.
    */
   async runMaintenance(prismaClient: SqlExecutor, options: PartitionMaintenanceOptions = {}): Promise<boolean> {
      const weeksAhead = options.weeksAhead ?? 2;
      const retentionDays = options.retentionDays ?? 14;

      try {
         this.logger.log(
            `Running outbox partition maintenance (weeksAhead=${weeksAhead}, retentionDays=${retentionDays})`,
         );
         await prismaClient.$executeRawUnsafe(`SELECT maintain_outbox_partitions(${weeksAhead}, ${retentionDays});`);
         this.logger.log('Outbox partition maintenance completed successfully');
         return true;
      } catch (err: unknown) {
         const error = err as Error;
         this.logger.warn(`Outbox partition maintenance procedure execution note: ${error.message}`);
         return false;
      }
   }
}
