'use client';

import { useEffect, useState } from 'react';
import { Lock, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AuthField } from '@/components/AuthField';
import { AuthAlert, AuthSubmitButton, PasswordChecklist } from '@/components/auth/AuthParts';
import { PASSWORD_PATTERN, PASSWORD_RULE_TEXT } from '@/components/constants';
import { changePasswordApi } from '@/lib/api';

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // The signed-in customer's email, which the server uses to find the account
  email: string;
}

/** The "Thay đổi mật khẩu" dialog of the account page. It keeps its own form, so the account page does not. */
export default function ChangePasswordDialog({ open, onOpenChange, email }: ChangePasswordDialogProps) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  // The problem with the form, shown inside the dialog
  const [errorMessage, setErrorMessage] = useState('');

  // A fresh form every time the dialog opens
  useEffect(() => {
    if (!open) return;
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setErrorMessage('');
  }, [open]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage('');
    if (!oldPassword) {
      setErrorMessage('Vui lòng nhập mật khẩu hiện tại');
      return;
    }
    if (!PASSWORD_PATTERN.test(newPassword)) {
      setErrorMessage(`Mật khẩu mới chưa đủ mạnh. ${PASSWORD_RULE_TEXT}`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('Mật khẩu mới không khớp');
      return;
    }
    if (newPassword === oldPassword) {
      setErrorMessage('Mật khẩu mới phải khác mật khẩu hiện tại');
      return;
    }

    setIsSaving(true);
    try {
      await changePasswordApi({ email, oldPassword, newPassword });
      toast.success('Đã cập nhật mật khẩu');
      onOpenChange(false);
    } catch (error: any) {
      setErrorMessage(error?.message ? `Đổi mật khẩu thất bại: ${error.message}` : 'Đổi mật khẩu thất bại');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border border-cyan-500/30 bg-gradient-to-br from-[#0b1226] via-[#0e1b3d] to-[#080d1f] text-white shadow-[0_0_60px_rgba(59,130,246,0.25)]">
        <DialogHeader>
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500/15 text-cyan-300">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <DialogTitle className="bg-gradient-to-r from-cyan-300 via-blue-400 to-indigo-300 bg-clip-text text-xl font-bold text-transparent">
            Thay đổi mật khẩu
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-300">
            Nhập mật khẩu hiện tại và mật khẩu mới để thay đổi.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" noValidate onSubmit={handleSubmit}>
          <AuthField
            id="account-old-password"
            label="Mật khẩu hiện tại"
            type="password"
            icon={Lock}
            autoComplete="current-password"
            maxLength={50}
            value={oldPassword}
            onChange={(value) => {
              setOldPassword(value);
              setErrorMessage('');
            }}
            disabled={isSaving}
          />
          <div className="space-y-2">
            <AuthField
              id="account-new-password"
              label="Mật khẩu mới"
              type="password"
              icon={Lock}
              autoComplete="new-password"
              maxLength={50}
              value={newPassword}
              onChange={(value) => {
                setNewPassword(value);
                setErrorMessage('');
              }}
              disabled={isSaving}
            />
            <PasswordChecklist password={newPassword} />
          </div>
          <AuthField
            id="account-confirm-password"
            label="Xác nhận mật khẩu mới"
            type="password"
            icon={Lock}
            autoComplete="new-password"
            maxLength={50}
            value={confirmPassword}
            onChange={(value) => {
              setConfirmPassword(value);
              setErrorMessage('');
            }}
            disabled={isSaving}
          />
          {errorMessage && <AuthAlert>{errorMessage}</AuthAlert>}
          <AuthSubmitButton label="Cập nhật" loadingLabel="Đang cập nhật..." isLoading={isSaving} />
        </form>
      </DialogContent>
    </Dialog>
  );
}
