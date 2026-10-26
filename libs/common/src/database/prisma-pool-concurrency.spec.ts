import { PrismaPoolConfigFactory } from './prisma-pool.config';

describe('Prisma & PgBouncer Connection Pool Concurrency Simulation', () => {
   it('should properly configure pool options to prevent database connection sprawl', () => {
      const url =
         'postgresql://postgres:postgres@localhost:6432/omni_service_auth?connection_limit=5&pool_timeout=10&pgbouncer=true';
      const options = PrismaPoolConfigFactory.createPoolOptions(url);

      expect(options.max).toBe(5);
      expect(options.connectionTimeoutMillis).toBe(10000);
      expect(options.idleTimeoutMillis).toBe(30000);
   });

   it('should simulate 100 concurrent workers without exceeding connection pool limit', async () => {
      const poolOptions = PrismaPoolConfigFactory.createPoolOptions(
         'postgresql://user:pass@localhost:6432/test_db?connection_limit=5&pool_timeout=10&pgbouncer=true',
      );

      const maxAllowedConnections = poolOptions.max; // 5 connections per Pod
      let currentActiveConnections = 0;
      let peakActiveConnections = 0;
      let waitingQueueLength = 0;
      let peakWaitingQueueLength = 0;

      // Simulated Async Connection Pool Queue
      class SimulatedConnectionPool {
         private active = 0;
         private queue: Array<() => void> = [];

         async acquire(): Promise<{ release: () => void }> {
            if (this.active < maxAllowedConnections) {
               this.active++;
               currentActiveConnections = this.active;
               if (currentActiveConnections > peakActiveConnections) {
                  peakActiveConnections = currentActiveConnections;
               }
               return {
                  release: () => {
                     this.active--;
                     currentActiveConnections = this.active;
                     const next = this.queue.shift();
                     if (next) {
                        waitingQueueLength = this.queue.length;
                        next();
                     }
                  },
               };
            }

            return new Promise<{ release: () => void }>((resolve, reject) => {
               const timeout = setTimeout(() => {
                  const idx = this.queue.indexOf(grant);
                  if (idx !== -1) {
                     this.queue.splice(idx, 1);
                  }
                  reject(new Error('Connection pool timeout'));
               }, poolOptions.connectionTimeoutMillis);

               const grant = () => {
                  clearTimeout(timeout);
                  this.active++;
                  currentActiveConnections = this.active;
                  if (currentActiveConnections > peakActiveConnections) {
                     peakActiveConnections = currentActiveConnections;
                  }
                  resolve({
                     release: () => {
                        this.active--;
                        currentActiveConnections = this.active;
                        const next = this.queue.shift();
                        if (next) {
                           waitingQueueLength = this.queue.length;
                           next();
                        }
                     },
                  });
               };

               this.queue.push(grant);
               waitingQueueLength = this.queue.length;
               if (waitingQueueLength > peakWaitingQueueLength) {
                  peakWaitingQueueLength = waitingQueueLength;
               }
            });
         }
      }

      const pool = new SimulatedConnectionPool();
      const TOTAL_WORKERS = 100;
      const workerResults: Array<{ id: number; success: boolean; duration: number }> = [];

      const runWorker = async (id: number) => {
         const start = Date.now();
         const conn = await pool.acquire();

         // Assert that active connections NEVER exceed max limit (5)
         expect(currentActiveConnections).toBeLessThanOrEqual(maxAllowedConnections);

         // Simulate fast asynchronous database query (e.g., indexed select/update)
         await new Promise((resolve) => setTimeout(resolve, 5));

         conn.release();
         workerResults.push({ id, success: true, duration: Date.now() - start });
      };

      // Launch 100 concurrent workers simultaneously
      const workerPromises = Array.from({ length: TOTAL_WORKERS }, (_, i) => runWorker(i));
      await Promise.all(workerPromises);

      // Verify all 100 workers completed successfully
      expect(workerResults.length).toBe(TOTAL_WORKERS);
      expect(workerResults.every((r) => r.success)).toBe(true);

      // Verify connection limit strictly held: peak <= 5
      expect(peakActiveConnections).toBeLessThanOrEqual(5);

      // Verify queue held workers during high contention without timeout
      expect(peakWaitingQueueLength).toBeGreaterThan(0);

      // Verify pool drained completely back to 0 active connections
      expect(currentActiveConnections).toBe(0);
   });
});
