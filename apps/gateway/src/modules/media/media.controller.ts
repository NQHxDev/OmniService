import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
   ApiErrorResponses,
   COMMON_ERROR_CODES,
   CORRELATION_ID_HEADER,
   CurrentUser,
   type JwtPayload,
   ResponseMessage,
} from '@common';
import {
   ConfirmUploadDto,
   DeleteMediaResponseDto,
   GetUploadUrlDto,
   InitiateMultipartUploadDto,
   InitiateMultipartUploadResponseDto,
   CompleteMultipartUploadDto,
   MEDIA_ERROR_CODES,
   MEDIA_RESPONSE_MESSAGES,
   MediaResponseDto,
   UploadFileDto,
   UploadUrlResponseDto,
} from '@contracts/media';
import { MediaService } from '@gateway/modules/media/media.service';

@ApiTags('Media')
@Controller('media')
export class MediaController {
   constructor(private readonly mediaService: MediaService) {}

   @Post('upload-url')
   @HttpCode(HttpStatus.OK)
   @ApiCookieAuth()
   @ApiBearerAuth()
   @ApiOperation({
      operationId: 'getDirectUploadUrl',
      summary: 'Step 1/3: Get presigned PUT URL or Cloudinary signature for direct upload',
      description: `### Workflow: Direct Cloud Storage Upload (Step 1 of 3)
#### Prerequisites
- Authenticated user session.

#### Process Flow
- Generates an authorized upload target (AWS S3 or Cloudflare R2 presigned PUT URL for video/large files, or signed parameters for Cloudinary image uploads).
- Pre-registers a media entity in the database with status \`PENDING\`.
- Provides \`uploadUrl\` and \`mediaId\` for client use.

#### Next Step
- **Step 2/3 (Out-of-band)**: Perform direct binary HTTP PUT request to \`uploadUrl\` with the file data.
- **Step 3/3**: Call \`POST /api/v1/media/confirm\` with \`mediaId\` to verify and transition media to \`READY\` state.`,
   })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'Upload target URL and authorization parameters generated successfully.',
      type: UploadUrlResponseDto,
      links: {
         ConfirmDirectUpload: {
            operationId: 'confirmDirectUpload',
            description: 'Step 3/3: Confirm upload after completing binary PUT to uploadUrl',
            parameters: {
               mediaId: '$response.body#/data/id',
            },
         },
      },
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.BAD_REQUEST,
         description: 'Invalid upload parameters or unsupported media type',
         errorCodes: [MEDIA_ERROR_CODES.INVALID_FILE_TYPE, MEDIA_ERROR_CODES.UNSUPPORTED_PROVIDER],
      },
      {
         status: HttpStatus.UNAUTHORIZED,
         description: 'Unauthorized access or missing credentials',
         errorCodes: [COMMON_ERROR_CODES.UNAUTHORIZED],
      },
   ])
   @ResponseMessage(MEDIA_RESPONSE_MESSAGES.GET_UPLOAD_URL_SUCCESS)
   async getUploadUrl(
      @Body() dto: GetUploadUrlDto,
      @CurrentUser() user: JwtPayload,
      @Req() req: Request,
   ): Promise<UploadUrlResponseDto> {
      const correlationId = req.headers[CORRELATION_ID_HEADER] as string | undefined;
      return this.mediaService.getUploadUrl(dto, user, correlationId);
   }

   @Post('upload')
   @HttpCode(HttpStatus.CREATED)
   @ApiCookieAuth()
   @ApiBearerAuth()
   @ApiOperation({
      operationId: 'uploadMediaFile',
      summary: 'Upload media file directly through backend proxy',
      description: `### Alternative Workflow: Server Proxy Upload
#### Prerequisites
- Authenticated user session.

#### Process Flow
- Accepts base64 encoded media payload directly, uploads file to storage provider via backend, and creates media entity already in \`READY\` state.
- Note: For large video files or high-throughput uploads, prefer the 3-step Direct Storage Upload workflow to bypass backend bandwidth limits.

#### Next Step
- Media is ready for use immediately. Use the returned \`id\` or \`url\` in downstream entities.`,
   })
   @ApiResponse({
      status: HttpStatus.CREATED,
      description: 'Media file uploaded and registered successfully.',
      type: MediaResponseDto,
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.BAD_REQUEST,
         description: 'Invalid payload or upload failure',
         errorCodes: [MEDIA_ERROR_CODES.FILE_REQUIRED, MEDIA_ERROR_CODES.UPLOAD_FAILED],
      },
      {
         status: HttpStatus.UNAUTHORIZED,
         description: 'Unauthorized access',
         errorCodes: [COMMON_ERROR_CODES.UNAUTHORIZED],
      },
   ])
   @ResponseMessage(MEDIA_RESPONSE_MESSAGES.UPLOAD_SUCCESS)
   async uploadFile(
      @Body() dto: UploadFileDto,
      @CurrentUser() user: JwtPayload,
      @Req() req: Request,
   ): Promise<MediaResponseDto> {
      const correlationId = req.headers[CORRELATION_ID_HEADER] as string | undefined;
      return this.mediaService.uploadFile(dto, user, correlationId);
   }

   @Post('confirm')
   @HttpCode(HttpStatus.OK)
   @ApiCookieAuth()
   @ApiBearerAuth()
   @ApiOperation({
      operationId: 'confirmDirectUpload',
      summary: 'Step 3/3: Confirm direct client upload and transition media to READY state',
      description: `### Workflow: Direct Cloud Storage Upload (Step 3 of 3)
#### Prerequisites
- MUST call **Step 1/3** (\`POST /api/v1/media/upload-url\`) to register the media entity, and complete **Step 2/3** (client binary PUT upload to storage provider).

#### Process Flow
- Backend checks storage provider (S3/R2/Cloudinary) for file presence, verifies MIME type and file byte size, and transitions entity status from \`PENDING\` to \`READY\`.
- When in \`READY\` status, the public media URL is fully active and accessible.

#### Next Step
- Use the verified media entity \`id\` in downstream domain resources (e.g. Recipe post attachments, product offers, user profiles).`,
   })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'Media entity confirmed and updated to ready state.',
      type: MediaResponseDto,
      links: {
         GetMediaById: {
            operationId: 'getMediaById',
            description: 'Retrieve confirmed media details and active public URL',
            parameters: {
               id: '$response.body#/data/id',
            },
         },
      },
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.NOT_FOUND,
         description: 'Media record not found',
         errorCodes: [MEDIA_ERROR_CODES.MEDIA_NOT_FOUND],
      },
      {
         status: HttpStatus.FORBIDDEN,
         description: 'User does not have permission to confirm this media entity',
         errorCodes: [MEDIA_ERROR_CODES.CONFIRMATION_FAILED],
      },
   ])
   @ResponseMessage(MEDIA_RESPONSE_MESSAGES.CONFIRM_UPLOAD_SUCCESS)
   async confirmUpload(
      @Body() dto: ConfirmUploadDto,
      @CurrentUser() user: JwtPayload,
      @Req() req: Request,
   ): Promise<MediaResponseDto> {
      const correlationId = req.headers[CORRELATION_ID_HEADER] as string | undefined;
      return this.mediaService.confirmUpload(dto, user, correlationId);
   }

   @Get(':id')
   @ApiOperation({
      operationId: 'getMediaById',
      summary: 'Get media entity details by identifier',
      description: 'Retrieves metadata and public URL for a specific media asset.',
   })
   @ApiParam({
      name: 'id',
      description: 'UUID of the media entity',
      example: 'f81d4fae-7dec-11d0-a765-00a0c91e6bf6',
   })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'Media entity details retrieved successfully.',
      type: MediaResponseDto,
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.NOT_FOUND,
         description: 'Media asset not found',
         errorCodes: [MEDIA_ERROR_CODES.MEDIA_NOT_FOUND],
      },
   ])
   @ResponseMessage(MEDIA_RESPONSE_MESSAGES.GET_MEDIA_SUCCESS)
   async getMediaById(@Param('id') id: string): Promise<MediaResponseDto> {
      return this.mediaService.getMediaById(id);
   }

   @Delete(':id')
   @ApiCookieAuth()
   @ApiBearerAuth()
   @ApiOperation({
      operationId: 'deleteMediaAsset',
      summary: 'Delete media asset from storage and database',
      description: 'Deletes the file from storage provider (Cloudinary or R2) and removes its metadata.',
   })
   @ApiParam({
      name: 'id',
      description: 'UUID of the media asset to delete',
      example: 'f81d4fae-7dec-11d0-a765-00a0c91e6bf6',
   })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'Media asset deleted successfully.',
      type: DeleteMediaResponseDto,
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.NOT_FOUND,
         description: 'Media asset not found',
         errorCodes: [MEDIA_ERROR_CODES.MEDIA_NOT_FOUND],
      },
      {
         status: HttpStatus.FORBIDDEN,
         description: 'User does not have permission to delete this media asset',
         errorCodes: [
            MEDIA_ERROR_CODES.CONFIRMATION_FAILED,
            COMMON_ERROR_CODES.FORBIDDEN,
            COMMON_ERROR_CODES.NOT_OWNER_OR_ADMIN,
         ],
      },
   ])
   @ResponseMessage(MEDIA_RESPONSE_MESSAGES.DELETE_MEDIA_SUCCESS)
   async deleteMedia(
      @Param('id') id: string,
      @CurrentUser() user: JwtPayload,
      @Req() req: Request,
   ): Promise<DeleteMediaResponseDto> {
      const correlationId = req.headers[CORRELATION_ID_HEADER] as string | undefined;
      return this.mediaService.deleteMedia(id, user, correlationId);
   }

   @Post('videos/multipart-initiate')
   @HttpCode(HttpStatus.OK)
   @ApiCookieAuth()
   @ApiBearerAuth()
   @ApiOperation({
      operationId: 'initiateVideoMultipartUpload',
      summary: 'Step 1/3: Initiate Cloudflare R2 multipart upload for large video files',
      description: `### Large Video Upload Workflow (Step 1 of 3): Multipart Upload Initiation
#### Prerequisites
- Authenticated user session.

#### Process Flow
- Initiates an S3-compatible Multipart Upload directly targeting **Cloudflare R2 Bucket** (Zero Egress Fees).
- Generates presigned HTTP PUT URLs for each requested part/chunk (between 5MB and 10MB per part recommended).
- Registers media entity in \`PENDING\` status.

#### Next Step
- **Step 2/3 (Out-of-band Client Execution)**: Upload binary chunks sequentially or concurrently to the returned part presigned URLs.
- **Step 3/3**: Call \`POST /api/v1/media/videos/multipart-complete\` with the collected parts and ETags.`,
   })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'Multipart upload session initiated and presigned part URLs generated successfully.',
      type: InitiateMultipartUploadResponseDto,
      links: {
         CompleteMultipartUpload: {
            operationId: 'completeVideoMultipartUpload',
            description: 'Step 3/3: Complete multipart upload after uploading all chunks to Cloudflare R2',
            parameters: {
               mediaId: '$response.body#/data/mediaId',
               uploadId: '$response.body#/data/uploadId',
            },
         },
      },
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.BAD_REQUEST,
         description: 'Invalid upload parameters or unsupported media type',
         errorCodes: [MEDIA_ERROR_CODES.INVALID_FILE_TYPE, MEDIA_ERROR_CODES.MULTIPART_INITIATE_FAILED],
      },
      {
         status: HttpStatus.UNAUTHORIZED,
         description: 'Unauthorized access or missing credentials',
         errorCodes: [COMMON_ERROR_CODES.UNAUTHORIZED],
      },
   ])
   @ResponseMessage(MEDIA_RESPONSE_MESSAGES.INITIATE_MULTIPART_SUCCESS)
   async initiateMultipartUpload(
      @Body() dto: InitiateMultipartUploadDto,
      @CurrentUser() user: JwtPayload,
      @Req() req: Request,
   ): Promise<InitiateMultipartUploadResponseDto> {
      const correlationId = req.headers[CORRELATION_ID_HEADER] as string | undefined;
      return this.mediaService.initiateMultipartUpload(dto, user, correlationId);
   }

   @Post('videos/multipart-complete')
   @HttpCode(HttpStatus.OK)
   @ApiCookieAuth()
   @ApiBearerAuth()
   @ApiOperation({
      operationId: 'completeVideoMultipartUpload',
      summary: 'Step 3/3: Finalize multipart upload on Cloudflare R2 and trigger async HLS transcoding',
      description: `### Large Video Upload Workflow (Step 3 of 3): Finalize & Transcode
#### Prerequisites
- Must have called **Step 1/3** (\`POST /api/v1/media/videos/multipart-initiate\`) and uploaded all parts to Cloudflare R2 (**Step 2/3**).

#### Process Flow
- Directs Cloudflare R2 to assemble uploaded chunks into a single raw video asset.
- Transitions media entity status to \`PROCESSING\`.
- Dispatches an asynchronous transcoding job via RabbitMQ to generate adaptive bitrate HLS streaming profiles (1080p, 720p, 360p, \`master.m3u8\`) and extract video thumbnail poster.

#### Next Step
- Listen for real-time notification or poll \`GET /api/v1/media/:id\` until status transitions from \`PROCESSING\` to \`READY\`.`,
   })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'Multipart upload finalized on Cloudflare R2; video is now in PROCESSING state for HLS transcoding.',
      type: MediaResponseDto,
      links: {
         GetMediaById: {
            operationId: 'getMediaById',
            description: 'Check status and retrieve HLS streaming master playlist once transcoding is complete',
            parameters: {
               id: '$response.body#/data/id',
            },
         },
      },
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.BAD_REQUEST,
         description: 'Invalid parts payload or Cloudflare R2 assembly failure',
         errorCodes: [MEDIA_ERROR_CODES.MULTIPART_COMPLETE_FAILED],
      },
      {
         status: HttpStatus.NOT_FOUND,
         description: 'Media entity not found',
         errorCodes: [MEDIA_ERROR_CODES.MEDIA_NOT_FOUND],
      },
      {
         status: HttpStatus.FORBIDDEN,
         description: 'User does not have permission to finalize this media asset',
         errorCodes: [MEDIA_ERROR_CODES.CONFIRMATION_FAILED],
      },
      {
         status: HttpStatus.UNAUTHORIZED,
         description: 'Unauthorized access',
         errorCodes: [COMMON_ERROR_CODES.UNAUTHORIZED],
      },
   ])
   @ResponseMessage(MEDIA_RESPONSE_MESSAGES.COMPLETE_MULTIPART_SUCCESS)
   async completeMultipartUpload(
      @Body() dto: CompleteMultipartUploadDto,
      @CurrentUser() user: JwtPayload,
      @Req() req: Request,
   ): Promise<MediaResponseDto> {
      const correlationId = req.headers[CORRELATION_ID_HEADER] as string | undefined;
      return this.mediaService.completeMultipartUpload(dto, user, correlationId);
   }
}
