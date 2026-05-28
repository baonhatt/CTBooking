import './global.css';

import { createRoot } from 'react-dom/client';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import LoadingScreen from './components/LoadingScreen';
import { HelmetProvider } from 'react-helmet-async';
const Maintenance = lazy(() => import('./pages/Maintenance'));

// Lazy load secondary pages to reduce initial bundle size
const NotFound = lazy(() => import('./pages/NotFound'));
const AdminGate = lazy(() => import('@/admin/auth/AdminGate').then((m) => ({ default: m.AdminGate })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      refetchOnWindowFocus: false
    }
  }
});

const isMaintenanceMode = import.meta.env.VITE_IS_MAINTENANCE === 'true';

const App = () => (
  <HelmetProvider>
    {isMaintenanceMode ? (
      <Suspense fallback={<LoadingScreen />}>
        <Maintenance />
      </Suspense>
    ) : (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster
            position="top-center"
            theme="dark"
            expand={false}
            richColors={false}
            offset={80}
            toastOptions={{
              unstyled: true,
              classNames: {
                toast:
                  'flex items-center gap-3 w-full max-w-[350px] p-4 rounded-xl border shadow-2xl backdrop-blur-md font-sans',
                title: 'text-sm font-bold',
                description: 'text-xs text-slate-300',
                actionButton: 'bg-zinc-900 text-zinc-50 font-medium',
                cancelButton: 'bg-zinc-100 text-zinc-900 font-medium',

                /* SUCCESS */
                success: 'bg-[#050915]/95 border-emerald-500/50 text-emerald-400',

                /* ERROR */
                error: 'bg-[#050915]/95 border-red-500/50 text-red-400',

                /* INFO */
                info: 'bg-[#050915]/95 border-blue-500/50 text-blue-400',

                /* WARNING */
                warning: 'bg-[#050915]/95 border-yellow-500/50 text-yellow-400'
              }
            }}
            icons={{
              success: (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="lucide lucide-check-circle"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <path d="m9 11 3 3L22 4" />
                </svg>
              ),
              error: (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="lucide lucide-x-circle"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="m15 9-6 6" />
                  <path d="m9 9 6 6" />
                </svg>
              ),
              info: (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="lucide lucide-info"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4" />
                  <path d="M12 8h.01" />
                </svg>
              ),
              warning: (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="lucide lucide-alert-triangle"
                >
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                  <path d="M12 9v4" />
                  <path d="M12 17h.01" />
                </svg>
              )
            }}
          />
          <BrowserRouter>
            <Suspense fallback={<LoadingScreen />}>
              <Routes>
                <Route path="/*" element={<AdminGate />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    )}
  </HelmetProvider>
);

createRoot(document.getElementById('root')!).render(<App />);
