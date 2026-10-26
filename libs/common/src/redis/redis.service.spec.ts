import { CommonConfigService } from '@common/config/common-config.service';
import { CacheHealthState } from '@common/constants/health.constant';
import { RedisService } from '@common/redis/redis.service';

describe('RedisService', () => {
   let service: RedisService;
   let mockConfigService: jest.Mocked<CommonConfigService>;

   beforeEach(() => {
      mockConfigService = {
         redis: {
            host: 'localhost',
            port: 6379,
            password: '',
         },
      } as unknown as jest.Mocked<CommonConfigService>;

      service = new RedisService(mockConfigService);
   });

   it('should initialize without error on module init', () => {
      expect(() => service.onModuleInit()).not.toThrow();
   });

   it('should handle get, setJson, incr and ttl gracefully when client is not connected', async () => {
      const data = await service.get('non-existent');
      expect(data).toBeNull();

      await expect(service.setJson('key', { a: 1 })).resolves.not.toThrow();

      const incrResult = await service.incr('counter');
      expect(incrResult).toBe(0);

      const ttlResult = await service.ttl('some_key');
      expect(ttlResult).toBe(-2);
   });

   it('should handle set methods (sadd, srem, smembers, expire) gracefully when client is not connected', async () => {
      await expect(service.sadd('set_key', 'm1', 'm2')).resolves.not.toThrow();
      await expect(service.srem('set_key', 'm1')).resolves.not.toThrow();
      const members = await service.smembers('set_key');
      expect(members).toEqual([]);
      await expect(service.expire('set_key', 3600)).resolves.not.toThrow();
   });

   it('should handle hash methods (hincrby, hgetall) gracefully when client is not connected', async () => {
      const incrResult = await service.hincrby('hash_key', 'field', 1);
      expect(incrResult).toBe(0);
      const allFields = await service.hgetall('hash_key');
      expect(allFields).toEqual({});
   });

   it('should handle sorted set methods (zincrby, zrevrange, zremrangebyrank) gracefully when client is not connected', async () => {
      const zincrResult = await service.zincrby('z_key', 1, 'mem');
      expect(zincrResult).toBeNull();
      const zrevResult = await service.zrevrange('z_key', 0, 10);
      expect(zrevResult).toEqual([]);
      const zremResult = await service.zremrangebyrank('z_key', 0, 10);
      expect(zremResult).toBe(0);
   });

   it('should handle deleteByPattern gracefully when client is not connected', async () => {
      const count = await service.deleteByPattern('pattern:*');
      expect(count).toBe(0);
   });

   it('should return down status when client is not initialized in healthCheck', async () => {
      const health = await service.healthCheck();
      expect(health.status).toBe(CacheHealthState.DOWN);
      expect(health.message).toContain('not initialized');
   });

   it('should return up status when client pings PONG', async () => {
      service.onModuleInit();
      const client = service.getClient();
      if (client) {
         jest.spyOn(client, 'ping').mockResolvedValueOnce('PONG');
         const health = await service.healthCheck();
         expect(health.status).toBe(CacheHealthState.UP);
         expect(health.latency).toBeDefined();
      }
   });

   it('should return down status when ping fails', async () => {
      service.onModuleInit();
      const client = service.getClient();
      if (client) {
         jest.spyOn(client, 'ping').mockRejectedValueOnce(new Error('Connection refused'));
         const health = await service.healthCheck();
         expect(health.status).toBe(CacheHealthState.DOWN);
         expect(health.message).toBe('Connection refused');
      }
   });

   it('should handle getdel and getdelJson gracefully when client is not connected', async () => {
      const data = await service.getdel('some_token');
      expect(data).toBeNull();

      const jsonData = await service.getdelJson<{ id: string }>('some_json_token');
      expect(jsonData).toBeNull();
   });

   it('should atomically get and delete using native getdel when client is connected', async () => {
      service.onModuleInit();
      const client = service.getClient();
      if (client) {
         jest.spyOn(client, 'getdel').mockResolvedValueOnce('token-payload');
         const result = await service.getdel('token_key');
         expect(result).toBe('token-payload');
         expect(client.getdel).toHaveBeenCalledWith('token_key');
      }
   });

   it('should fall back to Lua script when getdel command is unknown in older Redis', async () => {
      service.onModuleInit();
      const client = service.getClient();
      if (client) {
         jest.spyOn(client, 'getdel').mockRejectedValueOnce(new Error("ERR unknown command 'GETDEL'"));
         jest.spyOn(client, 'eval').mockResolvedValueOnce('fallback-payload');

         const result = await service.getdel('token_key');
         expect(result).toBe('fallback-payload');
         expect(client.eval).toHaveBeenCalledWith(expect.stringContaining("redis.call('GET'"), 1, 'token_key');
      }
   });

   it('should parse JSON correctly in getdelJson and return null for invalid JSON', async () => {
      service.onModuleInit();
      const client = service.getClient();
      if (client) {
         jest.spyOn(client, 'getdel').mockResolvedValueOnce(JSON.stringify({ userId: 'u-123' }));
         const parsed = await service.getdelJson<{ userId: string }>('json_key');
         expect(parsed).toEqual({ userId: 'u-123' });

         jest.spyOn(client, 'getdel').mockResolvedValueOnce('invalid-json');
         const invalidResult = await service.getdelJson<{ userId: string }>('json_key');
         expect(invalidResult).toBeNull();
      }
   });

   it('should clean up client on module destroy', async () => {
      await expect(service.onModuleDestroy()).resolves.not.toThrow();
   });
});
