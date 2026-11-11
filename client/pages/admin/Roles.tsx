import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { useStaffPermissions, useIsSuperAdmin } from '@/hooks/useStaffPermission';
import { Search, RefreshCw, Trash2, Plus } from 'lucide-react';
import { request } from '@/lib/api/http';
import AdminLayout from '@/admin/layouts/AdminLayout';
import { useStaffStore } from '@/store/staffStore';
import { useNavigate } from 'react-router-dom';
import { ConfirmDeleteDialog } from '@/components/admin/dialogs/ConfirmDeleteDialog';
import { formatVnDate } from '@/lib/format';
import { AdminDialog, AdminDialogFooter } from '@/components/admin/common/AdminDialog';
import { PageHeader } from '@/components/admin/common/PageHeader';
import { RowActionButton, RowActions } from '@/components/admin/common/RowActionButton';
import { StatusBadge } from '@/components/admin/common/StatusBadge';
import { EmptyState, TableSkeleton } from '@/components/admin/common/EmptyState';
import { FormField } from '@/components/admin/common/FormField';
import { notify } from '@/components/admin/common/notify';
import {
  ADMIN_BTN_PRIMARY,
  ADMIN_BTN_OUTLINE,
  ADMIN_CARD,
  ADMIN_TABLE_HEAD,
  ADMIN_TH,
  ADMIN_INPUT
} from '@/components/admin/common/adminTokens';
import { roleLevelLabel, countGrantedPermissions, TOTAL_APPLICABLE_PERMISSIONS } from './roleConstants';

interface Role {
  id: number;
  name: string;
  description?: string;
  level: number;
  isSystem: boolean;
  staffCount?: number;
  permissionIds?: number[];
  permissions?: { module: string; action: string }[];
  createdAt?: string;
  updatedAt?: string;
}

