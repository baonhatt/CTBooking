import { useEffect, useState, useRef } from 'react';
import { Routes, Route, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { AuthShell, AuthField, AuthError, AuthSubmitButton, AUTH_INPUT } from '@/components/admin/auth/AuthShell';
import { ADMIN_BTN_GHOST } from '@/components/admin/common/adminTokens';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useStaffStore } from '@/store/staffStore';
import { useStaffPermission, useIsSuperAdmin } from '@/hooks/useStaffPermission';
import { loginApi } from '@/lib/api/auth';
import { request } from '@/lib/api/http';
import { checkSuperAdminSetup } from '@/lib/api/admin';
import { ShieldAlert, Lock, Mail, Eye, EyeOff, ArrowRight, ArrowLeft, ShieldCheck } from 'lucide-react';
import { forceChangePasswordApi, verifyAdminLoginOtpApi } from '@/lib/api/auth';
import { SessionTimeoutModal } from '@/components/admin/SessionTimeoutModal';
import { performLogout } from '@/lib/auth-utils';
import { useStaffTokenSync } from '@/hooks/useStaffTokenSync';
import AdminIndex from '@/pages/admin/AdminIndex';
import DashboardPage from '@/pages/admin/Dashboard';
import UsersPage from '@/pages/admin/Users';
import MoviesPage from '@/pages/admin/Movies';
import ShowtimesPage from '@/pages/admin/Showtimes';
// TẠM ẨN ĐỒ CHƠI (20261110): khách chưa dùng module đồ chơi nên ẩn khỏi giao diện. API, DB và các file Toys* vẫn giữ nguyên. Tìm "TẠM ẨN ĐỒ CHƠI" để mở lại.
// import ToysPage from '@/pages/admin/Toys';
import PostsPage from '@/pages/admin/Posts';
import PostEditPage from '@/pages/admin/PostEdit';
import PostCreatePage from '@/pages/admin/PostCreate';
import TransactionsPage from '@/pages/admin/Transactions';
import TicketsPage from '@/pages/admin/Tickets';
import TicketCheckPage from '@/pages/admin/TicketCheck';
import UploadsPage from '@/pages/admin/Uploads';
import SettingsPage from '@/pages/admin/Settings';
import BranchesPage from '@/pages/admin/Branches';
import EmailLogsPage from '@/pages/admin/EmailLogs';
import StaffPage from '@/pages/admin/Staff';
import RolesPage from '@/pages/admin/Roles';
import RoleDetailPage from '@/pages/admin/RoleDetailPage';
import AuditLogsPage from '@/pages/admin/AuditLogs';
import SetupSuperAdminPage from '@/pages/admin/SetupSuperAdmin';
import ProfilePage from '@/pages/admin/Profile';
import DeletedMoviesPage from '@/pages/admin/DeletedMovies';
import DeletedStaffPage from '@/pages/admin/DeletedStaff';
import DeletedTicketsPage from '@/pages/admin/DeletedTickets';
import DeletedRolesPage from '@/pages/admin/DeletedRoles';
import DeletedBranchesPage from '@/pages/admin/DeletedBranches';
import VouchersPage from '@/pages/admin/Vouchers';
import DeletedVouchersPage from '@/pages/admin/DeletedVouchers';
import EmailPreviewPage from '@/pages/admin/EmailPreview';

const AccessDenied = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
      <div className="bg-rose-50 p-4 rounded-full mb-4">
        <ShieldAlert className="w-12 h-12 text-rose-500" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Truy cập bị từ chối</h2>
      <p className="text-gray-600 mb-6 max-w-md">
        Bạn không có quyền truy cập vào trang này. Vui lòng liên hệ với quản trị viên nếu bạn cho rằng đây là một sự
        nhầm lẫn.
      </p>
      <Button onClick={() => navigate('/')}>Quay lại trang chủ</Button>
    </div>
  );
};

const ProtectedRoute = ({
  children,
  module,
  action
}: {
  children: React.ReactNode;
  module: string;
  action: string;
}) => {
  const hasPerm = useStaffPermission(module, action);
  const isSuper = useIsSuperAdmin();

  if (!isSuper && !hasPerm) {
    return <AccessDenied />;
  }

  return <>{children}</>;
};

