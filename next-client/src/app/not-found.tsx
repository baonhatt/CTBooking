import { Suspense } from 'react';
import Link from 'next/link';
import { Film, Newspaper, Ticket } from 'lucide-react';
import UserLayout from '@/layouts/UserLayout';

// Where a lost visitor can go next
const SUGGESTIONS = [
  { href: '/#films', label: 'Phim đang chiếu', icon: Film },
  { href: '/#promotions', label: 'Giá vé', icon: Ticket },
  { href: '/bai-viet', label: 'Tin tức', icon: Newspaper }
];

export default function NotFound() {
  return (
    // The header reads the address, so it sits in a Suspense boundary like the other pages
    <Suspense fallback={null}>
      <UserLayout className="bg-[#050915]">
        <section className="flex min-h-[80vh] items-center justify-center px-4 pb-16 pt-32">
          <div className="w-full max-w-lg text-center">
            <h1 className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-7xl font-extrabold text-transparent sm:text-8xl">
              404
            </h1>
            <p className="mt-3 text-gray-300">Trang bạn tìm không tồn tại hoặc đã được di chuyển.</p>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/"
                className="inline-flex h-11 items-center justify-center rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 px-6 font-semibold text-white transition-colors hover:from-blue-600 hover:to-purple-600"
              >
                Về Trang Chủ
              </Link>
              <Link
                href="/booking"
                className="inline-flex h-11 items-center justify-center rounded-lg border border-white/30 px-6 font-semibold text-white transition-colors hover:bg-white/10"
              >
                Đặt vé
              </Link>
            </div>

            <div className="mt-10 border-t border-white/10 pt-6">
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400">Có thể bạn đang tìm</p>
              <ul className="grid gap-3 sm:grid-cols-3">
                {SUGGESTIONS.map((suggestion) => (
                  <li key={suggestion.href}>
                    <Link
                      href={suggestion.href}
                      className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-gray-200 transition-colors hover:border-cyan-400/40 hover:bg-white/10 hover:text-white"
                    >
                      <suggestion.icon className="h-4 w-4 text-cyan-400" />
                      {suggestion.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </UserLayout>
    </Suspense>
  );
}
