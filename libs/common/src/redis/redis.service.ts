import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { CommonConfigService } from '@common/config/common-config.service';
import { CacheHealthState } from '@common/constants/health.constant';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
   private readonly logger = new Logger(RedisService.name);
   private client: Redis | null = null;

   constructor(private readonly config: CommonConfigService) {}

   onModuleInit(): void {
      try {
         const redisConfig = this.config.redis;
         this.client = new Redis({
            host: redisConfig.host,
            port: redisConfig.port,
            password: redisConfig.password || undefined,
            lazyConnect: true,
            retryStrategy: (times: number) => {
               if (times > 3) {
                  return null;
               }
               return Math.min(times * 100, 3000);
            },
         });

         this.client.on('connect', () => {
            this.logger.log('Redis client connection initiated');
         });

         this.client.on('ready', () => {
            this.logger.log('Redis client connection established and ready');
         });

         this.client.on('error', (err: Error) => {
            this.logger.warn(`Redis client error: ${err.message}`);
         });

         this.client.on('close', () => {
            this.logger.warn('Redis client connection closed');
         });

         this.client.on('reconnecting', (delay: number) => {
            this.logger.log(`Redis client reconnecting in ${delay}ms`);
         });

         this.client.on('end', () => {
            this.logger.warn('Redis client connection ended');
         });
      } catch (err: unknown) {
         const error = err as Error;
         this.logger.warn(`Failed to initialize Redis client: ${error.message}`);
      }
   }

   async onModuleDestroy(): Promise<void> {
      if (this.client) {
         await this.client.quit().catch(() => {});
      }
   }

   getClient(): Redis | null {
      return this.client;
   }

   /**
    * Executes a PING command with timeout to assess Redis connectivity and latency.
    */
   async healthCheck(
      timeoutMs: number = 2000,
   ): Promise<{ status: CacheHealthState; latency?: number; message?: string }> {
      if (!this.client) {
         return { status: CacheHealthState.DOWN, message: 'Redis client is not initialized' };
      }
      const start = Date.now();
      try {
         const pingPromise = this.client.ping();
         let timer: ReturnType<typeof setTimeout> | undefined;
         const timeoutPromise = new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error('Redis health check ping timeout')), timeoutMs);
            timer.unref?.();
         });
         const res = await Promise.race([pingPromise, timeoutPromise]).finally(() => {
            if (timer) clearTimeout(timer);
         });
         const latency = Date.now() - start;
         if (res === 'PONG') {
            return { status: CacheHealthState.UP, latency };
         }
         return { status: CacheHealthState.DOWN, latency, message: `Unexpected response: ${String(res)}` };
      } catch (err: unknown) {
         const error = err as Error;
         const latency = Date.now() - start;
         return { status: CacheHealthState.DOWN, latency, message: error.message };
      }
   }

   async get(key: string): Promise<string | null> {
      if (!this.client) return null;
      try {
         return await this.client.get(key);
      } catch (err: unknown) {
         const error = err as Error;
         this.logger.warn(`Redis GET failed for key "${key}": ${error.message}`);
         return null;
      }
   }

   async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
      if (!this.client) return;
      try {
         if (ttlSeconds && ttlSeconds > 0) {
            await this.client.set(key, value, 'EX', ttlSeconds);
         } else {
            await this.client.set(key, value);
         }
      } catch (err: unknown) {
         const error = err as Error;
         this.logger.warn(`Redis SET failed for key "${key}": ${error.message}`);
      }
   }

   async setNx(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
      if (!this.client) return false;
      try {
         let result: string | null;
         if (ttlSeconds && ttlSeconds > 0) {
            result = await this.client.set(key, value, 'EX', ttlSeconds, 'NX');
         } else {
            result = await this.client.set(key, value, 'NX');
         }
         return result === 'OK';
      } catch (err: unknown) {
         const error = err as Error;
         this.logger.warn(`Redis SETNX failed for key "${key}": ${error.message}`);
         return false;
      }
   }

   async del(key: string): Promise<void> {
      if (!this.client) return;
      try {
         await this.client.del(key);
      } catch (err: unknown) {
         const error = err as Error;
         this.logger.warn(`Redis DEL failed for key "${key}": ${error.message}`);
      }
   }

   /**
    * Atomically gets the value of a key and deletes it (Redis 6.2+ GETDEL command).
    * If GETDEL command is not supported, transparently falls back to an atomic Lua script.
    * Eliminates Time-of-Check to Time-of-Use (TOCTOU) race conditions in one-time token flows.
    * @param key - Cache key to retrieve and delete
    * @returns The value before deletion, or null if key does not exist or client is disconnected
    */
   async getdel(key: string): Promise<string | null> {
      if (!this.client) return null;
      try {
         if (typeof this.client.getdel === 'function') {
            return await this.client.getdel(key);
         }
         return await this.executeAtomicGetDelScript(key);
      } catch (err: unknown) {
         const error = err as Error;
         if (error.message?.toLowerCase().includes('unknown command')) {
            try {
               return await this.executeAtomicGetDelScript(key);
            } catch (fallbackErr: unknown) {
               const fallbackError = fallbackErr as Error;
               this.logger.warn(`Redis GETDEL Lua fallback failed for key "${key}": ${fallbackError.message}`);
               return null;
            }
         }
         this.logger.warn(`Redis GETDEL failed for key "${key}": ${error.message}`);
         return null;
      }
   }

   private async executeAtomicGetDelScript(key: string): Promise<string | null> {
      if (!this.client) return null;
      const script = `
         local val = redis.call('GET', KEYS[1])
         if val and val ~= false then
            redis.call('DEL', KEYS[1])
            return val
         end
         return nil
      `;
      const result = await this.client.eval(script, 1, key);
      return (result as string) ?? null;
   }

   async incr(key: string): Promise<number> {
      if (!this.client) return 0;
      try {
         return await this.client.incr(key);
      } catch (err: unknown) {
         const error = err as Error;
         this.logger.warn(`Redis INCR failed for key "${key}": ${error.message}`);
         return 0;
      }
   }

   async ttl(key: string): Promise<number> {
      if (!this.client) return -2;
      try {
         return await this.client.ttl(key);
      } catch (err: unknown) {
         const error = err as Error;
         this.logger.warn(`Redis TTL failed for key "${key}": ${error.message}`);
         return -2;
      }
   }

   async hincrby(key: string, field: string, increment: number): Promise<number> {
      if (!this.client) return 0;
      try {
         return await this.client.hincrby(key, field, increment);
      } catch (err: unknown) {
         const error = err as Error;
         this.logger.warn(`Redis HINCRBY failed for key "${key}" field "${field}": ${error.message}`);
         return 0;
      }
   }

   async hgetall(key: string): Promise<Record<string, string>> {
      if (!this.client) return {};
      try {
         return await this.client.hgetall(key);
      } catch (err: unknown) {
         const error = err as Error;
         this.logger.warn(`Redis HGETALL failed for key "${key}": ${error.message}`);
         return {};
      }
   }

   async sadd(key: string, ...members: string[]): Promise<void> {
      if (!this.client || members.length === 0) return;
      try {
         await this.client.sadd(key, ...members);
      } catch (err: unknown) {
         const error = err as Error;
         this.logger.warn(`Redis SADD failed for key "${key}": ${error.message}`);
      }
   }

   async srem(key: string, ...members: string[]): Promise<void> {
      if (!this.client || members.length === 0) return;
      try {
         await this.client.srem(key, ...members);
      } catch (err: unknown) {
         const error = err as Error;
         this.logger.warn(`Redis SREM failed for key "${key}": ${error.message}`);
      }
   }

   async zincrby(key: string, increment: number, member: string): Promise<string | null> {
      if (!this.client) return null;
      try {
         return await this.client.zincrby(key, increment, member);
      } catch (err: unknown) {
         const error = err as Error;
         this.logger.warn(`Redis ZINCRBY failed for key "${key}": ${error.message}`);
         return null;
      }
   }

   async zrevrange(key: string, start: number, stop: number): Promise<string[]> {
      if (!this.client) return [];
      try {
         return await this.client.zrevrange(key, start, stop);
      } catch (err: unknown) {
         const error = err as Error;
         this.logger.warn(`Redis ZREVRANGE failed for key "${key}": ${error.message}`);
         return [];
      }
   }

   async zremrangebyrank(key: string, start: number, stop: number): Promise<number> {
      if (!this.client) return 0;
      try {
         return await this.client.zremrangebyrank(key, start, stop);
      } catch (err: unknown) {
         const error = err as Error;
         this.logger.warn(`Redis ZREMRANGEBYRANK failed for key "${key}": ${error.message}`);
         return 0;
      }
   }

   async smembers(key: string): Promise<string[]> {
      if (!this.client) return [];
      try {
         return await this.client.smembers(key);
      } catch (err: unknown) {
         const error = err as Error;
         this.logger.warn(`Redis SMEMBERS failed for key "${key}": ${error.message}`);
         return [];
      }
   }

   async setbit(key: string, offset: number, value: number): Promise<number> {
      if (!this.client) return 0;
      try {
         return await this.client.setbit(key, offset, value);
      } catch (err: unknown) {
         const error = err as Error;
         this.logger.warn(`Redis SETBIT failed for key "${key}" at offset ${offset}: ${error.message}`);
         return 0;
      }
   }

   async getbit(key: string, offset: number): Promise<number> {
      if (!this.client) return 0;
      try {
         return await this.client.getbit(key, offset);
      } catch (err: unknown) {
         const error = err as Error;
         this.logger.warn(`Redis GETBIT failed for key "${key}" at offset ${offset}: ${error.message}`);
         return 0;
      }
   }

   async expire(key: string, ttlSeconds: number): Promise<void> {
      if (!this.client || ttlSeconds <= 0) return;
      try {
         await this.client.expire(key, ttlSeconds);
      } catch (err: unknown) {
         const error = err as Error;
         this.logger.warn(`Redis EXPIRE failed for key "${key}": ${error.message}`);
      }
   }

   async deleteByPattern(pattern: string): Promise<number> {
      if (!this.client) return 0;
      try {
         let cursor = '0';
         let totalDeleted = 0;
         do {
            const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
            cursor = nextCursor;
            if (keys.length > 0) {
               await this.client.del(...keys);
               totalDeleted += keys.length;
            }
         } while (cursor !== '0');
         return totalDeleted;
      } catch (err: unknown) {
         const error = err as Error;
         this.logger.warn(`Redis deleteByPattern failed for pattern "${pattern}": ${error.message}`);
         return 0;
      }
   }

   async getJson<T>(key: string): Promise<T | null> {
      const data = await this.get(key);
      if (!data) return null;
      try {
         return JSON.parse(data) as T;
      } catch {
         return null;
      }
   }

   async getdelJson<T>(key: string): Promise<T | null> {
      const data = await this.getdel(key);
      if (!data) return null;
      try {
         return JSON.parse(data) as T;
      } catch {
         return null;
      }
   }

   async setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
      const serialized = JSON.stringify(value);
      await this.set(key, serialized, ttlSeconds);
   }
}
