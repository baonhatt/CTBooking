import { useEffect, useMemo, useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { adminNavigationItems } from '@/admin/layouts/AdminLayout';
import { getAdminProfileFromStorage } from '@/lib/admin-profile-utils';
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
import UserEditDetailPage from '@/pages/admin/UserEditDetail';
import UserDetailPage from '@/pages/admin/UserDetail';
import UserCreatePage from '@/pages/admin/UserCreate';
// import { adminLoginApi } from "@/lib/api";
import { adminLoginApi, getAdminMe } from '@/lib/api/admin';

const AdminLoginView = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function handleLogin(e?: React.FormEvent) {
    e?.preventDefault();
    try {
      setLoading(true);
      setError('');
      const r: any = await adminLoginApi({ email, password });
      const token = String(r?.token || '');
      if (!token) {
        setError(r?.message || 'Đăng nhập thất bại');
        return;
      }

      // Store token first so getAdminMe can use it
      localStorage.setItem('adminToken', token);
      localStorage.setItem('adminEmail', email);

      try {
        const me = await getAdminMe();
        localStorage.setItem('adminProfile', JSON.stringify(me));
        window.dispatchEvent(new Event('admin-auth-changed'));
        navigate('/', { replace: true });
      } catch (profileErr: any) {
        // If profile fetch fails, clear token - user is not fully authenticated
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminEmail');
        setError('Không thể tải thông tin tài khoản. Vui lòng thử lại.');
        return;
      }
    } catch (err: any) {
      setError(err?.message || err?.error || 'Đăng nhập thất bại. Vui lòng kiểm tra lại email và mật khẩu.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#141e38] to-[#1e293b] flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-4xl rounded-3xl border border-white/15 bg-white/10 backdrop-blur-xl shadow-2xl overflow-hidden">
        <div className="grid md:grid-cols-[1.1fr_1fr]">
          <div className="relative hidden md:flex flex-col gap-8 p-10 text-white bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.45),_transparent_55%),_radial-gradient(circle_at_bottom,_rgba(16,185,129,0.35),_transparent_45%)]">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em]">
                Cinesphere Admin
              </span>
              <h2 className="mt-6 text-3xl font-bold leading-tight">
                Trung tâm quản trị rạp phim
              </h2>
              <p className="mt-4 text-sm text-white/70 leading-relaxed">
                Theo dõi doanh thu, tối ưu lịch chiếu và quản lý đội ngũ của bạn chỉ trong vài thao tác.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 text-sm">
              <div className="rounded-2xl bg-white/10 border border-white/15 px-4 py-3">
                <p className="font-semibold">Truy cập nhanh</p>
                <p className="text-white/70">Xem báo cáo tổng quan, số lượng vé bán ra theo thời gian thực.</p>
              </div>
              <div className="rounded-2xl bg-white/10 border border-white/15 px-4 py-3">
                <p className="font-semibold">Phân quyền linh hoạt</p>
                <p className="text-white/70">Mỗi vai trò được giới hạn trong phạm vi phù hợp.</p>
              </div>
            </div>

            <div className="mt-auto text-xs text-white/60">
              © {new Date().getFullYear()} Cinesphere. Bảo mật và an toàn dữ liệu là ưu tiên hàng đầu.
            </div>
          </div>

          <div className="p-6 md:p-10 bg-white">
            <div className="mb-8">
              <h1 className="text-2xl font-semibold text-slate-900">Đăng nhập Admin</h1>
              <p className="text-sm text-slate-500 mt-1">Sử dụng tài khoản được cấp để truy cập bảng điều khiển.</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className="h-11 rounded-xl border-slate-200 focus-visible:ring-2 focus-visible:ring-indigo-400"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Mật khẩu</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="h-11 rounded-xl border-slate-200 focus-visible:ring-2 focus-visible:ring-indigo-400"
                  required
                />
              </div>

              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-between text-sm text-slate-500">
                <span>Quên mật khẩu? Liên hệ quản trị viên để đặt lại.</span>
              </div>

              <Button
                disabled={loading}
                type="submit"
                className="h-11 w-full rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
              >
                {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

import EmailLogsPage from '@/pages/admin/EmailLogs';

export const AdminGate = () => {
  const [hasToken, setHasToken] = useState<boolean>(!!localStorage.getItem('adminToken'));
  const [adminRole, setAdminRole] = useState<string>(() => {
    const profile = getAdminProfileFromStorage();
    return profile?.role || '';
  });
  const [adminPermissions, setAdminPermissions] = useState<string[]>(() => {
    const profile = getAdminProfileFromStorage();
    return profile?.permissions || [];
  });

  const adminPermissionsSet = useMemo(() => new Set(adminPermissions), [adminPermissions]);

  const canAccess = useMemo(() => {
    return (url: string) => {
      if (adminRole === 'super_admin') return true;
      const item = adminNavigationItems.find((i) => i.url === url);
      if (!item) return false; // Unknown URL - deny access
      if (item.superAdminOnly) return false;
      const required = item.requiredPermissions;
      if (!required || required.length === 0) return true;
      return required.some((p) => adminPermissionsSet.has(p));
    };
  }, [adminPermissionsSet, adminRole]);

  const canEditPosts = useMemo(() => {
    if (adminRole === 'super_admin') return true;
    return adminPermissionsSet.has('posts.edit');
  }, [adminPermissionsSet, adminRole]);

  const firstAllowedPath = useMemo(() => {
    if (adminRole === 'super_admin') return '/';
    const allowed = adminNavigationItems.filter((item) => {
      if (item.superAdminOnly) return false;
      const required = item.requiredPermissions;
      if (!required || required.length === 0) return true;
      return required.some((p) => adminPermissionsSet.has(p));
    });
    if (allowed.length === 0) {
      // No permissions - clear token and redirect to login
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminEmail');
      localStorage.removeItem('adminProfile');
      return '/login';
    }
    return allowed[0]?.url || '/';
  }, [adminPermissionsSet, adminRole]);

  useEffect(() => {
    const onAuthChanged = () => {
      setHasToken(!!localStorage.getItem('adminToken'));
      const profile = getAdminProfileFromStorage();
      setAdminRole(profile?.role || '');
      setAdminPermissions(profile?.permissions || []);
    };
    window.addEventListener('admin-auth-changed', onAuthChanged as any);
    window.addEventListener('storage', onAuthChanged as any);
    return () => {
      window.removeEventListener('admin-auth-changed', onAuthChanged as any);
      window.removeEventListener('storage', onAuthChanged as any);
    };
  }, []);
  if (!hasToken) return <AdminLoginView />;
  return (
    <Routes>
      <Route path="/" element={canAccess('/') ? <DashboardPage /> : <Navigate to={firstAllowedPath} replace />} />
      {canAccess('/users') && <Route path="/users" element={<UsersPage />} />}
      {canAccess('/users') && <Route path="/users/create" element={<UserCreatePage />} />}
      {canAccess('/users') && <Route path="/users/:id" element={<UserDetailPage />} />}
      {canAccess('/users') && <Route path="/users/:id/edit" element={<UserEditDetailPage />} />}
      {canAccess('/movies') && <Route path="/movies" element={<MoviesPage />} />}
      {canAccess('/toys') && <Route path="/toys" element={<ToysPage />} />}
      {canAccess('/posts') && <Route path="/posts" element={<PostsPage />} />}
      {canEditPosts && <Route path="/posts/:id/edit" element={<PostEditPage />} />}
      {canAccess('/tickets') && <Route path="/tickets" element={<TicketsPage />} />}
      {canAccess('/transactions') && <Route path="/transactions" element={<TransactionsPage />} />}
      {canAccess('/ticket-check') && <Route path="/ticket-check" element={<TicketCheckPage />} />}
      {canAccess('/branches') && <Route path="/branches" element={<BranchesPage />} />}
      {canAccess('/uploads') && <Route path="/uploads" element={<UploadsPage />} />}
      {canAccess('/email-logs') && <Route path="/email-logs" element={<EmailLogsPage />} />}
      {canAccess('/settings') && <Route path="/settings" element={<SettingsPage />} />}
      <Route path="*" element={<Navigate to={firstAllowedPath} replace />} />
    </Routes>
  );
};
