import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/admin/common/PageHeader';
import { notify } from '@/components/admin/common/notify';
import { ADMIN_BTN_OUTLINE, ADMIN_BTN_PRIMARY, ADMIN_BTN_GHOST, ADMIN_CARD, ADMIN_INPUT, ADMIN_TEXT } from '@/components/admin/common/adminTokens';
import { Skeleton } from '@/components/ui/skeleton';
import AdminLayout from '@/admin/layouts/AdminLayout';
import { useStaffStore } from '@/store/staffStore';
import { requestStaffPasswordChangeOTP, changeStaffPasswordWithOTP } from '@/lib/api/admin';
import { request } from '@/lib/api/http';
import { formatVnDateTime } from '@/lib/format';

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const { staff, clearStaff } = useStaffStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('staffToken');
    clearStaff();
    navigate('/login');
  };
  // The role names come from the server (the stored session only knows whether the user is a super admin)
  const { data: meData } = useQuery({
    queryKey: ['staff-me'],
    queryFn: () =>
      request<{ roleNames?: string[]; branchNames?: string[]; staff?: { createdAt?: string } }>('/api/admin/auth/me')
  });
  const roleNames = meData?.roleNames || [];
  const branchNames = meData?.branchNames || [];
  const NOT_UPDATED = 'Chưa cập nhật';
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showOtpInput, setShowOtpInput] = useState(false);

  // Request OTP mutation
  const requestOTPMutation = useMutation({
    mutationFn: requestStaffPasswordChangeOTP,
    onSuccess: (data: any) => {
      if (data.status === 'success') {
        notify.success(data.message);
        setShowOtpInput(true);
      } else {
        notify.error(data.message);
      }
    },
    onError: (error: any) => {
      notify.error(error.message || 'Không thể gửi OTP');
    }
  });

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: changeStaffPasswordWithOTP,
    onSuccess: (data: any) => {
      if (data.status === 'success') {
        notify.success(data.message);
        // Reset form
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setOtp('');
        setShowOtpInput(false);
      } else {
        notify.error(data.message);
      }
    },
    onError: (error: any) => {
      notify.error(error.message || 'Không thể đổi mật khẩu');
    }
  });

  const handleRequestOTP = () => {
    if (!oldPassword) {
      notify.error('Vui lòng nhập mật khẩu cũ');
      return;
    }
    requestOTPMutation.mutate({ oldPassword });
  };

  const handleChangePassword = () => {
    if (!oldPassword || !newPassword || !confirmPassword || !otp) {
      notify.error('Vui lòng điền đầy đủ thông tin');
      return;
    }

    if (newPassword !== confirmPassword) {
      notify.error('Mật khẩu mới không khớp');
      return;
    }

    if (newPassword.length < 12 || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      notify.error('Mật khẩu mới phải có ít nhất 12 ký tự, gồm cả chữ và số');
      return;
    }

    changePasswordMutation.mutate({ oldPassword, newPassword, otp });
  };

  if (!staff) {
    return (
      <AdminLayout active="profile" setActive={() => {}} adminEmailState={staff?.email || ''} handleLogout={handleLogout}>
        <div className="p-6">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout active="profile" setActive={() => {}} adminEmailState={staff?.email || ''} handleLogout={handleLogout}>
      <div className="max-w-2xl mx-auto space-y-6">
        <PageHeader title="Hồ sơ nhân viên" />

        {/* Staff Info Card */}
        <Card className={ADMIN_CARD}>
          <CardHeader>
            <CardTitle className="text-base font-bold text-slate-800">Thông tin cá nhân</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm text-slate-500">Họ và tên</Label>
              <p className="font-medium text-slate-800">{staff.fullname}</p>
            </div>
            <div>
              <Label className="text-sm text-slate-500">Email</Label>
              <p className="font-medium text-slate-800">{staff.email}</p>
            </div>
            <div>
              <Label className="text-sm text-slate-500">Số điện thoại</Label>
              <p className="font-medium text-slate-800">{staff.phone || NOT_UPDATED}</p>
            </div>
            <div>
              <Label className="text-sm text-slate-500">Vai trò</Label>
              <p className="font-medium text-slate-800">
                {staff.isSuperAdmin ? 'Siêu quản trị' : roleNames.length > 0 ? roleNames.join(', ') : 'Nhân viên'}
              </p>
            </div>
            <div>
              <Label className="text-sm text-slate-500">Chi nhánh phụ trách</Label>
              <p className="font-medium text-slate-800">
                {staff.isSuperAdmin ? 'Tất cả chi nhánh' : branchNames.length > 0 ? branchNames.join(', ') : NOT_UPDATED}
              </p>
            </div>
            <div>
              <Label className="text-sm text-slate-500">Ngày tạo tài khoản</Label>
              <p className="font-medium text-slate-800">
                {meData?.staff?.createdAt ? formatVnDateTime(meData.staff.createdAt) : NOT_UPDATED}
              </p>
            </div>
            <div>
              <Label className="text-sm text-slate-500">Lần đăng nhập cuối</Label>
              <p className="font-medium text-slate-800">{staff.lastLoginAt ? formatVnDateTime(staff.lastLoginAt) : NOT_UPDATED}</p>
            </div>
          </CardContent>
        </Card>

        {/* Change Password Card */}
        <Card className={ADMIN_CARD}>
          <CardHeader>
            <CardTitle className="text-base font-bold text-slate-800">Đổi mật khẩu</CardTitle>
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
                  className={ADMIN_INPUT}
                  disabled={showOtpInput}
                />
              </div>

              {!showOtpInput ? (
                <Button onClick={handleRequestOTP} disabled={requestOTPMutation.isPending} className={`${ADMIN_BTN_PRIMARY} w-full`}>
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
                      placeholder="Nhập mật khẩu mới"
                      className={ADMIN_INPUT}
                    />
                    <p className="text-xs text-slate-500 mt-1">Ít nhất 12 ký tự, gồm cả chữ và số.</p>
                  </div>

                  <div>
                    <Label htmlFor="confirmPassword">Xác nhận mật khẩu mới *</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Nhập lại mật khẩu mới"
                      className={ADMIN_INPUT}
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
                      className={`${ADMIN_INPUT} text-center text-lg tracking-widest`}
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      OTP đã được gửi đến email của bạn. Mã có hiệu lực trong 5 phút.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={handleChangePassword}
                      disabled={changePasswordMutation.isPending}
                      className={`${ADMIN_BTN_PRIMARY} flex-1`}
                    >
                      {changePasswordMutation.isPending ? ADMIN_TEXT.busy : 'Đổi mật khẩu'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowOtpInput(false);
                                      }}
                      className={`${ADMIN_BTN_OUTLINE} flex-1`}
                    >
                      {ADMIN_TEXT.cancel}
                    </Button>
                  </div>

                  <Button
                    variant="ghost"
                    onClick={handleRequestOTP}
                    disabled={requestOTPMutation.isPending}
                    className={`${ADMIN_BTN_GHOST} w-full`}
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
