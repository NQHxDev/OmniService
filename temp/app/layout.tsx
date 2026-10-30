import './globals.css';
import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/auth-context';
import { ThemeProvider } from '@/lib/theme-context';

export const metadata: Metadata = {
   title: 'OmniServices Admin Portal',
   description: 'Web Portal for Product & Supplier Approvals',
};

const themeInitScript = `
(function() {
   try {
      var stored = localStorage.getItem('omni_theme');
      var isDark = stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches) || (stored === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      if (isDark) {
         document.documentElement.classList.add('dark');
         document.documentElement.style.colorScheme = 'dark';
      } else {
         document.documentElement.classList.remove('dark');
         document.documentElement.style.colorScheme = 'light';
      }
   } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
   return (
      <html lang="vi" suppressHydrationWarning>
         <head>
            <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
         </head>
         <body className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 antialiased selection:bg-indigo-500 selection:text-white transition-colors duration-200">
            <ThemeProvider>
               <AuthProvider>{children}</AuthProvider>
            </ThemeProvider>
         </body>
      </html>
   );
}
