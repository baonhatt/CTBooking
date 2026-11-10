'use client';
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AuthField } from '@/components/AuthField';
import { EMAIL_PATTERN, AUTH_DIALOG_CLASS } from '@/components/constants';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

import { toast } from 'sonner';

interface ForgetPasswordDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onBackToLogin: () => void;
  auth: any;
}

export function ForgetPasswordDialog({ isOpen, onOpenChange, onBackToLogin, auth }: ForgetPasswordDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const turnstileRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetId = useRef<string | null>(null);

  // Handle Turnstile explicit render
  useEffect(() => {
    if (!isOpen) return;

    let timeoutId: any;
    const renderWidget = () => {
      // If turnstile script is ready but ref is not yet attached by Radix UI portal, wait.
      if (!turnstileRef.current) {
        timeoutId = setTimeout(renderWidget, 100);
        return;
      }
      
      if ((window as any).turnstile && !turnstileWidgetId.current) {
        turnstileWidgetId.current = (window as any).turnstile.render(turnstileRef.current, {
          sitekey: '0x4AAAAAAE1v1PaZCL-bktYH', // Use the same sitekey
          action: 'forget_password',
          callback: (token: string) => setTurnstileToken(token),
          'error-callback': () => setTurnstileToken(''),
          'expired-callback': () => setTurnstileToken('')
        });
      }
    };

    if (!document.getElementById('turnstile-script')) {
      const script = document.createElement('script');
      script.id = 'turnstile-script';
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
      script.onload = () => {
        timeoutId = setTimeout(renderWidget, 100);
      };
    } else {
      timeoutId = setTimeout(renderWidget, 100);
    }

    return () => {
      clearTimeout(timeoutId);
      if (turnstileWidgetId.current && (window as any).turnstile?.remove) {
        (window as any).turnstile.remove(turnstileWidgetId.current);
        turnstileWidgetId.current = null;
      }
    };
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');
    setSubmitError('');

    // Validate email
    if (!EMAIL_PATTERN.test(email)) {
      setEmailError('Vui lòng nhập email hợp lệ');
      return;
    }

    if (!turnstileToken) {
      setSubmitError('Vui lòng hoàn thành bài kiểm tra bảo mật (CAPTCHA).');
      return;
    }

    try {
      setIsLoading(true);
      const data = await auth.forgetPass(email, turnstileToken);

      if (data?.status === 'success') {
        onOpenChange(false);
        setEmail('');
        // Only an email was sent: the password is not changed until the customer opens the link in it
        toast.success('Đã gửi email hướng dẫn', {
          description: 'Vui lòng kiểm tra hộp thư (cả thư rác) để đặt lại mật khẩu.'
        });
      } else {
        setSubmitError(String(data?.message || 'Yêu cầu thất bại, vui lòng thử lại'));
      }
    } catch (err: any) {
      setSubmitError(String(err?.message || 'Yêu cầu thất bại'));
    } finally {
      setIsLoading(false);
      if ((window as any).turnstile && turnstileWidgetId.current) {
         (window as any).turnstile.reset(turnstileWidgetId.current);
         setTurnstileToken('');
      }
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setEmail('');
      setEmailError('');
      setSubmitError('');
      setTurnstileToken('');
      if ((window as any).turnstile && turnstileWidgetId.current) {
         (window as any).turnstile.reset(turnstileWidgetId.current);
      }
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          'bg-gradient-to-br from-[#0b1226] via-[#0e1b3d] to-[#050915] border border-cyan-500/30 text-white shadow-[0_0_50px_rgba(59,130,246,0.3)]',
          AUTH_DIALOG_CLASS
        )}
      >
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <img src="/icon.svg" alt="Cinesphere" className="h-14 w-14 sm:h-20 sm:w-20" />
          </div>
          <DialogTitle className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-blue-400 to-fuchsia-400 text-center">
            Quên mật khẩu
          </DialogTitle>
          <DialogDescription className="text-center text-sm text-gray-300">
            Nhập email đã đăng ký, chúng tôi sẽ gửi liên kết để bạn đặt lại mật khẩu.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <AuthField
            id="forgot-email"
            name="email"
            label="Email"
            type="email"
            value={email}
            placeholder="you@email.com"
            onChange={(value) => {
              setEmail(value);
              if (emailError && EMAIL_PATTERN.test(value)) setEmailError('');
              if (submitError) setSubmitError('');
            }}
            onBlur={() => {
              if (email && !EMAIL_PATTERN.test(email)) setEmailError('Vui lòng nhập email hợp lệ');
            }}
            error={emailError}
            autoComplete="email"
            inputMode="email"
            maxLength={50}
            disabled={isLoading}
          />

          {/* Submit Error */}
          {submitError && (
            <div role="alert" className="rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
              {submitError}
            </div>
          )}

          {/* Cloudflare Turnstile */}
          <div className="flex justify-center">
            <div ref={turnstileRef} className="cf-turnstile"></div>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isLoading || !turnstileToken}
            className="w-full h-11 bg-gradient-to-r from-cyan-400 via-blue-600 to-fuchsia-500 hover:from-fuchsia-500 hover:via-cyan-400 hover:to-blue-600 text-white font-semibold shadow-[0_0_30px_rgba(59,130,246,0.4)] hover:shadow-[0_0_40px_rgba(236,72,153,0.6)]"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang gửi...
              </span>
            ) : (
              'Gửi email đặt lại mật khẩu'
            )}
          </Button>

          {/* Back to Login Link */}
          <div className="flex justify-center">
            <Button
              variant="link"
              className="h-11 text-sm text-cyan-300 hover:text-cyan-200"
              type="button"
              onClick={onBackToLogin}
            >
              Quay lại đăng nhập
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default ForgetPasswordDialog;
