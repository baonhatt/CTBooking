import React from 'react';
import { cn } from '@/lib/utils';

// Five tones only. Every status in every module maps to one of them.
export type StatusTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

const TONE_CLASS: Record<StatusTone, string> = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  danger: 'bg-red-50 text-red-700 border-red-200',
  neutral: 'bg-slate-100 text-slate-600 border-slate-200',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
};

// Standard status vocabulary: key -> [label, tone]. Add new statuses here, not in the modules.
export const STATUS_MAP: Record<string, { label: string; tone: StatusTone }> = {
  // Generic on/off
  active: { label: 'Hoạt động', tone: 'success' },
  inactive: { label: 'Ngừng hoạt động', tone: 'neutral' },
  locked: { label: 'Đã khóa', tone: 'danger' },
  // Orders / payments
  paid: { label: 'Đã thanh toán', tone: 'success' },
  pending: { label: 'Chờ thanh toán', tone: 'warning' },
  processing: { label: 'Đang xử lý', tone: 'info' },
  cancelled: { label: 'Đã hủy', tone: 'danger' },
  failed: { label: 'Thất bại', tone: 'danger' },
  expired: { label: 'Hết hạn', tone: 'neutral' },
  refunded: { label: 'Đã hoàn tiền', tone: 'info' },
  // Email / jobs
  sent: { label: 'Đã gửi', tone: 'success' },
  queued: { label: 'Đang chờ', tone: 'warning' },
  // Posts
  published: { label: 'Đã xuất bản', tone: 'success' },
  draft: { label: 'Bản nháp', tone: 'neutral' },
};

interface StatusBadgeProps {
  // Either a known status key...
  status?: string;
  // ...or an explicit tone + label for module-specific wording
  tone?: StatusTone;
  children?: React.ReactNode;
  className?: string;
}

export function StatusBadge({ status, tone, children, className }: StatusBadgeProps) {
  const known = status ? STATUS_MAP[status.toLowerCase()] : undefined;
  const finalTone = tone ?? known?.tone ?? 'neutral';
  const label = children ?? known?.label ?? status ?? '';
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        TONE_CLASS[finalTone],
        className
      )}
    >
      {label}
    </span>
  );
}
