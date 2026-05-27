import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { request } from '@/lib/api/http';
import AdminLayout from '@/admin/layouts/AdminLayout';
import { useStaffStore } from '@/store/staffStore';
import { useNavigate } from 'react-router-dom';
import { useIsSuperAdmin } from '@/hooks/useStaffPermission';

interface Role {
        id: number;
        name: string;
        description?: string;
        level: number;
        isSystem: boolean;
        staffCount?: number;
        permissionIds?: number[];
}

interface Permission {
        id: number;
        module: string;
        action: string;
        description?: string;
}

const MODULES = ['staff', 'roles', 'dashboard', 'users', 'movies', 'toys', 'tickets', 'branches', 'uploads', 'email_logs', 'audit_logs', 'settings', 'transactions'];
const ACTIONS = ['view', 'create', 'edit', 'delete', 'view_detail', 'view_revenue', 'manage', 'upload', 'reset_password'];

const MODULE_LABELS: Record<string, string> = {
        staff: 'Nhân viên',
        roles: 'Vai trò',
        dashboard: 'Dashboard',
        users: 'Người dùng',
        movies: 'Phim',
        toys: 'Đồ chơi',
        tickets: 'Vé',
        branches: 'Chi nhánh',
        uploads: 'Upload',
        email_logs: 'Email logs',
        audit_logs: 'Audit logs',
        settings: 'Cài đặt',
        transactions: 'Giao dịch',
};

const ACTION_LABELS: Record<string, string> = {
        view: 'Xem',
        create: 'Tạo',
        edit: 'Sửa',
        delete: 'Xóa',
        view_detail: 'Xem chi tiết',
        view_revenue: 'Xem doanh thu',
        manage: 'Quản lý',
        upload: 'Upload',
        reset_password: 'Đặt lại mật khẩu',
};

// Define which actions are applicable to which modules
const APPLICABLE_ACTIONS: Record<string, string[]> = {
        staff: ['view', 'create', 'edit', 'delete', 'reset_password'],
        roles: ['view', 'create', 'edit', 'delete'],
        dashboard: ['view', 'view_revenue'],
        users: ['view', 'view_detail'],
        movies: ['view', 'create', 'edit', 'delete'],
        toys: ['view', 'create', 'edit', 'delete'],
        tickets: ['view', 'create', 'edit', 'delete'],
        branches: ['view', 'create', 'edit', 'delete'],
        uploads: ['upload', 'delete'],
        email_logs: ['view'],
        audit_logs: ['view'],
        settings: ['view', 'manage'],
        transactions: ['view'],
};

