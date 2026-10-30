'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeContextValue {
   theme: Theme;
   resolvedTheme: ResolvedTheme;
   setTheme: (theme: Theme) => void;
   toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const THEME_STORAGE_KEY = 'omni_theme';

function getSystemTheme(): ResolvedTheme {
   if (typeof window === 'undefined') return 'light';
   return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
   const [theme, setThemeState] = useState<Theme>('system');
   const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light');
   const [mounted, setMounted] = useState(false);

   const applyTheme = useCallback((targetTheme: Theme) => {
      const root = document.documentElement;
      let effectiveTheme: ResolvedTheme;

      if (targetTheme === 'system') {
         effectiveTheme = getSystemTheme();
      } else {
         effectiveTheme = targetTheme;
      }

      setResolvedTheme(effectiveTheme);

      if (effectiveTheme === 'dark') {
         root.classList.add('dark');
         root.style.colorScheme = 'dark';
      } else {
         root.classList.remove('dark');
         root.style.colorScheme = 'light';
      }
   }, []);

   useEffect(() => {
      setMounted(true);
      try {
         const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
         const initialTheme: Theme = stored && ['light', 'dark', 'system'].includes(stored) ? stored : 'system';
         setThemeState(initialTheme);
         applyTheme(initialTheme);
      } catch {
         applyTheme('system');
      }
   }, [applyTheme]);

   // Listen for system color scheme changes when theme is set to 'system'
   useEffect(() => {
      if (!mounted) return;

      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => {
         if (theme === 'system') {
            applyTheme('system');
         }
      };

      if (mediaQuery.addEventListener) {
         mediaQuery.addEventListener('change', handleChange);
         return () => mediaQuery.removeEventListener('change', handleChange);
      } else {
         // Fallback for older browsers
         mediaQuery.addListener(handleChange);
         return () => mediaQuery.removeListener(handleChange);
      }
   }, [mounted, theme, applyTheme]);

   const setTheme = useCallback(
      (newTheme: Theme) => {
         setThemeState(newTheme);
         try {
            localStorage.setItem(THEME_STORAGE_KEY, newTheme);
         } catch {
            // Storage quota or private browsing fallback
         }
         applyTheme(newTheme);
      },
      [applyTheme],
   );

   const toggleTheme = useCallback(() => {
      const nextTheme: Theme = resolvedTheme === 'dark' ? 'light' : 'dark';
      setTheme(nextTheme);
   }, [resolvedTheme, setTheme]);

   return (
      <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>{children}</ThemeContext.Provider>
   );
}

export function useTheme(): ThemeContextValue {
   const context = useContext(ThemeContext);
   if (!context) {
      throw new Error('useTheme must be used within a ThemeProvider');
   }
   return context;
}
