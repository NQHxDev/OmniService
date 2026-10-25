import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@common';
import { AUTH_ERROR_CODES } from '@contracts/auth';
import { ACCOUNT_REPOSITORY } from '@auth/repositories';
import { AuthAccountService } from '@auth/services/domain/auth-account.service';

describe('AuthAccountService', () => {
   let service: AuthAccountService;

   const mockAccountRepository = {
      findById: jest.fn(),
   };

   beforeEach(async () => {
      jest.clearAllMocks();

      const module: TestingModule = await Test.createTestingModule({
         providers: [
            AuthAccountService,
            {
               provide: ACCOUNT_REPOSITORY,
               useValue: mockAccountRepository,
            },
         ],
      }).compile();

      service = module.get<AuthAccountService>(AuthAccountService);
   });

   it('should be defined', () => {
      expect(service).toBeDefined();
   });

   describe('getEmail', () => {
      it('should return account email and verification status when account exists', async () => {
         mockAccountRepository.findById.mockResolvedValueOnce({
            accountId: 'acc-1',
            email: 'user@example.com',
            isEmailVerified: true,
         });

         const result = await service.getEmail('acc-1');

         expect(result).toEqual({
            accountId: 'acc-1',
            email: 'user@example.com',
            isEmailVerified: true,
         });
         expect(mockAccountRepository.findById).toHaveBeenCalledWith('acc-1');
      });

      it('should throw NotFoundException when account does not exist', async () => {
         mockAccountRepository.findById.mockResolvedValueOnce(null);

         await expect(service.getEmail('non-existent')).rejects.toThrow(NotFoundException);
         await expect(service.getEmail('non-existent')).rejects.toMatchObject({
            message: AUTH_ERROR_CODES.USER_NOT_FOUND,
         });
      });
   });
});
