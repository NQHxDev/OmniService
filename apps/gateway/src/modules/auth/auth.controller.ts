import {
   Body,
   Controller,
   Delete,
   Get,
   Headers,
   HttpCode,
   HttpStatus,
   Param,
   Post,
   Query,
   Req,
   Res,
} from '@nestjs/common';
import {
   ApiBearerAuth,
   ApiCookieAuth,
   ApiHeader,
   ApiOperation,
   ApiParam,
   ApiQuery,
   ApiResponse,
   ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import {
   ApiErrorResponse,
   ApiErrorResponses,
   BadRequestException,
   COMMON_ERROR_CODES,
   CorrelationId,
   CurrentAccount,
   CurrentUser,
   DeviceDetectorUtil,
   IDeviceInfo,
   JwtUtil,
   PaginationQueryDto,
   Public,
   ResponseMessage,
   UnauthorizedException,
} from '@common';
import {
   AuditLogResponseDto,
   AUTH_COOKIES,
   AUTH_ERROR_CODES,
   AUTH_ERROR_REASONS,
   AUTH_RESPONSE_MESSAGES,
   AuthProfileResponseDto,
   AuthResponseDto,
   AuthTokensDto,
   ChangePasswordDto,
   ChangePasswordResponseDto,
   CheckEmailResponseDto,
   DeviceSessionResponseDto,
   IAuditLogListResult,
   IJwksResponse,
   IRevokeSessionResult,
   IUserSessionInfo,
   JwksResponseDto,
   LoginDto,
   RefreshTokenRequestDto,
   RegisterDto,
   RevokeSessionResultDto,
   RevokeTokenRequestDto,
   SendRegisterOtpDto,
   SendRegisterOtpResponseDto,
   SimpleSuccessResponseDto,
   UserEmailResponseDto,
   VerifyChangePasswordOtpDto,
   VerifyChangePasswordOtpResponseDto,
   VerifyRegisterOtpDto,
   VerifyRegisterOtpResponseDto,
} from '@contracts/auth';
import type { JwtPayload } from '@common';
import { GatewayConfigService } from '@/config';
import { AuthService } from '@/modules/auth/auth.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
   constructor(
      private readonly authService: AuthService,
      private readonly config: GatewayConfigService,
   ) {}

   private extractClientIp(req?: Request): string {
      if (!req) {
         return '127.0.0.1';
      }
      const forwarded = req.headers?.['x-forwarded-for'];
      if (typeof forwarded === 'string') {
         return forwarded.split(',')[0].trim();
      }
      if (Array.isArray(forwarded) && forwarded.length > 0) {
         return forwarded[0].trim();
      }
      const realIp = req.headers?.['x-real-ip'];
      if (typeof realIp === 'string') {
         return realIp.trim();
      }
      return req.ip || req.socket?.remoteAddress || '127.0.0.1';
   }

   private extractDeviceInfo(req?: Request): IDeviceInfo {
      const userAgent = req?.headers?.['user-agent'];
      const clientIp = this.extractClientIp(req);
      return DeviceDetectorUtil.parse(typeof userAgent === 'string' ? userAgent : undefined, clientIp);
   }

   private extractCurrentJti(req?: Request): string | undefined {
      const cookies = req?.cookies as Record<string, string> | undefined;
      const refreshToken = cookies?.[this.config.refreshTokenCookieName] || cookies?.[AUTH_COOKIES.REFRESH_TOKEN];

      if (refreshToken) {
         try {
            const payload = JwtUtil.decode(refreshToken);
            return payload?.jti;
         } catch {
            // Try from header or body if cookie decode fails
         }
      }

      // Fallback to Authorization header
      const authHeader = req?.headers?.authorization;
      if (authHeader?.startsWith('Bearer ')) {
         try {
            const token = authHeader.substring(7);
            const payload = JwtUtil.decode(token);
            return payload?.jti;
         } catch {
            // Ignore decode errors
         }
      }

      // Fallback to X-Refresh-Token header
      const refreshHeaderToken = req?.headers?.['x-refresh-token'];
      if (typeof refreshHeaderToken === 'string') {
         try {
            const payload = JwtUtil.decode(refreshHeaderToken);
            return payload?.jti;
         } catch {
            // Ignore decode errors
         }
      }

      return undefined;
   }

   private setAuthCookies(res: Response, tokens: { accessToken: string; refreshToken: string }): void {
      res.cookie(this.config.accessTokenCookieName, tokens.accessToken, this.config.accessTokenCookieOptions);
      res.cookie(this.config.refreshTokenCookieName, tokens.refreshToken, this.config.refreshTokenCookieOptions);
   }

   private clearAuthCookies(res: Response): void {
      res.clearCookie(this.config.accessTokenCookieName, this.config.clearCookieOptions);
      res.clearCookie(this.config.refreshTokenCookieName, this.config.clearCookieOptions);
   }

   private buildTokensDto(accessToken: string, refreshToken: string): AuthTokensDto {
      return {
         accessToken,
         refreshToken,
         tokenType: 'Bearer',
         expiresIn: this.config.jwtAccessTokenExpiresIn,
      };
   }

   @Public()
   @Get('.well-known/jwks.json')
   @HttpCode(HttpStatus.OK)
   @ApiOperation({
      operationId: 'getJwks',
      summary: 'Get JSON Web Key Set (JWKS) public keys for JWT token verification',
   })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'JWKS public keys returned successfully.',
      type: JwksResponseDto,
   })
   async getJwks(): Promise<IJwksResponse> {
      try {
         return await this.authService.getJwks();
      } catch {
         // Fallback to locally configured public key if microservice call fails
         return JwtUtil.generateJwks(this.config.jwtPublicKey, this.config.jwtKeyId);
      }
   }

   @Public()
   @Get('jwks.json')
   @HttpCode(HttpStatus.OK)
   @ApiOperation({
      operationId: 'getJwksAlias',
      summary: 'Get JSON Web Key Set (JWKS) public keys (alias)',
   })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'JWKS public keys returned successfully.',
      type: JwksResponseDto,
   })
   async getJwksAlias(): Promise<IJwksResponse> {
      return this.getJwks();
   }

   @Public()
   @Get('check-email')
   @HttpCode(HttpStatus.OK)
   @ApiOperation({
      operationId: 'checkEmail',
      summary: 'Pre-check: Check if an email is available for registration using fast Bloom Filter [gRPC]',
      description: `### Workflow: User Registration (Pre-check)
#### Prerequisites
- None (Public endpoint).

#### Process Flow
- Queries the Auth microservice via high-performance internal gRPC communication.
- Uses a Redis Bloom Filter for instant probabilistic pre-filtering before checking database records.
- Prevents unnecessary OTP requests or registration payload transmission if email is already in use.

#### Next Step
- If available (\`isAvailable: true\`), proceed to **Step 1/3**: Call \`POST /api/v1/auth/register/send-otp\` to request a verification OTP code.`,
   })
   @ApiHeader({
      name: 'X-Correlation-Id',
      required: false,
      description: 'Correlation ID for distributed tracing across services',
      example: 'c1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
   })
   @ApiQuery({
      name: 'email',
      required: true,
      description: 'Email address to check',
      example: 'user@example.com',
   })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'Email availability status returned.',
      type: CheckEmailResponseDto,
      links: {
         SendRegisterOtp: {
            operationId: 'sendRegisterOtp',
            description: 'Step 1/3: Send registration OTP to this email if available',
            parameters: {
               email: '$request.query#/email',
            },
         },
      },
   })
   @ApiErrorResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Invalid or missing email address',
      errorCodes: [AUTH_ERROR_CODES.INVALID_EMAIL_FORMAT],
      exampleParams: { reason: AUTH_ERROR_REASONS.EMAIL_REQUIRED },
   })
   @ResponseMessage(AUTH_RESPONSE_MESSAGES.CHECK_EMAIL_SUCCESS)
   async checkEmail(
      @Query('email') email: string,
      @CorrelationId() correlationId?: string,
   ): Promise<CheckEmailResponseDto> {
      if (!email || !email.trim()) {
         throw new BadRequestException(AUTH_ERROR_CODES.INVALID_EMAIL_FORMAT, {
            params: { reason: AUTH_ERROR_REASONS.EMAIL_REQUIRED },
         });
      }
      return this.authService.checkEmail(email, correlationId);
   }

   @Public()
   @Post('register/send-otp')
   @HttpCode(HttpStatus.OK)
   @ApiOperation({
      operationId: 'sendRegisterOtp',
      summary: 'Step 1/3: Send 6-digit registration OTP verification code to email',
      description: `### Workflow: User Registration (Step 1 of 3)
#### Prerequisites
- Email must be valid and not already registered (can pre-check via \`GET /api/v1/auth/check-email\`).

#### Process Flow
- Verifies email uniqueness using Bloom Filter and Auth database records.
- Generates a cryptographically secure 6-digit numeric OTP.
- Stores the OTP in Redis cache with a 10-minute time-to-live (TTL).
- Dispatches an asynchronous event to Notification microservice to send the OTP email.
- Enforces a 60-second cooldown between resend requests and a maximum limit of 5 OTP attempts per day.

#### Next Step
- Check recipient email inbox for the 6-digit verification code.
- Proceed to **Step 2/3**: Call \`POST /api/v1/auth/register/verify-otp\` with the received OTP.`,
   })
   @ApiResponse({
      status: 200,
      description: 'OTP code sent successfully to user email.',
      type: SendRegisterOtpResponseDto,
      links: {
         VerifyOtp: {
            operationId: 'verifyRegisterOtp',
            description: 'Step 2/3: Verify the 6-digit OTP code received via email in the next step',
            parameters: {
               email: '$request.body#/email',
            },
         },
      },
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.BAD_REQUEST,
         description: 'Email already exists, invalid email format, or OTP cooldown active',
         errorCodes: [
            AUTH_ERROR_CODES.EMAIL_ALREADY_EXISTS,
            AUTH_ERROR_CODES.INVALID_EMAIL_FORMAT,
            AUTH_ERROR_CODES.OTP_COOLDOWN_ACTIVE,
         ],
         exampleParams: { cooldownSeconds: 60 },
      },
      {
         status: HttpStatus.TOO_MANY_REQUESTS,
         description: 'Maximum daily OTP limit exceeded',
         errorCodes: [AUTH_ERROR_CODES.OTP_MAX_ATTEMPTS_EXCEEDED],
      },
   ])
   @ResponseMessage(AUTH_RESPONSE_MESSAGES.SEND_OTP_SUCCESS)
   async sendRegisterOtp(@Req() req: Request, @Body() dto: SendRegisterOtpDto): Promise<SendRegisterOtpResponseDto> {
      const deviceInfo = this.extractDeviceInfo(req);
      return this.authService.sendRegisterOtp(dto, deviceInfo);
   }

   @Public()
   @Post('register/verify-otp')
   @HttpCode(HttpStatus.OK)
   @ApiOperation({
      operationId: 'verifyRegisterOtp',
      summary: 'Step 2/3: Verify registration OTP and obtain single-use verificationToken',
      description: `### Workflow: User Registration (Step 2 of 3)
#### Prerequisites
- MUST call **Step 1/3** (\`POST /api/v1/auth/register/send-otp\`) first to receive OTP in email.

#### Process Flow
- Validates the submitted 6-digit OTP code against the cached Redis entry.
- Tracks failed verification attempts (maximum 5 attempts before code is invalidated).
- Upon successful match, invalidates the OTP and generates a signed single-use \`verificationToken\` with 15-minute expiration.
- Proves email ownership before the account entity is created.

#### Next Step
- Proceed to **Step 3/3**: Call \`POST /api/v1/auth/register\` supplying \`verificationToken\` and account password to create the user account.`,
   })
   @ApiResponse({
      status: 200,
      description: 'OTP verified successfully. Returns verificationToken.',
      type: VerifyRegisterOtpResponseDto,
      links: {
         RegisterAccount: {
            operationId: 'registerAccount',
            description: 'Step 3/3: Complete account registration using verificationToken and email',
            parameters: {
               verificationToken: '$response.body#/data/verificationToken',
               email: '$response.body#/data/email',
            },
         },
      },
   })
   @ApiErrorResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Invalid OTP code, expired OTP, or maximum OTP attempts exceeded',
      errorCodes: [
         AUTH_ERROR_CODES.OTP_INVALID,
         AUTH_ERROR_CODES.OTP_EXPIRED,
         AUTH_ERROR_CODES.OTP_MAX_ATTEMPTS_EXCEEDED,
      ],
      exampleParams: { remainingAttempts: 2 },
   })
   @ResponseMessage(AUTH_RESPONSE_MESSAGES.VERIFY_OTP_SUCCESS)
   async verifyRegisterOtp(
      @Req() req: Request,
      @Body() dto: VerifyRegisterOtpDto,
   ): Promise<VerifyRegisterOtpResponseDto> {
      const deviceInfo = this.extractDeviceInfo(req);
      return this.authService.verifyRegisterOtp(dto, deviceInfo);
   }

   @Public()
   @Post('register')
   @HttpCode(HttpStatus.CREATED)
   @ApiOperation({
      operationId: 'registerAccount',
      summary: 'Step 3/3: Create user account using verificationToken and initialize session',
      description: `### Workflow: User Registration (Step 3 of 3)
#### Prerequisites
- MUST complete **Step 2/3** (\`POST /api/v1/auth/register/verify-otp\`) to obtain a valid \`verificationToken\`.

#### Process Flow
- Validates cryptographic signature and single-use status of \`verificationToken\`.
- Hashes password using Argon2id with unique salt.
- Persists user account and credentials in Auth database.
- Issues JWT access token (15-minute TTL) and refresh token (7-day TTL).
- Sets HttpOnly secure cookies and returns tokens in response payload.

#### Next Step
- User account is active and logged in.
- Proceed to create user profile via \`POST /api/v1/users/profile\` (**User Onboarding Step 2/2**).
- Or onboard as supplier via \`POST /api/v1/suppliers\` (**Supplier Onboarding Step 2/2**).`,
   })
   @ApiHeader({
      name: 'X-Client-Type',
      required: false,
      description: 'Client type identifier (e.g., ios, android, web)',
      example: 'ios',
   })
   @ApiHeader({
      name: 'X-Device-Id',
      required: false,
      description: 'Unique device identifier for session tracking',
      example: 'device-uuid-123',
   })
   @ApiResponse({
      status: 201,
      description: 'User successfully registered. Tokens returned in response body and stored in HttpOnly cookies.',
      type: AuthResponseDto,
      links: {
         GetAuthProfile: {
            operationId: 'getAuthProfile',
            description: 'Retrieve authenticated user profile and token payload after successful registration',
         },
         RegisterSupplier: {
            operationId: 'registerSupplier',
            description: 'Step 2 (Optional): Submit supplier store details after account creation to become a supplier',
         },
         GetMySupplier: {
            operationId: 'getMySupplierProfile',
            description: 'Check supplier onboarding state or retrieve store profile',
         },
      },
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.BAD_REQUEST,
         description: 'Validation failed or invalid/expired verification token',
         errorCodes: [
            COMMON_ERROR_CODES.VALIDATION_FAILED,
            AUTH_ERROR_CODES.VERIFICATION_TOKEN_INVALID,
            AUTH_ERROR_CODES.VERIFICATION_TOKEN_EXPIRED,
         ],
      },
      {
         status: HttpStatus.CONFLICT,
         description: 'Email already registered',
         errorCodes: [AUTH_ERROR_CODES.EMAIL_ALREADY_EXISTS],
         exampleParams: { email: 'user@example.com' },
      },
   ])
   @ResponseMessage(AUTH_RESPONSE_MESSAGES.REGISTER_SUCCESS)
   async register(
      @Req() req: Request,
      @Body() registerDto: RegisterDto,
      @Res({ passthrough: true }) res: Response,
   ): Promise<AuthResponseDto> {
      const deviceInfo = this.extractDeviceInfo(req);
      const result = await this.authService.register(registerDto, deviceInfo);

      this.setAuthCookies(res, {
         accessToken: result.accessToken,
         refreshToken: result.refreshToken,
      });

      return {
         user: result.user,
         tokens: this.buildTokensDto(result.accessToken, result.refreshToken),
      };
   }

   @Public()
   @Post('login')
   @HttpCode(HttpStatus.OK)
   @ApiOperation({
      operationId: 'loginAccount',
      summary: 'Authenticate credentials, create device session, and issue JWT tokens',
      description: `### Workflow: User Authentication & Session Creation
#### Prerequisites
- User must have an active registered account.

#### Process Flow
- Validates email and verifies password hash using Argon2id.
- Checks account lock and security thresholds (blocks temporary brute force).
- Registers client device session (IP address, user-agent, device ID).
- Issues JWT access token and refresh token, setting HttpOnly cookies and returning payload.

#### Next Step
- Access protected resources using Bearer token or HttpOnly cookie.
- Query active sessions via \`GET /api/v1/auth/sessions\` to inspect logged-in devices.`,
   })
   @ApiHeader({
      name: 'X-Correlation-Id',
      required: false,
      description: 'Correlation ID for distributed tracing across services',
      example: 'c1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
   })
   @ApiHeader({
      name: 'X-Client-Type',
      required: false,
      description: 'Client type identifier (e.g., ios, android, web)',
      example: 'android',
   })
   @ApiHeader({
      name: 'X-Device-Id',
      required: false,
      description: 'Unique device identifier for session tracking',
      example: 'device-uuid-456',
   })
   @ApiResponse({
      status: 200,
      description: 'User successfully logged in. Tokens returned in response body and stored in HttpOnly cookies.',
      type: AuthResponseDto,
      links: {
         GetAuthProfile: {
            operationId: 'getAuthProfile',
            description: 'Retrieve authenticated user profile and token payload after successful login',
         },
         GetUserSessions: {
            operationId: 'getUserSessions',
            description: 'List all active logged-in device sessions for this user',
         },
         RegisterSupplier: {
            operationId: 'registerSupplier',
            description: 'Step 2 (Optional): Submit supplier store details after authentication to become a supplier',
         },
         GetMySupplier: {
            operationId: 'getMySupplierProfile',
            description: 'Check supplier onboarding state or retrieve store profile',
         },
      },
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.BAD_REQUEST,
         description: 'Validation failed for login payload',
         errorCodes: [COMMON_ERROR_CODES.VALIDATION_FAILED],
      },
      {
         status: HttpStatus.UNAUTHORIZED,
         description: 'Invalid credentials, locked/blocked account, or inactive user',
         errorCodes: [
            AUTH_ERROR_CODES.INVALID_CREDENTIALS,
            AUTH_ERROR_CODES.USER_NOT_FOUND,
            AUTH_ERROR_CODES.ACCOUNT_BLOCKED,
            AUTH_ERROR_CODES.ACCOUNT_INACTIVE,
            AUTH_ERROR_CODES.ACCOUNT_LOCKED_TEMPORARILY,
         ],
         exampleParams: { lockedUntil: '2026-10-10T09:00:00.000Z' },
      },
   ])
   @ResponseMessage(AUTH_RESPONSE_MESSAGES.LOGIN_SUCCESS)
   async login(
      @Req() req: Request,
      @Body() loginDto: LoginDto,
      @Res({ passthrough: true }) res: Response,
      @CorrelationId() correlationId?: string,
   ): Promise<AuthResponseDto> {
      const deviceInfo = this.extractDeviceInfo(req);
      const result = await this.authService.login(
         {
            ...loginDto,
            ip: loginDto.ip || deviceInfo.ipAddress,
         },
         deviceInfo,
         correlationId,
      );

      this.setAuthCookies(res, {
         accessToken: result.accessToken,
         refreshToken: result.refreshToken,
      });

      return {
         user: result.user,
         tokens: this.buildTokensDto(result.accessToken, result.refreshToken),
      };
   }

   @Public()
   @Post('refresh')
   @HttpCode(HttpStatus.OK)
   @ApiOperation({
      operationId: 'refreshToken',
      summary: 'Rotate and refresh tokens using active refresh token',
      description: `### Workflow: Token Refresh & Rotation
#### Prerequisites
- Client must hold a valid, unrevoked refresh token via HttpOnly cookie (\`refresh_token\`), \`X-Refresh-Token\` header, or request body.

#### Process Flow
- Validates cryptographic signature and expiration of refresh token.
- Enforces strict refresh token rotation: marks used token as revoked and issues new token family pair.
- Sets updated HttpOnly cookies and returns new tokens in response payload.

#### Next Step
- Use rotated tokens for subsequent API requests.`,
   })
   @ApiHeader({
      name: 'X-Refresh-Token',
      required: false,
      description: 'Refresh token for mobile/API clients (alternative to cookie)',
      example: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
   })
   @ApiHeader({
      name: 'X-Client-Type',
      required: false,
      description: 'Client type identifier',
      example: 'ios',
   })
   @ApiResponse({
      status: 200,
      description: 'Tokens rotated successfully. New tokens returned in response body and cookies.',
      type: AuthResponseDto,
   })
   @ApiErrorResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Refresh token missing, invalid, expired, or revoked',
      errorCodes: [
         AUTH_ERROR_CODES.REFRESH_TOKEN_REQUIRED,
         AUTH_ERROR_CODES.REFRESH_TOKEN_INVALID,
         AUTH_ERROR_CODES.REFRESH_TOKEN_REVOKED,
         AUTH_ERROR_CODES.REFRESH_TOKEN_EXPIRED,
         AUTH_ERROR_CODES.TOKEN_REVOKED,
      ],
      exampleParams: { reason: AUTH_ERROR_REASONS.REFRESH_TOKEN_MISSING },
   })
   @ResponseMessage(AUTH_RESPONSE_MESSAGES.TOKEN_REFRESH_SUCCESS)
   async refreshToken(
      @Req() req: Request,
      @Res({ passthrough: true }) res: Response,
      @Body() body: RefreshTokenRequestDto,
      @Headers('x-refresh-token') headerRefreshToken?: string,
      @CorrelationId() correlationId?: string,
   ): Promise<AuthResponseDto> {
      const cookies = req.cookies as Record<string, string> | undefined;
      const token =
         cookies?.[this.config.refreshTokenCookieName] ||
         cookies?.[AUTH_COOKIES.REFRESH_TOKEN] ||
         headerRefreshToken ||
         body?.refreshToken;

      if (!token) {
         throw new UnauthorizedException(AUTH_ERROR_CODES.REFRESH_TOKEN_REQUIRED, {
            params: { reason: AUTH_ERROR_REASONS.REFRESH_TOKEN_MISSING },
         });
      }

      const deviceInfo = this.extractDeviceInfo(req);
      const result = await this.authService.refreshToken(token, deviceInfo, correlationId);

      this.setAuthCookies(res, {
         accessToken: result.accessToken,
         refreshToken: result.refreshToken,
      });

      return {
         user: result.user,
         tokens: this.buildTokensDto(result.accessToken, result.refreshToken),
      };
   }

   @Public()
   @Post('revoke')
   @HttpCode(HttpStatus.OK)
   @ApiBearerAuth()
   @ApiOperation({
      operationId: 'revokeToken',
      summary:
         'Revoke active token. Accepts token from cookie, Authorization header, or request body. Clears all auth cookies.',
   })
   @ApiHeader({
      name: 'X-Refresh-Token',
      required: false,
      description: 'Refresh token to revoke (alternative to cookie or Authorization header)',
      example: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
   })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'Token revoked and cookies cleared successfully.',
      type: SimpleSuccessResponseDto,
   })
   @ApiErrorResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Token invalid or expired',
      errorCodes: [AUTH_ERROR_CODES.TOKEN_INVALID_OR_EXPIRED],
   })
   @ResponseMessage(AUTH_RESPONSE_MESSAGES.TOKEN_REVOKE_SUCCESS)
   async revokeToken(
      @Req() req: Request,
      @Res({ passthrough: true }) res: Response,
      @Body() body: RevokeTokenRequestDto,
      @Headers('authorization') authHeader?: string,
      @Headers('x-refresh-token') headerRefreshToken?: string,
   ): Promise<SimpleSuccessResponseDto> {
      const cookies = req.cookies as Record<string, string> | undefined;

      let token =
         cookies?.[this.config.refreshTokenCookieName] ||
         cookies?.[AUTH_COOKIES.REFRESH_TOKEN] ||
         cookies?.[this.config.accessTokenCookieName] ||
         cookies?.[AUTH_COOKIES.ACCESS_TOKEN] ||
         headerRefreshToken ||
         body?.token;

      // Extract from Authorization: Bearer header
      if (!token && authHeader?.startsWith('Bearer ')) {
         token = authHeader.substring(7);
      }

      const deviceInfo = this.extractDeviceInfo(req);

      if (token) {
         await this.authService.revokeToken(token, deviceInfo);
      }

      this.clearAuthCookies(res);
      return { success: true, message: AUTH_RESPONSE_MESSAGES.TOKEN_REVOKE_SUCCESS };
   }

   @Public()
   @Post('logout')
   @HttpCode(HttpStatus.OK)
   @ApiBearerAuth()
   @ApiOperation({
      operationId: 'logout',
      summary:
         'User logout. Accepts token from cookie or Authorization header. Revokes refresh token and clears auth cookies.',
   })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'User successfully logged out.',
      type: SimpleSuccessResponseDto,
   })
   @ApiErrorResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Authentication token missing or expired',
      errorCodes: [AUTH_ERROR_CODES.TOKEN_INVALID_OR_EXPIRED],
   })
   @ResponseMessage(AUTH_RESPONSE_MESSAGES.LOGOUT_SUCCESS)
   async logout(
      @Req() req: Request,
      @Res({ passthrough: true }) res: Response,
      @Headers('authorization') authHeader?: string,
   ): Promise<SimpleSuccessResponseDto> {
      const cookies = req.cookies as Record<string, string> | undefined;
      let refreshToken = cookies?.[this.config.refreshTokenCookieName] || cookies?.[AUTH_COOKIES.REFRESH_TOKEN];

      // Extract from Authorization: Bearer header if no cookie
      if (!refreshToken && authHeader?.startsWith('Bearer ')) {
         refreshToken = authHeader.substring(7);
      }

      const deviceInfo = this.extractDeviceInfo(req);

      if (refreshToken) {
         await this.authService.revokeToken(refreshToken, deviceInfo);
      }

      this.clearAuthCookies(res);
      return { success: true, message: AUTH_RESPONSE_MESSAGES.LOGOUT_SUCCESS };
   }

   @Post('logout-all')
   @HttpCode(HttpStatus.OK)
   @ApiCookieAuth()
   @ApiBearerAuth()
   @ApiOperation({
      operationId: 'logoutAll',
      summary: 'Revoke all sessions/tokens for the current user across all devices and clear auth cookies',
   })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'All user sessions logged out successfully.',
      type: SimpleSuccessResponseDto,
   })
   @ApiErrorResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Unauthorized access or invalid token',
      errorCodes: [COMMON_ERROR_CODES.UNAUTHORIZED, AUTH_ERROR_CODES.TOKEN_INVALID_OR_EXPIRED],
   })
   @ResponseMessage(AUTH_RESPONSE_MESSAGES.LOGOUT_ALL_SUCCESS)
   async logoutAll(
      @CurrentUser() user: JwtPayload,
      @Req() req: Request,
      @Res({ passthrough: true }) res: Response,
   ): Promise<SimpleSuccessResponseDto> {
      const deviceInfo = this.extractDeviceInfo(req);
      if (user?.sub) {
         await this.authService.logoutAll(user.sub, deviceInfo);
      }

      this.clearAuthCookies(res);
      return { success: true, message: AUTH_RESPONSE_MESSAGES.LOGOUT_ALL_SUCCESS };
   }

   @Get('sessions')
   @HttpCode(HttpStatus.OK)
   @ApiCookieAuth()
   @ApiBearerAuth()
   @ApiOperation({
      operationId: 'getUserSessions',
      summary: 'List all active device sessions for current user',
      description: `### Workflow: Session Management (List Active Sessions)
#### Prerequisites
- Authenticated user session (Bearer token or HttpOnly cookie).

#### Process Flow
- Retrieves all active device sessions from Redis/Auth microservice for the authenticated user ID (\`sub\`).
- Identifies current device session via matching \`jti\` claim.
- Returns client metadata (device type, browser, OS, IP address, last active timestamp).

#### Next Step
- Terminate a specific session via \`DELETE /api/v1/auth/sessions/:sessionId\`.
- Or terminate all other sessions via \`POST /api/v1/auth/sessions/revoke-others\`.`,
   })
   @ApiResponse({
      status: 200,
      description: 'Active sessions and devices retrieved successfully.',
      type: [DeviceSessionResponseDto],
      links: {
         RevokeSession: {
            operationId: 'revokeSession',
            description: 'Terminate a specific device session from the list',
            parameters: {
               sessionId: '$response.body#/data/0/id',
            },
         },
         RevokeOtherSessions: {
            operationId: 'revokeOtherSessions',
            description: 'Revoke all device sessions except the current active session',
         },
      },
   })
   @ApiErrorResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Unauthorized access or invalid token',
      errorCodes: [COMMON_ERROR_CODES.UNAUTHORIZED, AUTH_ERROR_CODES.TOKEN_INVALID_OR_EXPIRED],
   })
   @ResponseMessage(AUTH_RESPONSE_MESSAGES.GET_SESSIONS_SUCCESS)
   async getSessions(@CurrentUser() user: JwtPayload, @Req() req: Request): Promise<IUserSessionInfo[]> {
      const currentJti = this.extractCurrentJti(req);
      return this.authService.getSessions(user.sub, currentJti);
   }

   @Delete('sessions/:sessionId')
   @HttpCode(HttpStatus.OK)
   @ApiCookieAuth()
   @ApiBearerAuth()
   @ApiOperation({
      operationId: 'revokeSession',
      summary: 'Revoke and terminate a specific device session by session ID',
      description: `### Workflow: Session Management (Terminate Single Session)
#### Prerequisites
- Authenticated user session.
- Session ID obtained from \`GET /api/v1/auth/sessions\`.

#### Process Flow
- Verifies session belongs to the current user.
- Blacklists token family and deletes session state from Redis.
- Dispatches session revocation notification.`,
   })
   @ApiParam({ name: 'sessionId', description: 'Session UUID to revoke', type: String })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'Session revoked successfully.',
      type: SimpleSuccessResponseDto,
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.UNAUTHORIZED,
         description: 'Unauthorized access or invalid token',
         errorCodes: [COMMON_ERROR_CODES.UNAUTHORIZED, AUTH_ERROR_CODES.TOKEN_INVALID_OR_EXPIRED],
      },
      {
         status: HttpStatus.NOT_FOUND,
         description: 'Session not found or already revoked',
         errorCodes: [AUTH_ERROR_CODES.SESSION_NOT_FOUND, AUTH_ERROR_CODES.SESSION_ALREADY_REVOKED],
         exampleParams: { sessionId: '550e8400-e29b-41d4-a716-446655440000' },
      },
   ])
   @ResponseMessage(AUTH_RESPONSE_MESSAGES.REVOKE_SESSION_SUCCESS)
   async revokeSession(
      @CurrentUser() user: JwtPayload,
      @Param('sessionId') sessionId: string,
      @Req() req: Request,
   ): Promise<SimpleSuccessResponseDto> {
      const deviceInfo = this.extractDeviceInfo(req);
      await this.authService.revokeSession(user.sub, sessionId, deviceInfo);
      return { success: true, message: AUTH_RESPONSE_MESSAGES.REVOKE_SESSION_SUCCESS };
   }

   @Post('sessions/revoke-others')
   @HttpCode(HttpStatus.OK)
   @ApiCookieAuth()
   @ApiBearerAuth()
   @ApiOperation({
      operationId: 'revokeOtherSessions',
      summary: 'Revoke and terminate all active sessions except current device session',
      description: `### Workflow: Session Management (Revoke Other Sessions)
#### Prerequisites
- Authenticated user with an active refresh token or identifiable session \`jti\`.

#### Process Flow
- Identifies current active session \`jti\` from request cookies or tokens.
- Revokes and removes all other device sessions in Redis for the user.
- Keeps current device authenticated while logging out all other devices.`,
   })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'All other sessions revoked successfully.',
      type: RevokeSessionResultDto,
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.BAD_REQUEST,
         description: 'Current active session ID missing from request',
         errorCodes: [AUTH_ERROR_CODES.CURRENT_SESSION_REQUIRED],
      },
      {
         status: HttpStatus.UNAUTHORIZED,
         description: 'Unauthorized access or invalid token',
         errorCodes: [COMMON_ERROR_CODES.UNAUTHORIZED, AUTH_ERROR_CODES.TOKEN_INVALID_OR_EXPIRED],
      },
   ])
   @ResponseMessage(AUTH_RESPONSE_MESSAGES.REVOKE_OTHER_SESSIONS_SUCCESS)
   async revokeOtherSessions(@CurrentUser() user: JwtPayload, @Req() req: Request): Promise<IRevokeSessionResult> {
      const currentJti = this.extractCurrentJti(req);
      if (!currentJti) {
         throw new BadRequestException(AUTH_ERROR_CODES.CURRENT_SESSION_REQUIRED, {
            params: { reason: AUTH_ERROR_REASONS.REFRESH_TOKEN_MISSING },
         });
      }

      const deviceInfo = this.extractDeviceInfo(req);
      return this.authService.revokeOtherSessions(user.sub, currentJti, deviceInfo);
   }

   @Post('change-password')
   @HttpCode(HttpStatus.OK)
   @ApiCookieAuth()
   @ApiBearerAuth()
   @ApiOperation({
      operationId: 'initiateChangePassword',
      summary: 'Step 1/2: Initiate password change and send verification OTP to email',
      description: `### Workflow: Change Password (Step 1 of 2)
#### Prerequisites
- User must be authenticated (Bearer token or HttpOnly cookie).
- Must provide correct current password.

#### Process Flow
- Validates \`currentPassword\` against Argon2id hash in database.
- Checks that \`newPassword\` differs from current password.
- Hashes and temporarily stores \`newPassword\` and \`logoutAll\` preference in Redis cache with 10-minute TTL.
- Generates a 6-digit numeric OTP and delivers it to user's verified email.
- Enforces a 60-second cooldown between requests.

#### Next Step
- Check email inbox for 6-digit OTP code.
- Call **Step 2/2**: \`POST /api/v1/auth/change-password/verify-otp\` with the OTP code to apply the new password.`,
   })
   @ApiResponse({
      status: 200,
      description: 'Current password verified and OTP sent successfully',
      type: ChangePasswordResponseDto,
      links: {
         VerifyChangePasswordOtp: {
            operationId: 'verifyChangePasswordOtp',
            description: 'Step 2/2: Verify the OTP code sent to email to finalize password change',
         },
      },
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.BAD_REQUEST,
         description: 'Current password invalid, password unchanged, or OTP cooldown active',
         errorCodes: [
            AUTH_ERROR_CODES.INVALID_OLD_PASSWORD,
            AUTH_ERROR_CODES.PASSWORD_UNCHANGED,
            AUTH_ERROR_CODES.OTP_COOLDOWN_ACTIVE,
            COMMON_ERROR_CODES.VALIDATION_FAILED,
         ],
         exampleParams: { cooldownSeconds: 60 },
      },
      {
         status: HttpStatus.UNAUTHORIZED,
         description: 'User not found or unauthorized',
         errorCodes: [COMMON_ERROR_CODES.UNAUTHORIZED, AUTH_ERROR_CODES.USER_NOT_FOUND],
      },
   ])
   @ResponseMessage(AUTH_RESPONSE_MESSAGES.SEND_CHANGE_PASSWORD_OTP_SUCCESS)
   async changePassword(
      @CurrentUser() user: JwtPayload,
      @Body() changePasswordDto: ChangePasswordDto,
      @Req() req: Request,
   ): Promise<ChangePasswordResponseDto> {
      const deviceInfo = this.extractDeviceInfo(req);
      return this.authService.changePassword(user.sub, changePasswordDto, deviceInfo);
   }

   @Post('change-password/verify-otp')
   @HttpCode(HttpStatus.OK)
   @ApiCookieAuth()
   @ApiBearerAuth()
   @ApiOperation({
      operationId: 'verifyChangePasswordOtp',
      summary: 'Step 2/2: Verify OTP code and finalize password change',
      description: `### Workflow: Change Password (Step 2 of 2)
#### Prerequisites
- MUST call **Step 1/2** (\`POST /api/v1/auth/change-password\`) first to initiate change and receive OTP.

#### Process Flow
- Verifies 6-digit OTP code against cached record in Redis.
- Allows up to 5 attempts before the OTP is invalidated.
- Upon successful verification, commits the cached new password hash into the database.
- Removes OTP and pending change state from Redis.
- If \`logoutAll\` was requested in Step 1, revokes all other active sessions across devices and clears authentication cookies.

#### Next Step
- Password change is complete.
- If \`logoutAll\` was executed, existing tokens on other devices are invalidated; client on current device may continue or re-authenticate.`,
   })
   @ApiResponse({
      status: 200,
      description: 'Password changed successfully via OTP verification',
      type: VerifyChangePasswordOtpResponseDto,
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.BAD_REQUEST,
         description: 'OTP invalid, expired, or maximum attempts exceeded',
         errorCodes: [
            AUTH_ERROR_CODES.OTP_INVALID,
            AUTH_ERROR_CODES.OTP_EXPIRED,
            AUTH_ERROR_CODES.OTP_MAX_ATTEMPTS_EXCEEDED,
         ],
         exampleParams: { remainingAttempts: 1 },
      },
      {
         status: HttpStatus.UNAUTHORIZED,
         description: 'Unauthorized access',
         errorCodes: [COMMON_ERROR_CODES.UNAUTHORIZED],
      },
   ])
   @ResponseMessage(AUTH_RESPONSE_MESSAGES.CHANGE_PASSWORD_SUCCESS)
   async verifyChangePasswordOtp(
      @CurrentUser() user: JwtPayload,
      @Body() dto: VerifyChangePasswordOtpDto,
      @Req() req: Request,
      @Res({ passthrough: true }) res: Response,
   ): Promise<VerifyChangePasswordOtpResponseDto> {
      const deviceInfo = this.extractDeviceInfo(req);
      const result = await this.authService.verifyChangePasswordOtp(user.sub, dto, deviceInfo);

      if (result.logoutAll) {
         this.clearAuthCookies(res);
      }

      return result;
   }

   @Get('security-logs')
   @HttpCode(HttpStatus.OK)
   @ApiCookieAuth()
   @ApiBearerAuth()
   @ApiOperation({
      operationId: 'getUserSecurityLogs',
      summary:
         'Get security audit logs for the current authenticated user (SOC 2, GDPR user access). Supports both cookie and Bearer token authentication.',
   })
   @ApiResponse({
      status: 200,
      description: 'User security audit logs retrieved successfully',
      type: [AuditLogResponseDto],
   })
   @ApiErrorResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Unauthorized access or invalid token',
      errorCodes: [COMMON_ERROR_CODES.UNAUTHORIZED, AUTH_ERROR_CODES.TOKEN_INVALID_OR_EXPIRED],
   })
   @ResponseMessage(AUTH_RESPONSE_MESSAGES.GET_SECURITY_LOGS_SUCCESS)
   async getSecurityLogs(
      @CurrentUser() user: JwtPayload,
      @Query() query: PaginationQueryDto,
   ): Promise<IAuditLogListResult> {
      return this.authService.getUserAuditLogs(user.sub, query.page, query.limit);
   }

   @Get('me/email')
   @ApiCookieAuth()
   @ApiBearerAuth()
   @ApiOperation({
      operationId: 'getMyEmail',
      summary: 'Get email address of current authenticated user from Auth Service',
      description:
         'Retrieves the account email address and email verification status directly from the Auth Service account database.',
   })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'Account email details retrieved successfully from Auth Service.',
      type: UserEmailResponseDto,
   })
   @ApiErrorResponses([
      {
         status: HttpStatus.UNAUTHORIZED,
         description: 'Authentication token is missing, revoked, or expired.',
         errorCodes: [COMMON_ERROR_CODES.UNAUTHORIZED, AUTH_ERROR_CODES.TOKEN_INVALID_OR_EXPIRED],
      },
      {
         status: HttpStatus.NOT_FOUND,
         description: 'Account record not found in Auth Service.',
         errorCodes: [AUTH_ERROR_CODES.USER_NOT_FOUND],
         exampleParams: { id: '018dc3bc-11a2-7f28-9842-bc08684d0001' },
      },
   ])
   @ResponseMessage(AUTH_RESPONSE_MESSAGES.GET_EMAIL_SUCCESS)
   async getMyEmail(@CurrentAccount('id') accountId: string): Promise<UserEmailResponseDto> {
      return this.authService.getEmail(accountId);
   }

   @Get('me')
   @ApiCookieAuth()
   @ApiBearerAuth()
   @ApiOperation({
      operationId: 'getAuthProfile',
      summary: 'Get current authenticated user profile. Supports both cookie and Bearer token authentication.',
   })
   @ApiResponse({
      status: HttpStatus.OK,
      description: 'Current user profile returned.',
      type: AuthProfileResponseDto,
   })
   @ApiErrorResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Unauthorized if authentication is missing or invalid.',
      errorCodes: [COMMON_ERROR_CODES.UNAUTHORIZED, AUTH_ERROR_CODES.TOKEN_INVALID_OR_EXPIRED],
   })
   @ResponseMessage(AUTH_RESPONSE_MESSAGES.GET_PROFILE_SUCCESS)
   getProfile(@CurrentUser() user: JwtPayload): AuthProfileResponseDto {
      return user;
   }
}
