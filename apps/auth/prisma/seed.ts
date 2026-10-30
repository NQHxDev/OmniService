import { PrismaClient } from '@auth/prisma-client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { RbacRedisKeys, RBAC_REDIS_TTL, SYSTEM_ROLES } from '@common/constants';
import { AUTH_PERMISSIONS, AUTH_PERMISSION_DEFINITIONS, AUTH_ROLES } from '@contracts/auth';
import { validateAuthEnv } from '@auth/config/auth-env.schema';

const env = validateAuthEnv(process.env);
const connectionString = env.DIRECT_URL || env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const permissionsData = AUTH_PERMISSION_DEFINITIONS;

const rolesDefinition = [
   {
      code: AUTH_ROLES.SUPER_ADMIN,
      name: 'Super Administrator',
      description: 'Full access to all system features and administration',
      permissions: Object.values(AUTH_PERMISSIONS),
   },
   {
      code: AUTH_ROLES.ADMIN,
      name: 'Administrator',
      description: 'System administrator for users, auth, and system governance',
      permissions: Object.values(AUTH_PERMISSIONS),
   },
   {
      code: AUTH_ROLES.MODERATOR,
      name: 'Content Moderator',
      description: 'Community moderator responsible for reviewing content and handling reports',
      permissions: [AUTH_PERMISSIONS.USERS_READ, AUTH_PERMISSIONS.USERS_BAN],
   },
   {
      code: SYSTEM_ROLES.USER,
      name: 'Standard User',
      description: 'Standard community member',
      permissions: [AUTH_PERMISSIONS.USERS_READ, AUTH_PERMISSIONS.USERS_UPDATE],
   },
   {
      code: AUTH_ROLES.STAFF,
      name: 'Staff Member',
      description: 'Internal operations and support staff member',
      permissions: [AUTH_PERMISSIONS.USERS_READ],
   },
];

interface RoleWithPermissions {
   roleId: string;
   code: string;
   name: string;
   description: string | null;
   permissions: string[];
}

async function seedRedis(rolesWithPermissions: RoleWithPermissions[]): Promise<void> {
   const redisHost = env.REDIS_HOST;
   const redisPort = env.REDIS_PORT;
   const redisPassword = env.REDIS_PASSWORD || undefined;

   let redis: Redis | null = null;
   try {
      redis = new Redis({
         host: redisHost,
         port: redisPort,
         password: redisPassword,
         lazyConnect: true,
         maxRetriesPerRequest: 1,
      });
      await redis.connect();

      for (const role of rolesWithPermissions) {
         const roleKey = RbacRedisKeys.role(role.code);
         const permissionsKey = RbacRedisKeys.rolePermissions(role.code);
         await redis.set(roleKey, JSON.stringify(role), 'EX', RBAC_REDIS_TTL.DEFAULT_ROLE);
         await redis.set(permissionsKey, JSON.stringify(role.permissions), 'EX', RBAC_REDIS_TTL.ROLE_PERMISSIONS);
      }
      console.log('✔ Redis cache pre-warmed successfully for all roles and permissions');
   } catch (err: unknown) {
      const error = err as Error;
      console.warn(`[Warning] Could not pre-warm Redis cache (is Redis running?): ${error.message}`);
   } finally {
      if (redis) {
         await redis.quit().catch(() => {});
      }
   }
}

async function main() {
   console.log('Seeding cooking network permissions...');
   const permissionMap = new Map<string, string>();

   for (const perm of permissionsData) {
      const created = await prisma.permission.upsert({
         where: { code: perm.code },
         update: { name: perm.name, description: perm.description },
         create: { code: perm.code, name: perm.name, description: perm.description },
      });
      permissionMap.set(perm.code, created.permissionId);
   }

   console.log('Seeding cooking network roles...');
   const seededRoles: RoleWithPermissions[] = [];

   for (const roleDef of rolesDefinition) {
      const role = await prisma.role.upsert({
         where: { code: roleDef.code },
         update: { name: roleDef.name, description: roleDef.description },
         create: { code: roleDef.code, name: roleDef.name, description: roleDef.description },
      });

      for (const permCode of roleDef.permissions) {
         const permissionId = permissionMap.get(permCode);
         if (permissionId) {
            await prisma.rolePermission.upsert({
               where: {
                  roleId_permissionId: {
                     roleId: role.roleId,
                     permissionId,
                  },
               },
               update: {},
               create: {
                  roleId: role.roleId,
                  permissionId,
               },
            });
         }
      }

      seededRoles.push({
         roleId: role.roleId,
         code: role.code,
         name: role.name,
         description: role.description,
         permissions: roleDef.permissions,
      });
   }

   console.log('Pre-warming Redis cache with roles & permissions...');
   await seedRedis(seededRoles);

   console.log('✔ Cooking network RBAC seeding completed successfully!');
}

main()
   .catch((e) => {
      console.error(e);
      process.exit(1);
   })
   .finally(async () => {
      await prisma.$disconnect();
      await pool.end();
   });
