'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Link2Off, Loader2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { checkResetTokenApi, resetPasswordApi } from '@/lib/api/auth';
import UserLayout from '@/layouts/UserLayout';
import { AuthField } from '@/components/AuthField';
import { AuthAside } from '@/components/auth/AuthDialogShell';
import { AuthAlert, AuthSubmitButton, PasswordChecklist } from '@/components/auth/AuthParts';
import { PASSWORD_PATTERN, PASSWORD_RULE_TEXT } from '@/components/constants';

// After the password is saved, the page waits this long (so the message can be read) and opens the login dialog
const REDIRECT_DELAY_MS = 3000;

// What the page is showing: checking the link, a link that no longer works, the form, or the "password changed" message
type PageStep = 'checking' | 'invalid' | 'form' | 'done';

// The card all four steps sit in: the brand panel on the left from md up, the step on the right
function ResetCard({ children }: { children: ReactNode }) {
  return (
    <UserLayout className="bg-[#050915]" hideFooter>
      <section className="flex min-h-screen items-center justify-center px-4 pb-10 pt-28">
        <div className="grid w-full max-w-3xl overflow-hidden rounded-2xl border border-white/[0.22] bg-[#1a2744] shadow-[0_0_60px_rgba(59,130,246,0.25)] md:grid-cols-[5fr_6fr]">
          <AuthAside
            asideTitle="Đặt lại mật khẩu"
            asideText="Chọn một mật khẩu mới cho tài khoản Cinesphere của bạn. Liên kết trong email chỉ dùng được một lần."
          />
          <div className="bg-[#1a2744] px-5 py-8 sm:px-8">{children}</div>
        </div>
      </section>
    </UserLayout>
  );
}

