import React, { useEffect, useState } from 'react';
import AdminLayout from '@/admin/layouts/AdminLayout';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/admin/common/PageHeader';
import { ConfirmDialog } from '@/components/admin/common/ConfirmDialog';
import { RowActionButton, RowActions } from '@/components/admin/common/RowActionButton';
import { AdminPagination } from '@/components/admin/common/AdminPagination';
import { EmptyState, TableSkeleton } from '@/components/admin/common/EmptyState';
import { notify } from '@/components/admin/common/notify';
import { ADMIN_BTN_PRIMARY, ADMIN_BTN_OUTLINE, ADMIN_CARD, ADMIN_TABLE_HEAD, ADMIN_TH, ADMIN_INPUT } from '@/components/admin/common/adminTokens';
import { useNavigate } from 'react-router-dom';
import { useStaffStore } from '@/store/staffStore';
import { RefreshCw, Shield, ArrowLeft } from 'lucide-react';
import { buildUrl } from '@/lib/api/http';
import { useHasStaffPermission } from '@/hooks/useStaffPermission';
import { formatVnDateTime } from '@/lib/format';

interface Role {
  id: number;
  name: string;
  description?: string;
  deleted_at: string;
  staff_count?: number;
  deleted_by_staff_name?: string;
}

export default function DeletedRolesPage() {
  const navigate = useNavigate();
  const hasPermission = useHasStaffPermission();
  const staffStore = useStaffStore();
  const [activeTab, setActiveTab] = useState('deleted-roles');
  const [roles, setRoles] = useState<Role[]>([]);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [total, setTotal] = useState(0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [localSearchQuery, setLocalSearchQuery] = useState('');

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSearchQuery(localSearchQuery);
    setPage(1);
  };
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [roleToRestore, setRoleToRestore] = useState<number | null>(null);
  const [sortField, setSortField] = useState<'name' | 'deleted_at'>('deleted_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const fetchDeletedRoles = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('staffToken');
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        search: searchQuery,
        // Sorting is done by the server so it covers every page, not just the 10 rows on screen
        sort: sortField === 'deleted_at' ? 'deleted_at' : 'name',
        dir: sortDir
      });
      const response = await fetch(buildUrl(`/api/admin/deleted/roles?${params}`), {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('request failed');
      const data = await response.json();
      const sortedItems = data.items || [];
      setRoles(sortedItems);
      setTotal(data.total || 0);
    } catch (error) {
      notify.error('Không thể tải danh sách vai trò đã xóa');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDeletedRoles();
  }, [page, searchQuery, sortField, sortDir]);

  const handleRestore = (id: number) => {
    setRoleToRestore(id);
    setRestoreDialogOpen(true);
  };

  const handleConfirmRestore = async () => {
    if (!roleToRestore) return;
    setIsRestoring(true);
    try {
      const token = localStorage.getItem('staffToken');
      const response = await fetch(buildUrl(`/api/admin/roles/${roleToRestore}/restore`), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        notify.restored('vai trò');
        setRestoreDialogOpen(false);
        fetchDeletedRoles();
      } else {
        notify.error(data.message || 'Không thể khôi phục vai trò');
      }
    } catch (error) {
      notify.error(error);
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <AdminLayout
      active={activeTab as any}
      setActive={setActiveTab as any}
      adminEmailState={staffStore.staff?.email || 'admin@email.com'}
      handleLogout={() => {
        staffStore.clearStaff();
        localStorage.removeItem('staffToken');
        navigate('/login');
      }}
    >
      <div className="space-y-6">
        <PageHeader
          title="Vai trò đã xóa"
          leading={
            <Button variant="ghost" size="icon" onClick={() => navigate('/roles')} className="rounded-full" title="Quay lại">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          }
          actions={
            <Button onClick={fetchDeletedRoles} variant="outline" className={ADMIN_BTN_OUTLINE}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Làm mới
            </Button>
          }
        />

        <form onSubmit={handleSearch} className="mb-4 flex max-w-md gap-2">
          <Input
            placeholder="Tìm kiếm theo tên vai trò..."
            value={localSearchQuery}
            onChange={(e) => setLocalSearchQuery(e.target.value)}
            className={`flex-1 ${ADMIN_INPUT}`}
          />
          <Button type="submit" className={ADMIN_BTN_PRIMARY}>
            Tìm kiếm
          </Button>
        </form>

        <div className={`${ADMIN_CARD} overflow-hidden`}>
          {isLoading ? (
            <TableSkeleton />
          ) : (
            <Table>
              <TableHeader className={ADMIN_TABLE_HEAD}>
                <TableRow>
                  <TableHead
                    className={`cursor-pointer hover:bg-slate-100 ${ADMIN_TH}`}
                    onClick={() => {
                      setSortField('name');
                      setSortDir(sortField === 'name' && sortDir === 'asc' ? 'desc' : 'asc');
                    }}
                  >
                    Tên vai trò {sortField === 'name' && (sortDir === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead className={ADMIN_TH}>Mô tả</TableHead>
                  <TableHead className={ADMIN_TH}>Số nhân viên</TableHead>
                  <TableHead className={ADMIN_TH}>Xóa bởi</TableHead>
                  <TableHead
                    className={`cursor-pointer hover:bg-slate-100 ${ADMIN_TH}`}
                    onClick={() => {
                      setSortField('deleted_at');
                      setSortDir(sortField === 'deleted_at' && sortDir === 'asc' ? 'desc' : 'asc');
                    }}
                  >
                    Ngày xóa {sortField === 'deleted_at' && (sortDir === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead className={`text-right ${ADMIN_TH}`}>Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-gray-500" />
                        {r.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-600">{r.description || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{r.staff_count || 0} nhân viên</Badge>
                    </TableCell>
                    <TableCell className="text-gray-600">{r.deleted_by_staff_name || '-'}</TableCell>
                    <TableCell>{formatVnDateTime(r.deleted_at)}</TableCell>
                    <TableCell className="text-right">
                      {hasPermission('roles', 'restore') && (
                        <RowActions>
                          <RowActionButton action="restore" onClick={() => handleRestore(r.id)} />
                        </RowActions>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {roles.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="p-0">
                      <EmptyState title={searchQuery ? 'Không tìm thấy vai trò đã xóa' : 'Chưa có vai trò nào bị xóa'} />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>

        <AdminPagination page={page} totalPages={totalPages} onPageChange={setPage} totalLabel={`${total} vai trò`} />
      </div>

      <ConfirmDialog
        open={restoreDialogOpen}
        onOpenChange={setRestoreDialogOpen}
        variant="restore"
        title="Khôi phục vai trò"
        description="Bạn có chắc chắn muốn khôi phục vai trò này?"
        busy={isRestoring}
        onConfirm={handleConfirmRestore}
      />
    </AdminLayout>
  );
}
