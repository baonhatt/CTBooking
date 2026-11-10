'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import UserLayout from '@/layouts/UserLayout';

// If the jump to the result page has not happened after this long, a link is offered
const SLOW_REDIRECT_MS = 5000;

export default function SuccessPayment() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showLink, setShowLink] = useState(false);

  // Passes every query parameter on to /checkout, the result page
  const queryString = searchParams.toString();
  const target = `/checkout${queryString ? `?${queryString}` : ''}`;

  useEffect(() => {
    router.replace(target);
  }, [router, target]);

  useEffect(() => {
    const timer = setTimeout(() => setShowLink(true), SLOW_REDIRECT_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <UserLayout className="bg-[#0f172a] border-none" hideFooter>
      <section className="min-h-screen flex items-center justify-center px-4 pt-28 pb-10">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-white text-lg">Đang chuyển tới kết quả thanh toán...</p>
          {showLink && (
            <p className="text-sm text-slate-300">
              Nếu trang chưa tự chuyển,{' '}
              <Link href={target} className="text-blue-400 underline">
                bấm vào đây
              </Link>
              .
            </p>
          )}
        </div>
      </section>
    </UserLayout>
  );
}
