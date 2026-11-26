'use client';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useAuth } from './useAuth';
import { clearCustomerProfile } from '@/lib/customer-session';

export function useAuthHandlers(setUserName: (name: string | null) => void) {
  const router = useRouter();
  const { logout } = useAuth();

  const handleLogout = async () => {
    try {
      // The API revokes the session and clears the HttpOnly cookie; this browser then forgets the profile
      await logout();
      clearCustomerProfile();
      setUserName(null);
      window.dispatchEvent(new Event('user-auth-changed'));
      router.push('/');
      toast.success('Đã đăng xuất');
    } catch (error) {
      toast.error('Đăng xuất thất bại');
      console.error('Logout error:', error);
    }
  };

  return { handleLogout };
}
