'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center">
        <div className="text-6xl font-extrabold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
          404
        </div>
        <p className="mt-3 text-gray-400">Trang bạn tìm không tồn tại hoặc đã được di chuyển.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button
            className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold"
            onClick={() => router.push('/')}
          >
            Về Trang Chủ
          </Button>
          <Button
            variant="outline"
            className="bg-transparent border-white/30 text-white hover:bg-white/10"
            onClick={() => router.push('/booking')}
          >
            Đặt vé
          </Button>
        </div>
      </div>
    </div>
  );
}
