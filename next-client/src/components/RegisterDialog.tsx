'use client';
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { AuthField } from '@/components/AuthField';
import { AuthDialogShell } from '@/components/auth/AuthDialogShell';
import {
  AUTH_LINK_BUTTON_CLASS,
  AuthAlert,
  AuthStepper,
  AuthSubmitButton,
  PasswordChecklist,
  TurnstileBox
} from '@/components/auth/AuthParts';
import { toast } from 'sonner';
import { ArrowLeft, Lock, Mail, User } from 'lucide-react';
import { PASSWORD_PATTERN, EMAIL_PATTERN, PASSWORD_RULE_TEXT } from '@/components/constants';
import { Checkbox } from '@/components/ui/checkbox';
import { setCookie } from '@/lib/cookies';
import { useTurnstile } from '@/hooks/useTurnstile';

interface RegisterDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  // Gets the email just registered, so the login dialog can fill it in
  onLogin: (registeredEmail?: string) => void;
  auth: any;
  setUserName: (name: string) => void;
  setErrorModal: (modal: { open: boolean; title: string; message: string }) => void;
}

// The two steps of the form: the account details, then the terms and the security check
const STEP_LABELS = ['Tài khoản', 'Xác nhận'];
const STEP_ACCOUNT = 0;
const STEP_CONFIRM = 1;

