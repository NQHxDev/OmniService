import { validateUserEnv } from '@user/config/user-env.schema';

describe('UserEnvSchema', () => {
   it('should apply valid default values when empty config is provided', () => {
      const config = validateUserEnv({});

      expect(config.PORT).toBe(3002);
      expect(config.SERVICE_NAME).toBe('user-service');
      expect(config.POSTGRES_USER).toBe('postgres');
      expect(config.POSTGRES_PASSWORD).toBe('postgres');
      expect(config.POSTGRES_DB).toBe('omni_service_user');
      expect(config.POSTGRES_PORT).toBe(5439);
      expect(config.NEBULA_GRAPHD_HOST).toBe('localhost');
      expect(config.NEBULA_GRAPHD_PORT).toBe(9669);
      expect(config.NEBULA_ADMIN_USERNAME).toBe('root');
      expect(config.NEBULA_ADMIN_PASSWORD).toBe('nebula');
   });

   it('should parse custom valid configuration correctly', () => {
      const config = validateUserEnv({
         PORT: '3100',
         POSTGRES_PORT: '5440',
         SERVICE_NAME: 'custom-user-service',
      });

      expect(config.PORT).toBe(3100);
      expect(config.POSTGRES_PORT).toBe(5440);
      expect(config.SERVICE_NAME).toBe('custom-user-service');
   });
});
