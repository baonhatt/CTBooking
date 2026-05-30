import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { request } from '@/lib/api/http';
import AdminLayout from '@/admin/layouts/AdminLayout';
import { useStaffStore } from '@/store/staffStore';
import { useIsSuperAdmin } from '@/hooks/useStaffPermission';
import { X } from 'lucide-react';
import { MODULES, ACTIONS, MODULE_LABELS, ACTION_LABELS, APPLICABLE_ACTIONS } from './roleConstants';

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

export default function RoleDetailPage() {
        const { id } = useParams<{ id: string }>();
        const queryClient = useQueryClient();
        const navigate = useNavigate();
        const staff = useStaffStore((state) => state.staff);
        const clearStaff = useStaffStore((state) => state.clearStaff);
        const isSuperAdmin = useIsSuperAdmin();
        const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
        const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
        const [dirty, setDirty] = useState(false);
        const [permissionIds, setPermissionIds] = useState<number[]>([]);
        const headerRef = useRef<HTMLDivElement>(null);
        const [headerHeight, setHeaderHeight] = useState(0);

        // Fetch role details
        const { data: roleData, isLoading: roleLoading } = useQuery({
                queryKey: ['role', id],
                queryFn: async () => {
                        if (!id) return null;
                        return request(`/api/admin/roles/${id}`);
                },
                enabled: !!id
        });

        // Fetch permissions
        const { data: permissionsData } = useQuery({
                queryKey: ['permissions'],
                queryFn: async () => {
                        return request('/api/admin/permissions');
                }
        });

        // Update role mutation
        const updateMutation = useMutation({
                mutationFn: async ({ id, data }: { id: number; data: any }) => {
                        return request(`/api/admin/roles/${id}`, {
                                method: 'PUT',
                                body: JSON.stringify(data)
                        });
                },
                onSuccess: () => {
                        toast.success('Cập nhật vai trò thành công');
                        setDirty(false);
                        queryClient.invalidateQueries({ queryKey: ['roles'] });
                        queryClient.invalidateQueries({ queryKey: ['role', id] });
                },
                onError: (err: any) => {
                        toast.error(err.message || 'Cập nhật vai trò thất bại');
                }
        });

        // Delete role mutation
        const deleteMutation = useMutation({
                mutationFn: async (roleId: number) => {
                        return request(`/api/admin/roles/${roleId}`, {
                                method: 'DELETE'
                        });
                },
                onSuccess: () => {
                        toast.success('Xóa vai trò thành công');
                        setIsDeleteDialogOpen(false);
                        navigate('/roles');
                        queryClient.invalidateQueries({ queryKey: ['roles'] });
                },
                onError: (err: any) => {
                        toast.error(err.message || 'Xóa vai trò thất bại');
                }
        });

        const handleUpdate = () => {
                setIsSaveDialogOpen(true);
        };

        const confirmUpdate = () => {
                if (!id) return;
                updateMutation.mutate({
                        id: parseInt(id),
                        data: {
                                name: (roleData as any)?.role?.name,
                                description: (roleData as any)?.role?.description,
                                permissionIds
                        }
                });
        };

        const handleDelete = () => {
                if (!id) return;
                deleteMutation.mutate(parseInt(id));
        };

        const togglePermission = (permissionId: number) => {
                setPermissionIds((prev) => {
                        const newIds = prev.includes(permissionId) ? prev.filter((id) => id !== permissionId) : [...prev, permissionId];
                        setDirty(true);
                        return newIds;
                });
        };

        // Update permissionIds when role data changes
        useEffect(() => {
                const role = (roleData as any)?.role;
                if (role?.permissionIds) {
                        setPermissionIds(role.permissionIds);
                        setDirty(false);
                } else if (role?.permissions) {
                        const ids = role.permissions.map((p: any) => p.id);
                        setPermissionIds(ids);
                        setDirty(false);
                }
        }, [roleData]);

        const role = (roleData as any)?.role;

        // Measure header height after render
        useEffect(() => {
                if (!headerRef.current) return;
                const observer = new ResizeObserver(() => {
                        if (headerRef.current) {
                                setHeaderHeight(headerRef.current.offsetHeight);
                        }
                });
                observer.observe(headerRef.current);
                return () => observer.disconnect();
        }, [role]);
        let permissions = (permissionsData as any)?.permissions || [];

        // Fallback: use permissions from selected role if global permissions list is empty
        if (permissions.length === 0 && role?.permissions) {
                permissions = role.permissions;
        }

        // Build permission map for quick lookup
        const permissionMap = new Map(permissions.map((p: Permission) => [`${p.module}_${p.action}`, p.id]));

        const getPermissionId = (module: string, action: string) => {
                return permissionMap.get(`${module}_${action}`);
        };

        const isActionApplicable = (module: string, action: string) => {
                return APPLICABLE_ACTIONS[module]?.includes(action) || false;
        };

        // Calculate visible actions - hide columns that have no applicable modules
        const visibleActions = useMemo(() => {
                return ACTIONS.filter((action) => {
                        return MODULES.some((module) => APPLICABLE_ACTIONS[module]?.includes(action));
                });
        }, []);

        const handleLogout = () => {
                localStorage.removeItem('staffToken');
                clearStaff();
                navigate('/login');
        };

        if (roleLoading) {
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
                                                        <CardTitle>Chi tiết vai trò</CardTitle>
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

        if (!role) {
                return (
                        <AdminLayout
                                active={'roles' as any}
                                setActive={() => { }}
                                adminEmailState={staff?.email || 'admin@email.com'}
                                handleLogout={handleLogout}
                        >
                                <div className="p-6">
                                        <Card>
                                                <CardContent className="py-12">
                                                        <div className="text-center text-gray-500">Không tìm thấy vai trò</div>
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
                                {/* Sticky Tier 1 Header */}
                                <div ref={headerRef} className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b mb-4 p-4 rounded-lg shadow-sm">
                                        <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-4">
                                                        <Button variant="ghost" onClick={() => navigate('/roles')}>
                                                                ← Quay lại
                                                        </Button>
                                                        <div>
                                                                <h3 className="font-semibold text-lg capitalize">{role.name}</h3>
                                                                {role.description && <p className="text-sm text-gray-600">{role.description}</p>}
                                                                <div className="flex items-center gap-2 mt-1">
                                                                        {role.isSystem && (
                                                                                <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">
                                                                                        Vai trò hệ thống
                                                                                </span>
                                                                        )}
                                                                        <span className="text-sm text-gray-500">Lv{role.level} · {role.staffCount || 0} nhân viên</span>
                                                                </div>
                                                        </div>
                                                </div>
                                                <div className="flex gap-2">
                                                        {(!role.isSystem || isSuperAdmin) && (
                                                                <Button
                                                                        variant={dirty ? 'default' : 'outline'}
                                                                        onClick={handleUpdate}
                                                                        disabled={!dirty || updateMutation.isPending}
                                                                >
                                                                        {updateMutation.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
                                                                </Button>
                                                        )}
                                                </div>
                                        </div>
                                </div>

                                {/* Permission Matrix */}
                                <div className="border rounded-lg overflow-hidden">
                                        <div className="overflow-auto" style={{ maxHeight: `calc(100vh - ${headerHeight + 96}px)` }}>
                                                <table className="w-full">
                                                        {/* Sticky Tier 2 Header - Table Head */}
                                                        <thead className="sticky top-0 z-10 bg-gray-50">
                                                                <tr>
                                                                        <th className="text-left p-3 border-b">Module</th>
                                                                        {visibleActions.map((action) => (
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
                                                                                {visibleActions.map((action) => {
                                                                                        const permissionId = getPermissionId(module, action);
                                                                                        const applicable = isActionApplicable(module, action);
                                                                                        const checked =
                                                                                                typeof permissionId === 'number' ? permissionIds.includes(permissionId) : false;
                                                                                        const disabled = (role.isSystem && !isSuperAdmin) || !applicable;

                                                                                        return (
                                                                                                <td key={action} className="p-3 text-center">
                                                                                                        {applicable ? (
                                                                                                                <Checkbox
                                                                                                                        checked={checked}
                                                                                                                        onCheckedChange={(checked) => {
                                                                                                                                if (typeof permissionId === 'number') {
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

                                {/* Delete Dialog */}
                                <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                                        <DialogContent className="[&>button]:hidden">
                                                <DialogHeader className="flex flex-row items-center gap-3 space-y-0 pb-4 border-b">
                                                        <DialogTitle className="text-lg font-bold text-slate-800">Xác nhận xóa</DialogTitle>
                                                        <div className="flex-1" />
                                                        <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => setIsDeleteDialogOpen(false)}
                                                                className="h-8 w-8 rounded-full hover:bg-slate-100 text-slate-400 transition-colors"
                                                        >
                                                                <X className="w-5 h-5" />
                                                        </Button>
                                                </DialogHeader>
                                                <p className="py-4">
                                                        Bạn có chắc chắn muốn xóa vai trò "{role.name}"? Hành động này không thể hoàn tác.
                                                </p>
                                                <DialogFooter>
                                                        <Button variant="ghost" onClick={() => setIsDeleteDialogOpen(false)} className="text-slate-500 hover:bg-slate-100">
                                                                Hủy
                                                        </Button>
                                                        <Button
                                                                onClick={handleDelete}
                                                                disabled={deleteMutation.isPending}
                                                                className="bg-red-600 hover:bg-red-700 min-w-[140px] rounded-xl shadow-lg shadow-red-500/20 transition-all active:scale-95"
                                                        >
                                                                {deleteMutation.isPending ? 'Đang xóa...' : 'Xóa'}
                                                        </Button>
                                                </DialogFooter>
                                        </DialogContent>
                                </Dialog>

                                {/* Save Confirm Dialog */}
                                <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
                                        <DialogContent className="[&>button]:hidden">
                                                <DialogHeader className="flex flex-row items-center gap-3 space-y-0 pb-4 border-b">
                                                        <DialogTitle className="text-lg font-bold text-slate-800">Xác nhận lưu thay đổi</DialogTitle>
                                                        <div className="flex-1" />
                                                        <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => setIsSaveDialogOpen(false)}
                                                                className="h-8 w-8 rounded-full hover:bg-slate-100 text-slate-400 transition-colors"
                                                        >
                                                                <X className="w-5 h-5" />
                                                        </Button>
                                                </DialogHeader>
                                                <p className="py-4">
                                                        Bạn có chắc chắn muốn lưu thay đổi quyền cho vai trò "{role.name}"?
                                                </p>
                                                <DialogFooter>
                                                        <Button variant="ghost" onClick={() => setIsSaveDialogOpen(false)} className="text-slate-500 hover:bg-slate-100">
                                                                Hủy
                                                        </Button>
                                                        <Button
                                                                onClick={confirmUpdate}
                                                                disabled={updateMutation.isPending}
                                                                className="bg-blue-600 hover:bg-blue-700 min-w-[140px] rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                                                        >
                                                                {updateMutation.isPending ? 'Đang lưu...' : 'Lưu'}
                                                        </Button>
                                                </DialogFooter>
                                        </DialogContent>
                                </Dialog>
                        </div>
                </AdminLayout>
        );
}