export function RegisterDialog({ isOpen, onOpenChange, onLogin, auth, setUserName }: RegisterDialogProps) {
  const [step, setStep] = useState(STEP_ACCOUNT);
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

  // True while the email is being checked against the registered accounts
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  // The last email asked about and the answer ('' = free), so the same address is not asked twice
  const checkedEmailRef = useRef<{ email: string; message: string } | null>(null);

  // The security check only appears on the last step
  const turnstile = useTurnstile('user_register', isOpen && step === STEP_CONFIRM);

  // A fresh form every time the dialog opens
  useEffect(() => {
    if (!isOpen) return;
    setStep(STEP_ACCOUNT);
    setEmail('');
    setName('');
    setPassword('');
    setConfirmPassword('');
    setTermsAccepted(false);
    setEmailError('');
    setNameError('');
    setPasswordError('');
    setConfirmError('');
    setTermsError('');
    setSubmitError('');
    setIsCheckingEmail(false);
    checkedEmailRef.current = null;
  }, [isOpen]);

  // Checks the four account fields together, so every problem shows at once; true when all are fine
  const validateAccountStep = () => {
    const emailMessage = EMAIL_PATTERN.test(email) ? '' : 'Vui lòng nhập email hợp lệ';
    const nameMessage = name.trim() ? '' : 'Vui lòng nhập họ và tên';
    const passwordMessage = PASSWORD_PATTERN.test(password) ? '' : 'Mật khẩu ít nhất 6 ký tự, gồm chữ và số';
    const confirmMessage = password === confirmPassword ? '' : 'Mật khẩu nhập lại không khớp';
    setEmailError(emailMessage);
    setNameError(nameMessage);
    setPasswordError(passwordMessage);
    setConfirmError(confirmMessage);
    return !(emailMessage || nameMessage || passwordMessage || confirmMessage);
  };

  // Asks the server whether the email is still free; returns the reason when it is not, or '' when it is.
  // When the check itself fails (no network, too many asks) the customer is let through: the final step checks again.
  const findEmailProblem = async (emailToCheck: string, showBusy: boolean) => {
    if (checkedEmailRef.current?.email === emailToCheck) return checkedEmailRef.current.message;
    try {
      if (showBusy) setIsCheckingEmail(true);
      const result = await auth.checkEmail(emailToCheck);
      const message = result?.available === false ? String(result.message || 'Email đã tồn tại') : '';
      checkedEmailRef.current = { email: emailToCheck, message };
      return message;
    } catch {
      return '';
    } finally {
      setIsCheckingEmail(false);
    }
  };

  // Leaving the email field tells the customer at once if the address is taken
  const checkEmailOnBlur = async () => {
    if (!email) return;
    if (!EMAIL_PATTERN.test(email)) {
      setEmailError('Vui lòng nhập email hợp lệ');
      return;
    }
    const problem = await findEmailProblem(email, false);
    if (problem) setEmailError(problem);
  };

  const goToConfirmStep = async () => {
    setSubmitError('');
    if (!validateAccountStep()) return;
    const problem = await findEmailProblem(email, true);
    if (problem) {
      setEmailError(problem);
      return;
    }
    setStep(STEP_CONFIRM);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === STEP_ACCOUNT) {
      void goToConfirmStep();
      return;
    }

    setTermsError('');
    setSubmitError('');

    if (!termsAccepted) {
      setTermsError('Vui lòng đồng ý điều khoản để tiếp tục');
      return;
    }

    if (!turnstile.token) {
      setSubmitError('Vui lòng hoàn thành bài kiểm tra bảo mật (CAPTCHA).');
      return;
    }

    try {
      setIsLoading(true);
      const data = await auth.register(email, password, name, turnstile.token);

      if (data?.status === 'success') {
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

        // Open the login dialog with the email filled in
        onOpenChange(false);
        onLogin(email);
      }
    } catch (err: any) {
      const msg = String(err?.message || 'Đăng ký thất bại');
      if (msg.toLowerCase().includes('email')) {
        // The email belongs to the first step: take the customer back to it
        setEmailError(msg);
        setStep(STEP_ACCOUNT);
      } else {
        setSubmitError(msg);
      }
    } finally {
      setIsLoading(false);
      turnstile.reset();
    }
  };

  return (
    <AuthDialogShell
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title="Đăng Ký Tài Khoản"
      description="Đăng ký tài khoản để trải nghiệm đặt vé phim đa chiều tại Cinesphere."
      asideTitle="Tạo tài khoản Cinesphere"
      asideText="Chỉ mất một phút để có tài khoản và đặt vé nhanh hơn ở những lần sau."
    >
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <AuthStepper steps={STEP_LABELS} current={step} />

        {step === STEP_ACCOUNT ? (
          <div className="space-y-4">
            <AuthField
              id="register-email"
              name="email"
              label="Email"
              type="email"
              icon={Mail}
              value={email}
              placeholder="you@email.com"
              onChange={(value) => {
                setEmail(value);
                if (emailError && EMAIL_PATTERN.test(value)) setEmailError('');
              }}
              onBlur={checkEmailOnBlur}
              error={emailError}
              autoComplete="email"
              inputMode="email"
              maxLength={50}
            />

            <AuthField
              id="register-name"
              name="name"
              label="Họ và tên"
              icon={User}
              value={name}
              placeholder="Nguyễn Văn A"
              onChange={(value) => {
                setName(value);
                if (nameError && value.trim()) setNameError('');
              }}
              onBlur={() => {
                if (!name.trim()) setNameError('Vui lòng nhập họ và tên');
              }}
              error={nameError}
              autoComplete="name"
              maxLength={50}
            />

            <div className="space-y-2">
              <AuthField
                id="register-password"
                name="new-password"
                label="Mật khẩu"
                type="password"
                icon={Lock}
                value={password}
                onChange={(value) => {
                  setPassword(value);
                  if (passwordError && PASSWORD_PATTERN.test(value)) setPasswordError('');
                  if (confirmPassword && value === confirmPassword) setConfirmError('');
                }}
                onBlur={() => {
                  if (password && !PASSWORD_PATTERN.test(password)) setPasswordError(`Mật khẩu chưa đủ mạnh. ${PASSWORD_RULE_TEXT}`);
                }}
                error={passwordError}
                autoComplete="new-password"
                maxLength={50}
              />
              <PasswordChecklist password={password} />
            </div>

            <AuthField
              id="register-confirm-password"
              name="confirm-password"
              label="Nhập lại mật khẩu"
              type="password"
              icon={Lock}
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
            />

            {/* A submit button, so the Enter key also moves on */}
            <AuthSubmitButton label="Tiếp tục" loadingLabel="Đang kiểm tra email..." isLoading={isCheckingEmail} />
          </div>
        ) : (
          <div className="space-y-4">
            {/* What the customer is about to register */}
            <div className="rounded-lg border border-white/10 bg-white/[0.05] px-4 py-3 text-sm">
              <p className="text-xs text-gray-400">Tài khoản sẽ được tạo cho</p>
              <p className="font-semibold text-white">{name.trim()}</p>
              <p className="break-all text-gray-300">{email}</p>
            </div>

            {/* Terms Checkbox */}
            <label className="flex min-h-[44px] cursor-pointer items-start gap-3 py-1">
              <Checkbox
                checked={termsAccepted}
                onCheckedChange={(checked) => {
                  setTermsAccepted(checked === true);
                  if (checked) setTermsError('');
                }}
                disabled={isLoading}
                className="mt-0.5 h-5 w-5 shrink-0 border-white/40 data-[state=checked]:bg-blue-500"
              />
              <span className="select-none text-[13px] leading-relaxed text-gray-300">
                Bằng việc đăng ký tài khoản, tôi đồng ý với Điều khoản dịch vụ và Chính sách bảo vệ của Cinesphere.
              </span>
            </label>

            {termsError && <AuthAlert tone="warning">{termsError}</AuthAlert>}
            {submitError && <AuthAlert>{submitError}</AuthAlert>}

            <TurnstileBox containerRef={turnstile.containerRef} hasToken={!!turnstile.token} loadFailed={turnstile.loadFailed} />

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={isLoading}
                onClick={() => setStep(STEP_ACCOUNT)}
                className="h-11 shrink-0 rounded-lg border-white/20 bg-transparent px-4 text-gray-200 hover:bg-white/10 hover:text-white"
                aria-label="Quay lại bước tài khoản"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex-1">
                <AuthSubmitButton
                  label="Đăng ký"
                  loadingLabel="Đang đăng ký..."
                  isLoading={isLoading}
                  disabled={!turnstile.token || !termsAccepted}
                />
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-center gap-1 border-t border-white/10 pt-3 text-sm text-gray-300">
          Đã có tài khoản?
          <Button variant="link" className={`${AUTH_LINK_BUTTON_CLASS} h-9 px-1 font-semibold`} type="button" onClick={() => onLogin()}>
            Đăng nhập
          </Button>
        </div>
      </form>
    </AuthDialogShell>
  );
}

export default RegisterDialog;
