import { CloudflareR2Provider } from '@media/storage/providers/r2.provider';
import type { MediaConfigService } from '@media/config';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
   getSignedUrl: jest.fn().mockImplementation((_client, command) => {
      return Promise.resolve(`https://mock-presigned-url.com?part=${command.input?.PartNumber || 0}`);
   }),
}));

describe('CloudflareR2Provider', () => {
   let provider: CloudflareR2Provider;
   let mockConfig: MediaConfigService;
   let mockSend: jest.Mock;

   beforeEach(() => {
      mockSend = jest.fn();
      mockConfig = {
         r2: {
            accountId: 'test-acc',
            accessKeyId: 'test-key',
            secretAccessKey: 'test-secret',
            bucketName: 'omnicoonect',
            endpoint: 'https://test-acc.r2.cloudflarestorage.com',
            publicUrl: 'https://pub-test.r2.dev',
         },
      } as unknown as MediaConfigService;

      provider = new CloudflareR2Provider(mockConfig);
      (provider as unknown as { s3Client: { send: jest.Mock } }).s3Client = {
         send: mockSend,
      };
   });

   describe('initiateMultipartUpload', () => {
      it('should return uploadId from S3 CreateMultipartUploadCommand', async () => {
         mockSend.mockResolvedValueOnce({ UploadId: 'upload-123' });

         const uploadId = await provider.initiateMultipartUpload('omni/videos/raw/test.mp4', 'video/mp4');

         expect(uploadId).toBe('upload-123');
         expect(mockSend).toHaveBeenCalledTimes(1);
      });

      it('should throw error if UploadId is missing', async () => {
         mockSend.mockResolvedValueOnce({});

         await expect(provider.initiateMultipartUpload('omni/videos/raw/test.mp4', 'video/mp4')).rejects.toThrow(
            'Cloudflare R2 returned empty UploadId during multipart initialization',
         );
      });
   });

   describe('generatePartUploadUrls', () => {
      it('should generate requested number of presigned URLs', async () => {
         const parts = await provider.generatePartUploadUrls('omni/videos/raw/test.mp4', 'upload-123', 3);

         expect(parts).toHaveLength(3);
         expect(parts[0]).toEqual({
            partNumber: 1,
            uploadUrl: 'https://mock-presigned-url.com?part=1',
         });
         expect(parts[1]).toEqual({
            partNumber: 2,
            uploadUrl: 'https://mock-presigned-url.com?part=2',
         });
         expect(parts[2]).toEqual({
            partNumber: 3,
            uploadUrl: 'https://mock-presigned-url.com?part=3',
         });
      });
   });

   describe('completeMultipartUpload', () => {
      it('should sort parts and call CompleteMultipartUploadCommand', async () => {
         mockSend.mockResolvedValueOnce({});

         const result = await provider.completeMultipartUpload('omni/videos/raw/test.mp4', 'upload-123', [
            { partNumber: 2, etag: 'etag-2' },
            { partNumber: 1, etag: '"etag-1"' },
         ]);

         expect(result).toBe('https://pub-test.r2.dev/omni/videos/raw/test.mp4');
         expect(mockSend).toHaveBeenCalledTimes(1);
         const callArg = mockSend.mock.calls[0][0];
         expect(callArg.input.MultipartUpload.Parts).toEqual([
            { PartNumber: 1, ETag: '"etag-1"' },
            { PartNumber: 2, ETag: '"etag-2"' },
         ]);
      });
   });

   describe('abortMultipartUpload', () => {
      it('should call AbortMultipartUploadCommand', async () => {
         mockSend.mockResolvedValueOnce({});

         const success = await provider.abortMultipartUpload('omni/videos/raw/test.mp4', 'upload-123');

         expect(success).toBe(true);
         expect(mockSend).toHaveBeenCalledTimes(1);
      });
   });

   describe('getPublicUrl', () => {
      it('should format public URL with configured publicBaseUrl', () => {
         const url = provider.getPublicUrl('omni/videos/test.mp4');
         expect(url).toBe('https://pub-test.r2.dev/omni/videos/test.mp4');
      });
   });
});
