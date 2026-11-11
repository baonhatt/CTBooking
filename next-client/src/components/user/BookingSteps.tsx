'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// The four steps of buying a ticket, in the order the customer meets them
export const BOOKING_STEP_LABELS = ['Giỏ hàng', 'Thông tin', 'Thanh toán', 'Hoàn tất'];

// Index of each step, so a page says which one it is without a bare number
export const BOOKING_STEP = { cart: 0, details: 1, payment: 2, done: 3 } as const;

interface BookingStepsProps {
  // The step the customer is on; a number past the last step (the labels' length) marks them all as finished
  current: number;
  // Called when the first step (the cart) is pressed; without it the step is plain text
  onCartClick?: () => void;
}

/** The progress line at the top of /booking, /qr-payment and /checkout. */
export default function BookingSteps({ current, onCartClick }: BookingStepsProps) {
  return (
    <ol className="flex items-center gap-1.5 sm:gap-3 py-2" aria-label="Các bước đặt vé">
      {BOOKING_STEP_LABELS.map((label, index) => {
        const isDone = index < current;
        const isCurrent = index === current;
        const isCartStep = index === BOOKING_STEP.cart && onCartClick;
        const marker = (
          <>
            <span
              className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors',
                isDone && 'bg-emerald-500 text-white',
                isCurrent && 'bg-cyan-500 text-[#050915]',
                !isDone && !isCurrent && 'bg-white/10 text-slate-400'
              )}
            >
              {isDone ? <Check className="h-3.5 w-3.5" /> : index + 1}
            </span>
            <span
              className={cn(
                'whitespace-nowrap text-xs font-semibold sm:text-sm',
                isCurrent ? 'text-white' : isDone ? 'text-slate-300' : 'text-slate-500',
                // On a narrow phone only the current step keeps its name
                !isCurrent && 'hidden min-[420px]:inline'
              )}
            >
              {label}
            </span>
          </>
        );
        return (
          <li key={label} className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2" aria-current={isCurrent ? 'step' : undefined}>
            {isCartStep ? (
              <button type="button" onClick={onCartClick} className="flex min-h-[44px] items-center gap-1.5 sm:gap-2 hover:opacity-80">
                {marker}
              </button>
            ) : (
              <span className="flex items-center gap-1.5 sm:gap-2">{marker}</span>
            )}
            {index < BOOKING_STEP_LABELS.length - 1 && (
              <span className={cn('h-px min-w-[8px] flex-1 transition-colors', isDone ? 'bg-emerald-500/60' : 'bg-white/15')} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
