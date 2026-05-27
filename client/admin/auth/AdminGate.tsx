import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useStaffStore } from '@/store/staffStore';
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

                        const response = await fetch('/api/admin/auth/login', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ email, password }),
                        });

                        const data = await response.json();

                        if (data.status === 'success') {
                                localStorage.setItem('staffToken', data.token);
                                setStaff(
                                        data.staff,
                                        data.permissions,
                                        data.branchIds,
                                        data.token
                                );
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

        // Check if super admin setup is needed
        const [needsSetup, setNeedsSetup] = useState(false);
        const [checkingSetup, setCheckingSetup] = useState(true);

        useEffect(() => {
                async function checkSetup() {
                        try {
                                const response = await fetch('/api/admin/setup/super-admin', {
                                        method: 'GET',
                                });
                                const data = await response.json();
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
                        await fetch('/api/admin/auth/logout', { method: 'POST' });
                } catch (err) {
                        console.error('Logout error:', err);
                }
                localStorage.removeItem('staffToken');
                clearStaff();
                navigate('/login', { replace: true });
        }

        if (checkingSetup) {
                return <div className="min-h-screen flex items-center justify-center">Đang kiểm tra...</div>;
        }

        if (needsSetup) {
                return <SetupSuperAdminPage />;
        }

        if (!isAuthenticated) return <AdminLoginView />;

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
