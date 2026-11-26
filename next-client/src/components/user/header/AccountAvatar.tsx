'use client';

import { cn } from '@/lib/utils';

/**
 * The signed-in customer in the header. It follows the glass pill style of the cart and branch buttons:
 * - HEADER_PILL: the shared pill (36px on desktop, 32px on phones), used by the account and login buttons too;
 * - AccountAvatar: the first letter of the given name on a quiet cyan circle (no gradient, glow or status dot);
 * - givenName: the name shown beside it on desktop.
 * A signed-out visitor sees a "Đăng nhập" pill with a person icon instead, so the two states cannot be confused.
 */
export const HEADER_PILL =
  'relative inline-flex items-center justify-center gap-1.5 rounded-full border border-white/15 bg-white/[0.07] text-xs font-semibold text-slate-200 transition-all duration-200 hover:border-cyan-400/50 hover:bg-white/[0.14] hover:text-white touch-manipulation select-none active:scale-95';

/** The last word of a Vietnamese name is the given name: "Nguyễn Thị Lan" -> "Lan" */
export function givenName(userName?: string | null): string {
  const words = String(userName || '').trim().split(/\s+/).filter(Boolean);
  return words[words.length - 1] || '';
}

export function nameInitial(userName?: string | null): string {
  return (givenName(userName)[0] || '?').toLocaleUpperCase('vi-VN');
}

export default function AccountAvatar({ userName, size = 'md' }: { userName?: string | null; size?: 'xs' | 'sm' | 'md' }) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-cyan-400/15 font-bold text-cyan-200 ring-1 ring-cyan-300/30',
        size === 'xs' && 'h-6 w-6 text-[11px]',
        size === 'sm' && 'h-8 w-8 text-sm',
        size === 'md' && 'h-10 w-10 text-base'
      )}
      aria-hidden="true"
    >
      {nameInitial(userName)}
    </span>
  );
}
