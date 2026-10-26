import { PrismaPoolConfigFactory } from './prisma-pool.config';

describe('PrismaPoolConfigFactory', () => {
   const defaultUrl = 'postgresql://postgres:postgres@localhost:6432/omni_service_test';

   describe('parse', () => {
      it('should return default pool options when query params are absent', () => {
         const config = PrismaPoolConfigFactory.parse(defaultUrl);

         expect(config.connectionString).toBe(defaultUrl);
         expect(config.max).toBe(PrismaPoolConfigFactory.DEFAULT_CONNECTION_LIMIT);
         expect(config.connectionTimeoutMillis).toBe(PrismaPoolConfigFactory.DEFAULT_POOL_TIMEOUT_SECONDS * 1000);
         expect(config.idleTimeoutMillis).toBe(PrismaPoolConfigFactory.DEFAULT_IDLE_TIMEOUT_MILLIS);
         expect(config.isPgBouncer).toBe(false);
      });

      it('should parse connection_limit, pool_timeout, and pgbouncer from URL', () => {
         const url = `${defaultUrl}?connection_limit=15&pool_timeout=20&pgbouncer=true&idle_timeout=45`;
         const config = PrismaPoolConfigFactory.parse(url);

         expect(config.max).toBe(15);
         expect(config.connectionTimeoutMillis).toBe(20000);
         expect(config.idleTimeoutMillis).toBe(45000);
         expect(config.isPgBouncer).toBe(true);
      });

      it('should gracefully handle invalid query param values with defaults', () => {
         const url = `${defaultUrl}?connection_limit=invalid&pool_timeout=-5`;
         const config = PrismaPoolConfigFactory.parse(url);

         expect(config.max).toBe(5);
         expect(config.connectionTimeoutMillis).toBe(10000);
      });

      it('should respect manual overrides if provided', () => {
         const config = PrismaPoolConfigFactory.parse(defaultUrl, {
            max: 25,
            isPgBouncer: true,
         });

         expect(config.max).toBe(25);
         expect(config.isPgBouncer).toBe(true);
      });

      it('should throw an error for empty or non-string URL', () => {
         expect(() => PrismaPoolConfigFactory.parse('')).toThrow('Database URL must be a non-empty string');
      });
   });

   describe('createPoolOptions', () => {
      it('should return compatible pg.Pool options', () => {
         const url = 'postgresql://usr:pwd@dbhost:5432/sample?connection_limit=7&pool_timeout=5';
         const options = PrismaPoolConfigFactory.createPoolOptions(url);

         expect(options).toEqual({
            connectionString: url,
            max: 7,
            connectionTimeoutMillis: 5000,
            idleTimeoutMillis: 30000,
         });
      });
   });

   describe('buildStandardDatabaseUrl', () => {
      it('should build a valid PgBouncer connection string with parameters', () => {
         const url = PrismaPoolConfigFactory.buildStandardDatabaseUrl({
            host: 'localhost',
            port: 6432,
            database: 'omni_auth',
            user: 'admin',
            password: 'secret',
            connectionLimit: 8,
            poolTimeoutSeconds: 15,
            isPgBouncer: true,
         });

         expect(url).toBe(
            'postgresql://admin:secret@localhost:6432/omni_auth?connection_limit=8&pool_timeout=15&pgbouncer=true',
         );
      });

      it('should use default values when optional parameters are omitted', () => {
         const url = PrismaPoolConfigFactory.buildStandardDatabaseUrl({
            host: 'dbhost',
            port: 5433,
            database: 'omni_default',
         });

         expect(url).toBe('postgresql://dbhost:5433/omni_default?connection_limit=5&pool_timeout=10&pgbouncer=true');
      });
   });
});
