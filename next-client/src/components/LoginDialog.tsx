'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AuthField } from '@/components/AuthField';
import { AuthDialogShell } from '@/components/auth/AuthDialogShell';
import { AUTH_LINK_BUTTON_CLASS, AuthAlert, AuthSubmitButton, TurnstileBox } from '@/components/auth/AuthParts';
import { toast } from 'sonner';
import { Lock, Mail } from 'lucide-react';
import { EMAIL_PATTERN } from '@/components/constants';
import { OTPDialog } from './OTPDialog';
import { setCookie } from '@/lib/cookies';
import { useTurnstile } from '@/hooks/useTurnstile';

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

// Keeps the signed-in customer's token and profile where the header and the guarded pages look for them
function saveSignedInUser(user: any, token: string) {
  try {
    setCookie('userToken', token, 86400);
    localStorage.setItem('userToken', token);
    const derivedName = user.username || (user.email || '').split('@')[0];
    const profile = {
      email: user.email,
      name: derivedName,
      phone: user.phone || ''
    };
    setCookie('userProfile', JSON.stringify(profile), 86400);
    localStorage.setItem('userProfile', JSON.stringify(profile));
  } catch {}
}

export function LoginDialog({
  isOpen,
  onOpenChange,
  onRegister,
  onForgetPassword,
  initialEmail,
  auth,
  setUserName
}: LoginDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const turnstile = useTurnstile('user_login', isOpen);

  // OTP states
  const [showOTPDialog, setShowOTPDialog] = useState(false);
  const [tempAccountId, setTempAccountId] = useState<number | null>(null);
  const [otpEmail, setOtpEmail] = useState('');

  // Ensure all states are clean when the dialog opens
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
    }
  }, [isOpen]);

  // The customer stays on the page they were on: signing in only refreshes the header
  const finishSignIn = (user: any) => {
    setUserName(user.username);
    window.dispatchEvent(new Event('user-auth-changed'));
    toast.success('Đăng nhập thành công', { description: user.email });
    onOpenChange(false);
    setEmail('');
    setPassword('');
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

    if (!turnstile.token) {
      setSubmitError('Vui lòng hoàn thành bài kiểm tra bảo mật (CAPTCHA).');
      return;
    }

    try {
      setIsLoading(true);
      const data = await auth.login(email, password, turnstile.token);

      if (data?.requires_otp) {
        // Show OTP dialog
        setTempAccountId(data.temp_account_id);
        setOtpEmail(data.email);
        setShowOTPDialog(true);
        setIsLoading(false);
        return;
      }

      if (data?.status === 'success') {
        saveSignedInUser(data.user, data.token);
        finishSignIn(data.user);
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
      } else {
        setSubmitError(msg);
      }
      toast.error(msg);
    } finally {
      setIsLoading(false);
      // A token works once: the next try needs a new one
      turnstile.reset();
    }
  };

  return (
    <>
      <AuthDialogShell
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        title="Đăng Nhập Tài Khoản"
        description="Đăng nhập vào tài khoản Cinesphere của bạn để tiếp tục đặt vé."
        asideTitle="Chào mừng trở lại"
        asideText="Đăng nhập để đặt vé nhanh hơn và quản lý vé của bạn ở một nơi."
      >
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
            icon={Mail}
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
            icon={Lock}
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

          <div className="-mt-2 flex justify-end">
            <Button variant="link" className={`${AUTH_LINK_BUTTON_CLASS} h-9 px-0`} type="button" onClick={onForgetPassword}>
              Quên mật khẩu?
            </Button>
          </div>

          {submitError && <AuthAlert>{submitError}</AuthAlert>}

          <TurnstileBox containerRef={turnstile.containerRef} hasToken={!!turnstile.token} loadFailed={turnstile.loadFailed} />

          <AuthSubmitButton
            label="Đăng nhập"
            loadingLabel="Đang đăng nhập..."
            isLoading={isLoading}
            disabled={!turnstile.token}
          />

          <div className="flex items-center justify-center gap-1 border-t border-white/10 pt-3 text-sm text-gray-300">
            Bạn chưa có tài khoản?
            <Button variant="link" className={`${AUTH_LINK_BUTTON_CLASS} h-9 px-1 font-semibold`} type="button" onClick={onRegister}>
              Đăng ký
            </Button>
          </div>
        </form>
      </AuthDialogShell>

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
            saveSignedInUser(userData, token);
            finishSignIn(userData);
          }}
          auth={auth}
        />
      )}
    </>
  );
}

export default LoginDialog;
