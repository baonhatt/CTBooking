'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function VRBookingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    router.replace(`/booking?${searchParams.toString()}`);
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-[#090d16] flex items-center justify-center text-white">
      <div className="animate-pulse text-sm font-mono">Đang chuyển hướng đến trang đặt vé...</div>
    </div>
  );
}
