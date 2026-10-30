'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError, ApiResponse, AuthResponseData, UserProfile } from './api';

interface AuthContextType {
   user: UserProfile | null;
   isLoading: boolean;
   isAuthenticated: boolean;
   login: (email: string, password: string) => Promise<void>;
   logout: () => Promise<void>;
   refreshProfile: () => Promise<UserProfile | null>;
}

export interface RawUserData {
   userId?: string;
   sub?: string;
   id?: string;
   email?: string;
   roles?: string[] | string;
   status?: string;
   isEmailVerified?: boolean;
   lastLoginAt?: string | null;
   createdAt?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY_USER = 'omni_user_profile';

function normalizeUser(raw: unknown): UserProfile {
   if (!raw || typeof raw !== 'object') {
      return { userId: '', email: '', roles: [] };
   }
   const u = raw as RawUserData;
   return {
      userId: u.userId ?? u.sub ?? u.id ?? '',
      email: u.email ?? '',
      roles: Array.isArray(u.roles) ? u.roles : typeof u.roles === 'string' ? [u.roles] : [],
      status: u.status ?? 'active',
      isEmailVerified: u.isEmailVerified,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
   };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
   // Always start with user=null and isLoading=true to guarantee server HTML and initial client hydration match identically
   const [user, setUser] = useState<UserProfile | null>(null);
   const [isLoading, setIsLoading] = useState<boolean>(true);

   const router = useRouter();

   const refreshProfile = useCallback(async (): Promise<UserProfile | null> => {
      try {
         const res = await api.get<ApiResponse<RawUserData>>('/auth/me');
         if (res && res.data) {
            const profile = normalizeUser(res.data);
            setUser(profile);
            if (typeof window !== 'undefined') {
               localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(profile));
            }
            return profile;
         }
         return null;
      } catch (err: unknown) {
         if (err instanceof ApiError && err.status === 401) {
            setUser(null);
            api.clearTokens();
            if (typeof window !== 'undefined') {
               localStorage.removeItem(STORAGE_KEY_USER);
            }
         }
         return null;
      } finally {
         setIsLoading(false);
      }
   }, []);

   useEffect(() => {
      let isMounted = true;

      // Restore cached user immediately on mount after hydration completes
      try {
         const cached = localStorage.getItem(STORAGE_KEY_USER);
         if (cached) {
            setUser(JSON.parse(cached) as UserProfile);
            setIsLoading(false);
         }
      } catch {
         // Ignore invalid JSON cached value
      }

      const safetyTimer = setTimeout(() => {
         if (isMounted) {
            setIsLoading(false);
         }
      }, 4000);

      void refreshProfile().finally(() => {
         if (isMounted) {
            clearTimeout(safetyTimer);
            setIsLoading(false);
         }
      });

      return () => {
         isMounted = false;
         clearTimeout(safetyTimer);
      };
   }, [refreshProfile]);

   const login = async (email: string, password: string) => {
      setIsLoading(true);
      try {
         const res = await api.post<ApiResponse<AuthResponseData>>('/auth/login', {
            email,
            password,
         });

         if (res?.data) {
            const { user: userData, tokens } = res.data;
            if (tokens?.accessToken) {
               api.setToken(tokens.accessToken);
            }
            if (tokens?.refreshToken) {
               api.setRefreshToken(tokens.refreshToken);
            }
            const profile = normalizeUser(userData);
            setUser(profile);
            if (typeof window !== 'undefined') {
               localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(profile));
            }
            router.push('/dashboard');
         }
      } finally {
         setIsLoading(false);
      }
   };

   const logout = async () => {
      setIsLoading(true);
      try {
         await api.post('/auth/logout').catch(() => undefined);
      } finally {
         setUser(null);
         api.clearTokens();
         if (typeof window !== 'undefined') {
            localStorage.removeItem(STORAGE_KEY_USER);
         }
         setIsLoading(false);
         router.push('/login');
      }
   };

   return (
      <AuthContext.Provider
         value={{
            user,
            isLoading,
            isAuthenticated: !!user,
            login,
            logout,
            refreshProfile,
         }}
      >
         {children}
      </AuthContext.Provider>
   );
}

export function useAuth() {
   const context = useContext(AuthContext);
   if (!context) {
      throw new Error('useAuth must be used within an AuthProvider');
   }
   return context;
}
