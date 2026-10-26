import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import createClient, { type Client } from '@nebula-contrib/nebula-nodejs';
import type { NebulaConfig } from '@user/infrastructure/nebula/nebula.config';
import type { NebulaExecutionResponse } from '@user/infrastructure/nebula/nebula.types';

interface NebulaRawResponse {
   error_code: number;
   error_msg?: string | null;
   data?: Record<string, unknown[]> | unknown[];
   space_name?: string;
   latency_in_us?: number;
}

@Injectable()
export class NebulaService implements OnModuleInit, OnModuleDestroy {
   private readonly logger = new Logger(NebulaService.name);
   private client: Client | null = null;
   private initPromise: Promise<void> | null = null;

   constructor(private readonly config: NebulaConfig) {}

   async onModuleInit(): Promise<void> {
      if (!this.initPromise) {
         this.initPromise = this.init();
      }
      await this.initPromise;
   }

   private async init(): Promise<void> {
      await this.bootstrap();
      this.connect();
   }

   private async bootstrap(): Promise<void> {
      const server = `${this.config.graphAddress}:${this.config.graphPort}`;
      const adminUsername = this.config.adminUsername || 'root';
      const adminPassword = this.config.adminPassword || 'nebula';
      const storagedHost = this.config.storagedHost || 'nebula-storaged';
      const storagedPort = this.config.storagedPort || 9779;

      const adminClient = createClient({
         servers: [server],
         userName: adminUsername,
         password: adminPassword,
         space: '',
         poolSize: 1,
         executeTimeout: 10000,
      });

      adminClient.on('error', (event: unknown) => {
         const error = typeof event === 'object' && event !== null && 'error' in event ? event.error : event;
         const rawMsg = error instanceof Error ? error.message : String(error);
         this.logger.debug(`NebulaGraph bootstrap admin client: ${rawMsg}`);
      });

      try {
         // 1. Add storage host if not registered
         try {
            await adminClient.execute(`ADD HOSTS "${storagedHost}":${storagedPort};`);
         } catch {
            // Host might already be registered
         }

         // Wait for storage host to report ONLINE in metad
         const hostStart = Date.now();
         let hostOnline = false;
         while (!hostOnline && Date.now() - hostStart < 30000) {
            try {
               const hostsRes = (await adminClient.execute('SHOW HOSTS;')) as NebulaRawResponse;
               const hostRows = this.transformToRows(hostsRes.data);
               if (hostRows.some((row) => row.Status === 'ONLINE')) {
                  hostOnline = true;
                  break;
               }
               const hostExists = hostRows.some((row) => {
                  const h = typeof row.Host === 'string' ? row.Host : '';
                  return h === storagedHost || h === `"${storagedHost}"`;
               });
               if (!hostExists) {
                  try {
                     await adminClient.execute(`ADD HOSTS "${storagedHost}":${storagedPort};`);
                  } catch {
                     // Host might already be registered
                  }
               }
            } catch {
               // Storage host or graphd might still be initializing
            }
            await new Promise((resolve) => setTimeout(resolve, 1000));
         }

         if (!hostOnline) {
            this.logger.warn(
               `NebulaGraph storage host ${storagedHost}:${storagedPort} was not ONLINE within 30 seconds`,
            );
         }

         // 2. Ensure target space exists
         const spacesRes = (await adminClient.execute('SHOW SPACES;')) as NebulaRawResponse;
         const rows = this.transformToRows(spacesRes.data);
         const hasSpace = rows.some((row) => row.Name === this.config.space);

         if (!hasSpace) {
            this.logger.log(`Creating NebulaGraph space: ${this.config.space}`);
            const createStart = Date.now();
            let spaceCreated = false;
            let lastCreateError: Error | null = null;
            while (!spaceCreated && Date.now() - createStart < 30000) {
               try {
                  const createRes = (await adminClient.execute(
                     `CREATE SPACE IF NOT EXISTS ${this.config.space}(partition_num=10, replica_factor=1, vid_type=FIXED_STRING(64));`,
                  )) as NebulaRawResponse;
                  if (createRes.error_code === 0) {
                     spaceCreated = true;
                     break;
                  }
               } catch (err) {
                  lastCreateError = err instanceof Error ? err : new Error(String(err));
                  if (!lastCreateError.message.includes('Host not enough')) {
                     throw lastCreateError;
                  }
               }
               await new Promise((resolve) => setTimeout(resolve, 1000));
            }

            if (!spaceCreated && lastCreateError) {
               throw lastCreateError;
            }
         }

         // 3. Ensure target space is fully ready across graphd and storaged
         if (this.config.space) {
            const startTime = Date.now();
            let spaceReady = false;
            while (!spaceReady && Date.now() - startTime < 30000) {
               try {
                  const checkRes = (await adminClient.execute(`USE ${this.config.space};`)) as NebulaRawResponse;
                  if (checkRes.error_code === 0) {
                     spaceReady = true;
                     break;
                  }
               } catch {
                  // Wait for heartbeat synchronization
               }
               await new Promise((resolve) => setTimeout(resolve, 1000));
            }

            if (!spaceReady) {
               throw new Error(`NebulaGraph space ${this.config.space} was not ready within 30 seconds`);
            }
         }

         // 4. Ensure configured user exists with DBA role if not admin
         if (this.config.username !== adminUsername) {
            try {
               await adminClient.execute(
                  `CREATE USER IF NOT EXISTS ${this.config.username} WITH PASSWORD '${this.config.password}';`,
               );
            } catch {
               // User might already exist
            }
            try {
               await adminClient.execute(`ALTER USER ${this.config.username} WITH PASSWORD '${this.config.password}';`);
            } catch {
               // Alter might fail if already matching
            }
            try {
               await adminClient.execute(`GRANT ROLE DBA ON ${this.config.space} TO ${this.config.username};`);
            } catch {
               // Role might already be granted
            }
         }
      } catch (error) {
         const errorMessage = error instanceof Error ? error.message : String(error);
         this.logger.error(`NebulaGraph bootstrap failed: ${errorMessage}`);
         throw error;
      } finally {
         try {
            await adminClient.close();
         } catch {
            // Ignore close error
         }
      }
   }

