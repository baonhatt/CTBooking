import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error('404 Error: User attempted to access non-existent route:', location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center">
        <div className="text-6xl font-extrabold text-primary">404</div>
        <p className="mt-3 text-muted-foreground">Trang không tồn tại.</p>
        <div className="mt-6">
          <Button onClick={() => navigate('/')}>Về Trang Chủ</Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
