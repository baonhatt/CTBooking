'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { checkCustomerSession, clearCustomerProfile, hasStoredProfile } from '@/lib/customer-session';

import PageLoading from '@/components/PageLoading';

interface Props {
  children: React.ReactNode;
}

/**
 * Client-side route guard for pages that need a signed-in customer (for example /account).
 * The session is the HttpOnly cookie, which page scripts cannot read, so the guard asks the API whether it is still
 * valid. No saved profile means nobody signed in on this browser, so that case is decided without a request.
 */
export default function ProtectedRoute({ children }: Props) {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const sendToLogin = () => {
      clearCustomerProfile();
      window.dispatchEvent(new Event('user-auth-changed'));
      toast.error('Vui lòng đăng nhập trước!', { duration: 3000 });
      // The home page opens the login dialog for this address (the header of this page goes away with the redirect)
      router.replace('/?login=1');
    };

    if (!hasStoredProfile()) {
      sendToLogin();
      return;
    }
    checkCustomerSession().then((sessionState) => {
      if (cancelled) return;
      // 'unknown' (offline, server error): show the page; its own requests will report a real expiry
      if (sessionState === 'invalid') sendToLogin();
      else setIsCheckingAuth(false);
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  // Show styled page loading while checking auth
  if (isCheckingAuth) {
    return <PageLoading />;
  }

  return <>{children}</>;
}
