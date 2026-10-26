import { DiskGuardService } from '@media/modules/transcoding/services/disk-guard.service';
import type { MediaConfigService } from '@media/config';
import * as fs from 'fs';

describe('DiskGuardService', () => {
   let service: DiskGuardService;
   let mockConfigService: jest.Mocked<MediaConfigService>;

   beforeEach(() => {
      mockConfigService = {
         transcodeMinFreeDiskBytes: 10 * 1024 * 1024 * 1024,
      } as unknown as jest.Mocked<MediaConfigService>;

      service = new DiskGuardService(mockConfigService);
   });

   it('should be defined', () => {
      expect(service).toBeDefined();
   });

   describe('getDiskSpace', () => {
      it('should calculate free and total disk space using statfs', async () => {
         jest.spyOn(fs.promises, 'statfs').mockResolvedValueOnce({
            bavail: BigInt(2500000),
            bsize: BigInt(4096),
            blocks: BigInt(10000000),
         } as unknown as fs.StatsFs);

         const info = await service.getDiskSpace('/tmp');
         expect(info.freeBytes).toBe(2500000 * 4096);
         expect(info.totalBytes).toBe(10000000 * 4096);
         expect(info.freeGb).toBeGreaterThan(0);
      });
   });

   describe('hasSufficientSpace', () => {
      it('should return true when free space exceeds required bytes', async () => {
         jest.spyOn(fs.promises, 'statfs').mockResolvedValueOnce({
            bavail: BigInt(10000000),
            bsize: BigInt(4096),
            blocks: BigInt(20000000),
         } as unknown as fs.StatsFs);

         const result = await service.hasSufficientSpace('/tmp', 1024 * 1024 * 1024);
         expect(result).toBe(true);
      });

      it('should return false when free space is below required bytes', async () => {
         jest.spyOn(fs.promises, 'statfs').mockResolvedValueOnce({
            bavail: BigInt(100),
            bsize: BigInt(4096),
            blocks: BigInt(20000000),
         } as unknown as fs.StatsFs);

         const result = await service.hasSufficientSpace('/tmp', 10 * 1024 * 1024 * 1024);
         expect(result).toBe(false);
      });
   });

   describe('assertSufficientDiskSpace', () => {
      it('should throw ServiceUnavailableException when disk space is exhausted', async () => {
         jest.spyOn(fs.promises, 'statfs').mockResolvedValueOnce({
            bavail: BigInt(10),
            bsize: BigInt(4096),
            blocks: BigInt(1000000),
         } as unknown as fs.StatsFs);

         await expect(service.assertSufficientDiskSpace('/tmp', 50 * 1024 * 1024 * 1024)).rejects.toThrow();
      });
   });
});
