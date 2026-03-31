import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import AdminIndex from '@/pages/admin/AdminIndex';
import DashboardPage from '@/pages/admin/Dashboard';
import UsersPage from '@/pages/admin/Users';
import MoviesPage from '@/pages/admin/Movies';
import ToysPage from '@/pages/admin/Toys';
import PostsPage from '@/pages/admin/Posts';
import TransactionsPage from '@/pages/admin/Transactions';
import TicketsPage from '@/pages/admin/Tickets';
import TicketCheckPage from '@/pages/admin/TicketCheck';
import UploadsPage from '@/pages/admin/Uploads';
import SettingsPage from '@/pages/admin/Settings';
// import { adminLoginApi } from "@/lib/api";

const AdminLoginView = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  async function handleLogin(e?: React.FormEvent) {
    e?.preventDefault();
    try {
      setLoading(true);
      setError('');
      // const { token } = await adminLoginApi({ email, password });
      // localStorage.setItem("adminToken", token);
      if (email === 'admin@email.com' && password === 'admin') {
        localStorage.setItem('adminToken', 'adminToken');
      } else {
        setError('Đăng nhập thất bại');
        return;
      }
      localStorage.setItem('adminEmail', email);
      window.dispatchEvent(new Event('admin-auth-changed'));
      navigate('/admin', { replace: true });
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

import EmailLogsPage from '@/pages/admin/EmailLogs';

export const AdminGate = () => {
  const [hasToken, setHasToken] = useState<boolean>(!!localStorage.getItem('adminToken'));
  useEffect(() => {
    const onAuthChanged = () => setHasToken(!!localStorage.getItem('adminToken'));
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
      <Route path="/" element={<AdminIndex />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/users" element={<UsersPage />} />
      <Route path="/movies" element={<MoviesPage />} />
      <Route path="/toys" element={<ToysPage />} />
      <Route path="/posts" element={<PostsPage />} />
      <Route path="/tickets" element={<TicketsPage />} />
      <Route path="/transactions" element={<TransactionsPage />} />
      <Route path="/ticket-check" element={<TicketCheckPage />} />
      <Route path="/uploads" element={<UploadsPage />} />
      <Route path="/email-logs" element={<EmailLogsPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
    </Routes>
  );
};
