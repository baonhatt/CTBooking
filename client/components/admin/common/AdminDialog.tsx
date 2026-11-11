import React, { createContext, useContext, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from './ConfirmDialog';
import { ADMIN_TEXT } from './adminTokens';

// Width scale for every modal (replaces the 700 / 950 / 998 / 1050 / 1200 px mix)
export type AdminDialogSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

const SIZE_CLASS: Record<AdminDialogSize, string> = {
  sm: 'sm:max-w-md', // confirm-like forms
  md: 'sm:max-w-2xl', // short forms (staff, role)
  lg: 'sm:max-w-4xl', // detail views, medium forms
  xl: 'sm:max-w-6xl', // large forms (movie, voucher, ticket)
  full: 'sm:max-w-7xl h-[90vh]', // media / preview
};

// Lets the footer Cancel button use the same close path (with the unsaved-changes prompt) as the X and Esc
const AdminDialogCloseContext = createContext<(() => void) | null>(null);

export interface AdminDialogProps {
  open: boolean;
  // Called after the dialog is really allowed to close
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  // Small tag next to the title (code, status badge...)
  titleExtra?: React.ReactNode;
  size?: AdminDialogSize;
  // "view": Esc / click outside closes freely. "form": outside click is blocked and unsaved changes are confirmed.
  mode?: 'view' | 'form';
  // Only used in "form" mode: true when the user typed something that is not saved yet
  dirty?: boolean;
  // While true (saving) the dialog cannot be closed
  busy?: boolean;
  // Footer content (use AdminDialogFooter for the standard Cancel / Save pair)
  footer?: React.ReactNode;
  // Remove default body padding (when the body has its own panels / tabs)
  flushBody?: boolean;
  className?: string;
  children: React.ReactNode;
}

// The one modal shell for the admin: header (icon, title, close X), scrolling body, sticky footer.
export function AdminDialog({
  open,
  onClose,
  title,
  subtitle,
  icon,
  titleExtra,
  size = 'lg',
  mode = 'view',
  dirty = false,
  busy = false,
  footer,
  flushBody = false,
  className,
  children,
}: AdminDialogProps) {
  const [askDiscard, setAskDiscard] = useState(false);

  const requestClose = () => {
    if (busy) return;
    if (mode === 'form' && dirty) {
      setAskDiscard(true);
      return;
    }
    onClose();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && requestClose()}>
        <DialogContent
          // The shared Dialog blocks Esc and outside click; view dialogs opt back in, form dialogs ask first
          onEscapeKeyDown={(event) => {
            event.preventDefault();
            requestClose();
          }}
          onInteractOutside={(event) => {
            event.preventDefault();
            if (mode === 'view') requestClose();
          }}
          className={cn(
            'flex max-h-[90vh] w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl [&>button]:hidden',
            SIZE_CLASS[size],
            className
          )}
        >
          <div className="flex items-start gap-3 border-b border-slate-200 bg-white px-6 py-4">
            {icon && (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">{icon}</div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle className="text-lg font-bold leading-tight text-slate-900">{title}</DialogTitle>
                {titleExtra}
              </div>
              {subtitle ? (
                <DialogDescription className="mt-0.5 text-sm text-slate-500">{subtitle}</DialogDescription>
              ) : (
                <DialogDescription className="sr-only">{typeof title === 'string' ? title : ADMIN_TEXT.view}</DialogDescription>
              )}
            </div>
            <button
              type="button"
              onClick={requestClose}
              disabled={busy}
              aria-label={ADMIN_TEXT.close}
              title={ADMIN_TEXT.close}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <AdminDialogCloseContext.Provider value={requestClose}>
            <div className={cn('min-h-0 flex-1 overflow-y-auto bg-slate-50/50', flushBody ? '' : 'p-6')}>{children}</div>

            {footer && (
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-white px-6 py-3">{footer}</div>
            )}
          </AdminDialogCloseContext.Provider>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={askDiscard}
        onOpenChange={setAskDiscard}
        variant="warning"
        title="Thay đổi chưa được lưu"
        description="Bạn đang có thay đổi chưa lưu. Nếu thoát bây giờ, nội dung vừa nhập sẽ bị mất."
        confirmText="Thoát, bỏ thay đổi"
        cancelText="Tiếp tục chỉnh sửa"
        onConfirm={() => {
          setAskDiscard(false);
          onClose();
        }}
      />
    </>
  );
}

interface AdminDialogFooterProps {
  onCancel: () => void;
  onSubmit?: () => void;
  submitText?: string;
  cancelText?: string;
  busy?: boolean;
  submitDisabled?: boolean;
  // Extra buttons shown on the left (e.g. Delete in a view dialog)
  leading?: React.ReactNode;
  // Submit button colour: blue for save, red for destructive
  tone?: 'primary' | 'danger';
}

// Standard footer: [leading actions ...... Cancel  Save]. Cancel is always first, the main action last.
export function AdminDialogFooter({
  onCancel,
  onSubmit,
  submitText = ADMIN_TEXT.save,
  cancelText = ADMIN_TEXT.cancel,
  busy = false,
  submitDisabled = false,
  leading,
  tone = 'primary',
}: AdminDialogFooterProps) {
  const requestClose = useContext(AdminDialogCloseContext);
  return (
    <>
      {leading && <div className="mr-auto flex items-center gap-2">{leading}</div>}
      <button
        type="button"
        onClick={requestClose ?? onCancel}
        disabled={busy}
        className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50 disabled:opacity-50"
      >
        {cancelText}
      </button>
      {onSubmit && (
        <button
          type="button"
          onClick={onSubmit}
          disabled={busy || submitDisabled}
          className={cn(
            'inline-flex h-10 min-w-[120px] items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-white shadow-sm transition-all active:scale-95 disabled:opacity-50',
            tone === 'danger' ? 'bg-red-600 shadow-red-500/20 hover:bg-red-700' : 'bg-blue-600 shadow-blue-500/20 hover:bg-blue-700'
          )}
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {busy ? ADMIN_TEXT.busy : submitText}
        </button>
      )}
    </>
  );
}
