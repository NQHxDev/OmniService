export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

export interface ApiResponse<T = unknown> {
   statusCode: number;
   message?: string;
   data: T;
   timestamp?: string;
   correlationId?: string;
}

export interface UserProfile {
   userId: string;
   email: string;
   roles: string[];
   status?: string;
   isEmailVerified?: boolean;
   lastLoginAt?: string | null;
   createdAt?: string;
}

export interface AuthTokens {
   accessToken: string;
   refreshToken: string;
   tokenType: string;
   expiresIn: number;
}

export interface AuthResponseData {
   user: UserProfile;
   tokens: AuthTokens;
}

interface RefreshTokenResponseData {
   tokens?: {
      accessToken?: string;
      refreshToken?: string;
   };
}

export class ApiError extends Error {
   status: number;
   response: unknown;

   constructor(message: string, status: number, response?: unknown) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.response = response;
   }
}

class ApiClient {
   private baseUrl: string;
   private token: string | null = null;
   private refreshTokenValue: string | null = null;
   private refreshPromise: Promise<boolean> | null = null;

   constructor(baseUrl: string) {
      this.baseUrl = baseUrl;
      if (typeof window !== 'undefined') {
         this.token = localStorage.getItem('accessToken');
         this.refreshTokenValue = localStorage.getItem('refreshToken');
      }
   }

   setToken(token: string | null) {
      this.token = token;
      if (typeof window !== 'undefined') {
         if (token) {
            localStorage.setItem('accessToken', token);
         } else {
            localStorage.removeItem('accessToken');
         }
      }
   }

   getToken(): string | null {
      if (!this.token && typeof window !== 'undefined') {
         this.token = localStorage.getItem('accessToken');
      }
      return this.token;
   }

   setRefreshToken(token: string | null) {
      this.refreshTokenValue = token;
      if (typeof window !== 'undefined') {
         if (token) {
            localStorage.setItem('refreshToken', token);
         } else {
            localStorage.removeItem('refreshToken');
         }
      }
   }

   getRefreshToken(): string | null {
      if (!this.refreshTokenValue && typeof window !== 'undefined') {
         this.refreshTokenValue = localStorage.getItem('refreshToken');
      }
      return this.refreshTokenValue;
   }

   clearTokens() {
      this.setToken(null);
      this.setRefreshToken(null);
   }

   async refreshToken(): Promise<boolean> {
      if (this.refreshPromise) {
         return this.refreshPromise;
      }

      this.refreshPromise = (async () => {
         const controller = new AbortController();
         const timeoutId = setTimeout(() => controller.abort(), 7000);

         try {
            const url = `${this.baseUrl}/auth/refresh`;
            const storedRt = this.getRefreshToken();
            const headers: Record<string, string> = {
               'Content-Type': 'application/json',
               Accept: 'application/json',
            };

            if (storedRt) {
               headers['X-Refresh-Token'] = storedRt;
            }

            const response = await fetch(url, {
               method: 'POST',
               headers,
               body: JSON.stringify(storedRt ? { refreshToken: storedRt } : {}),
               credentials: 'include', // Sends HttpOnly refresh_token cookie
               signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
               if (response.status === 401 || response.status === 400) {
                  this.clearTokens();
               }
               return false;
            }

            const resData = (await response.json().catch(() => null)) as ApiResponse<RefreshTokenResponseData> | null;
            const tokens = resData?.data?.tokens;
            if (tokens?.accessToken) {
               this.setToken(tokens.accessToken);
            }
            if (tokens?.refreshToken) {
               this.setRefreshToken(tokens.refreshToken);
            }
            return true;
         } catch {
            clearTimeout(timeoutId);
            return false;
         } finally {
            this.refreshPromise = null;
         }
      })();

      return this.refreshPromise;
   }

   async request<T>(endpoint: string, options: RequestInit = {}, isRetry = false): Promise<T> {
      const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;

      const headers: Record<string, string> = {
         'Content-Type': 'application/json',
         Accept: 'application/json',
         ...(options.headers as Record<string, string>),
      };

      const token = this.getToken();
      if (token) {
         headers['Authorization'] = `Bearer ${token}`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 9000);

      let response: Response;
      try {
         response = await fetch(url, {
            ...options,
            headers,
            credentials: 'include', // Essential for HttpOnly cookies (access_token & refresh_token)
            signal: options.signal || controller.signal,
         });
      } finally {
         clearTimeout(timeoutId);
      }

      // Check for 401 Unauthorized - Attempt transparent token refresh
      const isAuthRoute =
         endpoint.includes('/auth/login') || endpoint.includes('/auth/refresh') || endpoint.includes('/auth/register');

      if (response.status === 401 && !isRetry && !isAuthRoute) {
         const refreshed = await this.refreshToken();
         if (refreshed) {
            return this.request<T>(endpoint, options, true);
         }
      }

      const data: unknown = await response.json().catch(() => null);

      if (!response.ok) {
         const errorData = data as { message?: string; error?: string } | null;
         const errorMessage =
            (typeof errorData?.message === 'string' ? errorData.message : null) ??
            (typeof errorData?.error === 'string' ? errorData.error : null) ??
            `Request failed with status ${response.status}`;
         const error = new ApiError(errorMessage, response.status, data);
         throw error;
      }

      return data as T;
   }

   get<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
      return this.request<T>(endpoint, { ...options, method: 'GET' });
   }

