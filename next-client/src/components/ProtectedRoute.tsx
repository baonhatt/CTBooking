'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { getCookie } from '@/lib/cookies';

import PageLoading from '@/components/PageLoading';

interface Props {
  children: React.ReactNode;
}

/**
 * Client-side route guard - Check cookie/localStorage for userToken
 * Sử dụng cho các trang client cần login (ví dụ: /account)
 * Chỉ check localStorage/cookie, không gọi API (nhanh)
 */
export default function ProtectedRoute({ children }: Props) {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    // Check auth via userToken (client-side route guard)
    const token = getCookie('userToken') || localStorage.getItem('userToken');
    if (!token) {
      toast.error('Vui lòng đăng nhập trước!', { duration: 3000 });
      window.dispatchEvent(new Event('open-login'));
      router.replace('/');
    } else {
      setIsCheckingAuth(false);
    }
  }, [router]);

  // Show styled page loading while checking auth
  if (isCheckingAuth) {
    return <PageLoading />;
  }

  return <>{children}</>;
}
