import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import AdminLayout from '@/admin/layouts/AdminLayout';
import { useStaffStore } from '@/store/staffStore';
import { requestStaffPasswordChangeOTP, changeStaffPasswordWithOTP } from '@/lib/api/admin';

type AdminLayoutActive =
  | 'dashboard'
  | 'users'
  | 'movies'
  | 'toys'
  | 'posts'
  | 'transactions'
  | 'tickets'
  | 'ticket-check'
  | 'uploads'
  | 'email-logs'
  | 'settings'
  | 'branches'
  | 'staff'
  | 'roles'
  | 'audit-logs'
  | 'profile';

interface Props {
  active: AdminLayoutActive;
  setActive: (x: AdminLayoutActive) => void;
  adminEmailState: string;
  handleLogout: () => void;
}

export default function ProfilePage({ active, setActive, adminEmailState, handleLogout }: Props) {
  const queryClient = useQueryClient();
  const { staff } = useStaffStore();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [showOtpInput, setShowOtpInput] = useState(false);

  // Request OTP mutation
  const requestOTPMutation = useMutation({
    mutationFn: requestStaffPasswordChangeOTP,
    onSuccess: (data: any) => {
      if (data.status === 'success') {
        toast.success(data.message);
        setOtpSent(true);
        setShowOtpInput(true);
      } else {
        toast.error(data.message);
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Không thể gửi OTP');
    }
  });

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: changeStaffPasswordWithOTP,
    onSuccess: (data: any) => {
      if (data.status === 'success') {
        toast.success(data.message);
        // Reset form
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setOtp('');
        setOtpSent(false);
        setShowOtpInput(false);
      } else {
        toast.error(data.message);
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Không thể đổi mật khẩu');
    }
  });

  const handleRequestOTP = () => {
    if (!oldPassword) {
      toast.error('Vui lòng nhập mật khẩu cũ');
      return;
    }
    requestOTPMutation.mutate({ oldPassword });
  };

  const handleChangePassword = () => {
    if (!oldPassword || !newPassword || !confirmPassword || !otp) {
      toast.error('Vui lòng điền đầy đủ thông tin');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Mật khẩu mới không khớp');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Mật khẩu mới phải có ít nhất 6 ký tự');
      return;
    }

    changePasswordMutation.mutate({ oldPassword, newPassword, otp });
  };

  if (!staff) {
    return (
      <AdminLayout active={active} setActive={setActive} adminEmailState={adminEmailState} handleLogout={handleLogout}>
        <div className="p-6">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout active={active} setActive={setActive} adminEmailState={adminEmailState} handleLogout={handleLogout}>
      <div className="p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Hồ Sơ Nhân Viên</h1>

        {/* Staff Info Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Thông Tin Cá Nhân</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm text-gray-600">Họ và tên</Label>
              <p className="font-medium">{staff.fullname}</p>
            </div>
            <div>
              <Label className="text-sm text-gray-600">Email</Label>
              <p className="font-medium">{staff.email}</p>
            </div>
            {staff.phone && (
              <div>
                <Label className="text-sm text-gray-600">Số điện thoại</Label>
                <p className="font-medium">{staff.phone}</p>
              </div>
            )}
            <div>
              <Label className="text-sm text-gray-600">Vai trò</Label>
              <p className="font-medium">{staff.isSuperAdmin ? 'Super Admin' : 'Nhân viên'}</p>
            </div>
            {staff.lastLoginAt && (
              <div>
                <Label className="text-sm text-gray-600">Lần đăng nhập cuối</Label>
                <p className="font-medium">{new Date(staff.lastLoginAt).toLocaleString('vi-VN')}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Change Password Card */}
        <Card>
          <CardHeader>
            <CardTitle>Đổi Mật Khẩu</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => e.preventDefault()} className="space-y-4" autoComplete="off">
              <input type="text" name="username" value={staff.email} readOnly className="hidden" autoComplete="off" />
              <div>
                <Label htmlFor="oldPassword">Mật khẩu cũ *</Label>
                <Input
                  id="oldPassword"
                  name="oldPassword"
                  type="password"
                  autoComplete="off"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="Nhập mật khẩu cũ"
                  disabled={showOtpInput}
                />
              </div>

              {!showOtpInput ? (
                <Button onClick={handleRequestOTP} disabled={requestOTPMutation.isPending} className="w-full">
                  {requestOTPMutation.isPending ? 'Đang gửi OTP...' : 'Gửi OTP'}
                </Button>
              ) : (
                <>
                  <div>
                    <Label htmlFor="newPassword">Mật khẩu mới *</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Nhập mật khẩu mới (ít nhất 6 ký tự)"
                    />
                  </div>

                  <div>
                    <Label htmlFor="confirmPassword">Xác nhận mật khẩu mới *</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Nhập lại mật khẩu mới"
                    />
                  </div>

                  <div>
                    <Label htmlFor="otp">Mã OTP *</Label>
                    <Input
                      id="otp"
                      type="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder="Nhập mã OTP từ email"
                      maxLength={6}
                      className="text-center text-lg tracking-widest"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      OTP đã được gửi đến email của bạn. Mã có hiệu lực trong 5 phút.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={handleChangePassword}
                      disabled={changePasswordMutation.isPending}
                      className="flex-1"
                    >
                      {changePasswordMutation.isPending ? 'Đang xử lý...' : 'Đổi Mật Khẩu'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowOtpInput(false);
                        setOtpSent(false);
                      }}
                      className="flex-1"
                    >
                      Hủy
                    </Button>
                  </div>

                  <Button
                    variant="ghost"
                    onClick={handleRequestOTP}
                    disabled={requestOTPMutation.isPending}
                    className="w-full text-sm"
                  >
                    Gửi lại OTP
                  </Button>
                </>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