export default function RolesPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const staff = useStaffStore((state) => state.staff);
  const clearStaff = useStaffStore((state) => state.clearStaff);
  const permissions = useStaffPermissions();
  const isSuperAdmin = useIsSuperAdmin();

  const hasPermission = (module: string, action: string) => {
    if (isSuperAdmin) return true;
    return permissions.some((p) => p.module === module && p.action === action);
  };

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [localSearchQuery, setLocalSearchQuery] = useState('');

  const handleSearchRole = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSearchQuery(localSearchQuery);
  };
  const [showSystemOnly, setShowSystemOnly] = useState(false);

  // Form state for create
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    level: '0'
  });

  // Fetch roles
  const { data: rolesData, isFetching: rolesLoading } = useQuery({
    queryKey: ['roles', searchQuery, showSystemOnly],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('pageSize', '100');
      if (searchQuery) params.set('q', searchQuery);
      if (showSystemOnly) params.set('isSystem', 'true');
      return request(`/api/admin/roles?${params.toString()}`);
    }
  });

  // Create role mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return request('/api/admin/roles', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    onSuccess: (data: any) => {
      notify.created('vai trò');
      setIsCreateDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
    onError: (err: any) => {
      notify.error(err, 'Tạo vai trò thất bại');
    }
  });

  // Delete role mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return request(`/api/admin/roles/${id}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      notify.deleted('vai trò');
      setIsDeleteDialogOpen(false);
      setRoleToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
    onError: (err: any) => {
      notify.error(err, 'Xóa vai trò thất bại');
    }
  });

  // Seed roles mutation
  const seedMutation = useMutation({
    mutationFn: async () => {
      return request('/api/admin/setup/seed-roles', {
        method: 'POST'
      });
    },
    onSuccess: () => {
      notify.success('Đã khởi tạo vai trò mặc định');
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      queryClient.invalidateQueries({ queryKey: ['permissions'] });
    },
    onError: (err: any) => {
      notify.error(err, 'Khởi tạo vai trò thất bại');
    }
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      level: '0'
    });
  };

  const handleCreate = () => {
    createMutation.mutate({
      name: formData.name,
      description: formData.description,
      level: parseInt(formData.level),
      permissionIds: []
    });
  };

  const handleDelete = () => {
    if (!roleToDelete) return;
    deleteMutation.mutate(roleToDelete.id);
  };

  const handleSeed = () => {
    seedMutation.mutate();
  };

  const handleLogout = () => {
    localStorage.removeItem('staffToken');
    clearStaff();
    navigate('/login');
  };

  const roles = (rolesData as any)?.items || [];
  const isCreateDirty = formData.name.trim() !== '' || formData.description.trim() !== '' || formData.level !== '0';

  return (
    <AdminLayout
      active={'roles' as any}
      setActive={() => {}}
      adminEmailState={staff?.email || 'admin@email.com'}
      handleLogout={handleLogout}
    >
      {seedMutation.isPending && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-lg font-semibold text-slate-700 animate-pulse">Đang nạp cấu hình hệ thống...</p>
          </div>
        </div>
      )}
      <div className="space-y-6">
        <PageHeader title="Quản lý vai trò" description={`Tổng cộng ${roles.length} vai trò trong hệ thống`} />

        {/* TOOLBAR */}
        <div className={`${ADMIN_CARD} flex flex-col items-start justify-between gap-4 p-4 xl:flex-row xl:items-center`}>
          <form onSubmit={handleSearchRole} className="flex w-full gap-2 xl:w-auto">
            <div className="relative w-[320px] max-w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                type="text"
                placeholder="Tìm theo tên vai trò..."
                value={localSearchQuery}
                onChange={(e) => setLocalSearchQuery(e.target.value)}
                className={`${ADMIN_INPUT} pl-10`}
              />
            </div>
            <Button type="submit" className={`${ADMIN_BTN_PRIMARY} shrink-0 gap-1.5`}>
              <Search className="h-4 w-4" /> Tìm kiếm
            </Button>
          </form>

          <div className="flex w-full flex-wrap items-center justify-start gap-2.5 xl:w-auto xl:justify-end">
            {hasPermission('roles', 'view_deleted') && (
              <Button variant="outline" onClick={() => navigate('/deleted/roles')} className={`${ADMIN_BTN_OUTLINE} gap-2`}>
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:inline">Xem đã xóa</span>
              </Button>
            )}

            {isSuperAdmin && (
              <Button variant="outline" onClick={handleSeed} disabled={seedMutation.isPending} className={ADMIN_BTN_OUTLINE}>
                {seedMutation.isPending ? 'Đang khởi tạo...' : 'Khởi tạo vai trò mặc định'}
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setLocalSearchQuery('');
                setSearchQuery('');
                setShowSystemOnly(false);
                queryClient.invalidateQueries({ queryKey: ['roles'] });
              }}
              className={`${ADMIN_BTN_OUTLINE} gap-2`}
            >
              <RefreshCw className="h-4 w-4" /> Làm mới
            </Button>

            {isSuperAdmin && hasPermission('roles', 'create') && (
              <Button
                onClick={() => {
                  resetForm();
                  setIsCreateDialogOpen(true);
                }}
                className={`${ADMIN_BTN_PRIMARY} gap-2`}
              >
                <Plus className="h-4 w-4" /> Tạo vai trò mới
              </Button>
            )}
          </div>
        </div>

        <div className={`${ADMIN_CARD} overflow-hidden`}>
          {rolesLoading ? (
            <TableSkeleton />
          ) : (
            <Table className="min-w-[1000px] table-fixed">
              {/* Fixed widths per column; the description takes whatever is left */}
              <colgroup>
                <col className="w-[180px]" />
                <col className="w-[110px]" />
                <col className="w-[100px]" />
                <col className="w-[100px]" />
                <col className="w-[110px]" />
                <col />
                <col className="w-[110px]" />
                <col className="w-[110px]" />
                <col className="w-[130px]" />
              </colgroup>
              <TableHeader className={ADMIN_TABLE_HEAD}>
                <TableRow className="hover:bg-transparent">
                  <TableHead className={ADMIN_TH}>Tên vai trò</TableHead>
                  <TableHead className={ADMIN_TH}>Loại</TableHead>
                  <TableHead className={ADMIN_TH}>Cấp độ</TableHead>
                  <TableHead className={ADMIN_TH}>Nhân viên</TableHead>
                  <TableHead className={ADMIN_TH}>Quyền</TableHead>
                  <TableHead className={ADMIN_TH}>Mô tả</TableHead>
                  <TableHead className={ADMIN_TH}>Ngày tạo</TableHead>
                  <TableHead className={ADMIN_TH}>Cập nhật</TableHead>
                  <TableHead className={`text-right ${ADMIN_TH}`}>Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role: Role) => (
                  <TableRow key={role.id} className="cursor-pointer" onClick={() => navigate(`/roles/${role.id}`)}>
                    <TableCell className="font-medium">
                      <span className="block truncate" title={role.name}>
                        {role.name}
                      </span>
                    </TableCell>
                    <TableCell>
                      {role.isSystem ? (
                        <StatusBadge tone="neutral">Hệ thống</StatusBadge>
                      ) : (
                        <StatusBadge tone="info">Tùy chỉnh</StatusBadge>
                      )}
                    </TableCell>
                    <TableCell>{roleLevelLabel(role.level)}</TableCell>
                    <TableCell>{role.staffCount || 0}</TableCell>
                    <TableCell>
                      Quyền: {countGrantedPermissions(role.permissions)}/{TOTAL_APPLICABLE_PERMISSIONS}
                    </TableCell>
                    <TableCell className="whitespace-normal text-slate-600">
                      <span className="line-clamp-2" title={role.description || ''}>
                        {role.description || '-'}
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-600">{formatVnDate(role.createdAt)}</TableCell>
                    <TableCell className="text-slate-600">{formatVnDate(role.updatedAt)}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <RowActions>
                        <RowActionButton action="view" onClick={() => navigate(`/roles/${role.id}?mode=view`)} />
                        {!role.isSystem && isSuperAdmin && hasPermission('roles', 'edit') && (
                          <RowActionButton action="edit" onClick={() => navigate(`/roles/${role.id}?mode=edit`)} />
                        )}
                        {!role.isSystem && isSuperAdmin && hasPermission('roles', 'delete') && (
                          <RowActionButton
                            action="delete"
                            onClick={() => {
                              if ((role.staffCount || 0) > 0) {
                                notify.error(`Không thể xóa vai trò này vì đã được giao cho ${role.staffCount} nhân viên`);
                                return;
                              }
                              setRoleToDelete(role);
                              setIsDeleteDialogOpen(true);
                            }}
                          />
                        )}
                      </RowActions>
                    </TableCell>
                  </TableRow>
                ))}
                {roles.length === 0 && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={9} className="p-0">
                      <EmptyState title={searchQuery ? 'Không tìm thấy vai trò' : 'Chưa có vai trò nào'} />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>

        {/* CREATE DIALOG */}
        <AdminDialog
          open={isCreateDialogOpen}
          onClose={() => setIsCreateDialogOpen(false)}
          title="Tạo vai trò mới"
          size="sm"
          mode="form"
          dirty={isCreateDirty}
          busy={createMutation.isPending}
          footer={
            <AdminDialogFooter
              onCancel={() => setIsCreateDialogOpen(false)}
              onSubmit={handleCreate}
              submitText="Tạo mới"
              busy={createMutation.isPending}
            />
          }
        >
          <div className="space-y-4">
            <FormField label="Tên vai trò" required>
              <Input
                className={ADMIN_INPUT}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </FormField>
            <FormField label="Mô tả">
              <Input
                className={ADMIN_INPUT}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </FormField>
            <FormField label="Cấp độ">
              <Select value={formData.level} onValueChange={(v) => setFormData({ ...formData, level: v })}>
                <SelectTrigger className={ADMIN_INPUT}>
                  <SelectValue placeholder="Chọn cấp độ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">{roleLevelLabel(0)}</SelectItem>
                  <SelectItem value="1">{roleLevelLabel(1)}</SelectItem>
                  <SelectItem value="2">{roleLevelLabel(2)}</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </div>
        </AdminDialog>

        {/* DELETE DIALOG */}
        <ConfirmDeleteDialog
          isOpen={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
          description={<>Bạn có chắc chắn muốn xóa vai trò "{roleToDelete?.name}"? Hành động này không thể hoàn tác.</>}
          onConfirm={handleDelete}
          isDeleting={deleteMutation.isPending}
        />
      </div>
    </AdminLayout>
  );
}
