'use client';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export function useAuthHandlers(setUserName: (name: string | null) => void) {
  const router = useRouter();
  const handleLogout = () => {
    localStorage.removeItem('authUser');
    localStorage.removeItem('userProfile');
    setUserName(null);
    window.dispatchEvent(new Event('user-auth-changed'));
    router.push('/');
    toast.success('Đã đăng xuất');
  };

  return { handleLogout };
}


