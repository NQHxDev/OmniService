import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import {
   S3Client,
   PutObjectCommand,
   DeleteObjectCommand,
   CreateMultipartUploadCommand,
   UploadPartCommand,
   CompleteMultipartUploadCommand,
   AbortMultipartUploadCommand,
   GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { MEDIA_PROVIDERS, type MediaProvider } from '@contracts/media';
import { MediaConfigService } from '@media/config';
import type {
   IStorageProvider,
   GenerateUploadOptions,
   UploadOptions,
   UploadSignatureResult,
   StorageUploadResult,
} from '@media/storage/storage.interface';

@Injectable()
export class CloudflareR2Provider implements IStorageProvider {
   readonly provider: MediaProvider = MEDIA_PROVIDERS.CLOUDFLARE_R2;
   private readonly logger = new Logger(CloudflareR2Provider.name);
   private readonly s3Client: S3Client;
   private readonly bucketName: string;
   private readonly publicBaseUrl: string;

   constructor(private readonly config: MediaConfigService) {
      const { accessKeyId, secretAccessKey, endpoint, bucketName, publicUrl } = this.config.r2;

      this.bucketName = bucketName;
      this.publicBaseUrl = publicUrl ? publicUrl.replace(/\/$/, '') : '';

      this.s3Client = new S3Client({
         region: 'auto',
         endpoint: endpoint || undefined,
         credentials:
            accessKeyId && secretAccessKey
               ? {
                    accessKeyId,
                    secretAccessKey,
                 }
               : undefined,
      });

      if (accessKeyId && secretAccessKey && endpoint && bucketName) {
         this.logger.log(`Cloudflare R2 configured successfully for bucket: ${bucketName}`);
      } else {
         this.logger.warn('Cloudflare R2 credentials missing or incomplete in configuration');
      }
   }

   async generateUploadUrl(options: GenerateUploadOptions): Promise<UploadSignatureResult> {
      const fullKey = options.folder ? `${options.folder.replace(/\/$/, '')}/${options.key}` : options.key;

      const command = new PutObjectCommand({
         Bucket: this.bucketName,
         Key: fullKey,
         ContentType: options.mimeType,
         ContentLength: options.size,
      });

      // Presigned PUT URL valid for 1 hour (3600 seconds)
      const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
      const publicUrl = this.getPublicUrl(fullKey);

      return {
         provider: this.provider,
         method: 'PUT',
         uploadUrl,
         publicUrl,
         key: fullKey,
         headers: {
            'Content-Type': options.mimeType,
         },
      };
   }

   async uploadBuffer(buffer: Buffer, options: UploadOptions): Promise<StorageUploadResult> {
      const fullKey = options.folder ? `${options.folder.replace(/\/$/, '')}/${options.key}` : options.key;

      const command = new PutObjectCommand({
         Bucket: this.bucketName,
         Key: fullKey,
         Body: buffer,
         ContentType: options.mimeType || 'application/octet-stream',
      });

      await this.s3Client.send(command);
      const url = this.getPublicUrl(fullKey);

      return {
         provider: this.provider,
         key: fullKey,
         url,
         bytes: buffer.length,
      };
   }

   async uploadBase64(base64Data: string, options: UploadOptions): Promise<StorageUploadResult> {
      try {
         const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '');
         const buffer = Buffer.from(cleanBase64, 'base64');
         return await this.uploadBuffer(buffer, options);
      } catch (error) {
         this.logger.error(`Cloudflare R2 base64 upload failed: ${(error as Error).message}`);
         throw error;
      }
   }

   async deleteFile(key: string): Promise<boolean> {
      try {
         const command = new DeleteObjectCommand({
            Bucket: this.bucketName,
            Key: key,
         });
         await this.s3Client.send(command);
         return true;
      } catch (error) {
         this.logger.warn(`Failed to delete file ${key} from Cloudflare R2: ${(error as Error).message}`);
         throw error;
      }
   }

   getPublicUrl(key: string): string {
      if (this.publicBaseUrl) {
         return `${this.publicBaseUrl}/${key.replace(/^\//, '')}`;
      }
      return `${this.config.r2.endpoint}/${this.bucketName}/${key.replace(/^\//, '')}`;
   }

   async initiateMultipartUpload(key: string, mimeType: string): Promise<string> {
      try {
         const command = new CreateMultipartUploadCommand({
            Bucket: this.bucketName,
            Key: key,
            ContentType: mimeType,
         });
         const response = await this.s3Client.send(command);
         if (!response.UploadId) {
            throw new Error('Cloudflare R2 returned empty UploadId during multipart initialization');
         }
         this.logger.log(`Initiated multipart upload for key ${key}, UploadId: ${response.UploadId}`);
         return response.UploadId;
      } catch (error) {
         this.logger.error(`Failed to initiate multipart upload for ${key}: ${(error as Error).message}`);
         throw error;
      }
   }

   async generatePartUploadUrls(
      key: string,
      uploadId: string,
      partsCount: number,
   ): Promise<Array<{ partNumber: number; uploadUrl: string }>> {
      try {
         const partPromises = Array.from({ length: partsCount }, async (_, index) => {
            const partNumber = index + 1;
            const command = new UploadPartCommand({
               Bucket: this.bucketName,
               Key: key,
               UploadId: uploadId,
               PartNumber: partNumber,
            });
            // Presigned Part URL valid for 1 hour
            const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
            return { partNumber, uploadUrl };
         });

         return await Promise.all(partPromises);
      } catch (error) {
         this.logger.error(
            `Failed to generate part upload URLs for key ${key}, uploadId ${uploadId}: ${(error as Error).message}`,
         );
         throw error;
      }
   }

   async completeMultipartUpload(
      key: string,
      uploadId: string,
      parts: Array<{ partNumber: number; etag: string }>,
   ): Promise<string> {
      try {
         const sortedParts = [...parts]
            .sort((a, b) => a.partNumber - b.partNumber)
            .map((p) => ({
               PartNumber: p.partNumber,
               ETag: p.etag.replace(/^"|"$/g, ''), // Normalize ETag if quoted
            }));

         const command = new CompleteMultipartUploadCommand({
            Bucket: this.bucketName,
            Key: key,
            UploadId: uploadId,
            MultipartUpload: {
               Parts: sortedParts.map((p) => ({
                  PartNumber: p.PartNumber,
                  ETag: `"${p.ETag}"`, // S3 API requires double-quoted ETags
               })),
            },
         });

         await this.s3Client.send(command);
         const publicUrl = this.getPublicUrl(key);
         this.logger.log(`Completed multipart upload for key ${key}, parts: ${parts.length}`);
         return publicUrl;
      } catch (error) {
         this.logger.error(
            `Failed to complete multipart upload for ${key}, uploadId ${uploadId}: ${(error as Error).message}`,
         );
         throw error;
      }
   }

   async abortMultipartUpload(key: string, uploadId: string): Promise<boolean> {
      try {
         const command = new AbortMultipartUploadCommand({
            Bucket: this.bucketName,
            Key: key,
            UploadId: uploadId,
         });
         await this.s3Client.send(command);
         this.logger.log(`Aborted multipart upload for key ${key}, uploadId ${uploadId}`);
         return true;
      } catch (error) {
         this.logger.warn(
            `Failed to abort multipart upload for ${key}, uploadId ${uploadId}: ${(error as Error).message}`,
         );
         throw error;
      }
   }

   async downloadFile(key: string, destinationFilePath: string): Promise<void> {
      try {
         const command = new GetObjectCommand({
            Bucket: this.bucketName,
            Key: key,
         });
         const response = await this.s3Client.send(command);
         if (!response.Body) {
            throw new Error(`Empty response body received from R2 for key: ${key}`);
         }

         const parentDir = path.dirname(destinationFilePath);
         if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true });
         }

         const writeStream = fs.createWriteStream(destinationFilePath);
         const streamBody = response.Body as unknown;

         if (typeof (streamBody as { pipe?: unknown }).pipe === 'function') {
            await pipeline(streamBody as Readable, writeStream);
         } else if (typeof (streamBody as { transformToByteArray?: unknown }).transformToByteArray === 'function') {
            const bytes = await (
               streamBody as { transformToByteArray: () => Promise<Uint8Array> }
            ).transformToByteArray();
            await fs.promises.writeFile(destinationFilePath, Buffer.from(bytes));
         } else {
            throw new Error(`Unsupported response stream format for key: ${key}`);
         }

         this.logger.log(`Downloaded file from R2 ${key} -> ${destinationFilePath}`);
      } catch (error) {
         this.logger.error(`Failed to download ${key} from R2: ${(error as Error).message}`);
         throw error;
      }
   }

   async uploadFileFromDisk(key: string, localFilePath: string, mimeType?: string): Promise<string> {
      const detectedMime = mimeType || this.inferMimeType(localFilePath);
      const fileBuffer = await fs.promises.readFile(localFilePath);

      const command = new PutObjectCommand({
         Bucket: this.bucketName,
         Key: key,
         Body: fileBuffer,
         ContentType: detectedMime,
      });

      await this.s3Client.send(command);
      return this.getPublicUrl(key);
   }

   async uploadDirectory(localDirPath: string, targetKeyPrefix: string): Promise<string[]> {
      const normalizedPrefix = targetKeyPrefix.replace(/\/$/, '');
      const uploadedUrls: string[] = [];

      const walkAndUpload = async (currentDir: string, relativePath = '') => {
         const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });

         for (const entry of entries) {
            const fullLocalPath = path.join(currentDir, entry.name);
            const currentRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

            if (entry.isDirectory()) {
               await walkAndUpload(fullLocalPath, currentRelativePath);
            } else if (entry.isFile()) {
               const targetKey = `${normalizedPrefix}/${currentRelativePath}`;
               const publicUrl = await this.uploadFileFromDisk(targetKey, fullLocalPath);
               uploadedUrls.push(publicUrl);
            }
         }
      };

      await walkAndUpload(localDirPath);
      this.logger.log(`Uploaded ${uploadedUrls.length} files from ${localDirPath} to R2 prefix ${normalizedPrefix}`);
      return uploadedUrls;
   }

   private inferMimeType(filePath: string): string {
      const ext = path.extname(filePath).toLowerCase();
      switch (ext) {
         case '.m3u8':
            return 'application/vnd.apple.mpegurl';
         case '.ts':
            return 'video/MP2T';
         case '.mp4':
            return 'video/mp4';
         case '.jpg':
         case '.jpeg':
            return 'image/jpeg';
         case '.png':
            return 'image/png';
         case '.webp':
            return 'image/webp';
         default:
            return 'application/octet-stream';
      }
   }
}
