import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './useAuth';

export function useAuthHandlers(setUserName: (name: string | null) => void) {
<<<<<<< HEAD
        const navigator = useNavigate();
        const { logout } = useAuth();

        const handleLogout = async () => {
                try {
                        await logout();
                        localStorage.removeItem('userToken');
                        localStorage.removeItem('userProfile');
                        setUserName(null);
                        window.dispatchEvent(new Event('user-auth-changed'));
                        navigator('/');
                        toast.success('Đã đăng xuất');
                } catch (error) {
                        toast.error('Đăng xuất thất bại');
                        console.error('Logout error:', error);
                }
        };

        return { handleLogout };
=======
  const navigator = useNavigate();
  const { logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      localStorage.removeItem('userToken');
      localStorage.removeItem('userProfile');
      setUserName(null);
      window.dispatchEvent(new Event('user-auth-changed'));
      navigator('/');
      toast.success('Đã đăng xuất');
    } catch (error) {
      toast.error('Đăng xuất thất bại');
      console.error('Logout error:', error);
    }
  };

  return { handleLogout };
>>>>>>> preview
}
