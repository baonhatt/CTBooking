import type { ReactNode } from 'react';
import { AlertCircle, BarChart3, Loader2, ShieldCheck, Ticket } from 'lucide-react';
import iconCine from '@/assets/images/iconCine.svg';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ADMIN_BTN_PRIMARY, ADMIN_INPUT } from '@/components/admin/common/adminTokens';
import { cn } from '@/lib/utils';

// Shared layout and small controls for the admin auth screens
// (login, OTP, first-login password change, super admin setup).
// In this file, in order: constants, brand, left panel, AuthShell, AuthField, AuthError, AuthSubmitButton.

// Input style: admin input + left icon padding, taller on auth screens
export const AUTH_INPUT = `${ADMIN_INPUT} h-11 bg-white pl-10 pr-3 text-slate-900 placeholder:text-slate-400`;

const FEATURES = [
  { icon: ShieldCheck, text: 'Phân quyền theo vai trò và chi nhánh' },
  { icon: Ticket, text: 'Soát vé và quản lý giao dịch' },
  { icon: BarChart3, text: 'Báo cáo doanh thu trực tiếp' }
];

// BRAND
const Brand = ({ compact = false }: { compact?: boolean }) => (
  <div className="flex items-center gap-3">
    <div
      className={cn(
        'flex items-center justify-center rounded-xl border border-slate-700 bg-slate-900 p-2 shadow-lg',
        compact ? 'h-9 w-9' : 'h-12 w-12'
      )}
    >
      <img src={iconCine} alt="CineSphere" className="h-full w-full object-contain" />
    </div>
    <span className={cn('font-black uppercase tracking-widest text-white', compact ? 'text-base' : 'text-xl')}>CINESPHERE</span>
  </div>
);

// LEFT PANEL (lg and up)
const LeftPanel = () => (
  <aside className="relative hidden w-[45%] max-w-[640px] shrink-0 flex-col justify-between overflow-hidden bg-slate-950 p-12 lg:flex">
    <div className="pointer-events-none absolute -left-24 -top-24 h-[28rem] w-[28rem] rounded-full bg-blue-600/25 blur-3xl" />
    <div className="pointer-events-none absolute -bottom-32 right-0 h-[26rem] w-[26rem] rounded-full bg-indigo-600/20 blur-3xl" />
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] opacity-40 [background-size:24px_24px]" />

    <div className="relative z-10">
      <Brand />
    </div>

    <div className="relative z-10 max-w-md">
      <h2 className="text-4xl font-bold leading-tight text-white">Cổng quản trị CineSphere</h2>
      <p className="mt-4 text-base leading-relaxed text-slate-300">
        Một nơi duy nhất để vận hành rạp: lịch chiếu, vé, giao dịch và đội ngũ nhân viên.
      </p>
      <ul className="mt-10 space-y-4">
        {FEATURES.map((feature) => (
          <li key={feature.text} className="flex items-center gap-3 text-sm text-slate-200">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-blue-400">
              <feature.icon className="h-4 w-4" />
            </span>
            {feature.text}
          </li>
        ))}
      </ul>
    </div>

    <p className="relative z-10 text-xs text-slate-400">© CineSphere</p>
  </aside>
);

// SHELL
type AuthShellProps = {
  badge?: string; // small badge above the title, default "Cổng quản trị"
  title: string;
  description?: ReactNode;
  children: ReactNode; // the form (and anything below it)
  footer?: ReactNode; // optional line under the card
};

export const AuthShell = ({ badge = 'Cổng quản trị', title, description, children, footer }: AuthShellProps) => (
  <div className="flex min-h-screen flex-col bg-slate-50 lg:flex-row">
    <LeftPanel />

    {/* Mobile header strip */}
    <header className="relative flex items-center overflow-hidden bg-slate-950 px-4 py-4 lg:hidden">
      <div className="pointer-events-none absolute -left-10 -top-16 h-40 w-40 rounded-full bg-blue-600/25 blur-3xl" />
      <div className="relative z-10">
        <Brand compact />
      </div>
    </header>

    <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-8">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300 sm:p-8">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-blue-700">
            <ShieldCheck className="h-3 w-3" />
            {badge}
          </span>
          <h1 className="mt-3 text-xl font-bold text-slate-900">{title}</h1>
          {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-4 text-center text-xs text-slate-500">{footer}</div>}
      </div>
    </main>
  </div>
);

// FIELD: label + left icon + control (+ optional right element such as the show/hide toggle)
type AuthFieldProps = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  htmlFor?: string;
  trailing?: ReactNode;
  children: ReactNode;
};

export const AuthField = ({ label, icon: Icon, htmlFor, trailing, children }: AuthFieldProps) => (
  <div className="space-y-1.5">
    <Label htmlFor={htmlFor} className="text-sm font-medium text-slate-700">
      {label}
    </Label>
    <div className="group relative">
      <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-blue-600">
        <Icon className="h-4 w-4" />
      </div>
      {children}
      {trailing}
    </div>
  </div>
);

// ERROR BOX
export const AuthError = ({ message }: { message: string }) =>
  message ? (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 motion-safe:animate-in motion-safe:fade-in-50 motion-safe:duration-200"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  ) : null;

// SUBMIT BUTTON: full width, spinner + busy text while loading
type AuthSubmitButtonProps = {
  loading: boolean;
  disabled?: boolean;
  busyText: string;
  children: ReactNode;
};

export const AuthSubmitButton = ({ loading, disabled, busyText, children }: AuthSubmitButtonProps) => (
  <Button
    type="submit"
    disabled={loading || disabled}
    className={cn(ADMIN_BTN_PRIMARY, 'h-11 w-full gap-2 hover:bg-blue-700 disabled:opacity-60')}
  >
    {loading ? (
      <>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>{busyText}</span>
      </>
    ) : (
      children
    )}
  </Button>
);
