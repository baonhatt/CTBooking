'use client';
import type { ReactNode } from 'react';
import { History, Ticket, UserCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { AUTH_DIALOG_CLASS } from '@/components/constants';
import { cn } from '@/lib/utils';

// The frame of the login, register, forgot-password and OTP dialogs: a phone gets a bottom sheet with the form only; from
// the md breakpoint up the dialog has two columns, a brand panel on the left and the form on the right.

// What an account gives the customer (shown in the brand panel)
const ACCOUNT_BENEFITS = [
  { icon: Ticket, text: 'Nhận mã đặt vé qua email' },
  { icon: History, text: 'Xem lại vé đã đặt' },
  { icon: UserCheck, text: 'Điền sẵn thông tin khi đặt vé' }
];

interface AuthDialogShellProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  // Text over the picture in the brand panel
  asideTitle: string;
  asideText: string;
  // The OTP dialog opens on top of the login dialog, so it sits one layer higher
  layerClass?: string;
  children: ReactNode;
}

// ---------------------------------------------------------------------------------------------------------------
// BRAND PANEL (LEFT COLUMN, HIDDEN ON A PHONE)
// ---------------------------------------------------------------------------------------------------------------
export function AuthAside({ asideTitle, asideText }: { asideTitle: string; asideText: string }) {
  return (
    <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#050915] p-8 md:flex">
      <img src="/images/1.webp" alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-40" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#050915] via-[#0b1226]/75 to-cyan-900/30" />
      <div className="absolute -left-16 -top-16 h-56 w-56 rounded-full bg-cyan-500/20 blur-3xl" />

      <img src="/logo.svg" alt="Cinesphere" className="relative h-10 w-auto self-start drop-shadow-[0_0_16px_rgba(59,130,246,0.5)]" />

      <div className="relative space-y-5">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold leading-tight text-white">{asideTitle}</h2>
          <p className="text-sm leading-relaxed text-gray-300">{asideText}</p>
        </div>
        <ul className="space-y-3">
          {ACCOUNT_BENEFITS.map((benefit) => (
            <li key={benefit.text} className="flex items-center gap-3 text-sm text-gray-200">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-cyan-300">
                <benefit.icon className="h-4 w-4" />
              </span>
              {benefit.text}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// DIALOG FRAME
// ---------------------------------------------------------------------------------------------------------------
export function AuthDialogShell({
  isOpen,
  onOpenChange,
  title,
  description,
  asideTitle,
  asideText,
  layerClass = 'z-[9999]',
  children
}: AuthDialogShellProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'gap-0 overflow-hidden border border-cyan-500/30 bg-[#0b1226] p-0 text-white shadow-[0_0_60px_rgba(59,130,246,0.25)] sm:max-w-[820px]',
          layerClass,
          AUTH_DIALOG_CLASS
        )}
      >
        <div className="grid max-h-[inherit] overflow-y-auto md:grid-cols-[5fr_6fr]">
          <AuthAside asideTitle={asideTitle} asideText={asideText} />

          <div className="relative bg-gradient-to-br from-[#0b1226] via-[#0e1b3d] to-[#080d1f] px-5 pb-6 pt-3 sm:px-8 sm:py-8">
            {/* Grip of the bottom sheet on a phone */}
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20 sm:hidden" aria-hidden="true" />

            <div className="mb-5 flex flex-col items-center gap-3 md:items-start">
              <img src="/icon.svg" alt="" aria-hidden="true" className="h-12 w-12 md:hidden" />
              <div className="space-y-1 text-center md:text-left">
                <DialogTitle className="bg-gradient-to-r from-cyan-300 via-blue-400 to-indigo-300 bg-clip-text text-xl font-bold text-transparent sm:text-2xl">
                  {title}
                </DialogTitle>
                <DialogDescription className="text-sm text-gray-300">{description}</DialogDescription>
              </div>
            </div>

            <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300">{children}</div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
