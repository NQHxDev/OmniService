'use client';

import React, { useEffect, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';

interface ThemeToggleProps {
   variant?: 'button' | 'dropdown' | 'compact';
   className?: string;
}

export function ThemeToggle({ variant = 'button', className = '' }: ThemeToggleProps) {
   const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();
   const [mounted, setMounted] = useState(false);
   const [isOpen, setIsOpen] = useState(false);

   useEffect(() => {
      setMounted(true);
   }, []);

   // Placeholder for SSR / initial hydration
   if (!mounted) {
      return (
         <div
            className={`h-9 w-9 rounded-xl border border-slate-200 bg-white/60 dark:border-slate-800 dark:bg-slate-900/60 ${className}`}
         />
      );
   }

   if (variant === 'compact') {
      return (
         <button
            type="button"
            onClick={toggleTheme}
            aria-label={resolvedTheme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
            title={resolvedTheme === 'dark' ? 'Chế độ Sáng' : 'Chế độ Tối'}
            className={`relative flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-100 hover:text-indigo-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-amber-400 ${className}`}
         >
            {resolvedTheme === 'dark' ? (
               <Sun className="h-4 w-4 transition-transform duration-300 rotate-0 scale-100 text-amber-400" />
            ) : (
               <Moon className="h-4 w-4 transition-transform duration-300 rotate-0 scale-100 text-slate-700" />
            )}
         </button>
      );
   }

   if (variant === 'dropdown') {
      return (
         <div className="relative">
            <button
               type="button"
               onClick={() => setIsOpen(!isOpen)}
               className={`flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 ${className}`}
            >
               {resolvedTheme === 'dark' ? (
                  <Sun className="h-4 w-4 text-amber-400" />
               ) : (
                  <Moon className="h-4 w-4 text-indigo-600" />
               )}
               <span className="capitalize">{theme === 'system' ? 'Hệ thống' : theme === 'dark' ? 'Tối' : 'Sáng'}</span>
            </button>

            {isOpen && (
               <>
                  <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
                  <div className="absolute right-0 mt-2 z-40 w-36 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl backdrop-blur-lg dark:border-slate-800 dark:bg-slate-900">
                     <button
                        onClick={() => {
                           setTheme('light');
                           setIsOpen(false);
                        }}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                           theme === 'light'
                              ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400'
                              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                        }`}
                     >
                        <Sun className="h-3.5 w-3.5 text-amber-500" />
                        <span>Sáng (Light)</span>
                     </button>
                     <button
                        onClick={() => {
                           setTheme('dark');
                           setIsOpen(false);
                        }}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                           theme === 'dark'
                              ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400'
                              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                        }`}
                     >
                        <Moon className="h-3.5 w-3.5 text-indigo-400" />
                        <span>Tối (Dark)</span>
                     </button>
                     <button
                        onClick={() => {
                           setTheme('system');
                           setIsOpen(false);
                        }}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                           theme === 'system'
                              ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400'
                              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                        }`}
                     >
                        <Monitor className="h-3.5 w-3.5 text-slate-400" />
                        <span>Theo hệ thống</span>
                     </button>
                  </div>
               </>
            )}
         </div>
      );
   }

   // Default button toggle: fast, intuitive, one-click toggle with visual indicator
   return (
      <button
         type="button"
         onClick={toggleTheme}
         aria-label={resolvedTheme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
         title={
            resolvedTheme === 'dark'
               ? 'Đang là Giao diện Tối - Bấm để chuyển sang Sáng'
               : 'Đang là Giao diện Sáng - Bấm để chuyển sang Tối'
         }
         className={`group relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:border-slate-700 ${className}`}
      >
         <Sun
            className={`h-4 w-4 transition-all duration-300 text-amber-500 dark:text-amber-400 ${
               resolvedTheme === 'dark' ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0 absolute'
            }`}
         />
         <Moon
            className={`h-4 w-4 transition-all duration-300 text-slate-700 dark:text-slate-300 ${
               resolvedTheme === 'dark' ? 'rotate-90 scale-0 opacity-0 absolute' : 'rotate-0 scale-100 opacity-100'
            }`}
         />
      </button>
   );
}
