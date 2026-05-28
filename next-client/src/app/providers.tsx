'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import React, { useState } from 'react';

export default function Providers({ children }: React.PropsWithChildren) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5,
            gcTime: 1000 * 60 * 30,
            refetchOnWindowFocus: false
          }
        }
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
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
              success: 'bg-[#050915]/95 border-emerald-500/50 text-emerald-400',
              error: 'bg-[#050915]/95 border-red-500/50 text-red-400',
              info: 'bg-[#050915]/95 border-blue-500/50 text-blue-400',
              warning: 'bg-[#050915]/95 border-yellow-500/50 text-yellow-400'
            }
          }}
        />
        {children as any}
      </TooltipProvider>
    </QueryClientProvider>
  );
}
