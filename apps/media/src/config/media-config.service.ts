import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ENV_KEYS, isDevelopment, isProduction } from '@common';
import { CLOUD_TRANSCODE_PROVIDERS, type CloudTranscodeProvider } from '@contracts/media';
import { MEDIA_ENV_KEYS, type MediaEnvConfig } from '@media/config/media-env.schema';

@Injectable()
export class MediaConfigService {
   constructor(private readonly configService: ConfigService<MediaEnvConfig, true>) {}

   get serviceName(): string {
      return this.configService.get(MEDIA_ENV_KEYS.SERVICE_NAME, { infer: true });
   }

   get isProduction(): boolean {
      return isProduction(this.nodeEnv);
   }

   get isDevelopment(): boolean {
      return isDevelopment(this.nodeEnv);
   }

   get nodeEnv(): string {
      return this.configService.get(MEDIA_ENV_KEYS.NODE_ENV, { infer: true });
   }

   get logLevel(): string {
      return this.configService.get(MEDIA_ENV_KEYS.LOG_LEVEL, { infer: true });
   }

   get databaseUrl(): string {
      const url = this.configService.get(MEDIA_ENV_KEYS.DATABASE_URL, { infer: true });
      if (url) {
         return url;
      }
      const user = this.configService.get(MEDIA_ENV_KEYS.POSTGRES_USER, { infer: true });
      const password = this.configService.get(MEDIA_ENV_KEYS.POSTGRES_PASSWORD, { infer: true });
      const db = this.configService.get(MEDIA_ENV_KEYS.POSTGRES_DB, { infer: true });
      const port = this.configService.get(MEDIA_ENV_KEYS.POSTGRES_PORT, { infer: true });
      return `postgresql://${user}:${password}@localhost:${port}/${db}`;
   }

   get directUrl(): string | undefined {
      return this.configService.get(ENV_KEYS.DIRECT_URL, { infer: true });
   }

   get pgbouncerPort(): number {
      const val = this.configService.get(ENV_KEYS.PGBOUNCER_PORT, { infer: true });
      return val !== undefined && val !== null ? Number(val) : 6432;
   }

   get rabbitMq() {
      return {
         uri: this.configService.get(MEDIA_ENV_KEYS.RABBIT_MQ_URI, { infer: true }),
         queue: this.configService.get(MEDIA_ENV_KEYS.RABBIT_MQ_MEDIA_SERVICE_QUEUE, { infer: true }),
      };
   }

   get cloudinary() {
      return {
         cloudName: this.configService.get(MEDIA_ENV_KEYS.CLOUDINARY_CLOUD_NAME, { infer: true }) || '',
         apiKey: this.configService.get(MEDIA_ENV_KEYS.CLOUDINARY_API_KEY, { infer: true }) || '',
         apiSecret: this.configService.get(MEDIA_ENV_KEYS.CLOUDINARY_API_SECRET, { infer: true }) || '',
      };
   }

   get r2() {
      return {
         accountId: this.configService.get(MEDIA_ENV_KEYS.R2_ACCOUNT_ID, { infer: true }) || '',
         accessKeyId: this.configService.get(MEDIA_ENV_KEYS.R2_ACCESS_KEY_ID, { infer: true }) || '',
         secretAccessKey: this.configService.get(MEDIA_ENV_KEYS.R2_SECRET_ACCESS_KEY, { infer: true }) || '',
         bucketName: this.configService.get(MEDIA_ENV_KEYS.R2_BUCKET_NAME, { infer: true }) || '',
         endpoint: this.configService.get(MEDIA_ENV_KEYS.R2_ENDPOINT, { infer: true }) || '',
         publicUrl: this.configService.get(MEDIA_ENV_KEYS.R2_PUBLIC_URL, { infer: true }) || '',
      };
   }

   get grpcPort(): number {
      const val = this.configService.get(MEDIA_ENV_KEYS.GRPC_PORT, { infer: true });
      return val !== undefined && val !== null ? Number(val) : 50055;
   }

   get grpcUrl(): string {
      return this.configService.get(MEDIA_ENV_KEYS.GRPC_URL, { infer: true }) || '0.0.0.0:50055';
   }

   get ffmpegPath(): string {
      return this.configService.get(MEDIA_ENV_KEYS.FFMPEG_PATH, { infer: true }) || 'ffmpeg';
   }

   get ffprobePath(): string {
      return this.configService.get(MEDIA_ENV_KEYS.FFPROBE_PATH, { infer: true }) || 'ffprobe';
   }

   get mediaRole(): 'api' | 'worker' | 'all' {
      return this.configService.get(MEDIA_ENV_KEYS.MEDIA_ROLE, { infer: true }) || 'all';
   }

   get isWorkerRole(): boolean {
      return this.mediaRole === 'worker' || this.mediaRole === 'all';
   }

   get isApiRole(): boolean {
      return this.mediaRole === 'api' || this.mediaRole === 'all';
   }

   get transcodePrefetchCount(): number {
      const val = this.configService.get(MEDIA_ENV_KEYS.TRANSCODE_PREFETCH_COUNT, { infer: true });
      return val !== undefined && val !== null ? Number(val) : 1;
   }

   get transcodeMinFreeDiskGb(): number {
      const val = this.configService.get(MEDIA_ENV_KEYS.TRANSCODE_MIN_FREE_DISK_GB, { infer: true });
      return val !== undefined && val !== null ? Number(val) : 10;
   }

   get transcodeMinFreeDiskBytes(): number {
      return this.transcodeMinFreeDiskGb * 1024 * 1024 * 1024;
   }

   get transcodeOffloadMaxSizeMb(): number {
      const val = this.configService.get(MEDIA_ENV_KEYS.TRANSCODE_OFFLOAD_MAX_SIZE_MB, { infer: true });
      return val !== undefined && val !== null ? Number(val) : 1024;
   }

   get transcodeOffloadMaxSizeBytes(): number {
      return this.transcodeOffloadMaxSizeMb * 1024 * 1024;
   }

   get transcodeOffloadMaxDurationSec(): number {
      const val = this.configService.get(MEDIA_ENV_KEYS.TRANSCODE_OFFLOAD_MAX_DURATION_SEC, { infer: true });
      return val !== undefined && val !== null ? Number(val) : 1800;
   }

   get transcodeHwaccel(): 'none' | 'auto' | 'videotoolbox' | 'nvenc' | 'vaapi' {
      return this.configService.get(MEDIA_ENV_KEYS.TRANSCODE_HWACCEL, { infer: true }) || 'none';
   }

   get cloudTranscodeProvider(): CloudTranscodeProvider {
      return (
         this.configService.get(MEDIA_ENV_KEYS.CLOUD_TRANSCODE_PROVIDER, { infer: true }) ||
         CLOUD_TRANSCODE_PROVIDERS.CLOUDFLARE_STREAM
      );
   }
}
