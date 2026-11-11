'use client';
import type { ReactNode, RefObject } from 'react';
import { Check, Circle, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Small building blocks shared by the login, register, forgot-password and OTP dialogs and the reset-password page

// A text-style button under a form ("Quên mật khẩu?", "Đăng ký")
export const AUTH_LINK_BUTTON_CLASS = 'h-11 text-sm text-cyan-300 hover:text-cyan-200 hover:no-underline';

// ---------------------------------------------------------------------------------------------------------------
// SUBMIT BUTTON
// ---------------------------------------------------------------------------------------------------------------
interface AuthSubmitButtonProps {
  label: string;
  loadingLabel: string;
  isLoading: boolean;
  disabled?: boolean;
  type?: 'submit' | 'button';
  onClick?: () => void;
}

export function AuthSubmitButton({
  label,
  loadingLabel,
  isLoading,
  disabled,
  type = 'submit',
  onClick
}: AuthSubmitButtonProps) {
  return (
    <Button
      type={type}
      onClick={onClick}
      disabled={isLoading || disabled}
      className="h-11 w-full rounded-lg bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 font-semibold text-white shadow-[0_8px_24px_rgba(37,99,235,0.35)] transition-all hover:from-cyan-400 hover:via-blue-500 hover:to-indigo-500 hover:shadow-[0_8px_30px_rgba(34,211,238,0.35)] active:scale-[0.99]"
    >
      {isLoading ? (
        <span className="flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          {loadingLabel}
        </span>
      ) : (
        label
      )}
    </Button>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// MESSAGE BOX
// ---------------------------------------------------------------------------------------------------------------
export function AuthAlert({ children, tone = 'error' }: { children: ReactNode; tone?: 'error' | 'warning' }) {
  return (
    <div
      role="alert"
      className={cn(
        'rounded-lg border px-3 py-2 text-sm',
        tone === 'error'
          ? 'border-rose-500/30 bg-rose-500/10 text-rose-200'
          : 'border-yellow-500/30 bg-yellow-500/10 text-yellow-200'
      )}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// SECURITY CHECK (CLOUDFLARE TURNSTILE)
// ---------------------------------------------------------------------------------------------------------------
interface TurnstileBoxProps {
  containerRef: RefObject<HTMLDivElement>;
  hasToken: boolean;
  loadFailed: boolean;
}

// Keeps a fixed height, so the dialog does not jump when the widget appears; says what the grey button is waiting for
export function TurnstileBox({ containerRef, hasToken, loadFailed }: TurnstileBoxProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex min-h-[65px] items-center justify-center">
        <div ref={containerRef} />
      </div>
      {loadFailed ? (
        <p role="alert" className="text-center text-xs text-yellow-300">
          Không tải được bước kiểm tra bảo mật. Vui lòng kiểm tra kết nối mạng, tắt trình chặn quảng cáo rồi tải lại trang.
        </p>
      ) : (
        <p className="flex items-center justify-center gap-1.5 text-xs text-gray-400">
          <ShieldCheck className={cn('h-3.5 w-3.5', hasToken ? 'text-emerald-400' : 'text-gray-500')} />
          {hasToken ? 'Đã xác minh bảo mật' : 'Đang xác minh bảo mật...'}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// PASSWORD RULE CHECKLIST
// ---------------------------------------------------------------------------------------------------------------
// Shows the same rule as PASSWORD_PATTERN (at least 6 characters, a letter and a digit) as ticks while the customer types
export function PasswordChecklist({ password }: { password: string }) {
  const rules = [
    { label: 'Ít nhất 6 ký tự', isMet: password.length >= 6 },
    { label: 'Có chữ', isMet: /[A-Za-z]/.test(password) },
    { label: 'Có số', isMet: /\d/.test(password) }
  ];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Yêu cầu mật khẩu">
      {rules.map((rule) => (
        <li
          key={rule.label}
          className={cn('flex items-center gap-1.5 text-xs transition-colors', rule.isMet ? 'text-emerald-400' : 'text-gray-400')}
        >
          {rule.isMet ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-3 w-3" />}
          {rule.label}
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// STEP INDICATOR
// ---------------------------------------------------------------------------------------------------------------
export function AuthStepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Các bước đăng ký">
      {steps.map((stepLabel, index) => {
        const isDone = index < current;
        const isCurrent = index === current;
        return (
          <li key={stepLabel} className="flex flex-1 items-center gap-2" aria-current={isCurrent ? 'step' : undefined}>
            <span
              className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors',
                isDone && 'bg-emerald-500 text-white',
                isCurrent && 'bg-cyan-500 text-[#050915]',
                !isDone && !isCurrent && 'bg-white/10 text-gray-400'
              )}
            >
              {isDone ? <Check className="h-3.5 w-3.5" /> : index + 1}
            </span>
            <span className={cn('text-xs font-medium', isCurrent ? 'text-white' : 'text-gray-400')}>{stepLabel}</span>
            {index < steps.length - 1 && (
              <span className={cn('h-px flex-1 transition-colors', isDone ? 'bg-emerald-500/60' : 'bg-white/15')} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
