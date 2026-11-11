import React from 'react';
import { AlertTriangle, RotateCcw, Trash2, Info, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { ADMIN_TEXT } from './adminTokens';

export type ConfirmVariant = 'danger' | 'warning' | 'restore' | 'info';

const VARIANT_STYLE: Record<ConfirmVariant, { icon: React.ElementType; tile: string; button: string; defaultConfirm: string; defaultTitle: string }> = {
  danger: {
    icon: Trash2,
    tile: 'bg-red-50 text-red-600',
    button: 'bg-red-600 hover:bg-red-700 shadow-red-500/20',
    defaultConfirm: ADMIN_TEXT.delete,
    defaultTitle: 'Xác nhận xóa',
  },
  warning: {
    icon: AlertTriangle,
    tile: 'bg-amber-50 text-amber-600',
    button: 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20',
    defaultConfirm: 'Xác nhận',
    defaultTitle: 'Cần xác nhận',
  },
  restore: {
    icon: RotateCcw,
    tile: 'bg-emerald-50 text-emerald-600',
    button: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20',
    defaultConfirm: ADMIN_TEXT.restore,
    defaultTitle: 'Xác nhận khôi phục',
  },
  info: {
    icon: Info,
    tile: 'bg-blue-50 text-blue-600',
    button: 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20',
    defaultConfirm: 'Đồng ý',
    defaultTitle: 'Xác nhận',
  },
};

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  variant?: ConfirmVariant;
  title?: string;
  description: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  busy?: boolean;
  confirmDisabled?: boolean;
}

// The single confirmation dialog for the whole admin: delete, restore, lock account, discard changes...
export function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  variant = 'danger',
  title,
  description,
  confirmText,
  cancelText = ADMIN_TEXT.cancel,
  busy = false,
  confirmDisabled = false,
}: ConfirmDialogProps) {
  const style = VARIANT_STYLE[variant];
  const Icon = style.icon;
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md rounded-2xl border-slate-200 bg-white font-sans shadow-2xl">
        <AlertDialogHeader>
          <div className="flex items-start gap-3">
            <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', style.tile)}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <AlertDialogTitle className="text-lg font-bold text-slate-900">{title ?? style.defaultTitle}</AlertDialogTitle>
              <AlertDialogDescription className="mt-1.5 text-sm text-slate-600">{description}</AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-2 gap-2 sm:space-x-0">
          <AlertDialogCancel
            disabled={busy}
            className="mt-0 h-10 rounded-xl border border-slate-200 bg-white px-4 text-slate-700 hover:bg-slate-50"
          >
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={busy || confirmDisabled}
            className={cn('h-10 min-w-[104px] rounded-xl px-4 text-white shadow-sm transition-all active:scale-95', style.button)}
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {ADMIN_TEXT.busy}
              </>
            ) : (
              (confirmText ?? style.defaultConfirm)
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
