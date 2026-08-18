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
import { AlertCircle, ShieldAlert } from 'lucide-react';
import { forceChangePasswordApi } from '@/lib/api/auth';
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

const AccessDenied = () => {
        const navigate = useNavigate();

        return (
                <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
                        <div className="bg-rose-50 p-4 rounded-full mb-4">
                                <ShieldAlert className="w-12 h-12 text-rose-500" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Truy cập bị từ chối</h2>
                        <p className="text-gray-600 mb-6 max-w-md">
                                Bạn không có quyền truy cập vào trang này. Vui lòng liên hệ với quản trị viên nếu bạn cho rằng đây là một sự nhầm lẫn.
                        </p>
                        <Button onClick={() => navigate('/')}>Quay lại trang chủ</Button>
                </div>
        );
};

const ProtectedRoute = ({ children, module, action }: { children: React.ReactNode; module: string; action: string }) => {
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
                return <ForcePasswordChangeView staff={staff} />;
        }

        return (
                <div>
                        <Routes>
                                <Route path="/" element={<ProtectedRoute module="dashboard" action="view"><DashboardPage /></ProtectedRoute>} />
                                <Route path="/users" element={<ProtectedRoute module="users" action="view"><UsersPage /></ProtectedRoute>} />
                                <Route path="/movies" element={<ProtectedRoute module="movies" action="view"><MoviesPage /></ProtectedRoute>} />
                                <Route path="/showtimes" element={<ProtectedRoute module="showtimes" action="view"><ShowtimesPage /></ProtectedRoute>} />
                                <Route path="/toys" element={<ProtectedRoute module="toys" action="view"><ToysPage /></ProtectedRoute>} />
                                <Route path="/posts" element={<ProtectedRoute module="posts" action="view"><PostsPage /></ProtectedRoute>} />
                                <Route path="/posts/new" element={<ProtectedRoute module="posts" action="create"><PostCreatePage /></ProtectedRoute>} />
                                <Route path="/posts/:id/edit" element={<ProtectedRoute module="posts" action="edit"><PostEditPage /></ProtectedRoute>} />
                                <Route path="/tickets" element={<ProtectedRoute module="tickets" action="view"><TicketsPage /></ProtectedRoute>} />
                                <Route path="/transactions" element={<ProtectedRoute module="transactions" action="view"><TransactionsPage /></ProtectedRoute>} />
                                <Route path="/ticket-check" element={<ProtectedRoute module="ticket_check" action="scan"><TicketCheckPage /></ProtectedRoute>} />
                                <Route path="/branches" element={<ProtectedRoute module="branches" action="view"><BranchesPage /></ProtectedRoute>} />
                                <Route path="/uploads" element={<ProtectedRoute module="uploads" action="view"><UploadsPage /></ProtectedRoute>} />
                                <Route path="/email-logs" element={<ProtectedRoute module="email_logs" action="view"><EmailLogsPage /></ProtectedRoute>} />
                                <Route path="/settings" element={<ProtectedRoute module="settings" action="view"><SettingsPage /></ProtectedRoute>} />
                                <Route path="/staff" element={<ProtectedRoute module="staff" action="view"><StaffPage /></ProtectedRoute>} />
                                <Route path="/roles" element={<ProtectedRoute module="roles" action="view"><RolesPage /></ProtectedRoute>} />
                                <Route path="/roles/:id" element={<ProtectedRoute module="roles" action="view"><RoleDetailPage /></ProtectedRoute>} />
                                <Route path="/audit-logs" element={<ProtectedRoute module="audit_logs" action="view"><AuditLogsPage /></ProtectedRoute>} />

                                {/* Deleted Items Routes */}
                                <Route path="/deleted/movies" element={<ProtectedRoute module="movies" action="view_deleted"><DeletedMoviesPage /></ProtectedRoute>} />
                                <Route path="/deleted/staff" element={<ProtectedRoute module="staff" action="view_deleted"><DeletedStaffPage /></ProtectedRoute>} />
                                <Route path="/deleted/tickets" element={<ProtectedRoute module="tickets" action="view_deleted"><DeletedTicketsPage /></ProtectedRoute>} />
                                <Route path="/deleted/roles" element={<ProtectedRoute module="roles" action="view_deleted"><DeletedRolesPage /></ProtectedRoute>} />
                                <Route path="/deleted/branches" element={<ProtectedRoute module="branches" action="view_deleted"><DeletedBranchesPage /></ProtectedRoute>} />

                                <Route path="/profile" element={<ProfilePage active="profile" setActive={() => { }} adminEmailState={staff?.email || ''} handleLogout={handleLogout} />} />
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
                } catch (err) {
                        setError('Lỗi kết nối server');
                } finally {
                        setLoading(false);
                }
        }

        return (
                <div className="min-h-screen flex items-center justify-center bg-background p-4">
                        <Card className="w-full max-w-sm bg-white shadow-xl">
                                <CardHeader>
                                        <CardTitle className="text-xl font-bold">Đổi mật khẩu lần đầu</CardTitle>
                                </CardHeader>
                                <CardContent>
                                        <p className="text-sm text-gray-600 mb-6">
                                                Tài khoản của bạn vừa được khởi tạo hoặc reset. Vui lòng đặt mật khẩu mới để bắt đầu sử dụng hệ thống.
                                        </p>
                                        <form onSubmit={handleSubmit} className="space-y-4">
                                                <div className="space-y-2">
                                                        <Label htmlFor="new-password">Mật khẩu mới</Label>
                                                        <Input
                                                                id="new-password"
                                                                type="password"
                                                                value={newPassword}
                                                                onChange={(e) => setNewPassword(e.target.value)}
                                                                placeholder="Nhập mật khẩu mới"
                                                                required
                                                                autoFocus
                                                        />
                                                </div>
                                                <div className="space-y-2">
                                                        <Label htmlFor="confirm-password">Xác nhận mật khẩu mới</Label>
                                                        <Input
                                                                id="confirm-password"
                                                                type="password"
                                                                value={confirmPassword}
                                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                                placeholder="Nhập lại mật khẩu mới"
                                                                required
                                                        />
                                                </div>
                                                {error && (
                                                        <div className="flex items-center gap-2 text-rose-500 text-xs font-medium bg-rose-50 p-2 rounded-lg border border-rose-100">
                                                                <AlertCircle size={14} />
                                                                {error}
                                                        </div>
                                                )}
                                                <Button disabled={loading} type="submit" className="w-full">
                                                        {loading ? 'Đang thực hiện...' : 'Đổi mật khẩu & Bắt đầu'}
                                                </Button>
                                        </form>
                                </CardContent>
                        </Card>
                </div>
        );
};

