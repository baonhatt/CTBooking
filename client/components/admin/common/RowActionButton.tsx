import React from 'react';
import { Copy, Eye, KeyRound, Lock, LockOpen, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// One icon + one colour + one label per action, used in every table.
export type RowAction = 'view' | 'edit' | 'delete' | 'restore' | 'copy' | 'resetPassword' | 'lock' | 'unlock';

const ACTION_STYLE: Record<RowAction, { icon: React.ElementType; label: string; color: string }> = {
  view: { icon: Eye, label: 'Xem chi tiết', color: 'text-blue-600 hover:bg-blue-50 hover:border-blue-200' },
  edit: { icon: Pencil, label: 'Chỉnh sửa', color: 'text-amber-600 hover:bg-amber-50 hover:border-amber-200' },
  delete: { icon: Trash2, label: 'Xóa', color: 'text-red-600 hover:bg-red-50 hover:border-red-200' },
  restore: { icon: RotateCcw, label: 'Khôi phục', color: 'text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200' },
  copy: { icon: Copy, label: 'Nhân bản', color: 'text-teal-600 hover:bg-teal-50 hover:border-teal-200' },
  resetPassword: { icon: KeyRound, label: 'Đặt lại mật khẩu', color: 'text-slate-600 hover:bg-slate-100 hover:border-slate-300' },
  lock: { icon: Lock, label: 'Khóa tài khoản', color: 'text-red-600 hover:bg-red-50 hover:border-red-200' },
  unlock: { icon: LockOpen, label: 'Mở khóa tài khoản', color: 'text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200' },
};

interface RowActionButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'title'> {
  action: RowAction;
  // Overrides the default tooltip / accessible name, e.g. "Xóa voucher"
  label?: string;
}

export function RowActionButton({ action, label, className, disabled, ...props }: RowActionButtonProps) {
  const style = ACTION_STYLE[action];
  const Icon = style.icon;
  const text = label ?? style.label;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={text}
          title={text}
          disabled={disabled}
          className={cn(
            'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent bg-transparent transition-colors disabled:cursor-not-allowed disabled:opacity-40',
            style.color,
            className
          )}
          {...props}
        >
          <Icon className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  );
}

// Wrapper that lays row actions out the same way everywhere (right aligned, 4px gap)
export function RowActions({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-end gap-1">{children}</div>;
}
