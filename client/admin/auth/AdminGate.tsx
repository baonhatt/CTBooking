import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useStaffStore } from '@/store/staffStore';
import { loginApi } from '@/lib/api/auth';
import { request } from '@/lib/api/http';
import { checkSuperAdminSetup } from '@/lib/api/admin';
import AdminIndex from '@/pages/admin/AdminIndex';
import DashboardPage from '@/pages/admin/Dashboard';
import UsersPage from '@/pages/admin/Users';
import MoviesPage from '@/pages/admin/Movies';
import ToysPage from '@/pages/admin/Toys';
import PostsPage from '@/pages/admin/Posts';
import PostEditPage from '@/pages/admin/PostEdit';
import TransactionsPage from '@/pages/admin/Transactions';
import TicketsPage from '@/pages/admin/Tickets';
import TicketCheckPage from '@/pages/admin/TicketCheck';
import UploadsPage from '@/pages/admin/Uploads';
import SettingsPage from '@/pages/admin/Settings';
import BranchesPage from '@/pages/admin/Branches';
import EmailLogsPage from '@/pages/admin/EmailLogs';
import StaffPage from '@/pages/admin/Staff';
import RolesPage from '@/pages/admin/Roles';
import AuditLogsPage from '@/pages/admin/AuditLogs';
import SetupSuperAdminPage from '@/pages/admin/SetupSuperAdmin';

const AdminLoginView = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
        setStaff(data.staff, data.permissions, data.branchIds, data.token);
        navigate('/', { replace: true });
      } else {
        setError(data.message || 'Đăng nhập thất bại');
      }
    } catch (err) {
      setError('Lỗi kết nối server');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-sm bg-white">
        <CardHeader>
          <CardTitle>Đăng nhập Admin</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <form onSubmit={handleLogin}>
              <div>
                <Label>Email</Label>
                <Input
                  className="text-black"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete={isEmailFocused ? 'email' : 'new-password'}
                  onFocus={() => setIsEmailFocused(true)}
                  readOnly={!isEmailFocused}
                  required
                />
              </div>
              <div>
                <Label>Mật khẩu</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isPasswordFocused ? 'current-password' : 'new-password'}
                  onFocus={() => setIsPasswordFocused(true)}
                  readOnly={!isPasswordFocused}
                  required
                />
              </div>
              {error && <div className="text-red-500 text-sm">{error}</div>}
              <div className="flex justify-end">
                <Button disabled={loading} type="submit">
                  {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
                </Button>
              </div>
            </form>
          </div>
        </CardContent>
      </Card>
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-sm bg-white">
          <CardHeader>
            <CardTitle>Đổi mật khẩu</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">Bạn cần đổi mật khẩu để tiếp tục.</p>
            <Button onClick={() => navigate('/settings')}>Đi đến trang cài đặt</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/movies" element={<MoviesPage />} />
        <Route path="/toys" element={<ToysPage />} />
        <Route path="/posts" element={<PostsPage />} />
        <Route path="/posts/:id/edit" element={<PostEditPage />} />
        <Route path="/tickets" element={<TicketsPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/ticket-check" element={<TicketCheckPage />} />
        <Route path="/branches" element={<BranchesPage />} />
        <Route path="/uploads" element={<UploadsPage />} />
        <Route path="/email-logs" element={<EmailLogsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/staff" element={<StaffPage />} />
        <Route path="/roles" element={<RolesPage />} />
        <Route path="/audit-logs" element={<AuditLogsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
};