   async onModuleDestroy(): Promise<void> {
      await this.disconnect();
   }

   private connect(): void {
      try {
         this.logger.log('Connecting to NebulaGraph...');

         const server = `${this.config.graphAddress}:${this.config.graphPort}`;

         this.client = createClient({
            servers: [server],
            userName: this.config.username,
            password: this.config.password,
            space: this.config.space,
            poolSize: 10,
            executeTimeout: 15000,
         });

         this.client.on('error', (event: unknown) => {
            const error = typeof event === 'object' && event !== null && 'error' in event ? event.error : event;

            const rawMsg =
               error instanceof Error
                  ? error.message
                  : typeof error === 'object' && error !== null
                    ? JSON.stringify(error)
                    : String(error);

            // During initial bootstrap before space creation, connection pool retries in background
            if (rawMsg.includes('SpaceNotFound') || rawMsg.includes('Space was not chosen')) {
               this.logger.debug(`NebulaGraph connection pool sync notice: ${rawMsg}`);
               return;
            }

            const errorDetails = error instanceof Error ? error.stack || error.message : rawMsg;
            this.logger.error(`NebulaGraph client error: ${errorDetails}`);
         });

         this.logger.log('Connected to NebulaGraph successfully');
      } catch (error) {
         const errorMessage = error instanceof Error ? error.message : 'Unknown error';
         this.logger.error('Failed to connect to NebulaGraph', errorMessage);
         throw error;
      }
   }

   private async disconnect(): Promise<void> {
      try {
         if (this.client) {
            await this.client.close();
            this.client = null;
            this.initPromise = null;
         }
         this.logger.log('Disconnected from NebulaGraph');
      } catch (error) {
         const errorMessage = error instanceof Error ? error.message : 'Unknown error';
         this.logger.error('Error disconnecting from NebulaGraph', errorMessage);
      }
   }

   private transformToRows(data: Record<string, unknown[]> | unknown[] | null | undefined): Record<string, unknown>[] {
      if (!data) return [];
      if (Array.isArray(data)) return data as Record<string, unknown>[];
      const keys = Object.keys(data);
      if (keys.length === 0) return [];
      const firstCol = data[keys[0]];
      if (!Array.isArray(firstCol)) return [];
      const rowCount = firstCol.length;
      const rows: Record<string, unknown>[] = [];
      for (let i = 0; i < rowCount; i++) {
         const row: Record<string, unknown> = {};
         for (const key of keys) {
            const col = data[key];
            if (Array.isArray(col)) {
               row[key] = col[i];
            }
         }
         rows.push(row);
      }
      return rows;
   }

   async execute(query: string, options?: { silent?: boolean }): Promise<NebulaExecutionResponse> {
      if (!this.client) {
         if (!this.initPromise) {
            this.initPromise = this.init();
         }
         await this.initPromise;
      }

      if (!this.client) {
         throw new Error('NebulaGraph client not initialized');
      }

      try {
         this.logger.debug(`Executing query: ${query}`);
         let result = (await this.client.execute(query)) as NebulaRawResponse;

         if (result.error_code !== 0) {
            // Auto-recover if session dropped space
            if (result.error_msg?.includes('Space was not chosen') && this.config.space) {
               this.logger.warn(`Space was not chosen, re-trying query with explicit USE ${this.config.space}`);
               result = (await this.client.execute(`USE ${this.config.space}; ${query}`)) as NebulaRawResponse;
            }
         }

         if (result.error_code !== 0) {
            throw new Error(`NebulaGraph query failed: ${result.error_msg || `code ${result.error_code}`}`);
         }

         const rows = this.transformToRows(result.data);

         return {
            errorCode: result.error_code,
            errorMessage: result.error_msg || '',
            data: rows,
            spaceName: result.space_name,
            latencyInUs: result.latency_in_us,
         };
      } catch (error) {
         const errorMessage = error instanceof Error ? error.message : 'Unknown error';
         if (!options?.silent) {
            this.logger.error(`Query execution failed: ${query}`, errorMessage);
         }
         throw error;
      }
   }

   async executeMany(queries: string[], options?: { silent?: boolean }): Promise<NebulaExecutionResponse[]> {
      const results: NebulaExecutionResponse[] = [];

      for (const query of queries) {
         const result = await this.execute(query, options);
         results.push(result);
      }

      return results;
   }

   getClient(): Client {
      if (!this.client) {
         throw new Error('NebulaGraph client not initialized');
      }
      return this.client;
   }
}
