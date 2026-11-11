'use client';
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AuthDialogShell } from '@/components/auth/AuthDialogShell';
import { AUTH_LINK_BUTTON_CLASS, AuthAlert, AuthSubmitButton, TurnstileBox } from '@/components/auth/AuthParts';
import { toast } from 'sonner';
import { Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildUrl } from '@/lib/api/http';
import { setCookie } from '@/lib/cookies';
import { useTurnstile } from '@/hooks/useTurnstile';

interface OTPDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  tempAccountId: number;
  email: string;
  onSuccess: (userData: any, token: string) => void;
  auth: any;
}

export function OTPDialog({ isOpen, onOpenChange, tempAccountId, email, onSuccess, auth }: OTPDialogProps) {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
  const [canResend, setCanResend] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(30);
  
  const turnstile = useTurnstile('user_otp', isOpen);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  // The code already sent for checking, so a complete code is submitted once, not on every render
  const autoSubmitCodeRef = useRef('');

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setOtp(['', '', '', '', '', '']);
      setError('');
      setTimeLeft(300);
      setCanResend(false);
      setResendCooldown(30);
      // Focus first input
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Countdown timer for OTP expiry
  useEffect(() => {
    if (!isOpen || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, timeLeft]);

  // Resend cooldown timer
  useEffect(() => {
    if (!isOpen || resendCooldown <= 0) {
      if (resendCooldown <= 0) setCanResend(true);
      return;
    }

    const timer = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, resendCooldown]);

  // Puts digits into the boxes from startIndex on, and moves the focus after the last one
  const fillBoxes = (startIndex: number, digits: string) => {
    const newOtp = [...otp];
    for (let offset = 0; offset < digits.length && startIndex + offset < 6; offset++) {
      newOtp[startIndex + offset] = digits[offset];
    }
    setOtp(newOtp);
    setError('');
    inputRefs.current[Math.min(startIndex + digits.length, 5)]?.focus();
  };

  const handleOtpChange = (index: number, value: string) => {
    const digits = value.replace(/\D/g, '');

    // The phone's SMS suggestion puts the whole code into one box
    if (digits.length > 1) {
      fillBoxes(digits.length >= 6 ? 0 : index, digits.slice(0, 6));
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = digits;
    setOtp(newOtp);
    setError('');

    // Auto-focus next input
    if (digits && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedDigits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pastedDigits) return;
    fillBoxes(0, pastedDigits);
  };

  // The server does not ask for the CAPTCHA when a code is checked (only when a new one is sent), so none is demanded here
  const submitOtp = async () => {
    const otpValue = otp.join('');

    if (otpValue.length !== 6) {
      setError('Vui lòng nhập đầy đủ 6 số OTP');
      return;
    }

    try {
      setIsLoading(true);
      setError('');

      const response = await fetch(buildUrl('/api/validate-otp'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          temp_account_id: tempAccountId,
          otp: otpValue
        })
      });

      const data = await response.json();

      if (data.status === 'success' || data.status === 200) {
        // Mirror cookie để frontend check nhanh
        setCookie('userToken', data.token, 86400);
        localStorage.setItem('userToken', data.token);
        toast.success('Xác thực OTP thành công!');
        onSuccess(data.user, data.token);
        onOpenChange(false);
      } else {
        setError(data.message || 'OTP không hợp lệ');
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch (err: any) {
      setError('Có lỗi xảy ra. Vui lòng thử lại.');
      console.error('OTP validation error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitOtp();
  };

  // A complete code is checked at once, so the customer does not need to find the button
  useEffect(() => {
    const code = otp.join('');
    if (code.length !== 6) {
      autoSubmitCodeRef.current = '';
      return;
    }
    if (autoSubmitCodeRef.current === code || isLoading || timeLeft === 0) return;
    autoSubmitCodeRef.current = code;
    submitOtp();
  }, [otp]);

  const handleResend = async () => {
    if (!canResend) return;

    // The server asks for a fresh security check when a new code is sent
    if (!turnstile.token) {
      setError('Đang xác minh bảo mật, vui lòng thử lại sau vài giây.');
      return;
    }

    try {
      setIsResending(true);
      setError('');

      const response = await fetch(buildUrl('/api/resend-otp'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          temp_account_id: tempAccountId,
          email: email,
          turnstileToken: turnstile.token
        })
      });

      const data = await response.json();

      if (data.status === 'success' || data.status === 200) {
        toast.success('OTP mới đã được gửi đến email của bạn');
        setTimeLeft(300);
        setCanResend(false);
        setResendCooldown(30);
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      } else {
        setError(data.message || 'Không thể gửi lại OTP');
      }
    } catch (err: any) {
      setError('Có lỗi xảy ra. Vui lòng thử lại.');
      console.error('Resend OTP error:', err);
    } finally {
      setIsResending(false);
      turnstile.reset();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <AuthDialogShell
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      layerClass="z-[10000]"
      title="Xác Thực 2 Lớp"
      description={`Mã OTP đã được gửi đến ${email}`}
      asideTitle="Thêm một lớp bảo vệ"
      asideText="Mã gồm 6 số được gửi tới email của bạn, giúp chỉ bạn mới đăng nhập được tài khoản."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Timer */}
        <div className="text-center md:text-left">
          <div className={cn('font-mono text-2xl font-bold', timeLeft <= 60 ? 'text-red-400' : 'text-cyan-400')}>
            {formatTime(timeLeft)}
          </div>
          <div className="mt-1 text-xs text-gray-400">{timeLeft <= 60 ? 'OTP sắp hết hạn' : 'OTP hết hạn sau'}</div>
        </div>

        {/* OTP Input */}
        <div className="flex justify-center gap-1.5 sm:gap-2 md:justify-start">
          {otp.map((digit, index) => (
            <Input
              key={index}
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              aria-label={`Chữ số thứ ${index + 1}`}
              value={digit}
              onChange={(e) => handleOtpChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              className={cn(
                'h-14 w-11 rounded-lg border-white/20 bg-white/[0.07] px-0 text-center text-2xl font-bold text-white focus-visible:ring-cyan-400 focus-visible:ring-offset-1 sm:w-12',
                digit && 'border-cyan-400/60',
                error && 'border-red-500 focus-visible:ring-red-500'
              )}
              disabled={isLoading || timeLeft === 0}
              autoComplete="one-time-code"
            />
          ))}
        </div>

        {error && <AuthAlert>{error}</AuthAlert>}

        <TurnstileBox containerRef={turnstile.containerRef} hasToken={!!turnstile.token} loadFailed={turnstile.loadFailed} />

        <AuthSubmitButton
          label="XÁC THỰC"
          loadingLabel="Đang xác thực..."
          isLoading={isLoading}
          disabled={timeLeft === 0 || otp.join('').length !== 6}
        />

        <div className="flex flex-col items-center border-t border-white/10 pt-2 md:flex-row md:justify-between">
          <Button
            type="button"
            variant="link"
            onClick={handleResend}
            disabled={!canResend || isResending}
            className={cn(AUTH_LINK_BUTTON_CLASS, !canResend && 'cursor-not-allowed text-gray-500')}
          >
            {isResending ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                Đang gửi...
              </span>
            ) : canResend ? (
              'Gửi lại OTP'
            ) : (
              `Gửi lại sau ${resendCooldown}s`
            )}
            {!canResend && <RefreshCw className="ml-1 h-3 w-3" />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="h-11 text-sm text-gray-400 hover:bg-transparent hover:text-white"
          >
            Hủy bỏ
          </Button>
        </div>
      </form>
    </AuthDialogShell>
  );
}
