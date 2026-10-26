import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { DEFAULT_ROLES, type JwtPayload, ROLES_KEY } from '@common';
import { AuditLogsController } from '@/modules/audit-logs/audit-logs.controller';
import { AuditLogsService } from '@/modules/audit-logs/audit-logs.service';

describe('AuditLogsController', () => {
   let controller: AuditLogsController;
   let reflector: Reflector;
   const mockAuditLogsService = {
      getAuditLogs: jest.fn(),
      getAuditLogById: jest.fn(),
   };
   const mockUser: JwtPayload = {
      sub: 'user-admin-1',
      email: 'admin@example.com',
      roles: [DEFAULT_ROLES.ADMIN],
   };

   beforeEach(async () => {
      jest.clearAllMocks();

      const module: TestingModule = await Test.createTestingModule({
         controllers: [AuditLogsController],
         providers: [
            Reflector,
            {
               provide: AuditLogsService,
               useValue: mockAuditLogsService,
            },
         ],
      }).compile();

      controller = module.get<AuditLogsController>(AuditLogsController);
      reflector = module.get<Reflector>(Reflector);
   });

   it('should be defined', () => {
      expect(controller).toBeDefined();
   });

   describe('security & authorization decorators', () => {
      it('should have RequireRoles decorator demanding ADMIN role on getAuditLogs', () => {
         const roles = reflector.get<string[]>(ROLES_KEY, controller.getAuditLogs);
         expect(roles).toBeDefined();
         expect(roles).toEqual([DEFAULT_ROLES.ADMIN]);
      });

      it('should have RequireRoles decorator demanding ADMIN role on getAuditLogById', () => {
         const roles = reflector.get<string[]>(ROLES_KEY, controller.getAuditLogById);
         expect(roles).toBeDefined();
         expect(roles).toEqual([DEFAULT_ROLES.ADMIN]);
      });
   });

   describe('getAuditLogs', () => {
      it('should get audit logs list for authorized caller', async () => {
         const mockResult = {
            data: [{ id: 'audit-1', action: 'AUTH.LOGIN_SUCCESS' }],
            total: 1,
            page: 1,
            limit: 10,
            totalPages: 1,
         };
         mockAuditLogsService.getAuditLogs.mockResolvedValue(mockResult);

         const result = await controller.getAuditLogs({ page: 1, limit: 10 }, mockUser);
         expect(mockAuditLogsService.getAuditLogs).toHaveBeenCalledWith({ page: 1, limit: 10 }, mockUser);
         expect(result).toEqual(mockResult);
      });
   });

   describe('getAuditLogById', () => {
      it('should get audit log by ID for authorized caller', async () => {
         const mockLog = { id: 'audit-1', action: 'AUTH.LOGIN_SUCCESS' };
         mockAuditLogsService.getAuditLogById.mockResolvedValue(mockLog);

         const result = await controller.getAuditLogById('audit-1', mockUser);
         expect(mockAuditLogsService.getAuditLogById).toHaveBeenCalledWith('audit-1', mockUser);
         expect(result).toEqual(mockLog);
      });
   });
});
