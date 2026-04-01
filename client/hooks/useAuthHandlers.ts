import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export function useAuthHandlers(setUserName: (name: string | null) => void) {
  const navigator = useNavigate();
  const handleLogout = () => {
    localStorage.removeItem('authUser');
    localStorage.removeItem('userProfile');
    setUserName(null);
    window.dispatchEvent(new Event('user-auth-changed'));
    navigator('/');
    toast.success('Đã đăng xuất');
  };

  return { handleLogout };
}
