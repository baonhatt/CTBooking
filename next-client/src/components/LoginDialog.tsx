'use client';
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AuthField } from '@/components/AuthField';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EMAIL_PATTERN, AUTH_DIALOG_CLASS } from '@/components/constants';
import { useRouter } from 'next/navigation';
import { OTPDialog } from './OTPDialog';
import { setCookie } from '@/lib/cookies';

interface LoginDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onRegister: () => void;
  onForgetPassword: () => void;
  // Filled into the email field when the dialog opens (for example right after registering)
  initialEmail?: string;
  auth: any;
  setUserName: (name: string) => void;
  setErrorModal: (modal: { open: boolean; title: string; message: string }) => void;
}

export function LoginDialog({
  isOpen,
  onOpenChange,
  onRegister,
  onForgetPassword,
  initialEmail,
  auth,
  setUserName,
  setErrorModal
}: LoginDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const turnstileRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetId = useRef<string | null>(null);

  // OTP states
  const [showOTPDialog, setShowOTPDialog] = useState(false);
  const [tempAccountId, setTempAccountId] = useState<number | null>(null);
  const [otpEmail, setOtpEmail] = useState('');

  const router = useRouter();

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
          sitekey: '0x4AAAAAAE1v1PaZCL-bktYH',
          action: 'user_login',
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

  // Ensure all states are clean when the dialog opens or closes
  useEffect(() => {
    if (isOpen) {
      setEmail(initialEmail || '');
      setPassword('');
      setEmailError('');
      setPasswordError('');
      setSubmitError('');
      setShowOTPDialog(false);
      setTempAccountId(null);
      setOtpEmail('');
      setTurnstileToken('');
      
      // Auto-reset turnstile on dialog open to generate fresh token
      if ((window as any).turnstile && turnstileWidgetId.current) {
        (window as any).turnstile.reset(turnstileWidgetId.current);
      }
    }
  }, [isOpen]);

  const handleOpenChange = (open: boolean) => {
    onOpenChange(open);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');
    setPasswordError('');
    setSubmitError('');

    // Validate email
    if (!EMAIL_PATTERN.test(email)) {
      setEmailError('Vui lòng nhập email hợp lệ');
      return;
    }

    // Only "not empty" is checked: the account may hold an older, simpler password, and the server says "wrong password"
    if (!password) {
      setPasswordError('Vui lòng nhập mật khẩu');
      return;
    }

    if (!turnstileToken) {
      setSubmitError('Vui lòng hoàn thành bài kiểm tra bảo mật (CAPTCHA).');
      return;
    }

    try {
      setIsLoading(true);
      const data = await auth.login(email, password, turnstileToken);

      if (data?.requires_otp) {
        // Show OTP dialog
        setTempAccountId(data.temp_account_id);
        setOtpEmail(data.email);
        setShowOTPDialog(true);
        setIsLoading(false);
        return;
      }

      if (data?.status === 'success') {
        // Token được lưu trong httpOnly cookie bởi backend
        // Lưu token vào localStorage để frontend check nhanh
        try {
          setCookie('userToken', data.token, 86400);
          const derivedName = data.user.username || (data.user.email || '').split('@')[0];
          const profile = {
            email: data.user.email,
            name: derivedName,
            phone: (data.user as any)?.phone || ''
          };
          setCookie('userProfile', JSON.stringify(profile), 86400);
          localStorage.setItem('userProfile', JSON.stringify(profile));
        } catch {
        } finally {
          router.push('/');
        }
        setUserName(data.user.username);
        window.dispatchEvent(new Event('user-auth-changed'));
        toast.success('Đăng nhập thành công', { description: data.user.email });

        onOpenChange(false);
        setEmail('');
        setPassword('');
      } else {
        const msg = data?.message || 'Đăng nhập thất bại';
        if (msg.toLowerCase().includes('email')) {
          setEmailError(msg);
        } else if (msg.toLowerCase().includes('mật khẩu') || msg.toLowerCase().includes('password')) {
          setPasswordError(msg);
        }
        setSubmitError(msg);
      }
    } catch (err: any) {
      const msg = String(err?.message || 'Đăng nhập thất bại');
      if (msg.toLowerCase().includes('email')) {
        setEmailError(msg);
      } else if (msg.toLowerCase().includes('mật khẩu') || msg.toLowerCase().includes('password')) {
         setSubmitError(msg);
      } else {
         setSubmitError(msg);
      }
      toast.error(msg);
    } finally {
      setIsLoading(false);
      if ((window as any).turnstile && turnstileWidgetId.current) {
         (window as any).turnstile.reset(turnstileWidgetId.current);
         setTurnstileToken('');
      }
    }
  };

  return (
    <>
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
              Đăng Nhập Tài Khoản
            </DialogTitle>
            <DialogDescription className="sr-only">
              Đăng nhập vào tài khoản Cinesphere của bạn để tiếp tục đặt vé.
            </DialogDescription>
          </DialogHeader>

          <form
            key={isOpen ? 'login-dialog-active' : 'login-dialog-inactive'}
            className="space-y-4"
            onSubmit={handleSubmit}
            noValidate
          >
            <AuthField
              id="login-email"
              name="email"
              label="Email"
              type="email"
              value={email}
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
              id="login-password"
              name="password"
              label="Mật khẩu"
              type="password"
              value={password}
              onChange={(value) => {
                setPassword(value);
                if (passwordError && value) setPasswordError('');
                if (submitError) setSubmitError('');
              }}
              error={passwordError}
              autoComplete="current-password"
              maxLength={50}
              disabled={isLoading}
            />

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
                  Đang đăng nhập...
                </span>
              ) : (
                'Đăng nhập'
              )}
            </Button>

            <div className="flex flex-col items-center">
              <Button
                variant="link"
                className="h-11 text-sm text-cyan-300 hover:text-cyan-200"
                type="button"
                onClick={onForgetPassword}
              >
                Quên mật khẩu?
              </Button>
              <Button
                variant="link"
                className="h-11 text-sm text-cyan-300 hover:text-cyan-200"
                type="button"
                onClick={onRegister}
              >
                Bạn chưa có tài khoản? Đăng ký
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* OTP Dialog */}
      {tempAccountId && (
        <OTPDialog
          isOpen={showOTPDialog}
          onOpenChange={(open) => {
            setShowOTPDialog(open);
            if (!open) {
              setTempAccountId(null);
              setOtpEmail('');
            }
          }}
          tempAccountId={tempAccountId}
          email={otpEmail}
          onSuccess={(userData, token) => {
            try {
              setCookie('userToken', token, 86400);
              localStorage.setItem('userToken', token);
              const derivedName = userData.username || (userData.email || '').split('@')[0];
              const profile = {
                email: userData.email,
                name: derivedName,
                phone: userData.phone || ''
              };
              setCookie('userProfile', JSON.stringify(profile), 86400);
              localStorage.setItem('userProfile', JSON.stringify(profile));
            } catch {
            } finally {
              router.push('/');
            }
            setUserName(userData.username);
            window.dispatchEvent(new Event('user-auth-changed'));
            toast.success('Đăng nhập thành công', { description: userData.email });
            onOpenChange(false);
            setEmail('');
            setPassword('');
          }}
          auth={auth}
        />
      )}
    </>
  );
}

export default LoginDialog;
