import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useStaffStore } from '@/store/staffStore';
import { useStaffPermission, useIsSuperAdmin } from '@/hooks/useStaffPermission';
import { loginApi } from '@/lib/api/auth';
import { request } from '@/lib/api/http';
import { checkSuperAdminSetup } from '@/lib/api/admin';
import iconCine from '@/assets/images/iconCine.svg';
import { AlertCircle, ShieldAlert, Lock, Mail, Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react';
import { forceChangePasswordApi } from '@/lib/api/auth';
import { SessionTimeoutModal } from '@/components/admin/SessionTimeoutModal';
import AdminIndex from '@/pages/admin/AdminIndex';
import DashboardPage from '@/pages/admin/Dashboard';
import UsersPage from '@/pages/admin/Users';
import MoviesPage from '@/pages/admin/Movies';
import ShowtimesPage from '@/pages/admin/Showtimes';
import ToysPage from '@/pages/admin/Toys';
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
  const setStaff = useStaffStore((state) => state.setStaff);

  async function handleLogin(e?: React.FormEvent) {
    e?.preventDefault();
    try {
      setLoading(true);
      setError('');

      const data = await loginApi({ email, password });

      if (data.status === 'success') {
        localStorage.setItem('staffToken', data.token);
        setStaff(data.staff, data.permissions, data.branchIds, data.token, data.expiresAt);
        navigate('/', { replace: true });
      } else {
        setError(data.message || 'Đăng nhập thất bại');
      }
    } catch (err: any) {
      setError(err?.message || 'Lỗi kết nối server');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden px-4 py-8 select-none">
      {/* Ambient Cinematic Background Glows */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="relative mb-3 group">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl blur-md opacity-70 group-hover:opacity-100 transition duration-500" />
            <div className="relative h-16 w-16 bg-slate-900 rounded-2xl border border-slate-700/80 flex items-center justify-center shadow-xl p-3">
              <img src={iconCine} alt="CineSphere" className="h-full w-full object-contain" />
            </div>
          </div>
          <h1 className="text-xl font-black tracking-widest text-white uppercase">CINESPHERE</h1>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 mt-1.5 rounded-full bg-slate-900/90 border border-slate-800 text-[10px] font-bold tracking-wider text-emerald-400 uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            Management Portal
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-slate-900/80 backdrop-blur-2xl border border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7)]">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-white">Đăng nhập tài khoản</h2>
            <p className="text-xs text-slate-400 mt-1">Truy cập bảng điều khiển dành cho Ban Quản trị & Nhân viên</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email Input */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300">Email quản trị</Label>
              <div className="relative group">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors">
                  <Mail className="h-4 w-4" />
                </div>
                <Input
                  type="email"
                  placeholder="name@cinesphere.com"
                  className="bg-slate-950/70 border-slate-800/90 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete={isEmailFocused ? 'email' : 'new-password'}
                  onFocus={() => setIsEmailFocused(true)}
                  readOnly={!isEmailFocused}
                  required
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300">Mật khẩu</Label>
              <div className="relative group">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors">
                  <Lock className="h-4 w-4" />
                </div>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="bg-slate-950/70 border-slate-800/90 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isPasswordFocused ? 'current-password' : 'new-password'}
                  onFocus={() => setIsPasswordFocused(true)}
                  readOnly={!isPasswordFocused}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-2.5 bg-rose-500/10 border border-rose-500/25 p-3 rounded-xl text-rose-400 text-xs animate-in fade-in-50 duration-200">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <Button
              disabled={loading}
              type="submit"
              className="w-full mt-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-2.5 h-11 rounded-xl shadow-lg shadow-blue-600/25 hover:shadow-blue-600/40 transition-all duration-300 flex items-center justify-center gap-2 group cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Đang xác thực...</span>
                </>
              ) : (
                <>
                  <span>Đăng nhập hệ thống</span>
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </Button>
          </form>
        </div>

        {/* Security Footer */}
        <div className="text-center mt-6 text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
          <span>🔒 Bảo mật chuẩn phân quyền RBAC</span>
          <span>•</span>
          <span>CineSphere System</span>
        </div>
      </div>
    </div>
  );
};

export const AdminGate = () => {
  const isAuthenticated = useStaffStore((state) => state.isAuthenticated);
  const staff = useStaffStore((state) => state.staff);
  const clearStaff = useStaffStore((state) => state.clearStaff);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

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
    try {
      await request('/api/admin/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout error:', err);
    }
    localStorage.removeItem('staffToken');
    clearStaff();
    navigate('/login', { replace: true });
  }

  // Ưu tiên hiển thị Login ngay nếu chắc chắn chưa auth, không cần đợi checkSetup hoàn thành
  // vì setup page chỉ dành cho trường hợp hệ thống mới tinh.
  if (actuallyAuth === false) return <AdminLoginView />;

  if (checkingSetup || actuallyAuth === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050915] text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-sm font-medium animate-pulse">Đang kiểm tra hệ thống...</p>
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
        <Route
          path="/toys"
          element={
            <ProtectedRoute module="toys" action="view">
              <ToysPage />
            </ProtectedRoute>
          }
        />
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
          element={
            <ProfilePage
              active="profile"
              setActive={() => {}}
              adminEmailState={staff?.email || ''}
              handleLogout={handleLogout}
            />
          }
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
    if (newPassword.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự');
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
    <div className="min-h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden px-4 py-8 select-none">
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="relative mb-3 group">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl blur-md opacity-70 group-hover:opacity-100 transition duration-500" />
            <div className="relative h-16 w-16 bg-slate-900 rounded-2xl border border-slate-700/80 flex items-center justify-center shadow-xl p-3">
              <img src={iconCine} alt="CineSphere" className="h-full w-full object-contain" />
            </div>
          </div>
          <h1 className="text-xl font-black tracking-widest text-white uppercase">CINESPHERE</h1>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 mt-1.5 rounded-full bg-slate-900/90 border border-slate-800 text-[10px] font-bold tracking-wider text-amber-400 uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Bảo mật tài khoản
          </div>
        </div>

        <div className="bg-slate-900/80 backdrop-blur-2xl border border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7)]">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-white">Đổi mật khẩu lần đầu</h2>
            <p className="text-xs text-slate-400 mt-1">
              Tài khoản của bạn vừa được khởi tạo hoặc thiết lập lại. Vui lòng đặt mật khẩu mới để tiếp tục.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300">Mật khẩu mới</Label>
              <div className="relative group">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors">
                  <Lock className="h-4 w-4" />
                </div>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nhập tối thiểu 6 ký tự"
                  className="bg-slate-950/70 border-slate-800/90 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300">Xác nhận mật khẩu mới</Label>
              <div className="relative group">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors">
                  <Lock className="h-4 w-4" />
                </div>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                  className="bg-slate-950/70 border-slate-800/90 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 bg-rose-500/10 border border-rose-500/25 p-3 rounded-xl text-rose-400 text-xs animate-in fade-in-50 duration-200">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <Button
              disabled={loading}
              type="submit"
              className="w-full mt-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-2.5 h-11 rounded-xl shadow-lg shadow-blue-600/25 hover:shadow-blue-600/40 transition-all duration-300 flex items-center justify-center gap-2 group cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Đang cập nhật...</span>
                </>
              ) : (
                <>
                  <span>Đổi mật khẩu & Bắt đầu</span>
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};