export default function RolesPage() {
        const queryClient = useQueryClient();
        const navigate = useNavigate();
        const staff = useStaffStore((state) => state.staff);
        const clearStaff = useStaffStore((state) => state.clearStaff);
        const isSuperAdmin = useIsSuperAdmin();
        const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
        const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
        const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
        const [dirty, setDirty] = useState(false);

        // Form state for create/edit
        const [formData, setFormData] = useState({
                name: '',
                description: '',
                level: '0',
        });

        // Permission editor state
        const [permissionIds, setPermissionIds] = useState<number[]>([]);

        // Fetch roles
        const { data: rolesData, isLoading: rolesLoading } = useQuery({
                queryKey: ['roles'],
                queryFn: async () => {
                        return request('/api/admin/roles?pageSize=100');
                },
        });

        // Fetch permissions
        const { data: permissionsData } = useQuery({
                queryKey: ['permissions'],
                queryFn: async () => {
                        return request('/api/admin/permissions');
                },
        });

        // Fetch selected role details
        const { data: selectedRoleData, isLoading: roleLoading } = useQuery({
                queryKey: ['role', selectedRoleId],
                queryFn: async () => {
                        if (!selectedRoleId) return null;
                        return request(`/api/admin/roles/${selectedRoleId}`);
                },
                enabled: !!selectedRoleId,
        });

        // Create role mutation
        const createMutation = useMutation({
                mutationFn: async (data: any) => {
                        return request('/api/admin/roles', {
                                method: 'POST',
                                body: JSON.stringify(data),
                        });
                },
                onSuccess: (data: any) => {
                        toast.success('Tạo vai trò thành công');
                        setIsCreateDialogOpen(false);
                        resetForm();
                        queryClient.invalidateQueries({ queryKey: ['roles'] });
                        setSelectedRoleId(data.role.id);
                },
                onError: (err: any) => {
                        toast.error(err.message || 'Tạo vai trò thất bại');
                },
        });

        // Update role mutation
        const updateMutation = useMutation({
                mutationFn: async ({ id, data }: { id: number; data: any }) => {
                        return request(`/api/admin/roles/${id}`, {
                                method: 'PUT',
                                body: JSON.stringify(data),
                        });
                },
                onSuccess: () => {
                        toast.success('Cập nhật vai trò thành công');
                        setDirty(false);
                        queryClient.invalidateQueries({ queryKey: ['roles'] });
                        queryClient.invalidateQueries({ queryKey: ['role', selectedRoleId] });
                },
                onError: (err: any) => {
                        toast.error(err.message || 'Cập nhật vai trò thất bại');
                },
        });

        // Delete role mutation
        const deleteMutation = useMutation({
                mutationFn: async (id: number) => {
                        return request(`/api/admin/roles/${id}`, {
                                method: 'DELETE',
                        });
                },
                onSuccess: () => {
                        toast.success('Xóa vai trò thành công');
                        setIsDeleteDialogOpen(false);
                        setSelectedRoleId(null);
                        queryClient.invalidateQueries({ queryKey: ['roles'] });
                },
                onError: (err: any) => {
                        toast.error(err.message || 'Xóa vai trò thất bại');
                },
        });

        // Seed roles mutation
        const seedMutation = useMutation({
                mutationFn: async () => {
                        return request('/api/admin/setup/seed-roles', {
                                method: 'POST',
                        });
                },
                onSuccess: () => {
                        toast.success('Seed vai trò mặc định thành công');
                        queryClient.invalidateQueries({ queryKey: ['roles'] });
                },
                onError: (err: any) => {
                        toast.error(err.message || 'Seed vai trò thất bại');
                },
        });

        const resetForm = () => {
                setFormData({
                        name: '',
                        description: '',
                        level: '0',
                });
        };

        const handleCreate = () => {
                createMutation.mutate({
                        name: formData.name,
                        description: formData.description,
                        level: parseInt(formData.level),
                        permissionIds: [],
                });
        };

        const handleUpdate = () => {
                if (!selectedRoleId) return;
                updateMutation.mutate({
                        id: selectedRoleId,
                        data: {
                                name: (selectedRoleData as any)?.role?.name,
                                description: (selectedRoleData as any)?.role?.description,
                                permissionIds,
                        },
                });
        };

        const handleDelete = () => {
                if (!selectedRoleId) return;
                deleteMutation.mutate(selectedRoleId);
        };

        const handleSeed = () => {
                seedMutation.mutate();
        };

        const togglePermission = (permissionId: number) => {
                setPermissionIds((prev) => {
                        const newIds = prev.includes(permissionId)
                                ? prev.filter((id) => id !== permissionId)
                                : [...prev, permissionId];
                        setDirty(true);
                        return newIds;
                });
        };

        // Update permissionIds when role data changes
        useEffect(() => {
                const role = (selectedRoleData as any)?.role;
                if (role?.permissionIds) {
                        setPermissionIds(role.permissionIds);
                        setDirty(false);
                } else if (role?.permissions) {
                        // Fallback: extract permissionIds from permissions array
                        const ids = role.permissions.map((p: any) => p.id);
                        setPermissionIds(ids);
                        setDirty(false);
                }
        }, [selectedRoleData]);

        const roles = (rolesData as any)?.items || [];
        let permissions = (permissionsData as any)?.permissions || [];
        const selectedRole = (selectedRoleData as any)?.role;

        // Fallback: use permissions from selected role if global permissions list is empty
        if (permissions.length === 0 && selectedRole?.permissions) {
                permissions = selectedRole.permissions;
        }

        // Build permission map for quick lookup
        const permissionMap = new Map(permissions.map((p: Permission) => [`${p.module}_${p.action}`, p.id]));

        const getPermissionId = (module: string, action: string) => {
                return permissionMap.get(`${module}_${action}`);
        };

        const isActionApplicable = (module: string, action: string) => {
                return APPLICABLE_ACTIONS[module]?.includes(action) || false;
        };

        const handleLogout = () => {
                localStorage.removeItem('staffToken');
                clearStaff();
                navigate('/login');
        };

        if (rolesLoading) {
                return (
                        <AdminLayout
                                active={'roles' as any}
                                setActive={() => { }}
                                adminEmailState={staff?.email || 'admin@email.com'}
                                handleLogout={handleLogout}
                        >
                                <div className="p-6">
                                        <Card>
                                                <CardHeader>
                                                        <CardTitle>Quản lý vai trò</CardTitle>
                                                </CardHeader>
                                                <CardContent>
                                                        <div className="space-y-4">
                                                                <Skeleton className="h-10 w-full" />
                                                                <Skeleton className="h-10 w-full" />
                                                                <Skeleton className="h-10 w-full" />
                                                        </div>
                                                </CardContent>
                                        </Card>
                                </div>
                        </AdminLayout>
                );
        }

        return (
                <AdminLayout
                        active={'roles' as any}
                        setActive={() => { }}
                        adminEmailState={staff?.email || 'admin@email.com'}
                        handleLogout={handleLogout}
                >
                        <div className="p-6">
                                <Card>
                                        <CardHeader>
                                                <div className="flex justify-between items-center">
                                                        <CardTitle>Quản lý vai trò</CardTitle>
                                                        <div className="flex gap-2">
                                                                <Button variant="outline" onClick={handleSeed} disabled={seedMutation.isPending}>
                                                                        {seedMutation.isPending ? 'Đang seed...' : 'Seed vai trò mặc định'}
                                                                </Button>
                                                                <Button onClick={() => { resetForm(); setIsCreateDialogOpen(true); }}>
                                                                        Tạo vai trò mới
                                                                </Button>
                                                        </div>
                                                </div>
                                        </CardHeader>
                                        <CardContent>
                                                <div className="flex gap-6">
                                                        {/* Side Panel - Role List */}
                                                        <div className="w-80 border-r pr-6">
                                                                <h3 className="font-semibold mb-4">Danh sách vai trò</h3>
                                                                <div className="space-y-2">
                                                                        {roles.map((role: Role) => (
                                                                                <div
                                                                                        key={role.id}
                                                                                        className={`p-3 rounded-lg cursor-pointer border transition-colors ${selectedRoleId === role.id
                                                                                                ? 'bg-blue-50 border-blue-500'
                                                                                                : 'hover:bg-gray-50 border-gray-200'
                                                                                                }`}
                                                                                        onClick={() => setSelectedRoleId(role.id)}
                                                                                >
                                                                                        <div className="flex justify-between items-start">
                                                                                                <div>
                                                                                                        <div className="font-medium">{role.name}</div>
                                                                                                        {role.description && (
                                                                                                                <div className="text-sm text-gray-600">{role.description}</div>
                                                                                                        )}
                                                                                                </div>
                                                                                                {role.isSystem && (
                                                                                                        <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">
                                                                                                                System
                                                                                                        </span>
                                                                                                )}
                                                                                        </div>
                                                                                        <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
                                                                                                <span>Level: {role.level}</span>
                                                                                                <span>{role.staffCount || 0} nhân viên</span>
                                                                                        </div>
                                                                                </div>
                                                                        ))}
                                                                </div>
                                                        </div>

                                                        {/* Main Panel - Permission Editor */}
                                                        <div className="flex-1">
                                                                {roleLoading ? (
                                                                        <div className="space-y-4">
                                                                                <Skeleton className="h-10 w-full" />
                                                                                <Skeleton className="h-10 w-full" />
                                                                                <Skeleton className="h-10 w-full" />
                                                                        </div>
                                                                ) : selectedRole ? (
                                                                        <div>
                                                                                <div className="flex justify-between items-center mb-4">
                                                                                        <div>
                                                                                                <h3 className="font-semibold text-lg">{selectedRole.name}</h3>
                                                                                                {selectedRole.description && (
                                                                                                        <p className="text-sm text-gray-600">{selectedRole.description}</p>
                                                                                                )}
                                                                                                {selectedRole.isSystem && (
                                                                                                        <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs mt-1 inline-block">
                                                                                                                Vai trò hệ thống - Không thể chỉnh sửa
                                                                                                        </span>
                                                                                                )}
                                                                                        </div>
                                                                                        <div className="flex gap-2">
                                                                                                {(!selectedRole.isSystem || isSuperAdmin) && (
                                                                                                        <>
                                                                                                                <Button
                                                                                                                        variant={dirty ? 'default' : 'outline'}
                                                                                                                        onClick={handleUpdate}
                                                                                                                        disabled={!dirty || updateMutation.isPending}
                                                                                                                >
                                                                                                                        {updateMutation.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
                                                                                                                </Button>
                                                                                                                {!selectedRole.isSystem && (
                                                                                                                        <Button
                                                                                                                                variant="outline"
                                                                                                                                className="text-red-600"
                                                                                                                                onClick={() => setIsDeleteDialogOpen(true)}
                                                                                                                        >
                                                                                                                                Xóa vai trò
                                                                                                                        </Button>
                                                                                                                )}
                                                                                                        </>
                                                                                                )}
                                                                                        </div>
                                                                                </div>

                                                                                {/* Permission Matrix */}
                                                                                <div className="border rounded-lg overflow-hidden">
                                                                                        <table className="w-full">
                                                                                                <thead>
                                                                                                        <tr className="bg-gray-50">
                                                                                                                <th className="text-left p-3 border-b">Module</th>
                                                                                                                {ACTIONS.map((action) => (
                                                                                                                        <th key={action} className="text-center p-3 border-b text-sm">
                                                                                                                                {ACTION_LABELS[action] || action}
                                                                                                                        </th>
                                                                                                                ))}
                                                                                                        </tr>
                                                                                                </thead>
                                                                                                <tbody>
                                                                                                        {MODULES.map((module) => (
                                                                                                                <tr key={module} className="border-b">
                                                                                                                        <td className="p-3 font-medium">{MODULE_LABELS[module] || module}</td>
                                                                                                                        {ACTIONS.map((action) => {
                                                                                                                                const permissionId = getPermissionId(module, action);
                                                                                                                                const applicable = isActionApplicable(module, action);
                                                                                                                                const checked = typeof permissionId === "number" ? permissionIds.includes(permissionId) : false;
                                                                                                                                const disabled = (selectedRole.isSystem && !isSuperAdmin) || !applicable;

                                                                                                                                return (
                                                                                                                                        <td key={action} className="p-3 text-center">
                                                                                                                                                {applicable ? (
                                                                                                                                                        <Checkbox
                                                                                                                                                                checked={checked}
                                                                                                                                                                onCheckedChange={(checked) => {
                                                                                                                                                                        if (typeof permissionId === "number") {
                                                                                                                                                                                togglePermission(permissionId);
                                                                                                                                                                        }
                                                                                                                                                                }}
                                                                                                                                                                disabled={disabled}
                                                                                                                                                        />
                                                                                                                                                ) : (
                                                                                                                                                        <span className="text-gray-300">-</span>
                                                                                                                                                )}
                                                                                                                                        </td>
                                                                                                                                );
                                                                                                                        })}
                                                                                                                </tr>
                                                                                                        ))}
                                                                                                </tbody>
                                                                                        </table>
                                                                                </div>
                                                                        </div>
                                                                ) : (
                                                                        <div className="text-center text-gray-500 py-12">
                                                                                Chọn một vai trò để xem và chỉnh sửa quyền
                                                                        </div>
                                                                )}
                                                        </div>
                                                </div>
                                        </CardContent>
                                </Card>

                                {/* Create Dialog */}
                                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                                        <DialogContent>
                                                <DialogHeader>
                                                        <DialogTitle>Tạo vai trò mới</DialogTitle>
                                                </DialogHeader>
                                                <div className="space-y-4 py-4">
                                                        <div>
                                                                <Label>Tên vai trò *</Label>
                                                                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                                                        </div>
                                                        <div>
                                                                <Label>Mô tả</Label>
                                                                <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                                                        </div>
                                                        <div>
                                                                <Label>Level</Label>
                                                                <Select value={formData.level} onValueChange={(v) => setFormData({ ...formData, level: v })}>
                                                                        <SelectTrigger>
                                                                                <SelectValue placeholder="Chọn level" />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                                <SelectItem value="0">Staff (0)</SelectItem>
                                                                                <SelectItem value="1">Manager (1)</SelectItem>
                                                                                <SelectItem value="2">Admin (2)</SelectItem>
                                                                        </SelectContent>
                                                                </Select>
                                                        </div>
                                                </div>
                                                <DialogFooter>
                                                        <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                                                                Hủy
                                                        </Button>
                                                        <Button onClick={handleCreate} disabled={createMutation.isPending}>
                                                                {createMutation.isPending ? 'Đang tạo...' : 'Tạo'}
                                                        </Button>
                                                </DialogFooter>
                                        </DialogContent>
                                </Dialog>

                                {/* Delete Dialog */}
                                <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                                        <DialogContent>
                                                <DialogHeader>
                                                        <DialogTitle>Xác nhận xóa</DialogTitle>
                                                </DialogHeader>
                                                <p className="py-4">
                                                        Bạn có chắc chắn muốn xóa vai trò "{selectedRole?.name}"? Hành động này không thể hoàn tác.
                                                </p>
                                                <DialogFooter>
                                                        <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                                                                Hủy
                                                        </Button>
                                                        <Button onClick={handleDelete} disabled={deleteMutation.isPending} className="bg-red-600 hover:bg-red-700">
                                                                {deleteMutation.isPending ? 'Đang xóa...' : 'Xóa'}
                                                        </Button>
                                                </DialogFooter>
                                        </DialogContent>
                                </Dialog>
                        </div>
                </AdminLayout>
        );
}