   post<T>(endpoint: string, body?: unknown, options: RequestInit = {}): Promise<T> {
      return this.request<T>(endpoint, {
         ...options,
         method: 'POST',
         body: body !== undefined ? JSON.stringify(body) : undefined,
      });
   }

   put<T>(endpoint: string, body?: unknown, options: RequestInit = {}): Promise<T> {
      return this.request<T>(endpoint, {
         ...options,
         method: 'PUT',
         body: body !== undefined ? JSON.stringify(body) : undefined,
      });
   }

   patch<T>(endpoint: string, body?: unknown, options: RequestInit = {}): Promise<T> {
      return this.request<T>(endpoint, {
         ...options,
         method: 'PATCH',
         body: body !== undefined ? JSON.stringify(body) : undefined,
      });
   }

   delete<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
      return this.request<T>(endpoint, { ...options, method: 'DELETE' });
   }
}

export const api = new ApiClient(API_BASE_URL);

export type SupplierStatus = 'ACTIVE' | 'PENDING' | 'UNDER_REVIEW' | 'REJECTED' | 'SUSPENDED';

export interface SupplierItem {
   supplierId: string;
   supplierName: string;
   supplierSlug: string;
   supplierCode: string;
   contactEmail?: string;
   contactPhone?: string;
   address?: string;
   city?: string;
   rating: number;
   isVerified: boolean;
   supplierStatus: SupplierStatus;
   supplierLogoUrl?: string;
   merchantType?: 'INDIVIDUAL' | 'ENTERPRISE';
   citizenId?: string;
   citizenIdIssuedDate?: string;
   idCardFrontUrl?: string;
   idCardBackUrl?: string;
   businessName?: string;
   taxCode?: string;
   businessLicenseUrl?: string;
   bankName?: string;
   bankAccountNumber?: string;
   bankAccountHolder?: string;
   rejectionReason?: string;
   verifiedAt?: string;
   createdAt?: string;
   updatedAt?: string;
}

export interface ListSuppliersResponse {
   items: SupplierItem[];
   total: number;
   limit: number;
   offset: number;
}

export interface ListSuppliersParams {
   status?: SupplierStatus | 'ALL';
   city?: string;
   limit?: number;
   offset?: number;
}

export const suppliersApi = {
   async list(params?: ListSuppliersParams): Promise<ApiResponse<ListSuppliersResponse>> {
      const searchParams = new URLSearchParams();
      if (params?.status && params.status !== 'ALL') {
         searchParams.set('status', params.status);
      }
      if (params?.city) {
         searchParams.set('city', params.city);
      }
      if (params?.limit !== undefined) {
         searchParams.set('limit', String(params.limit));
      }
      if (params?.offset !== undefined) {
         searchParams.set('offset', String(params.offset));
      }
      const qs = searchParams.toString();
      const endpoint = qs ? `/suppliers?${qs}` : '/suppliers';
      return api.get<ApiResponse<ListSuppliersResponse>>(endpoint);
   },

   async getById(supplierId: string): Promise<ApiResponse<SupplierItem>> {
      return api.get<ApiResponse<SupplierItem>>(`/suppliers/${supplierId}`);
   },

   async verify(supplierId: string, isVerified = true): Promise<ApiResponse<SupplierItem>> {
      return api.post<ApiResponse<SupplierItem>>(`/suppliers/${supplierId}/verify`, { isVerified });
   },

   async reject(supplierId: string, reason: string): Promise<ApiResponse<SupplierItem>> {
      return api.patch<ApiResponse<SupplierItem>>(`/suppliers/${supplierId}/reject`, { reason });
   },

   async updateStatus(supplierId: string, status: SupplierStatus): Promise<ApiResponse<SupplierItem>> {
      return api.patch<ApiResponse<SupplierItem>>(`/suppliers/${supplierId}/status`, { status });
   },
};

