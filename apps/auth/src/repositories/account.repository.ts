import { Inject, Injectable } from '@nestjs/common';
import { uuidv7 } from '@common';
import type { AccountEntity, CreateAccountData } from '@auth/entities/account.entity';
import { PrismaService, type PrismaClientOrTransaction } from '@auth/prisma';
import type { IAccountRepository } from '@auth/repositories/account.repository.interface';
import { AccountStatus, type Account, type Role } from '@auth/prisma-client';

type AccountWithRoles = Account & {
   accountRoles?: Array<{
      role: Role;
   }>;
};

@Injectable()
export class AccountRepository implements IAccountRepository {
   constructor(@Inject(PrismaService) private readonly prisma: PrismaClientOrTransaction) {}

   private toEntity(account: AccountWithRoles): AccountEntity {
      return {
         accountId: account.accountId,
         email: account.email,
         phoneNumber: account.phoneNumber,
         passwordHash: account.passwordHash,
         status: account.status,
         isEmailVerified: account.isEmailVerified,
         lastLoginAt: account.lastLoginAt ? account.lastLoginAt.toISOString() : null,
         version: account.version,
         deletedAt: account.deletedAt ? account.deletedAt.toISOString() : null,
         roles: account.accountRoles ? account.accountRoles.map((ur) => ur.role.code) : [],
         createdAt: account.createdAt.toISOString(),
         updatedAt: account.updatedAt.toISOString(),
      };
   }

   async findByEmail(email: string): Promise<AccountEntity | null> {
      const normalizedEmail = email.toLowerCase().trim();
      const account = await this.prisma.account.findFirst({
         where: {
            email: normalizedEmail,
            deletedAt: null,
         },
         include: {
            accountRoles: {
               include: {
                  role: true,
               },
            },
         },
      });

      return account ? this.toEntity(account) : null;
   }

   async findById(accountId: string): Promise<AccountEntity | null> {
      const account = await this.prisma.account.findFirst({
         where: {
            accountId,
            deletedAt: null,
         },
         include: {
            accountRoles: {
               include: {
                  role: true,
               },
            },
         },
      });

      return account ? this.toEntity(account) : null;
   }

   async findAllEmails(): Promise<string[]> {
      const accounts = await this.prisma.account.findMany({
         where: {
            deletedAt: null,
         },
         select: {
            email: true,
         },
      });

      return accounts.map((a) => a.email);
   }

   async create(data: CreateAccountData): Promise<AccountEntity> {
      const accountId = data.accountId || uuidv7();

      const createdAccount = await this.prisma.account.create({
         data: {
            accountId,
            email: data.email,
            phoneNumber: data.phoneNumber,
            passwordHash: data.passwordHash,
            status: data.status as AccountStatus,
            isEmailVerified: data.isEmailVerified,
            createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
            accountRoles: data.roleId
               ? {
                    create: [
                       {
                          roleId: data.roleId,
                       },
                    ],
                 }
               : undefined,
         },
         include: {
            accountRoles: {
               include: {
                  role: true,
               },
            },
         },
      });

      return this.toEntity(createdAccount);
   }

   async update(accountId: string, data: Partial<AccountEntity>): Promise<AccountEntity | null> {
      try {
         const account = await this.prisma.account.update({
            where: { accountId },
            data: {
               email: data.email,
               phoneNumber: data.phoneNumber,
               passwordHash: data.passwordHash,
               status: data.status as AccountStatus,
               isEmailVerified: data.isEmailVerified,
               lastLoginAt: data.lastLoginAt
                  ? new Date(data.lastLoginAt)
                  : data.lastLoginAt === null
                    ? null
                    : undefined,
               version: data.version,
               deletedAt: data.deletedAt ? new Date(data.deletedAt) : data.deletedAt === null ? null : undefined,
            },
            include: {
               accountRoles: {
                  include: {
                     role: true,
                  },
               },
            },
         });

         return this.toEntity(account);
      } catch {
         return null;
      }
   }

   async softDelete(accountId: string): Promise<boolean> {
      try {
         await this.prisma.account.update({
            where: { accountId },
            data: { deletedAt: new Date() },
         });
         return true;
      } catch {
         return false;
      }
   }

   async delete(accountId: string): Promise<boolean> {
      try {
         await this.prisma.account.delete({
            where: { accountId },
         });
         return true;
      } catch {
         return false;
      }
   }

   async deleteAbortedByEmail(email: string): Promise<number> {
      const normalizedEmail = email.toLowerCase().trim();
      try {
         const result = await this.prisma.account.deleteMany({
            where: {
               email: normalizedEmail,
               status: AccountStatus.REGISTRATION_ABORTED,
            },
         });
         return result.count;
      } catch {
         return 0;
      }
   }

   async findExpiredPending(threshold: Date, limit = 50): Promise<AccountEntity[]> {
      const accounts = await this.prisma.account.findMany({
         where: {
            status: AccountStatus.PENDING_ACTIVATION,
            createdAt: { lt: threshold },
            deletedAt: null,
         },
         take: limit,
         include: {
            accountRoles: {
               include: {
                  role: true,
               },
            },
         },
         orderBy: { createdAt: 'asc' },
      });

      return accounts.map((a) => this.toEntity(a));
   }
}
