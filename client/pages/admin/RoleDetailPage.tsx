import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { request } from '@/lib/api/http';
import AdminLayout from '@/admin/layouts/AdminLayout';
import { useStaffStore } from '@/store/staffStore';
import { useIsSuperAdmin, useHasStaffPermission } from '@/hooks/useStaffPermission';
import { X, FileText } from 'lucide-react';
import { MODULES, ACTIONS, MODULE_LABELS, ACTION_LABELS, APPLICABLE_ACTIONS } from './roleConstants';

interface Role {
  id: number;
  name: string;
  description?: string;
  level: number;
  isSystem: boolean;
  staffCount?: number;
  permissionIds?: number[];
  created_at?: string;
  created_by_staff_name?: string;
  updated_at?: string;
  updated_by_staff_name?: string;
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
  const hasPermission = useHasStaffPermission();
  const canEditRole = hasPermission('roles', 'edit');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
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
      navigate('/roles');
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

  const confirmUpdate = async () => {
    if (!id) return;
    await updateMutation.mutateAsync({
      id: parseInt(id),
      data: {
        name: (roleData as any)?.role?.name,
        description: (roleData as any)?.role?.description,
        permissionIds
      }
    });
    setIsSaveDialogOpen(false);
  };

  const handleDelete = () => {
    if (!id) return;
    deleteMutation.mutate(parseInt(id));
  };

  const togglePermission = (permissionId: number) => {
    if (!isEditMode) return;
    setPermissionIds((prev) => {
      const newIds = prev.includes(permissionId) ? prev.filter((id) => id !== permissionId) : [...prev, permissionId];
      setDirty(true);
      return newIds;
    });
  };

  const handleEditMode = () => {
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    setDirty(false);
    // Reset permissionIds to original
    const role = (roleData as any)?.role;
    if (role?.permissionIds) {
      setPermissionIds(role.permissionIds);
    } else if (role?.permissions) {
      const ids = role.permissions.map((p: any) => p.id);
      setPermissionIds(ids);
    }
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
        setActive={() => {}}
        adminEmailState={staff?.email || 'admin@email.com'}
        handleLogout={handleLogout}
        fullWidth
      >
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
      </AdminLayout>
    );
  }

  if (!role) {
    return (
      <AdminLayout
        active={'roles' as any}
        setActive={() => {}}
        adminEmailState={staff?.email || 'admin@email.com'}
        handleLogout={handleLogout}
        fullWidth
      >
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-gray-500">Không tìm thấy vai trò</div>
          </CardContent>
        </Card>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      active={'roles' as any}
      setActive={() => {}}
      adminEmailState={staff?.email || 'admin@email.com'}
      handleLogout={handleLogout}
      fullWidth
    >
      <div className="space-y-4">
        {/* Sticky Tier 1 Header */}
        <div
          ref={headerRef}
          className="sticky top-0 z-20 bg-white/95 backdrop-blur border border-slate-200/80 p-4 rounded-xl shadow-xs"
        >
          <div className="flex flex-wrap justify-between items-center gap-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => navigate('/roles')} className="rounded-lg">
                ← Quay lại
              </Button>
              <div>
                <h3 className="font-bold text-slate-800 text-lg capitalize flex items-center gap-2">
                  {role.name}
                  {role.isSystem && (
                    <span className="bg-amber-100 text-amber-800 text-[11px] font-semibold px-2 py-0.5 rounded-md">
                      Vai trò hệ thống
                    </span>
                  )}
                </h3>
                {role.description && <p className="text-xs text-slate-500 mt-0.5">{role.description}</p>}
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-slate-400">
                    Cấp độ: Lv{role.level} · {role.staffCount || 0} nhân viên
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isEditMode ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelEdit}
                    disabled={updateMutation.isPending}
                    className="rounded-lg"
                  >
                    Hủy
                  </Button>
                  <Button
                    size="sm"
                    variant={dirty ? 'default' : 'outline'}
                    onClick={handleUpdate}
                    disabled={!dirty || updateMutation.isPending}
                    className="rounded-lg"
                  >
                    {updateMutation.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </Button>
                </>
              ) : (
                canEditRole &&
                (!role.isSystem || isSuperAdmin) && (
                  <Button size="sm" variant="outline" onClick={handleEditMode} className="rounded-lg">
                    Chỉnh sửa
                  </Button>
                )
              )}
            </div>
          </div>
        </div>

        {/* Permission Matrix */}
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              {/* Sticky Table Head */}
              <thead className="bg-slate-100 border-b border-slate-200">
                <tr>
                  <th className="sticky left-0 z-10 bg-slate-100 px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap min-w-[130px] border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                    Module
                  </th>
                  {visibleActions.map((action) => (
                    <th
                      key={action}
                      className="px-2 py-3 text-center text-xs font-bold text-slate-700 whitespace-nowrap min-w-[80px] border-r border-slate-200 last:border-r-0"
                    >
                      {ACTION_LABELS[action] || action}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {MODULES.map((module) => (
                  <tr key={module} className="group hover:bg-slate-50/75 transition-colors">
                    <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 px-4 py-2.5 font-semibold text-slate-800 text-xs sm:text-sm whitespace-nowrap border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                      {MODULE_LABELS[module] || module}
                    </td>
                    {visibleActions.map((action) => {
                      const permissionId = getPermissionId(module, action);
                      const applicable = isActionApplicable(module, action);
                      const checked = typeof permissionId === 'number' ? permissionIds.includes(permissionId) : false;
                      const disabled = (role.isSystem && !isSuperAdmin) || !applicable || !isEditMode;

                      return (
                        <td
                          key={action}
                          className="px-2 py-2.5 text-center whitespace-nowrap border-r border-slate-100 last:border-r-0"
                        >
                          {applicable ? (
                            <div className="flex items-center justify-center">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={() => {
                                  if (typeof permissionId === 'number') {
                                    togglePermission(permissionId);
                                  }
                                }}
                                disabled={disabled}
                                className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                              />
                            </div>
                          ) : (
                            <span className="text-slate-300 font-medium select-none">-</span>
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

        {/* Role Info Section - chỉ hiển thị khi ở chế độ view */}
        {!isEditMode && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4" /> Thông tin vai trò
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-500">Ngày tạo</Label>
                  <div className="text-sm">
                    {role.created_at ? new Date(role.created_at).toLocaleString('vi-VN') : '-'}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-500">Tạo bởi</Label>
                  <div className="text-sm">{role.created_by_staff_name || '-'}</div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-500">Cập nhật lần cuối</Label>
                  <div className="text-sm">
                    {role.updated_at ? new Date(role.updated_at).toLocaleString('vi-VN') : '-'}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-500">Cập nhật bởi</Label>
                  <div className="text-sm">{role.updated_by_staff_name || '-'}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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
            <p className="py-4">Bạn có chắc chắn muốn xóa vai trò "{role.name}"? Hành động này không thể hoàn tác.</p>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setIsDeleteDialogOpen(false)}
                className="text-slate-500 hover:bg-slate-100"
              >
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
            <p className="py-4">Bạn có chắc chắn muốn lưu thay đổi quyền cho vai trò "{role.name}"?</p>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setIsSaveDialogOpen(false)}
                className="text-slate-500 hover:bg-slate-100"
              >
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