export type ModerationStatus =
   'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'EDIT_PENDING_APPROVAL' | 'SUSPENDED';

export type ModerationAction = 'APPROVE' | 'REJECT' | 'SUSPEND' | 'APPROVE_EDIT' | 'REJECT_EDIT';

export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE';

export interface ProductVariantItem {
   variantId?: string;
   sku: string;
   barcode?: string;
   variantName: string;
   optionValues?: Record<string, string>;
   price: number;
   compareAtPrice?: number | null;
   currency?: string;
   stockQuantity: number;
   lowStockThreshold?: number;
   weightGrams?: number;
   dimensions?: { length?: number; width?: number; height?: number; unit?: string };
   status?: 'AVAILABLE' | 'OUT_OF_STOCK' | 'DISCONTINUED';
   imageUrl?: string;
}

export interface ProductItem {
   productId: string;
   supplierId: string;
   supplierName?: string;
   whoCategoryCode: string;
   productName: string;
   productSlug: string;
   description: string;
   origin?: string;
   storageCondition?: string;
   shelfLifeDays?: number;
   images: string[];
   status: ProductStatus;
   moderationStatus: ModerationStatus;
   rejectionReason?: string;
   moderationNotes?: string;
   pendingEditData?: Record<string, unknown> | null;
   variants: ProductVariantItem[];
   createdAt?: string;
   updatedAt?: string;
   submittedAt?: string;
}

export interface ListProductsResponse {
   items: ProductItem[];
   total: number;
}

export interface ListProductsParams {
   supplierId?: string;
   whoCategoryCode?: string;
   status?: ProductStatus;
   moderationStatus?: ModerationStatus | 'ALL';
   search?: string;
   limit?: number;
   offset?: number;
}

export interface ModerateProductPayload {
   moderationStatus: 'APPROVED' | 'REJECTED' | 'SUSPENDED';
   action?: ModerationAction;
   rejectionReason?: string;
   moderationNotes?: string;
}

export const productsApi = {
   async list(params?: ListProductsParams): Promise<ApiResponse<ListProductsResponse>> {
      const searchParams = new URLSearchParams();
      if (params?.supplierId) {
         searchParams.set('supplierId', params.supplierId);
      }
      if (params?.whoCategoryCode) {
         searchParams.set('whoCategoryCode', params.whoCategoryCode);
      }
      if (params?.status) {
         searchParams.set('status', params.status);
      }
      if (params?.moderationStatus && params.moderationStatus !== 'ALL') {
         searchParams.set('moderationStatus', params.moderationStatus);
      }
      if (params?.search) {
         searchParams.set('search', params.search);
      }
      if (params?.limit !== undefined) {
         searchParams.set('limit', String(params.limit));
      }
      if (params?.offset !== undefined) {
         searchParams.set('offset', String(params.offset));
      }
      const qs = searchParams.toString();
      const endpoint = qs ? `/products?${qs}` : '/products';
      return api.get<ApiResponse<ListProductsResponse>>(endpoint);
   },

   async getById(productId: string): Promise<ApiResponse<ProductItem>> {
      return api.get<ApiResponse<ProductItem>>(`/products/${productId}`);
   },

   async moderate(productId: string, payload: ModerateProductPayload): Promise<ApiResponse<ProductItem>> {
      return api.patch<ApiResponse<ProductItem>>(`/products/${productId}/moderate`, payload);
   },

   async approve(productId: string, notes?: string): Promise<ApiResponse<ProductItem>> {
      return this.moderate(productId, {
         moderationStatus: 'APPROVED',
         action: 'APPROVE',
         moderationNotes: notes,
      });
   },

   async reject(productId: string, reason: string, notes?: string): Promise<ApiResponse<ProductItem>> {
      return this.moderate(productId, {
         moderationStatus: 'REJECTED',
         action: 'REJECT',
         rejectionReason: reason,
         moderationNotes: notes,
      });
   },

   async suspend(productId: string, reason: string, notes?: string): Promise<ApiResponse<ProductItem>> {
      return this.moderate(productId, {
         moderationStatus: 'SUSPENDED',
         action: 'SUSPEND',
         rejectionReason: reason,
         moderationNotes: notes,
      });
   },
};
