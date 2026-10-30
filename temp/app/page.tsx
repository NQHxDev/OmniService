'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function HomePage() {
   const { isAuthenticated, isLoading } = useAuth();
   const [mounted, setMounted] = useState(false);
   const router = useRouter();

   useEffect(() => {
      setMounted(true);
   }, []);

   useEffect(() => {
      if (mounted && !isLoading) {
         if (isAuthenticated) {
            router.replace('/dashboard');
         } else {
            router.replace('/login');
         }
      }
   }, [mounted, isAuthenticated, isLoading, router]);

   return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 transition-colors">
         <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Đang khởi tạo ứng dụng...</p>
         </div>
      </div>
   );
}
