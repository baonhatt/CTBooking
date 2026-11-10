'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { resetPasswordApi } from '@/lib/api/auth';
import UserLayout from '@/layouts/UserLayout';
import { AuthField } from '@/components/AuthField';
import { PASSWORD_PATTERN, PASSWORD_RULE_TEXT } from '@/components/constants';

export default function ConfirmToken() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPasswordError, setNewPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [submitError, setSubmitError] = useState('');
  // True when the server said the link is no longer good (used or expired)
  const [linkRejected, setLinkRejected] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const router = useRouter();

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
        // The home page opens the login dialog for this address
        router.push('/?login=1');
      } else {
        setSubmitError(response.message || 'Không đặt lại được mật khẩu, vui lòng thử lại.');
      }
    } catch (err: any) {
      const message = String(err?.message || 'Đã xảy ra lỗi, vui lòng thử lại.');
      setSubmitError(message);
      // The server's answer for a used or expired link ("Token không hợp lệ hoặc đã hết hạn!") cannot work on a
      // second try: offer a new link. Other answers (for example "same as the current password") stay on the form.
      if (/token|hết hạn/i.test(message)) {
        setLinkRejected(true);
      }
    } finally {
      setIsSaving(false);
    }
  };

  // No token in the address, or the server turned it down: the only way forward is a new link
  if (!token || linkRejected) {
    return (
      <UserLayout className="bg-gradient-dark" hideFooter>
        <section className="min-h-screen flex items-center justify-center px-4 pt-28 pb-10">
          <div className="w-full max-w-md text-center space-y-4 bg-black/80 border border-white/10 rounded-2xl p-6">
            <h1 className="text-xl font-bold text-white">Liên kết không còn hiệu lực</h1>
            <p className="text-sm text-gray-300 leading-relaxed">
              {submitError || 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.'} Vui lòng yêu cầu một liên kết mới.
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <Button className="h-11 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => router.push('/?forgot=1')}>
                Gửi lại email đặt lại mật khẩu
              </Button>
              <Button variant="outline" className="h-11" onClick={() => router.push('/')}>
                Về trang chủ
              </Button>
            </div>
          </div>
        </section>
      </UserLayout>
    );
  }

  return (
    <UserLayout className="bg-gradient-dark" hideFooter>
      <section className="min-h-screen flex items-center justify-center px-4 pt-28 pb-10">
        <form
          className="bg-black/80 border border-white/10 p-6 rounded-2xl shadow-md space-y-4 w-full max-w-md"
          onSubmit={handleResetPassSubmit}
          noValidate
        >
          <h1 className="text-xl text-blue-400 font-bold text-center">Đặt lại mật khẩu</h1>
          <p className="text-sm text-gray-300 text-center">Nhập mật khẩu mới cho tài khoản của bạn.</p>

          <AuthField
            id="reset-new-password"
            name="new-password"
            label="Mật khẩu mới"
            type="password"
            value={newPassword}
            onChange={(value) => {
              setNewPassword(value);
              if (newPasswordError && PASSWORD_PATTERN.test(value)) setNewPasswordError('');
              if (submitError) setSubmitError('');
            }}
            error={newPasswordError}
            hint={PASSWORD_RULE_TEXT}
            autoComplete="new-password"
            maxLength={50}
            disabled={isSaving}
          />

          <AuthField
            id="reset-confirm-password"
            name="confirm-password"
            label="Nhập lại mật khẩu mới"
            type="password"
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

          {submitError && (
            <div role="alert" className="rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
              {submitError}
            </div>
          )}

          <Button
            type="submit"
            disabled={isSaving}
            className="w-full h-11 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
          >
            {isSaving ? 'Đang lưu...' : 'Đặt lại mật khẩu'}
          </Button>
        </form>
      </section>
    </UserLayout>
  );
}
