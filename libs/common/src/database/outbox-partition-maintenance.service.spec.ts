import {
   OutboxPartitionMaintenanceService,
   type SqlExecutor,
} from '@common/database/outbox-partition-maintenance.service';

describe('OutboxPartitionMaintenanceService', () => {
   let service: OutboxPartitionMaintenanceService;
   let mockSqlExecutor: SqlExecutor;

   beforeEach(() => {
      service = new OutboxPartitionMaintenanceService();
      mockSqlExecutor = {
         $executeRawUnsafe: jest.fn().mockResolvedValue(1),
      };
   });

   it('should compute valid ISO week partition name', () => {
      const fixedDate = new Date('2026-10-25T12:00:00.000Z');
      const partitionName = service.computePartitionName(fixedDate);
      expect(partitionName).toMatch(/^outbox_events_y\d{4}w\d{2}$/);
      expect(partitionName).toContain('2026');
   });

   it('should execute maintain_outbox_partitions query with parameters', async () => {
      const success = await service.runMaintenance(mockSqlExecutor, {
         weeksAhead: 3,
         retentionDays: 7,
      });

      expect(success).toBe(true);
      expect(mockSqlExecutor.$executeRawUnsafe).toHaveBeenCalledWith('SELECT maintain_outbox_partitions(3, 7);');
   });

   it('should return false gracefully if database stored procedure throws an error', async () => {
      mockSqlExecutor.$executeRawUnsafe = jest.fn().mockRejectedValue(new Error('Function does not exist'));

      const success = await service.runMaintenance(mockSqlExecutor);

      expect(success).toBe(false);
   });
});
