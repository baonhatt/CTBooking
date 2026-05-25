import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Shield, User, Mail, Clock, Activity, Edit } from 'lucide-react';
import { getUserById } from '@/lib/api/users';
import { getAdminPermissions } from '@/lib/api/admin';
import AdminLayout from '@/admin/layouts/AdminLayout';
import PermissionMatrix from '@/components/admin/permissions/PermissionMatrix';
import { transformPermissionsToMatrix } from '@/components/admin/permissions/utils';
import { PermissionModule } from '@/components/admin/permissions/types';

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [permGroups, setPermGroups] = useState<Record<string, Array<{ key: string; name: string }>> | null>(null);
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set());
  const [permissionModules, setPermissionModules] = useState<PermissionModule[]>([]);

  useEffect(() => {
    loadUserData();
    loadPermissions();
  }, [id]);

  useEffect(() => {
    if (permGroups) {
      setPermissionModules(transformPermissionsToMatrix(permGroups));
    }
  }, [permGroups]);

  const loadUserData = async () => {
    try {
      setIsLoading(true);
      const data = await getUserById(id!);
      setUser(data);
      if (Array.isArray(data.permissions)) {
        setSelectedPerms(new Set(data.permissions));
      }
    } catch (err: any) {
      console.error('Lỗi load user:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPermissions = async () => {
    try {
      const g = await getAdminPermissions();
      setPermGroups(g);
    } catch (err) {
      console.error('Lỗi load permissions:', err);
      setPermGroups({});
    }
  };

  if (isLoading) {
    return (
      <AdminLayout
        active={'users' as any}
        setActive={(() => {}) as any}
        adminEmailState={localStorage.getItem('adminEmail') || 'admin@email.com'}
        handleLogout={() => {
          localStorage.removeItem('adminToken');
          localStorage.removeItem('adminEmail');
          window.dispatchEvent(new Event('admin-auth-changed'));
          window.location.href = '/';
        }}
      >
        <div className="p-6 max-w-6xl mx-auto">
          <div className="text-center py-12 text-slate-500">Đang tải...</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      active={'users' as any}
      setActive={(() => {}) as any}
      adminEmailState={localStorage.getItem('adminEmail') || 'admin@email.com'}
      handleLogout={() => {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminEmail');
        window.dispatchEvent(new Event('admin-auth-changed'));
        window.location.href = '/';
      }}
    >
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/users')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Chi tiết người dùng</h1>
              <p className="text-sm text-slate-500">Xem thông tin và phân quyền</p>
            </div>
          </div>
          <Button
            onClick={() => navigate(`/users/${id}/edit`)}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            <Edit className="h-4 w-4 mr-2" />
            Chỉnh sửa
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - User Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Thông tin cơ bản
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Họ tên</label>
                    <div className="px-3 py-2 bg-slate-50 rounded-lg text-sm text-slate-900">
                      {user?.name || user?.fullname || '-'}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Email</label>
                    <div className="px-3 py-2 bg-slate-50 rounded-lg text-sm text-slate-900">
                      {user?.email || '-'}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Vai trò</label>
                    <div className="px-3 py-2 bg-slate-50 rounded-lg text-sm text-slate-900 capitalize">
                      {user?.role || '-'}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Trạng thái</label>
                    <div className="px-3 py-2 bg-slate-50 rounded-lg">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${
                        user?.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {user?.is_active ? 'Hoạt động' : 'Ngừng'}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Permissions Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Phân quyền
                </CardTitle>
              </CardHeader>
              <CardContent>
                {permissionModules.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    Không có quyền nào
                  </div>
                ) : (
                  <div className="opacity-75 pointer-events-none">
                    <PermissionMatrix
                      modules={permissionModules}
                      selectedPermissions={selectedPerms}
                      onPermissionToggle={() => {}}
                      onRowToggle={() => {}}
                      onColumnToggle={() => {}}
                      onToggleAll={() => {}}
                      onClearAll={() => {}}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - User Stats */}
          <div className="space-y-6">
            {/* Quick Stats Card */}
            <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white border-0">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-white">
                  <Shield className="h-5 w-5" />
                  Tổng quan phân quyền
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/10 rounded-lg p-4">
                    <div className="text-3xl font-bold text-white">
                      {selectedPerms.size}
                    </div>
                    <div className="text-xs text-slate-300 mt-1">Đã chọn</div>
                  </div>
                  <div className="bg-white/10 rounded-lg p-4">
                    <div className="text-3xl font-bold text-white">
                      {permissionModules.flatMap(m => m.permissions).length}
                    </div>
                    <div className="text-xs text-slate-300 mt-1">Tổng quyền</div>
                  </div>
                </div>
                <div className="bg-white/5 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-300">Tiến độ</span>
                    <span className="text-sm font-semibold text-white">
                      {permissionModules.flatMap(m => m.permissions).length > 0
                        ? Math.round((selectedPerms.size / permissionModules.flatMap(m => m.permissions).length) * 100)
                        : 0}%
                    </span>
                  </div>
                  <div className="w-full bg-white/20 rounded-full h-2">
                    <div
                      className="bg-indigo-500 h-2 rounded-full transition-all"
                      style={{
                        width: `${permissionModules.flatMap(m => m.permissions).length > 0
                          ? (selectedPerms.size / permissionModules.flatMap(m => m.permissions).length) * 100
                          : 0}%`
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Account Status Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Trạng thái tài khoản
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Trạng thái</p>
                    <p className="text-xs text-slate-500 mt-1">Tài khoản hiện tại</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    user?.is_active
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {user?.is_active ? 'Hoạt động' : 'Ngừng'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Vai trò</p>
                    <p className="text-xs text-slate-500 mt-1">Quyền hạn hệ thống</p>
                  </div>
                  <span className="text-sm font-semibold text-slate-900 capitalize">
                    {user?.role}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Account Info Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Thông tin tài khoản
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">ID</p>
                  <p className="text-sm font-semibold text-slate-900 font-mono">{user?.id}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-1">Email</p>
                  <p className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <Mail className="h-4 w-4 text-slate-400" />
                    {user?.email}
                  </p>
                </div>
                {user?.created_at && (
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">Ngày tạo</p>
                    <p className="text-sm font-semibold text-slate-900">
                      {new Date(user.created_at).toLocaleDateString('vi-VN')}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
