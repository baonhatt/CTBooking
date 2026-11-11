import React from 'react';
import { Inbox, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ADMIN_TEXT } from './adminTokens';

interface EmptyStateProps {
  // Rule: "Chưa có ..." when the list is really empty, "Không tìm thấy ..." when a filter hides everything
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        {icon ?? <Inbox className="h-6 w-6" />}
      </div>
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {description && <p className="max-w-sm text-xs text-slate-500">{description}</p>}
      {action}
    </div>
  );
}

// Rows of skeletons for tables while loading (use inside a table cell or a card)
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: rows }).map((_, row_no) => (
        <Skeleton key={row_no} className="h-10 w-full rounded-lg" />
      ))}
    </div>
  );
}

export function InlineLoading({ text = ADMIN_TEXT.loading }: { text?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin" />
      {text}
    </div>
  );
}
