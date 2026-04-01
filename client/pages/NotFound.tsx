import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import UserLayout from '@/user/layouts/UserLayout';
import { Button } from '@/components/ui/button';

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error('404 Error: User attempted to access non-existent route:', location.pathname);
  }, [location.pathname]);

  return (
    <UserLayout className="bg-gradient-dark" contentClassName="text-white">
      <div className="min-h-screen flex items-center justify-center px-4 pt-24">
        <div className="w-full max-w-xl">
          <div className="bg-black/40 border border-white/10 rounded-2xl p-8 text-center shadow-xl">
            <div className="text-6xl font-extrabold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              404
            </div>
            <p className="mt-3 text-gray-300">Trang bạn tìm không tồn tại hoặc đã được di chuyển.</p>
            <div className="mt-6 flex justify-center gap-3">
              <Button
                className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold"
                onClick={() => navigate('/')}
              >
                Về Trang Chủ
              </Button>
              <Button
                variant="outline"
                className="bg-transparent border-white/30 text-white hover:bg-white/10"
                onClick={() => navigate('/booking')}
              >
                Đặt vé
              </Button>
            </div>
          </div>
        </div>
      </div>
    </UserLayout>
  );
};

export default NotFound;
