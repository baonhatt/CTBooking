'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AuthField } from '@/components/AuthField';
import { AuthDialogShell } from '@/components/auth/AuthDialogShell';
import { AUTH_LINK_BUTTON_CLASS, AuthAlert, AuthSubmitButton, TurnstileBox } from '@/components/auth/AuthParts';
import { EMAIL_PATTERN } from '@/components/constants';
import { MailCheck, Mail } from 'lucide-react';
import { useTurnstile } from '@/hooks/useTurnstile';

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
  // The address the link was sent to; while it is set the dialog shows the "check your mail" message instead of the form
  const [sentEmail, setSentEmail] = useState('');
  const isFormStep = !sentEmail;
  const turnstile = useTurnstile('forget_password', isOpen && isFormStep);

  useEffect(() => {
    if (isOpen) {
      setEmail('');
      setEmailError('');
      setSubmitError('');
      setSentEmail('');
    }
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

    if (!turnstile.token) {
      setSubmitError('Vui lòng hoàn thành bài kiểm tra bảo mật (CAPTCHA).');
      return;
    }

    try {
      setIsLoading(true);
      const data = await auth.forgetPass(email, turnstile.token);

      if (data?.status === 'success') {
        // Only an email was sent: the password is not changed until the customer opens the link in it
        setSentEmail(email);
      } else {
        setSubmitError(String(data?.message || 'Yêu cầu thất bại, vui lòng thử lại'));
      }
    } catch (err: any) {
      setSubmitError(String(err?.message || 'Yêu cầu thất bại'));
    } finally {
      setIsLoading(false);
      turnstile.reset();
    }
  };

  return (
    <AuthDialogShell
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title="Quên mật khẩu"
      description={
        isFormStep
          ? 'Nhập email đã đăng ký, chúng tôi sẽ gửi liên kết để bạn đặt lại mật khẩu.'
          : 'Chúng tôi đã gửi hướng dẫn đặt lại mật khẩu.'
      }
      asideTitle="Lấy lại quyền truy cập"
      asideText="Liên kết đặt lại mật khẩu được gửi qua email và chỉ dùng được một lần."
    >
      {isFormStep ? (
        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <AuthField
            id="forgot-email"
            name="email"
            label="Email"
            type="email"
            icon={Mail}
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

          {submitError && <AuthAlert>{submitError}</AuthAlert>}

          <TurnstileBox containerRef={turnstile.containerRef} hasToken={!!turnstile.token} loadFailed={turnstile.loadFailed} />

          <AuthSubmitButton
            label="Gửi email đặt lại mật khẩu"
            loadingLabel="Đang gửi..."
            isLoading={isLoading}
            disabled={!turnstile.token}
          />

          <div className="flex justify-center border-t border-white/10 pt-3">
            <Button variant="link" className={AUTH_LINK_BUTTON_CLASS} type="button" onClick={onBackToLogin}>
              Quay lại đăng nhập
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-5 text-center md:text-left">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 md:mx-0">
            <MailCheck className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-white">Đã gửi email hướng dẫn</p>
            <p className="text-sm leading-relaxed text-gray-300">
              Vui lòng kiểm tra hộp thư (cả thư rác) của <strong className="break-all text-white">{sentEmail}</strong> để đặt lại mật khẩu.
            </p>
          </div>
          <div className="space-y-1">
            <AuthSubmitButton label="Quay lại đăng nhập" loadingLabel="" isLoading={false} type="button" onClick={onBackToLogin} />
            <Button variant="link" className={`${AUTH_LINK_BUTTON_CLASS} w-full`} type="button" onClick={() => setSentEmail('')}>
              Chưa nhận được? Gửi lại
            </Button>
          </div>
        </div>
      )}
    </AuthDialogShell>
  );
}

export default ForgetPasswordDialog;
