'use client';
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AuthField } from '@/components/AuthField';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

import { PASSWORD_PATTERN, EMAIL_PATTERN, PASSWORD_RULE_TEXT, AUTH_DIALOG_CLASS } from '@/components/constants';
import { useRouter } from 'next/navigation';
import { Checkbox } from '@/components/ui/checkbox';
import { setCookie } from '@/lib/cookies';

interface RegisterDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  // Gets the email just registered, so the login dialog can fill it in
  onLogin: (registeredEmail?: string) => void;
  auth: any;
  setUserName: (name: string) => void;
  setErrorModal: (modal: { open: boolean; title: string; message: string }) => void;
}

export function RegisterDialog({
  isOpen,
  onOpenChange,
  onLogin,
  auth,
  setUserName,
  setErrorModal
}: RegisterDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [emailError, setEmailError] = useState('');
  const [nameError, setNameError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [termsError, setTermsError] = useState('');
  const [submitError, setSubmitError] = useState('');

  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const turnstileRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetId = useRef<string | null>(null);

  const router = useRouter();

  // Handle Turnstile explicit render
  useEffect(() => {
    if (!isOpen) return;

    let timeoutId: any;
    const renderWidget = () => {
      if (!turnstileRef.current) {
        timeoutId = setTimeout(renderWidget, 100);
        return;
      }

      if ((window as any).turnstile && !turnstileWidgetId.current) {
        turnstileWidgetId.current = (window as any).turnstile.render(turnstileRef.current, {
          sitekey: '0x4AAAAAAE1v1PaZCL-bktYH',
          action: 'user_register',
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

    // Reset errors
    setEmailError('');
    setNameError('');
    setPasswordError('');
    setConfirmError('');
    setTermsError('');
    setSubmitError('');

    // Validate email
    if (!EMAIL_PATTERN.test(email)) {
      setEmailError('Vui lòng nhập email hợp lệ');
      return;
    }

    // Validate name
    if (!name.trim()) {
      setNameError('Vui lòng nhập họ và tên');
      return;
    }

    // Validate password
    const passOk = PASSWORD_PATTERN.test(password);
    if (!passOk) {
      setPasswordError('Mật khẩu ít nhất 6 ký tự, gồm chữ và số');
      return;
    }

    // Validate confirm password
    if (password !== confirmPassword) {
      setConfirmError('Mật khẩu nhập lại không khớp');
      return;
    }

    // Validate terms
    if (!termsAccepted) {
      setTermsError('Vui lòng đồng ý điều khoản để tiếp tục');
      return;
    }

    if (!turnstileToken) {
      setSubmitError('Vui lòng hoàn thành bài kiểm tra bảo mật (CAPTCHA).');
      return;
    }

    try {
      setIsLoading(true);
      const data = await auth.register(email, password, name, turnstileToken);

      if (data?.status === 'success') {
        // Token được lưu trong httpOnly cookie bởi backend (nếu có)
        // Không cần lưu vào localStorage anymore

        try {
          const derivedName = data.user.username || (data.user.email || '').split('@')[0];
          const profile = {
            email: data.user.email,
            name: derivedName,
            phone: (data.user as any)?.phone || ''
          };
          setCookie('userProfile', JSON.stringify(profile), 86400);
          localStorage.setItem('userProfile', JSON.stringify(profile));
        } catch {}

        setUserName(data.user.username);
        window.dispatchEvent(new Event('user-auth-changed'));
        toast.success('Đăng ký thành công', { description: data.user.email });

        // Reset form
        const registeredEmail = email;
        onOpenChange(false);
        setEmail('');
        setName('');
        setPassword('');
        setConfirmPassword('');
        setTermsAccepted(false);

        // Open login dialog with the email filled in
        onLogin(registeredEmail);
      }
    } catch (err: any) {
      const msg = String(err?.message || 'Đăng ký thất bại');
      if (msg.toLowerCase().includes('email')) {
        setEmailError(msg);
      } else {
        setSubmitError(msg);
      }
    } finally {
      setIsLoading(false);
      if ((window as any).turnstile && turnstileWidgetId.current) {
         (window as any).turnstile.reset(turnstileWidgetId.current);
         setTurnstileToken('');
      }
      // router.push('/'); // Should not push if it fails
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      // Reset all states when closing
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setEmailError('');
      setPasswordError('');
      setConfirmError('');
      setSubmitError('');
      setTermsAccepted(false);
      setTurnstileToken('');
      // Auto-reset turnstile
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
          'bg-gradient-to-br z-[9999] from-[#0b1226] via-[#0e1b3d] to-[#050915] border border-cyan-500/30 text-white shadow-[0_0_50px_rgba(59,130,246,0.3)]',
          AUTH_DIALOG_CLASS
        )}
      >
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <img src="/icon.svg" alt="Cinesphere" className="h-14 w-14 sm:h-20 sm:w-20" />
          </div>
          <DialogTitle className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-blue-400 to-fuchsia-400 text-center">
            Đăng Ký Tài Khoản
          </DialogTitle>
          <DialogDescription className="sr-only">
            Đăng ký tài khoản để trải nghiệm đặt vé phim đa chiều tại Cinesphere.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <AuthField
            id="register-email"
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

          <AuthField
            id="register-name"
            name="name"
            label="Họ và tên"
            value={name}
            placeholder="Nguyễn Văn A"
            onChange={(value) => {
              setName(value);
              if (nameError && value.trim()) setNameError('');
              if (submitError) setSubmitError('');
            }}
            onBlur={() => {
              if (!name.trim()) setNameError('Vui lòng nhập họ và tên');
            }}
            error={nameError}
            autoComplete="name"
            maxLength={50}
            disabled={isLoading}
          />

          <AuthField
            id="register-password"
            name="new-password"
            label="Mật khẩu"
            type="password"
            value={password}
            onChange={(value) => {
              setPassword(value);
              if (passwordError && PASSWORD_PATTERN.test(value)) setPasswordError('');
              if (submitError) setSubmitError('');
              if (confirmPassword && value === confirmPassword) setConfirmError('');
            }}
            onBlur={() => {
              if (password && !PASSWORD_PATTERN.test(password)) setPasswordError(`Mật khẩu chưa đủ mạnh. ${PASSWORD_RULE_TEXT}`);
            }}
            error={passwordError}
            hint={PASSWORD_RULE_TEXT}
            autoComplete="new-password"
            maxLength={50}
            disabled={isLoading}
          />

          <AuthField
            id="register-confirm-password"
            name="confirm-password"
            label="Nhập lại mật khẩu"
            type="password"
            value={confirmPassword}
            onChange={(value) => {
              setConfirmPassword(value);
              if (confirmError && password === value) setConfirmError('');
            }}
            onBlur={() => {
              if (confirmPassword && password !== confirmPassword) setConfirmError('Mật khẩu nhập lại không khớp');
            }}
            error={confirmError}
            autoComplete="new-password"
            maxLength={50}
            disabled={isLoading}
          />

          {/* Terms Checkbox */}
          <label className="flex items-start gap-3 cursor-pointer min-h-[44px] py-1">
            <Checkbox
              checked={termsAccepted}
              onCheckedChange={(e) => {
                setTermsAccepted(e === true);
                if (e) setTermsError('');
              }}
              disabled={isLoading}
              className="mt-0.5 border-white/40 data-[state=checked]:bg-blue-500 w-5 h-5 shrink-0"
            />
            <span className="text-[13px] leading-relaxed text-gray-400 select-none">
              Bằng việc đăng ký tài khoản, tôi đồng ý với Điều khoản dịch vụ và Chính sách bảo vệ của Cinesphere.
            </span>
          </label>

          {termsError && (
            <div role="alert" className="rounded-md bg-yellow-500/10 px-3 py-2 text-xs text-yellow-300">{termsError}</div>
          )}

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
            disabled={
              isLoading ||
              !turnstileToken ||
              !(email && name && password && confirmPassword && password === confirmPassword && termsAccepted)
            }
            className="w-full h-11 bg-gradient-to-r from-cyan-400 via-blue-600 to-fuchsia-500 hover:from-fuchsia-500 hover:via-cyan-400 hover:to-blue-600 text-white font-semibold shadow-[0_0_30px_rgba(59,130,246,0.4)] hover:shadow-[0_0_40px_rgba(236,72,153,0.6)]"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang đăng ký...
              </span>
            ) : (
              'Đăng ký'
            )}
          </Button>

          {/* Login Link */}
          <div className="flex justify-center">
            <Button
              variant="link"
              className="h-11 text-sm text-cyan-300 hover:text-cyan-200"
              type="button"
              onClick={() => onLogin()}
            >
              Đã có tài khoản? Đăng nhập
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default RegisterDialog;
