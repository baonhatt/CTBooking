'use client';

import { cn } from '@/lib/utils';

// The signed-in customer's mark in the header: the first letter of the given name (the last word of a Vietnamese
// name, e.g. "Nguyễn Thị Lan" -> "L") on a filled circle, with a green dot. A signed-out visitor never sees this:
// the header shows a "Đăng nhập" button instead, so the two states cannot be confused.
export function nameInitial(userName?: string | null): string {
  const words = String(userName || '').trim().split(/\s+/).filter(Boolean);
  const lastWord = words[words.length - 1] || '';
  return (lastWord[0] || '?').toLocaleUpperCase('vi-VN');
}

export default function AccountAvatar({ userName, size = 'md' }: { userName?: string | null; size?: 'sm' | 'md' }) {
  return (
    <span
      className={cn(
        'relative flex items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 font-black text-white shadow-[0_0_12px_rgba(6,182,212,0.35)] ring-2 ring-cyan-300/40',
        size === 'sm' ? 'h-8 w-8 text-sm' : 'h-10 w-10 text-base'
      )}
      aria-hidden="true"
    >
      {nameInitial(userName)}
      {/* "signed in" dot */}
      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-[#050915]" />
    </span>
  );
}
