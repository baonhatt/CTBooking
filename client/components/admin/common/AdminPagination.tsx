import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdminPaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  // Shown on the left, e.g. "86 giao dịch"
  totalLabel?: React.ReactNode;
  className?: string;
}

const PAGE_BUTTON =
  'inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40';

// One pagination bar: total on the left, "Trước  Trang x / y  Sau" on the right
export function AdminPagination({ page, totalPages, onPageChange, totalLabel, className }: AdminPaginationProps) {
  const pages = Math.max(1, totalPages);
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3 px-1 py-3', className)}>
      <span className="text-sm text-slate-500">{totalLabel}</span>
      <div className="flex items-center gap-2">
        <button type="button" className={PAGE_BUTTON} disabled={page <= 1} onClick={() => onPageChange(Math.max(1, page - 1))}>
          <ChevronLeft className="h-4 w-4" />
          Trước
        </button>
        <span className="px-2 text-sm text-slate-600">
          Trang {page} / {pages}
        </span>
        <button type="button" className={PAGE_BUTTON} disabled={page >= pages} onClick={() => onPageChange(Math.min(pages, page + 1))}>
          Sau
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