const AdminLoginView = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  // On localhost there is no captcha: the widget is not shown and a placeholder token is sent
  const IS_LOCAL_HOST = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const [turnstileToken, setTurnstileToken] = useState<string>(IS_LOCAL_HOST ? 'local-dev' : '');
  
  // 2FA Flow states
  const [requireOtp, setRequireOtp] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [pendingStaffId, setPendingStaffId] = useState<number | null>(null);

  const turnstileRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetId = useRef<string | null>(null);

  const setStaff = useStaffStore((state) => state.setStaff);

  useEffect(() => {
    if (IS_LOCAL_HOST) return;
    const renderWidget = () => {
      if ((window as any).turnstile && turnstileRef.current && !turnstileWidgetId.current) {
        turnstileWidgetId.current = (window as any).turnstile.render(turnstileRef.current, {
          sitekey: '0x4AAAAAAE1v1PaZCL-bktYH',
          action: 'admin_login',
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
      script.onload = renderWidget;
    } else {
      renderWidget();
    }

    return () => {
      if (turnstileWidgetId.current && (window as any).turnstile?.remove) {
        (window as any).turnstile.remove(turnstileWidgetId.current);
        turnstileWidgetId.current = null;
      }
    };
  }, []);

  async function handleLogin(e?: React.FormEvent) {
    e?.preventDefault();
    if (!turnstileToken) {
      setError('Vui lòng hoàn tất kiểm tra bảo mật (CAPTCHA).');
      return;
    }
    
    try {
      setLoading(true);
      setError('');

      const data = await loginApi({ email, password, turnstileToken });

      if (data.status === 'success') {
        localStorage.setItem('staffToken', data.token);
        setStaff(data.staff, data.permissions, data.branchIds, data.token, data.expiresAt);
        navigate('/', { replace: true });
      } else if (data.status === 'require_otp') {
        setRequireOtp(true);
        setPendingStaffId(data.staffId);
        setError('');
      } else {
        setError(data.message || 'Đăng nhập thất bại');
      }
    } catch (err: any) {
      setError(err?.message || 'Lỗi kết nối server');
    } finally {
      setLoading(false);
      if (!IS_LOCAL_HOST && !requireOtp && (window as any).turnstile && turnstileWidgetId.current) {
        (window as any).turnstile.reset(turnstileWidgetId.current);
        setTurnstileToken('');
      }
    }
  }

  async function handleVerifyOtp(e?: React.FormEvent) {
    e?.preventDefault();
    if (!otpCode || !pendingStaffId) return;

    try {
      setLoading(true);
      setError('');
      
      const data = await verifyAdminLoginOtpApi({ staffId: pendingStaffId, otp: otpCode });

      if (data.status === 'success') {
        localStorage.setItem('staffToken', data.token);
        setStaff(data.staff, data.permissions, data.branchIds, data.token, data.expiresAt);
        navigate('/', { replace: true });
      } else {
        setError(data.message || 'Mã OTP không hợp lệ hoặc đã hết hạn');
      }
    } catch (err: any) {
      setError(err?.message || 'Lỗi kết nối server xác thực OTP');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title={requireOtp ? 'Xác thực bảo vệ 2 lớp' : 'Đăng nhập tài khoản'}
      description={
        requireOtp
          ? 'Mã xác thực gồm 6 số đã được gửi tới email của bạn.'
          : 'Truy cập bảng điều khiển dành cho ban quản trị & nhân viên'
      }
      footer="Bảo mật chuẩn phân quyền RBAC • Hệ thống CineSphere"
    >
      {requireOtp ? (
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <AuthField label="Mã xác thực (OTP)" icon={ShieldCheck}>
            <Input
              type="text"
              placeholder="Nhập mã 6 số"
              className={`${AUTH_INPUT} text-center font-mono text-xl font-bold tracking-[0.5em]`}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              maxLength={8}
              autoFocus
              required
            />
          </AuthField>

          <AuthError message={error} />

          <AuthSubmitButton loading={loading} disabled={otpCode.length < 4} busyText="Đang xác thực...">
            <span>Xác thực & đăng nhập</span>
            <ArrowRight className="h-4 w-4" />
          </AuthSubmitButton>

          <button
            type="button"
            onClick={() => {
              setRequireOtp(false);
              setOtpCode('');
              setPendingStaffId(null);
              setError('');
            }}
            className={`${ADMIN_BTN_GHOST} inline-flex w-full items-center justify-center gap-1.5`}
          >
            <ArrowLeft className="h-4 w-4" />
            Quay lại
          </button>
        </form>
      ) : (
        <form onSubmit={handleLogin} className="space-y-4">
          <AuthField label="Email quản trị" icon={Mail}>
            <Input
              type="email"
              placeholder="name@cinesphere.com"
              className={AUTH_INPUT}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete={isEmailFocused ? 'email' : 'new-password'}
              onFocus={() => setIsEmailFocused(true)}
              readOnly={!isEmailFocused}
              required
            />
          </AuthField>

          <AuthField
            label="Mật khẩu"
            icon={Lock}
            trailing={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 transition-colors hover:text-slate-700"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
          >
            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              className={`${AUTH_INPUT} pr-10`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isPasswordFocused ? 'current-password' : 'new-password'}
              onFocus={() => setIsPasswordFocused(true)}
              readOnly={!isPasswordFocused}
              required
            />
          </AuthField>

          <AuthError message={error} />

          {/* Cloudflare Turnstile CAPTCHA */}
          {!IS_LOCAL_HOST && (
            <div className="flex justify-center">
              <div ref={turnstileRef} className="cf-turnstile"></div>
            </div>
          )}

          <AuthSubmitButton loading={loading} disabled={!turnstileToken} busyText="Đang xác thực...">
            <span>Đăng nhập hệ thống</span>
            <ArrowRight className="h-4 w-4" />
          </AuthSubmitButton>
        </form>
      )}
    </AuthShell>
  );
};

export const AdminGate = () => {
  const isAuthenticated = useStaffStore((state) => state.isAuthenticated);
  const staff = useStaffStore((state) => state.staff);
  const clearStaff = useStaffStore((state) => state.clearStaff);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Follow sign-out and sign-in done in another tab
  useStaffTokenSync();

  // ĐẢM BẢO isAuthenticated ĐÚNG (Token đồng bộ với Store)
  // Fix lỗi flicker khi staff-storage vẫn còn isAuthenticated=true nhưng staffToken đã mất
  const [actuallyAuth, setActuallyAuth] = useState<boolean | null>(null);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('staffToken') : null;
    if (isAuthenticated && !token) {
      clearStaff();
      setActuallyAuth(false);
    } else {
      setActuallyAuth(isAuthenticated);
    }
  }, [isAuthenticated, clearStaff]);

  // Hiển thị thông báo nếu bị kick ra do hết hạn session
  useEffect(() => {
    const reason = searchParams.get('reason');
    if (reason === 'session_expired') {
      toast.error('Phiên đăng nhập đã hết hạn', {
        description: 'Vui lòng đăng nhập lại để tiếp tục làm việc.'
      });
      // Xóa params để không hiện lại khi F5
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('reason');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Check if super admin setup is needed
  const [needsSetup, setNeedsSetup] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);

  useEffect(() => {
    async function checkSetup() {
      try {
        const data = await checkSuperAdminSetup();
        if (data.exists) {
          setNeedsSetup(false);
        } else {
          setNeedsSetup(true);
        }
      } catch {
        setNeedsSetup(false);
      } finally {
        setCheckingSetup(false);
      }
    }
    checkSetup();
  }, []);

  async function handleLogout() {
    await performLogout();
  }

  // Ưu tiên hiển thị Login ngay nếu chắc chắn chưa auth, không cần đợi checkSetup hoàn thành
  // vì setup page chỉ dành cho trường hợp hệ thống mới tinh.
  if (actuallyAuth === false) return <AdminLoginView />;

  if (checkingSetup || actuallyAuth === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-700">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600/20 border-t-blue-600" />
          <p className="text-sm font-medium">Đang kiểm tra hệ thống...</p>
        </div>
      </div>
    );
  }

  if (needsSetup) {
    return <SetupSuperAdminPage />;
  }

  if (!actuallyAuth) return <AdminLoginView />;

  // Check if force password change is required
  if (staff?.forcePasswordChange) {
    return <ForcePasswordChangeView staff={staff} />;
  }

  return (
    <div>
      <SessionTimeoutModal />
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute module="dashboard" action="view">
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute module="users" action="view">
              <UsersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/movies"
          element={
            <ProtectedRoute module="movies" action="view">
              <MoviesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/showtimes"
          element={
            <ProtectedRoute module="showtimes" action="view">
              <ShowtimesPage />
            </ProtectedRoute>
          }
        />
        {/* TẠM ẨN ĐỒ CHƠI (20261110): khách chưa dùng module đồ chơi nên ẩn khỏi giao diện. API, DB và các file Toys* vẫn giữ nguyên. Tìm "TẠM ẨN ĐỒ CHƠI" để mở lại. */}
        {/*
        <Route
          path="/toys"
          element={
            <ProtectedRoute module="toys" action="view">
              <ToysPage />
            </ProtectedRoute>
          }
        />
        */}
        <Route
          path="/posts"
          element={
            <ProtectedRoute module="posts" action="view">
              <PostsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/posts/new"
          element={
            <ProtectedRoute module="posts" action="create">
              <PostCreatePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/posts/:id/edit"
          element={
            <ProtectedRoute module="posts" action="edit">
              <PostEditPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tickets"
          element={
            <ProtectedRoute module="tickets" action="view">
              <TicketsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/vouchers"
          element={
            <ProtectedRoute module="vouchers" action="view">
              <VouchersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/transactions"
          element={
            <ProtectedRoute module="transactions" action="view">
              <TransactionsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ticket-check"
          element={
            <ProtectedRoute module="ticket_check" action="scan">
              <TicketCheckPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/branches"
          element={
            <ProtectedRoute module="branches" action="view">
              <BranchesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/uploads"
          element={
            <ProtectedRoute module="uploads" action="view">
              <UploadsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/email-logs"
          element={
            <ProtectedRoute module="email_logs" action="view">
              <EmailLogsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/email-templates"
          element={
            <ProtectedRoute module="email_logs" action="view">
              <EmailPreviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute module="settings" action="view">
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/staff"
          element={
            <ProtectedRoute module="staff" action="view">
              <StaffPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/roles"
          element={
            <ProtectedRoute module="roles" action="view">
              <RolesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/roles/:id"
          element={
            <ProtectedRoute module="roles" action="view">
              <RoleDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/audit-logs"
          element={
            <ProtectedRoute module="audit_logs" action="view">
              <AuditLogsPage />
            </ProtectedRoute>
          }
        />

        {/* Deleted Items Routes */}
        <Route
          path="/deleted/movies"
          element={
            <ProtectedRoute module="movies" action="view_deleted">
              <DeletedMoviesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/deleted/staff"
          element={
            <ProtectedRoute module="staff" action="view_deleted">
              <DeletedStaffPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/deleted/tickets"
          element={
            <ProtectedRoute module="tickets" action="view_deleted">
              <DeletedTicketsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/deleted/roles"
          element={
            <ProtectedRoute module="roles" action="view_deleted">
              <DeletedRolesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/deleted/branches"
          element={
            <ProtectedRoute module="branches" action="view_deleted">
              <DeletedBranchesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/deleted/vouchers"
          element={
            <ProtectedRoute module="vouchers" action="view_deleted">
              <DeletedVouchersPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/profile"
          element={<ProfilePage />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
};

const ForcePasswordChangeView = ({ staff }: { staff: any }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const setStaff = useStaffStore((state) => state.setStaff);
  const permissions = useStaffStore((state) => state.permissions);
  const branchIds = useStaffStore((state) => state.branchIds);
  const token = useStaffStore((state) => state.token);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }
    if (newPassword.length < 12 || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setError('Mật khẩu phải có ít nhất 12 ký tự, gồm cả chữ và số');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await forceChangePasswordApi({ newPassword });
      if (res.status === 'success') {
        toast.success('Đổi mật khẩu thành công!');
        // Cập nhật store để clear forcePasswordChange
        if (token) {
          setStaff({ ...staff, forcePasswordChange: false }, permissions, branchIds, token);
        }
      } else {
        setError(res.message || 'Có lỗi xảy ra');
      }
    } catch (err: any) {
      setError(err?.message || 'Lỗi kết nối server');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      badge="Bảo mật tài khoản"
      title="Đổi mật khẩu lần đầu"
      description="Tài khoản của bạn vừa được khởi tạo hoặc thiết lập lại. Vui lòng đặt mật khẩu mới để tiếp tục."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField label="Mật khẩu mới" icon={Lock} htmlFor="new-password">
          <Input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Tối thiểu 12 ký tự, gồm chữ và số"
            className={AUTH_INPUT}
            required
            autoFocus
          />
        </AuthField>

        <AuthField label="Xác nhận mật khẩu mới" icon={Lock} htmlFor="confirm-password">
          <Input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Nhập lại mật khẩu mới"
            className={AUTH_INPUT}
            required
          />
        </AuthField>

        <AuthError message={error} />

        <AuthSubmitButton loading={loading} busyText="Đang cập nhật...">
          <span>Đổi mật khẩu & bắt đầu</span>
          <ArrowRight className="h-4 w-4" />
        </AuthSubmitButton>
      </form>
    </AuthShell>
  );
};
