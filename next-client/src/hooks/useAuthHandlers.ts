'use client';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { useAuth } from './useAuth';
import { deleteCookie } from '@/lib/cookies';

export function useAuthHandlers(setUserName: (name: string | null) => void) {
  const router = useRouter();
  const { logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      localStorage.removeItem('userToken');
      localStorage.removeItem('userProfile');
      deleteCookie('userToken');
      deleteCookie('userProfile');
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
