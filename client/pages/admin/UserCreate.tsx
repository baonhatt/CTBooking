import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { ArrowLeft, Save, Shield, User, Plus } from 'lucide-react';
import { createAdminUser } from '@/lib/api/users';
import { getAdminPermissions } from '@/lib/api/admin';
import AdminLayout from '@/admin/layouts/AdminLayout';
import PermissionMatrix from '@/components/admin/permissions/PermissionMatrix';
import { transformPermissionsToMatrix, toggleAllPermissions, toggleActionPermissions, toggleModulePermissions } from '@/components/admin/permissions/utils';
import { PermissionModule } from '@/components/admin/permissions/types';

export default function UserCreatePage() {
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [permGroups, setPermGroups] = useState<Record<string, Array<{ key: string; name: string }>> | null>(null);
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set());
  const [permissionModules, setPermissionModules] = useState<PermissionModule[]>([]);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user' as 'admin' | 'viewer' | 'user'
  });

  useEffect(() => {
    loadPermissions();
  }, []);

  useEffect(() => {
    if (permGroups) {
      setPermissionModules(transformPermissionsToMatrix(permGroups));
    }
  }, [permGroups]);

  const loadPermissions = async () => {
    try {
      const g = await getAdminPermissions();
      setPermGroups(g);
    } catch (err) {
      console.error('Lỗi load permissions:', err);
      setPermGroups({});
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.email.trim() || !formData.password.trim()) {
      toast.error('Lỗi', {
        description: 'Vui lòng điền đầy đủ thông tin'
      });
      return;
    }

    try {
      setIsSaving(true);
      await createAdminUser({
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        role: formData.role,
        permissions: Array.from(selectedPerms)
      });
      toast.success('Thành công', {
        description: 'Đã tạo người dùng mới'
      });
      navigate('/users');
    } catch (err: any) {
      toast.error('Lỗi', {
        description: err?.message || 'Không thể tạo người dùng'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const togglePermission = (key: string) => {
    const next = new Set(selectedPerms);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelectedPerms(next);
  };

  const handleToggleAll = () => {
    setSelectedPerms(toggleAllPermissions(permissionModules, selectedPerms, true));
  };

  const handleClearAll = () => {
    setSelectedPerms(toggleAllPermissions(permissionModules, selectedPerms, false));
  };

  const handleColumnToggle = (action: any) => {
    const allSelected = permissionModules
      .flatMap(m => m.permissions)
      .filter(p => p.action === action)
      .every(p => selectedPerms.has(p.key));
    setSelectedPerms(toggleActionPermissions(permissionModules, action, selectedPerms, !allSelected));
  };

  const handleRowToggle = (module: string) => {
    const modulePerms = permissionModules.find(m => m.name === module)?.permissions || [];
    const allSelected = modulePerms.every(p => selectedPerms.has(p.key));
    setSelectedPerms(toggleModulePermissions(permissionModules, module, selectedPerms, !allSelected));
  };

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
              <h1 className="text-2xl font-bold text-slate-900">Tạo người dùng mới</h1>
              <p className="text-sm text-slate-500">Thêm tài khoản admin mới vào hệ thống</p>
            </div>
          </div>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Đang lưu...' : 'Tạo người dùng'}
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
                    <Label>Họ tên *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Nhập họ tên đầy đủ"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email *</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="user@example.com"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Mật khẩu *</Label>
                    <Input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Nhập mật khẩu"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Vai trò</Label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                      className="w-full h-10 px-3 py-2 rounded-md border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                      <option value="viewer">Viewer</option>
                    </select>
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
                  <PermissionMatrix
                    modules={permissionModules}
                    selectedPermissions={selectedPerms}
                    onPermissionToggle={togglePermission}
                    onRowToggle={handleRowToggle}
                    onColumnToggle={handleColumnToggle}
                    onToggleAll={handleToggleAll}
                    onClearAll={handleClearAll}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Info */}
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

            {/* Guide Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Hướng dẫn
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-indigo-600">1</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">Mật khẩu mạnh</p>
                      <p className="text-xs text-slate-500 mt-1">Ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-indigo-600">2</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">Phân quyền tối thiểu</p>
                      <p className="text-xs text-slate-500 mt-1">Chỉ cấp quyền cần thiết cho vai trò của người dùng</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-indigo-600">3</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">Email xác thực</p>
                      <p className="text-xs text-slate-500 mt-1">Sẽ được dùng để đăng nhập vào hệ thống admin</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Role Info Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Vai trò
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-slate-900">User</p>
                    <p className="text-xs text-slate-500">Quyền hạn cơ bản</p>
                  </div>
                  <div className={`w-3 h-3 rounded-full ${formData.role === 'user' ? 'bg-indigo-600' : 'bg-slate-300'}`} />
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Admin</p>
                    <p className="text-xs text-slate-500">Quản trị hệ thống</p>
                  </div>
                  <div className={`w-3 h-3 rounded-full ${formData.role === 'admin' ? 'bg-indigo-600' : 'bg-slate-300'}`} />
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Viewer</p>
                    <p className="text-xs text-slate-500">Chỉ xem</p>
                  </div>
                  <div className={`w-3 h-3 rounded-full ${formData.role === 'viewer' ? 'bg-indigo-600' : 'bg-slate-300'}`} />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
