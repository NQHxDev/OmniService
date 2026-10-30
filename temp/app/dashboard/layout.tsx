'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { LayoutDashboard, PackageCheck, Building2, LogOut, ShieldAlert, ChevronRight, Bell } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
   const { user, isLoading, isAuthenticated, logout } = useAuth();
   const [mounted, setMounted] = useState(false);
   const router = useRouter();
   const pathname = usePathname();
   const [tookTooLong, setTookTooLong] = useState(false);

   useEffect(() => {
      setMounted(true);
   }, []);

   useEffect(() => {
      if (mounted && !isLoading && !isAuthenticated) {
         router.replace('/login');
      }
   }, [mounted, isLoading, isAuthenticated, router]);

   // Fallback safety timeout if initial check takes too long
   useEffect(() => {
      if (isLoading) {
         const timer = setTimeout(() => {
            setTookTooLong(true);
         }, 3500);
         return () => clearTimeout(timer);
      }
   }, [isLoading]);

   // Loading state
   if (!mounted || isLoading) {
      return (
         <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 transition-colors">
            <div className="flex flex-col items-center gap-3 p-6 text-center">
               <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
               <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Đang kiểm tra quyền truy cập...</p>
               {tookTooLong && (
                  <button
                     onClick={() => router.replace('/login')}
                     className="mt-2 px-3.5 py-1.5 text-xs font-semibold text-indigo-600 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                  >
                     Mạng phản hồi chậm? Bấm vào đây để đăng nhập lại
                  </button>
               )}
            </div>
         </div>
      );
   }

   // Not authenticated state
   if (!isAuthenticated) {
      return (
         <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 transition-colors">
            <div className="flex flex-col items-center gap-3 p-6 max-w-sm text-center">
               <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
               <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Phiên làm việc đã hết hạn</h2>
               <p className="text-xs text-slate-500 dark:text-slate-400">
                  Hệ thống đang chuyển hướng bạn về trang đăng nhập...
               </p>
               <button
                  onClick={() => router.replace('/login')}
                  className="mt-2 w-full px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition shadow-sm"
               >
                  Đến trang Đăng nhập ngay
               </button>
            </div>
         </div>
      );
   }

   const navItems = [
      {
         label: 'Tổng quan',
         href: '/dashboard',
         icon: LayoutDashboard,
      },
      {
         label: 'Duyệt sản phẩm',
         href: '/dashboard/products',
         icon: PackageCheck,
         badge: '12',
      },
      {
         label: 'Duyệt tài khoản Supp',
         href: '/dashboard/suppliers',
         icon: Building2,
         badge: '4',
      },
   ];

   return (
      <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
         {/* Sidebar */}
         <aside className="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col fixed inset-y-0 z-20 transition-colors duration-200">
            <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-100 dark:border-slate-800">
               <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
                  <ShieldAlert className="h-5 w-5" />
               </div>
               <div>
                  <span className="font-bold text-slate-900 dark:text-white tracking-tight block">OmniAdmin</span>
                  <span className="text-[10px] uppercase font-semibold text-indigo-600 dark:text-indigo-400 tracking-wider">
                     Moderation Portal
                  </span>
               </div>
            </div>

            {/* Navigation */}
            <nav className="p-4 space-y-1.5 flex-1">
               {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                     <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                           isActive
                              ? 'bg-indigo-50 text-indigo-700 shadow-sm dark:bg-indigo-950/70 dark:text-indigo-300 dark:border dark:border-indigo-800/60'
                              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-slate-100'
                        }`}
                     >
                        <div className="flex items-center gap-3">
                           <Icon
                              className={`h-4 w-4 ${
                                 isActive
                                    ? 'text-indigo-600 dark:text-indigo-400'
                                    : 'text-slate-400 dark:text-slate-500'
                              }`}
                           />
                           <span>{item.label}</span>
                        </div>
                        {item.badge && (
                           <span
                              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                                 isActive
                                    ? 'bg-indigo-200/70 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200'
                                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                              }`}
                           >
                              {item.badge}
                           </span>
                        )}
                     </Link>
                  );
               })}
            </nav>

            {/* User Card & Logout in Sidebar Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60">
               <div className="flex items-center gap-3 mb-3">
                  <div className="h-9 w-9 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 font-semibold text-xs border border-slate-300 dark:border-slate-700">
                     {user?.email?.[0]?.toUpperCase() || 'A'}
                  </div>
                  <div className="flex-1 min-w-0">
                     <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">{user?.email}</p>
                     <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                        Role: {user?.roles?.join(', ') || 'admin'}
                     </p>
                  </div>
               </div>
               <button
                  onClick={logout}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-lg transition"
               >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Đăng xuất</span>
               </button>
            </div>
         </aside>

         {/* Main Content Area */}
         <div className="flex-1 pl-64 flex flex-col min-w-0">
            {/* Top Navbar */}
            <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-8 flex items-center justify-between sticky top-0 z-10 transition-colors duration-200">
               <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>Admin</span>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-400 dark:text-slate-600" />
                  <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">
                     {pathname.split('/').pop() || 'Dashboard'}
                  </span>
               </div>

               <div className="flex items-center gap-3">
                  {/* Dark/Light Theme Toggle */}
                  <ThemeToggle />

                  <button
                     title="Thông báo"
                     className="h-9 w-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 relative transition"
                  >
                     <Bell className="h-4 w-4" />
                     <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                  </button>

                  <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 mx-1" />

                  <div className="flex items-center gap-2.5">
                     <div className="text-right">
                        <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 block">
                           {user?.email}
                        </span>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                           ● Đang hoạt động
                        </span>
                     </div>
                  </div>
               </div>
            </header>

            {/* Page Content */}
            <main className="flex-1 p-8">{children}</main>
         </div>
      </div>
   );
}
