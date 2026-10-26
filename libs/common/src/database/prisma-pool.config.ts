export interface PrismaDatabasePoolConfig {
   connectionString: string;
   max: number;
   connectionTimeoutMillis: number;
   idleTimeoutMillis: number;
   isPgBouncer: boolean;
}

export interface BuildDatabaseUrlOptions {
   host: string;
   port: number;
   database: string;
   user?: string;
   password?: string;
   connectionLimit?: number;
   poolTimeoutSeconds?: number;
   isPgBouncer?: boolean;
}

export class PrismaPoolConfigFactory {
   public static readonly DEFAULT_CONNECTION_LIMIT = 5;
   public static readonly DEFAULT_POOL_TIMEOUT_SECONDS = 10;
   public static readonly DEFAULT_IDLE_TIMEOUT_MILLIS = 30000;

   /**
    * Parses a database connection URL and extracts pool configuration.
    * Ensures connection limits, timeouts, and PgBouncer flags are strictly enforced.
    */
   public static parse(rawUrl: string, overrides?: Partial<PrismaDatabasePoolConfig>): PrismaDatabasePoolConfig {
      if (!rawUrl || typeof rawUrl !== 'string') {
         throw new Error('Database URL must be a non-empty string');
      }

      let max = this.DEFAULT_CONNECTION_LIMIT;
      let connectionTimeoutMillis = this.DEFAULT_POOL_TIMEOUT_SECONDS * 1000;
      let idleTimeoutMillis = this.DEFAULT_IDLE_TIMEOUT_MILLIS;
      let isPgBouncer = false;

      try {
         // Use dummy http protocol to parse postgresql/postgres URLs reliably with standard URL API
         const normalizedUrl = rawUrl.replace(/^postgres(ql)?:\/\//i, 'http://');
         const parsed = new URL(normalizedUrl);

         const connectionLimitParam = parsed.searchParams.get('connection_limit');
         if (connectionLimitParam) {
            const parsedLimit = Number.parseInt(connectionLimitParam, 10);
            if (!Number.isNaN(parsedLimit) && parsedLimit > 0) {
               max = parsedLimit;
            }
         }

         const poolTimeoutParam = parsed.searchParams.get('pool_timeout');
         if (poolTimeoutParam) {
            const parsedTimeout = Number.parseInt(poolTimeoutParam, 10);
            if (!Number.isNaN(parsedTimeout) && parsedTimeout > 0) {
               connectionTimeoutMillis = parsedTimeout * 1000;
            }
         }

         const idleTimeoutParam = parsed.searchParams.get('idle_timeout');
         if (idleTimeoutParam) {
            const parsedIdle = Number.parseInt(idleTimeoutParam, 10);
            if (!Number.isNaN(parsedIdle) && parsedIdle > 0) {
               idleTimeoutMillis = parsedIdle * 1000;
            }
         }

         const pgbouncerParam = parsed.searchParams.get('pgbouncer');
         if (pgbouncerParam && (pgbouncerParam === 'true' || pgbouncerParam === '1')) {
            isPgBouncer = true;
         }
      } catch {
         // Fallback to default values if URL parsing encounters unexpected format
      }

      return {
         connectionString: rawUrl,
         max: overrides?.max ?? max,
         connectionTimeoutMillis: overrides?.connectionTimeoutMillis ?? connectionTimeoutMillis,
         idleTimeoutMillis: overrides?.idleTimeoutMillis ?? idleTimeoutMillis,
         isPgBouncer: overrides?.isPgBouncer ?? isPgBouncer,
      };
   }

   /**
    * Creates standard pg.Pool configuration options from a database URL.
    */
   public static createPoolOptions(
      rawUrl: string,
      overrides?: Partial<PrismaDatabasePoolConfig>,
   ): {
      connectionString: string;
      max: number;
      connectionTimeoutMillis: number;
      idleTimeoutMillis: number;
   } {
      const config = this.parse(rawUrl, overrides);
      return {
         connectionString: config.connectionString,
         max: config.max,
         connectionTimeoutMillis: config.connectionTimeoutMillis,
         idleTimeoutMillis: config.idleTimeoutMillis,
      };
   }

   /**
    * Builds a standardized PostgreSQL / PgBouncer connection URL.
    */
   public static buildStandardDatabaseUrl(options: BuildDatabaseUrlOptions): string {
      const auth =
         options.user && options.password
            ? `${encodeURIComponent(options.user)}:${encodeURIComponent(options.password)}@`
            : options.user
              ? `${encodeURIComponent(options.user)}@`
              : '';

      const base = `postgresql://${auth}${options.host}:${options.port}/${options.database}`;
      const params: string[] = [];

      const connectionLimit = options.connectionLimit ?? this.DEFAULT_CONNECTION_LIMIT;
      params.push(`connection_limit=${connectionLimit}`);

      const poolTimeout = options.poolTimeoutSeconds ?? this.DEFAULT_POOL_TIMEOUT_SECONDS;
      params.push(`pool_timeout=${poolTimeout}`);

      if (options.isPgBouncer ?? true) {
         params.push('pgbouncer=true');
      }

      return `${base}?${params.join('&')}`;
   }
}