// A round icon above a short message ("checking", "link expired", "done")
function StatusIcon({ tone, children }: { tone: 'info' | 'warning' | 'success'; children: ReactNode }) {
  const toneClass = {
    info: 'bg-cyan-500/15 text-cyan-300',
    warning: 'bg-amber-500/15 text-amber-300',
    success: 'bg-emerald-500/15 text-emerald-400'
  }[tone];
  return (
    <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full md:mx-0 ${toneClass}`}>{children}</div>
  );
}

export default function ConfirmToken() {
  const [step, setStep] = useState<PageStep>('checking');
  // The address the link belongs to, partly hidden ("ng***@gmail.com"); empty when the server did not say
  const [maskedEmail, setMaskedEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPasswordError, setNewPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const router = useRouter();

  // Ask the server at once whether the link still works, so the customer is not told only after typing a password
  useEffect(() => {
    if (!token) {
      setStep('invalid');
      return;
    }
    let isCancelled = false;
    checkResetTokenApi(token)
      .then((result) => {
        if (isCancelled) return;
        setMaskedEmail(result.maskedEmail || '');
        setStep(result.valid ? 'form' : 'invalid');
      })
      // The check itself failed (no network): show the form anyway, saving the password checks the link again
      .catch(() => {
        if (!isCancelled) setStep('form');
      });
    return () => {
      isCancelled = true;
    };
  }, [token]);

  // After the "password changed" message, open the login dialog
  useEffect(() => {
    if (step !== 'done') return;
    const timer = setTimeout(() => router.push('/?login=1'), REDIRECT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [step, router]);

  const handleResetPassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewPasswordError('');
    setConfirmError('');
    setSubmitError('');

    // The same rule as the register form, so a password made there is accepted here
    if (!PASSWORD_PATTERN.test(newPassword)) {
      setNewPasswordError(`Mật khẩu chưa đủ mạnh. ${PASSWORD_RULE_TEXT}`);
      return;
    }

    if (newPassword !== confirmPassword) {
      setConfirmError('Mật khẩu nhập lại không khớp');
      return;
    }

    try {
      setIsSaving(true);
      const response = await resetPasswordApi({ token, newPassword });
      if (response.status === 'success') {
        toast.success('Đã đổi mật khẩu', { description: 'Vui lòng đăng nhập bằng mật khẩu mới.' });
        setStep('done');
      } else {
        setSubmitError(response.message || 'Không đặt lại được mật khẩu, vui lòng thử lại.');
      }
    } catch (err: any) {
      const message = String(err?.message || 'Đã xảy ra lỗi, vui lòng thử lại.');
      setSubmitError(message);
      // The server's answer for a used or expired link ("Token không hợp lệ hoặc đã hết hạn!") cannot work on a
      // second try: offer a new link. Other answers (for example "same as the current password") stay on the form.
      if (/token|hết hạn/i.test(message)) {
        setStep('invalid');
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (step === 'checking') {
    return (
      <ResetCard>
        <div role="status" className="py-10 text-center md:text-left">
          <StatusIcon tone="info">
            <Loader2 className="h-7 w-7 animate-spin" />
          </StatusIcon>
          <p className="text-sm text-gray-300">Đang kiểm tra liên kết...</p>
        </div>
      </ResetCard>
    );
  }

  // No token in the address, or the server turned it down: the only way forward is a new link
  if (step === 'invalid') {
    return (
      <ResetCard>
        <div className="space-y-4 text-center md:text-left">
          <StatusIcon tone="warning">
            <Link2Off className="h-7 w-7" />
          </StatusIcon>
          <h1 className="text-xl font-bold text-white">Liên kết không còn hiệu lực</h1>
          <p className="text-sm leading-relaxed text-gray-300">
            {submitError || 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.'} Vui lòng yêu cầu một liên kết mới.
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <Button
              className="h-11 rounded-lg bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 font-semibold text-white hover:from-cyan-400 hover:to-indigo-500"
              onClick={() => router.push('/?forgot=1')}
            >
              Gửi lại email đặt lại mật khẩu
            </Button>
            <Button
              variant="outline"
              className="h-11 rounded-lg border-white/20 bg-transparent text-gray-200 hover:bg-white/10 hover:text-white"
              onClick={() => router.push('/')}
            >
              Về trang chủ
            </Button>
          </div>
        </div>
      </ResetCard>
    );
  }

  if (step === 'done') {
    return (
      <ResetCard>
        <div role="status" className="space-y-4 text-center md:text-left">
          <StatusIcon tone="success">
            <CheckCircle2 className="h-7 w-7" />
          </StatusIcon>
          <h1 className="text-xl font-bold text-white">Đã đổi mật khẩu</h1>
          <p className="text-sm leading-relaxed text-gray-300">
            Mật khẩu của bạn đã được cập nhật. Đang chuyển tới đăng nhập, bạn hãy dùng mật khẩu mới.
          </p>
          <Button
            className="h-11 w-full rounded-lg bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 font-semibold text-white hover:from-cyan-400 hover:to-indigo-500"
            onClick={() => router.push('/?login=1')}
          >
            Đăng nhập ngay
          </Button>
        </div>
      </ResetCard>
    );
  }

  return (
    <ResetCard>
      <form className="space-y-4" onSubmit={handleResetPassSubmit} noValidate>
        <div className="space-y-1 text-center md:text-left">
          <h1 className="bg-gradient-to-r from-cyan-300 via-blue-400 to-indigo-300 bg-clip-text text-2xl font-bold text-transparent">
            Đặt lại mật khẩu
          </h1>
          <p className="text-sm text-gray-300">
            {maskedEmail ? (
              <>
                Nhập mật khẩu mới cho tài khoản <strong className="break-all text-white">{maskedEmail}</strong>.
              </>
            ) : (
              'Nhập mật khẩu mới cho tài khoản của bạn.'
            )}
          </p>
        </div>

        <div className="space-y-2">
          <AuthField
            id="reset-new-password"
            name="new-password"
            label="Mật khẩu mới"
            type="password"
            icon={Lock}
            value={newPassword}
            onChange={(value) => {
              setNewPassword(value);
              if (newPasswordError && PASSWORD_PATTERN.test(value)) setNewPasswordError('');
              if (submitError) setSubmitError('');
              if (confirmPassword && value === confirmPassword) setConfirmError('');
            }}
            error={newPasswordError}
            autoComplete="new-password"
            maxLength={50}
            disabled={isSaving}
          />
          <PasswordChecklist password={newPassword} />
        </div>

        <AuthField
          id="reset-confirm-password"
          name="confirm-password"
          label="Nhập lại mật khẩu mới"
          type="password"
          icon={Lock}
          value={confirmPassword}
          onChange={(value) => {
            setConfirmPassword(value);
            if (confirmError && value === newPassword) setConfirmError('');
          }}
          error={confirmError}
          autoComplete="new-password"
          maxLength={50}
          disabled={isSaving}
        />

        {submitError && <AuthAlert>{submitError}</AuthAlert>}

        <AuthSubmitButton label="Đặt lại mật khẩu" loadingLabel="Đang lưu..." isLoading={isSaving} />

        <p className="border-t border-white/10 pt-3 text-center text-xs leading-relaxed text-gray-400 md:text-left">
          Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email đó, mật khẩu hiện tại vẫn giữ nguyên.
        </p>
      </form>
    </ResetCard>
  );
}
