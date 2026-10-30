import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CompleteMultipartUploadDto } from '@contracts/media/dto/media/complete-multipart-upload.dto';

describe('CompleteMultipartUploadDto', () => {
   const validMediaId = '01a18c90-186c-722b-a1c2-f784498a574f';
   const validUploadId = '2~upload_id_123';

   it('should succeed validation when standard lowercase etag is provided', async () => {
      const payload = {
         mediaId: validMediaId,
         uploadId: validUploadId,
         parts: [
            { partNumber: 1, etag: '"etag-chunk-1"' },
            { partNumber: 2, etag: '"etag-chunk-2"' },
         ],
      };

      const instance = plainToInstance(CompleteMultipartUploadDto, payload);
      const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });

      expect(errors).toHaveLength(0);
      expect(instance.parts[0].etag).toBe('"etag-chunk-1"');
      expect(instance.parts[1].etag).toBe('"etag-chunk-2"');
   });

   it('should succeed validation when mobile client sends camelCase eTag', async () => {
      const payload = {
         mediaId: validMediaId,
         uploadId: validUploadId,
         parts: [
            { partNumber: 1, eTag: '"etag-chunk-1"' },
            { partNumber: 2, eTag: '"etag-chunk-2"' },
         ],
      };

      const instance = plainToInstance(CompleteMultipartUploadDto, payload);
      const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });

      expect(errors).toHaveLength(0);
      expect(instance.parts[0].etag).toBe('"etag-chunk-1"');
      expect(instance.parts[1].etag).toBe('"etag-chunk-2"');
   });

   it('should succeed validation when mobile client sends PascalCase ETag', async () => {
      const payload = {
         mediaId: validMediaId,
         uploadId: validUploadId,
         parts: [{ partNumber: 1, ETag: '"etag-chunk-1"' }],
      };

      const instance = plainToInstance(CompleteMultipartUploadDto, payload);
      const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });

      expect(errors).toHaveLength(0);
      expect(instance.parts[0].etag).toBe('"etag-chunk-1"');
   });

   it('should succeed validation when client sends both etag and eTag simultaneously', async () => {
      const payload = {
         mediaId: validMediaId,
         uploadId: validUploadId,
         parts: [
            { partNumber: 1, etag: '"etag-1"', eTag: '"etag-1"' },
            { partNumber: 2, etag: '"etag-2"', eTag: '"etag-2"' },
            { partNumber: 3, etag: '"etag-3"', eTag: '"etag-3"' },
            { partNumber: 4, etag: '"etag-4"', eTag: '"etag-4"' },
         ],
      };

      const instance = plainToInstance(CompleteMultipartUploadDto, payload);
      const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });

      expect(errors).toHaveLength(0);
      expect(instance.parts).toHaveLength(4);
      expect(instance.parts[0].etag).toBe('"etag-1"');
      expect(instance.parts[3].etag).toBe('"etag-4"');
   });

   it('should fail validation when non-whitelisted properties exist on parts', async () => {
      const payload = {
         mediaId: validMediaId,
         uploadId: validUploadId,
         parts: [{ partNumber: 1, etag: '"etag-1"', disallowedProperty: 'malicious' }],
      };

      const instance = plainToInstance(CompleteMultipartUploadDto, payload);
      const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });

      expect(errors.length).toBeGreaterThan(0);
      const partErrors = errors[0]?.children?.[0]?.children || [];
      expect(partErrors.some((err) => err.property === 'disallowedProperty')).toBe(true);
   });

   it('should fail validation when etag/eTag/ETag is missing', async () => {
      const payload = {
         mediaId: validMediaId,
         uploadId: validUploadId,
         parts: [{ partNumber: 1 }],
      };

      const instance = plainToInstance(CompleteMultipartUploadDto, payload);
      const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });

      expect(errors.length).toBeGreaterThan(0);
      const partErrors = errors[0]?.children?.[0]?.children || [];
      expect(partErrors.some((err) => err.property === 'etag')).toBe(true);
   });

   it('should fail validation when partNumber is less than 1', async () => {
      const payload = {
         mediaId: validMediaId,
         uploadId: validUploadId,
         parts: [{ partNumber: 0, etag: '"etag-1"' }],
      };

      const instance = plainToInstance(CompleteMultipartUploadDto, payload);
      const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });

      expect(errors.length).toBeGreaterThan(0);
      const partErrors = errors[0]?.children?.[0]?.children || [];
      expect(partErrors.some((err) => err.property === 'partNumber')).toBe(true);
   });

   it('should fail validation when parts array is empty', async () => {
      const payload = {
         mediaId: validMediaId,
         uploadId: validUploadId,
         parts: [],
      };

      const instance = plainToInstance(CompleteMultipartUploadDto, payload);
      const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('parts');
   });
});
