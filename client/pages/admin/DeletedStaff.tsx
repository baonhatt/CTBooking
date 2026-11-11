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
import { RefreshCw, ArrowLeft } from 'lucide-react';
import { buildUrl } from '@/lib/api/http';
import { useHasStaffPermission } from '@/hooks/useStaffPermission';
import { formatVnDateTime } from '@/lib/format';

interface Staff {
  id: number;
  email: string;
  fullname: string;
  phone?: string;
  is_active: boolean;
  deleted_at: string;
  role?: string;
  deleted_by_staff_name?: string;
}

export default function DeletedStaffPage() {
  const navigate = useNavigate();
  const hasPermission = useHasStaffPermission();
  const staffStore = useStaffStore();
  const [activeTab, setActiveTab] = useState('deleted-staff');
  const [staff, setStaff] = useState<Staff[]>([]);
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
  const [staffToRestore, setStaffToRestore] = useState<number | null>(null);
  const [sortField, setSortField] = useState<'fullname' | 'deleted_at'>('deleted_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const fetchDeletedStaff = async () => {
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
      const response = await fetch(buildUrl(`/api/admin/deleted/staff?${params}`), {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('request failed');
      const data = await response.json();
      const sortedItems = data.items || [];
      setStaff(sortedItems);
      setTotal(data.total || 0);
    } catch (error) {
      notify.error('Không thể tải danh sách nhân viên đã xóa');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDeletedStaff();
  }, [page, searchQuery, sortField, sortDir]);

  const handleRestore = (id: number) => {
    setStaffToRestore(id);
    setRestoreDialogOpen(true);
  };

  const handleConfirmRestore = async () => {
    if (!staffToRestore) return;
    setIsRestoring(true);
    try {
      const token = localStorage.getItem('staffToken');
      const response = await fetch(buildUrl(`/api/admin/staff/${staffToRestore}/restore`), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        notify.restored('nhân viên');
        setRestoreDialogOpen(false);
        fetchDeletedStaff();
      } else {
        notify.error(data.message || 'Không thể khôi phục nhân viên');
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
          title="Nhân viên đã xóa"
          leading={
            <Button variant="ghost" size="icon" onClick={() => navigate('/staff')} className="rounded-full" title="Quay lại">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          }
          actions={
            <Button onClick={fetchDeletedStaff} variant="outline" className={ADMIN_BTN_OUTLINE}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Làm mới
            </Button>
          }
        />

        <form onSubmit={handleSearch} className="mb-4 flex max-w-md gap-2">
          <Input
            placeholder="Tìm kiếm theo email, tên..."
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
                  <TableHead className={ADMIN_TH}>Email</TableHead>
                  <TableHead
                    className={`cursor-pointer hover:bg-slate-100 ${ADMIN_TH}`}
                    onClick={() => {
                      setSortField('fullname');
                      setSortDir(sortField === 'fullname' && sortDir === 'asc' ? 'desc' : 'asc');
                    }}
                  >
                    Họ tên {sortField === 'fullname' && (sortDir === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead className={ADMIN_TH}>SĐT</TableHead>
                  <TableHead className={ADMIN_TH}>Vai trò</TableHead>
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
                {staff.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.email}</TableCell>
                    <TableCell>{s.fullname}</TableCell>
                    <TableCell>{s.phone || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{s.role || '-'}</Badge>
                    </TableCell>
                    <TableCell className="text-gray-600">{s.deleted_by_staff_name || '-'}</TableCell>
                    <TableCell>{formatVnDateTime(s.deleted_at)}</TableCell>
                    <TableCell className="text-right">
                      {hasPermission('staff', 'restore') && (
                        <RowActions>
                          <RowActionButton action="restore" onClick={() => handleRestore(s.id)} />
                        </RowActions>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {staff.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="p-0">
                      <EmptyState title={searchQuery ? 'Không tìm thấy nhân viên đã xóa' : 'Chưa có nhân viên nào bị xóa'} />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>

        <AdminPagination page={page} totalPages={totalPages} onPageChange={setPage} totalLabel={`${total} nhân viên`} />
      </div>

      <ConfirmDialog
        open={restoreDialogOpen}
        onOpenChange={setRestoreDialogOpen}
        variant="restore"
        title="Khôi phục nhân viên"
        description="Bạn có chắc chắn muốn khôi phục nhân viên này?"
        busy={isRestoring}
        onConfirm={handleConfirmRestore}
      />
    </AdminLayout>
  );
}
