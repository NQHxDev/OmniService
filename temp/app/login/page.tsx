'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import { Lock, Mail, Eye, EyeOff, ShieldCheck, AlertCircle } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

export default function LoginPage() {
   const { login, isAuthenticated, isLoading } = useAuth();
   const [mounted, setMounted] = useState(false);
   const router = useRouter();
   const [email, setEmail] = useState('');
   const [password, setPassword] = useState('');
   const [showPassword, setShowPassword] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [isSubmitting, setIsSubmitting] = useState(false);

   useEffect(() => {
      setMounted(true);
   }, []);

   useEffect(() => {
      if (mounted && !isLoading && isAuthenticated) {
         router.replace('/dashboard');
      }
   }, [mounted, isLoading, isAuthenticated, router]);

   const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setIsSubmitting(true);

      try {
         await login(email.trim(), password);
      } catch (err: unknown) {
         if (err instanceof ApiError) {
            const resp = err.response as { message?: string } | null;
            setError(
               (typeof resp?.message === 'string' ? resp.message : null) ??
                  err.message ??
                  'Đăng nhập thất bại. Vui lòng kiểm tra lại email hoặc mật khẩu.',
            );
         } else if (err instanceof Error) {
            setError(err.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại email hoặc mật khẩu.');
         } else {
            setError('Đăng nhập thất bại. Vui lòng kiểm tra lại email hoặc mật khẩu.');
         }
      } finally {
         setIsSubmitting(false);
      }
   };

   if (!mounted || isLoading) {
      return (
         <div className="flex min-h-screen items-center justify-center bg-slate-900">
            <div className="flex flex-col items-center gap-3">
               <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
               <p className="text-sm font-medium text-slate-400">Đang kiểm tra đăng nhập...</p>
            </div>
         </div>
      );
   }

   return (
      <div className="relative flex min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 transition-colors">
         {/* Top-right corner theme toggle */}
         <div className="absolute top-5 right-5 z-20">
            <ThemeToggle className="bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-700" />
         </div>

         <div className="m-auto w-full max-w-md p-6 z-10">
            <div className="rounded-2xl border border-white/20 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 p-8 shadow-2xl backdrop-blur-xl transition-colors duration-200">
               {/* Header */}
               <div className="mb-8 text-center">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30">
                     <ShieldCheck className="h-8 w-8" />
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                     Omni Admin Portal
                  </h1>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                     Hệ thống Quản lý & Duyệt sản phẩm, nhà cung cấp
                  </p>
               </div>

               {/* Error Notice */}
               {error && (
                  <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-700 dark:text-red-300">
                     <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
                     <div>
                        <p className="font-medium">Không thể đăng nhập</p>
                        <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">{error}</p>
                     </div>
                  </div>
               )}

               {/* Login Form */}
               <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                     <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Email
                     </label>
                     <div className="relative mt-1.5">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 dark:text-slate-500">
                           <Mail className="h-4 w-4" />
                        </div>
                        <input
                           type="email"
                           required
                           value={email}
                           onChange={(e) => setEmail(e.target.value)}
                           placeholder="admin@omniservices.dev"
                           className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 py-2.5 pl-10 pr-4 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 transition focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                        />
                     </div>
                  </div>

                  <div>
                     <div className="flex items-center justify-between">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                           Mật khẩu
                        </label>
                     </div>
                     <div className="relative mt-1.5">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 dark:text-slate-500">
                           <Lock className="h-4 w-4" />
                        </div>
                        <input
                           type={showPassword ? 'text' : 'password'}
                           required
                           value={password}
                           onChange={(e) => setPassword(e.target.value)}
                           placeholder="••••••••••••"
                           className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 py-2.5 pl-10 pr-11 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 transition focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                        />
                        <button
                           type="button"
                           onClick={() => setShowPassword(!showPassword)}
                           className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                        >
                           {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                     </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                     <label className="flex items-center gap-2 cursor-pointer">
                        <input
                           type="checkbox"
                           defaultChecked
                           className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>Ghi nhớ đăng nhập</span>
                     </label>
                     <span className="text-slate-400 dark:text-slate-500">Bảo mật Cookie HttpOnly</span>
                  </div>

                  <button
                     type="submit"
                     disabled={isSubmitting}
                     className="flex w-full items-center justify-center rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-600/50 disabled:opacity-60"
                  >
                     {isSubmitting ? (
                        <div className="flex items-center gap-2">
                           <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                           <span>Đang xác thực...</span>
                        </div>
                     ) : (
                        'Đăng nhập hệ thống'
                     )}
                  </button>
               </form>

               {/* Dev Hint Footer */}
               <div className="mt-8 border-t border-slate-100 dark:border-slate-800 pt-4 text-center">
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                     Gateway Endpoint:{' '}
                     <code className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-slate-600 dark:text-slate-300">
                        http://localhost:8080/api/v1
                     </code>
                  </p>
               </div>
            </div>
         </div>
      </div>
   );
}
