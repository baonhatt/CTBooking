'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import React, { useEffect, useState } from 'react';
import { checkCustomerSession, clearCustomerProfile, hasStoredProfile, removeLegacyTokens } from '@/lib/customer-session';

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

  // Member-only packages are only sent to signed-in customers. The home page is drawn for visitors, so a signed-in
  // customer reloads the package lists once on arrival, and everybody reloads them after signing in or out.
  useEffect(() => {
    const reloadPackageLists = () => {
      queryClient.invalidateQueries({ queryKey: ['activeTickets'] });
      queryClient.invalidateQueries({ queryKey: ['vrPackages'] });
    };
    // Token copies kept by the old login are removed. A saved profile is checked once against the API: a session that
    // ended while the site was closed signs the header out; a valid one reloads the lists with member-only packages.
    removeLegacyTokens();
    if (hasStoredProfile()) {
      checkCustomerSession().then((sessionState) => {
        if (sessionState === 'invalid') {
          clearCustomerProfile();
          window.dispatchEvent(new Event('user-auth-changed'));
        } else if (sessionState === 'valid') {
          reloadPackageLists();
        }
      });
    }
    window.addEventListener('user-auth-changed', reloadPackageLists);
    return () => window.removeEventListener('user-auth-changed', reloadPackageLists);
  }, [queryClient]);

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
