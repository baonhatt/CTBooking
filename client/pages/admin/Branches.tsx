import React, { useEffect, useRef, useState } from 'react';
import AdminLayout from '@/admin/layouts/AdminLayout';
import { getBranches, deleteBranchApi, toggleBranchStatusApi, toggleBranchOpenApi } from '@/lib/api/branches';
import { useNavigate } from 'react-router-dom';
import { useStaffPermissions, useIsSuperAdmin } from '@/hooks/useStaffPermission';
import {
  Edit2,
  Search,
  RefreshCw,
  Trash2,
  Plus,
  Building2,
  Phone,
  Mail,
  MapPin,
  BarChart3,
  History,
  Info,
  HelpCircle,
  Loader2,
  Upload,
  Image as ImageIcon,
  ExternalLink,
  CreditCard
} from 'lucide-react';
import { uploadDirectToCloudinary } from '@/lib/api/uploads';
import { optimizeCloudinaryUrl } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AdminDialog, AdminDialogFooter } from '@/components/admin/common/AdminDialog';
import { ConfirmDialog } from '@/components/admin/common/ConfirmDialog';
import { PageHeader } from '@/components/admin/common/PageHeader';
import { RowActionButton, RowActions } from '@/components/admin/common/RowActionButton';
import { StatusBadge } from '@/components/admin/common/StatusBadge';
import { AdminPagination } from '@/components/admin/common/AdminPagination';
import { EmptyState, TableSkeleton } from '@/components/admin/common/EmptyState';
import { FormField, FormSection } from '@/components/admin/common/FormField';
import { notify } from '@/components/admin/common/notify';
import {
  ADMIN_BTN_PRIMARY,
  ADMIN_BTN_OUTLINE,
  ADMIN_CARD,
  ADMIN_TABLE_HEAD,
  ADMIN_TH,
  ADMIN_INPUT,
  ADMIN_TEXT
} from '@/components/admin/common/adminTokens';
import { Label } from '@/components/ui/label';
import { formatVnDateTime } from '@/lib/format';

interface Branch {
  id: number;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  email?: string;
  is_default: boolean;
  is_active: boolean;
  is_open: boolean;
  banner_images?: string | string[] | null;
  settings?: string;
  movie_count: number;
  package_count: number;
  booking_count: number;
  pending_bookings_count: number;
  paid_unused_count: number;
  paid_unused_codes?: string;
  created_at: string;
  updated_at: string;
  created_by_staff_name?: string;
  updated_by_staff_name?: string;
}

export default function BranchesPage() {
  const navigate = useNavigate();
  const permissions = useStaffPermissions();
  const isSuperAdmin = useIsSuperAdmin();

  const hasPermission = (module: string, action: string) => {
    if (isSuperAdmin) return true;
    return permissions.some((p) => p.module === module && p.action === action);
  };

  const getInitialFilters = () => {
    try {
      const raw = localStorage.getItem('admin_branches_filters');
      if (raw) return JSON.parse(raw);
    } catch {}
    return {};
  };

  const initialFilters = getInitialFilters();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [page, setPage] = useState(initialFilters.page || 1);
  const pageSize = 10;
  const [total, setTotal] = useState(0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const [activeTab, setActiveTab] = useState('branches');

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showActiveOnly, setShowActiveOnly] = useState(initialFilters.showActiveOnly ?? true);
  const [searchQuery, setSearchQuery] = useState(initialFilters.searchQuery || '');
  const [localSearchQuery, setLocalSearchQuery] = useState(initialFilters.searchQuery || '');

  const handleSearchBranch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSearchQuery(localSearchQuery);
    setPage(1);
  };
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [branchToDelete, setBranchToDelete] = useState<number | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  // Which store / active toggle is waiting for the user's confirmation
  const [statusAction, setStatusAction] = useState<{ kind: 'open' | 'active'; branch: Branch } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isChangingStatus, setIsChangingStatus] = useState(false);

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      const { items, total } = await getBranches({
        page,
        pageSize,
        q: searchQuery,
        includeInactive: !showActiveOnly
      });
      setBranches(items);
      setTotal(total);
    } catch (e: any) {
      notify.error(e, 'Không tải được danh sách chi nhánh');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    handleRefresh();
  }, [page, showActiveOnly, searchQuery]);

  useEffect(() => {
    try {
      const state = { page, showActiveOnly, searchQuery };
      localStorage.setItem('admin_branches_filters', JSON.stringify(state));
    } catch {}
  }, [page, showActiveOnly, searchQuery]);

  const openCreate = () => {
    setEditData({ id: 0, name: '', code: generateCode(), is_default: false, is_active: true });
    setIsEditOpen(true);
  };

  const openEdit = (data: Branch) => {
    setEditData({ ...data });
    setIsEditOpen(true);
  };

  const handleDelete = (id: number) => {
    setBranchToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!branchToDelete) return;
    setIsDeleting(true);
    try {
      await deleteBranchApi(branchToDelete);
      notify.deleted('chi nhánh');
      setDeleteDialogOpen(false);
      handleRefresh();
    } catch (e: any) {
      notify.error(e);
    } finally {
      setIsDeleting(false);
    }
  };

  // The default branch must stay active, so it cannot be hidden
  const requestToggleActive = (branch: Branch) => {
    if (branch.is_active && branch.is_default) {
      notify.error('Vui lòng bỏ chọn "Chi nhánh mặc định" trước khi ngừng hoạt động chi nhánh này.');
      return;
    }
    setStatusAction({ kind: 'active', branch });
  };

  const handleConfirmActiveToggle = async () => {
    if (!statusAction) return;
    const { branch } = statusAction;
    setIsChangingStatus(true);
    try {
      await toggleBranchStatusApi(branch.id);
      notify.success(branch.is_active ? 'Đã ngừng hoạt động chi nhánh' : 'Đã kích hoạt chi nhánh');
      setStatusAction(null);
      handleRefresh();
    } catch (e: any) {
      notify.error(e);
    } finally {
      setIsChangingStatus(false);
    }
  };

  const handleConfirmOpenToggle = async () => {
    if (!statusAction) return;
    const { branch } = statusAction;
    if (branch.is_open) {
      if (branch.is_default) {
        notify.error('Không thể đóng cửa chi nhánh mặc định');
        return;
      }
      if (branch.pending_bookings_count > 0) {
        notify.error(`Có ${branch.pending_bookings_count} đơn hàng đang chờ thanh toán.`);
        return;
      }
    }
    setIsChangingStatus(true);
    try {
      await toggleBranchOpenApi(branch.id);
      notify.success(branch.is_open ? 'Đã đóng cửa chi nhánh' : 'Đã mở cửa chi nhánh');
      setStatusAction(null);
      handleRefresh();
    } catch (e: any) {
      notify.error(e);
    } finally {
      setIsChangingStatus(false);
    }
  };

  // BRANCH TO DELETE (for the confirm text)
  const branchToDeleteItem = branches.find((item) => item.id === branchToDelete) || null;

  return (
    <AdminLayout
      active={activeTab as any}
      setActive={setActiveTab as any}
      adminEmailState={localStorage.getItem('adminEmail') || 'admin@email.com'}
      handleLogout={() => {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminEmail');
        window.dispatchEvent(new Event('admin-auth-changed'));
        window.location.href = '/';
      }}
    >
      <div className="space-y-6">
        <PageHeader title="Quản lý chi nhánh" description={`Tổng cộng ${total} chi nhánh trong hệ thống`} />

        {/* TOOLBAR */}
        <div className={`${ADMIN_CARD} flex flex-col items-start justify-between gap-4 p-4 xl:flex-row xl:items-center`}>
          <div className="flex w-full flex-wrap items-center gap-3 xl:w-auto">
            <form onSubmit={handleSearchBranch} className="flex gap-2">
              <div className="relative w-[320px] max-w-full">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Tìm theo tên, mã, địa chỉ..."
                  value={localSearchQuery}
                  onChange={(e) => setLocalSearchQuery(e.target.value)}
                  className={`${ADMIN_INPUT} pl-10`}
                />
              </div>
              <Button type="submit" className={`${ADMIN_BTN_PRIMARY} shrink-0 gap-1.5`}>
                <Search className="h-4 w-4" /> Tìm kiếm
              </Button>
            </form>
            <div className="flex h-10 items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3">
              <span className="whitespace-nowrap text-sm font-medium text-slate-600">Chỉ hiện khả dụng</span>
              <Switch
                checked={showActiveOnly}
                onCheckedChange={setShowActiveOnly}
                className="cursor-pointer data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-gray-300"
              />
            </div>
          </div>

          <div className="flex w-full flex-wrap items-center justify-start gap-2.5 xl:w-auto xl:justify-end">
            {hasPermission('branches', 'view_deleted') && (
              <Button variant="outline" onClick={() => navigate('/deleted/branches')} className={`${ADMIN_BTN_OUTLINE} gap-2`}>
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:inline">Xem đã xóa</span>
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setLocalSearchQuery('');
                setSearchQuery('');
                handleRefresh();
              }}
              className={`${ADMIN_BTN_OUTLINE} gap-2`}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Làm mới
            </Button>
            {hasPermission('branches', 'create') && (
              <Button onClick={openCreate} className={`${ADMIN_BTN_PRIMARY} gap-2`}>
                <Plus className="h-4 w-4" /> Thêm mới
              </Button>
            )}
          </div>
        </div>

        <div className={`${ADMIN_CARD} overflow-hidden`}>
          {isLoading ? (
            <TableSkeleton />
          ) : (
            <Table>
              <TableHeader className={ADMIN_TABLE_HEAD}>
                <TableRow className="border-none hover:bg-transparent">
                  <TableHead className={ADMIN_TH}>Tên</TableHead>
                  <TableHead className={ADMIN_TH}>Mã</TableHead>
                  <TableHead className={ADMIN_TH}>Địa chỉ</TableHead>
                  <TableHead className={`hidden xl:table-cell ${ADMIN_TH}`}>Liên hệ</TableHead>
                  <TableHead className={`text-center ${ADMIN_TH}`}>Mặc định</TableHead>
                  <TableHead className={`text-center ${ADMIN_TH}`}>Cửa hàng</TableHead>
                  <TableHead className={`text-center ${ADMIN_TH}`}>Trạng thái</TableHead>
                  <TableHead className={`text-right ${ADMIN_TH}`}>Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branches.length === 0 && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={8} className="p-0">
                      <EmptyState title={searchQuery ? 'Không tìm thấy chi nhánh' : 'Chưa có chi nhánh nào'} />
                    </TableCell>
                  </TableRow>
                )}
                {branches.map((branch) => (
                  <TableRow key={branch.id} className="h-[52px]">
                    <TableCell className="font-medium text-slate-900">{branch.name}</TableCell>
                    <TableCell className="font-mono text-xs text-slate-500">{branch.code}</TableCell>
                    <TableCell className="max-w-[240px] text-sm text-slate-600">
                      <span className="block truncate" title={branch.address || ''}>
                        {branch.address || '-'}
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-xs text-slate-600 xl:table-cell">
                      <div className="flex flex-col gap-0.5">
                        <span>{branch.phone || '-'}</span>
                        <span className="max-w-[180px] truncate text-slate-500" title={branch.email || ''}>
                          {branch.email || ''}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{branch.is_default && <StatusBadge tone="success">Mặc định</StatusBadge>}</TableCell>
                    <TableCell className="text-center">
                      {hasPermission('branches', 'edit') ? (
                        <button
                          type="button"
                          onClick={() => setStatusAction({ kind: 'open', branch })}
                          className="rounded-full transition-opacity hover:opacity-80"
                          aria-label={`Đổi trạng thái mở cửa của ${branch.name}`}
                        >
                          <StatusBadge tone={branch.is_open ? 'success' : 'danger'}>{branch.is_open ? 'Mở cửa' : 'Đóng cửa'}</StatusBadge>
                        </button>
                      ) : (
                        <StatusBadge tone={branch.is_open ? 'success' : 'danger'}>{branch.is_open ? 'Mở cửa' : 'Đóng cửa'}</StatusBadge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        {hasPermission('branches', 'toggle_status') ? (
                          <Switch
                            checked={branch.is_active}
                            aria-label={`Kích hoạt chi nhánh ${branch.name}`}
                            onCheckedChange={() => requestToggleActive(branch)}
                            className="cursor-pointer data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-gray-300"
                          />
                        ) : (
                          <Switch
                            checked={branch.is_active}
                            aria-label={`Kích hoạt chi nhánh ${branch.name}`}
                            disabled
                            className="cursor-not-allowed opacity-40 data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-gray-300"
                          />
                        )}
                        <StatusBadge status={branch.is_active ? 'active' : 'inactive'} />
                      </div>
                    </TableCell>
                    <TableCell>
                      <RowActions>
                        <RowActionButton
                          action="view"
                          onClick={() => {
                            setSelectedBranch(branch);
                            setIsDetailDialogOpen(true);
                          }}
                        />
                        {hasPermission('branches', 'edit') && <RowActionButton action="edit" onClick={() => openEdit(branch)} />}
                        {hasPermission('branches', 'delete') && (
                          <RowActionButton action="delete" onClick={() => handleDelete(branch.id)} />
                        )}
                      </RowActions>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <AdminPagination page={page} totalPages={totalPages} onPageChange={setPage} totalLabel={`${total} chi nhánh trong hệ thống`} />
      </div>

      {isEditOpen && (
        <BranchEditModal
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          data={editData}
          onSave={handleRefresh}
          branches={branches}
        />
      )}

      {/* DELETE DIALOG */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        variant="danger"
        title="Xóa chi nhánh"
        description={
          <>
            Bạn có chắc chắn muốn xóa chi nhánh {branchToDeleteItem ? `"${branchToDeleteItem.name}"` : 'này'}? Hành động này không
            thể hoàn tác.
          </>
        }
        busy={isDeleting}
        onConfirm={handleConfirmDelete}
      />

      {/* OPEN / CLOSE STORE DIALOG */}
      <ConfirmDialog
        open={statusAction?.kind === 'open'}
        onOpenChange={(open) => !open && setStatusAction(null)}
        variant={statusAction?.branch.is_open ? 'warning' : 'info'}
        title="Thay đổi trạng thái cửa hàng"
        description={
          statusAction && (
            <span className="block space-y-3">
              <span className="block">
                {statusAction.branch.is_open
                  ? 'Bạn có chắc chắn muốn ĐÓNG CỬA chi nhánh này? Khách hàng sẽ không thể đặt vé mới.'
                  : 'Bạn có chắc chắn muốn MỞ CỬA chi nhánh này?'}
              </span>
              {statusAction.branch.is_open && statusAction.branch.paid_unused_count > 0 && (
                <span className="block space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <span className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                    <Info className="h-4 w-4" />
                    Cảnh báo: Có {statusAction.branch.paid_unused_count} vé đã thanh toán chưa sử dụng!
                  </span>
                  <span className="block rounded border border-amber-100 bg-white/50 p-2">
                    <span className="mb-1 block text-[11px] font-bold uppercase text-amber-600">Danh sách mã vé (Để copy):</span>
                    <code className="break-all text-xs leading-relaxed text-slate-700">
                      {statusAction.branch.paid_unused_codes || 'Không có mã nào'}
                    </code>
                  </span>
                  <span className="block text-[11px] italic text-amber-600">
                    * Vui lòng liên hệ khách hàng hoặc đảm bảo có nhân viên trực trước khi đóng cửa.
                  </span>
                </span>
              )}
            </span>
          )
        }
        busy={isChangingStatus}
        onConfirm={handleConfirmOpenToggle}
      />

      {/* ACTIVATE / HIDE DIALOG */}
      <ConfirmDialog
        open={statusAction?.kind === 'active'}
        onOpenChange={(open) => !open && setStatusAction(null)}
        variant="warning"
        title="Thay đổi trạng thái"
        description={`Bạn có chắc chắn muốn ${statusAction?.branch.is_active ? 'ngừng hoạt động' : 'kích hoạt'} chi nhánh này?`}
        busy={isChangingStatus}
        onConfirm={handleConfirmActiveToggle}
      />

      {/* DETAIL DIALOG */}
      <AdminDialog
        open={isDetailDialogOpen}
        onClose={() => setIsDetailDialogOpen(false)}
        title="Chi tiết chi nhánh"
        size="lg"
        mode="view"
        footer={
          <AdminDialogFooter
            onCancel={() => setIsDetailDialogOpen(false)}
            cancelText={ADMIN_TEXT.close}
            onSubmit={
              selectedBranch && hasPermission('branches', 'edit')
                ? () => {
                    setIsDetailDialogOpen(false);
                    openEdit(selectedBranch);
                  }
                : undefined
            }
            submitText={ADMIN_TEXT.edit}
          />
        }
      >
          {selectedBranch && (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* LEFT COLUMN: OPERATIONAL INFO */}
                <div className="space-y-6">
                  {/* Basic Info */}
                  <Card className={`${ADMIN_CARD} overflow-hidden`}>
                    <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 flex items-center gap-2">
                      <Info className="w-4 h-4 text-blue-500" />
                      <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Thông tin cơ bản</h3>
                    </div>
                    <CardContent className="p-4 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label className="text-[11px] font-medium text-slate-500 uppercase">Tên chi nhánh</Label>
                          <div className="text-sm font-bold text-slate-900">{selectedBranch.name}</div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] font-medium text-slate-500 uppercase">Mã chi nhánh</Label>
                          <div className="text-sm font-mono text-blue-600 font-bold">{selectedBranch.code}</div>
                        </div>
                        <div className="space-y-2 col-span-2">
                          <Label className="text-[11px] font-medium text-slate-500 uppercase">
                            Trạng thái hiện tại
                          </Label>
                          <div className="flex flex-wrap gap-2 pt-0.5">
                            {selectedBranch.is_default && (
                              <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase">
                                Mặc định
                              </Badge>
                            )}
                            <StatusBadge status={selectedBranch.is_active ? 'active' : 'inactive'} />
                            <Badge
                              className={`${selectedBranch.is_open ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'} border-none rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase`}
                            >
                              {selectedBranch.is_open ? 'Đang mở cửa' : 'Đã đóng cửa'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Statistics */}
                  <Card className={`${ADMIN_CARD} overflow-hidden`}>
                    <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-purple-500" />
                      <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Thống kê hoạt động</h3>
                    </div>
                    <CardContent className="p-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100 text-center">
                          <div className="text-[11px] text-blue-500 uppercase font-black mb-1">Số phim</div>
                          <div className="text-xl font-black text-blue-700">{selectedBranch.movie_count}</div>
                        </div>
                        <div className="bg-purple-50/50 p-3 rounded-xl border border-purple-100 text-center">
                          <div className="text-[11px] text-purple-500 uppercase font-black mb-1">Số gói vé</div>
                          <div className="text-xl font-black text-purple-700">{selectedBranch.package_count}</div>
                        </div>
                        <div className="bg-green-50/50 p-3 rounded-xl border border-green-100 text-center">
                          <div className="text-[11px] text-green-500 uppercase font-black mb-1">Tổng Booking</div>
                          <div className="text-xl font-black text-green-700">{selectedBranch.booking_count}</div>
                        </div>
                        <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-100 text-center">
                          <div className="text-[11px] text-rose-500 uppercase font-black mb-1">Đang thanh toán</div>
                          <div className="text-xl font-black text-rose-700">
                            {selectedBranch.pending_bookings_count}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Contact & System */}
                  <div className="grid grid-cols-1 gap-6">
                    {/* Contact Info */}
                    <Card className={`${ADMIN_CARD} h-fit overflow-hidden`}>
                      <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-orange-500" />
                        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Liên hệ chi nhánh</h3>
                      </div>
                      <CardContent className="p-4 space-y-3 text-xs">
                        <div className="flex items-start gap-3">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <p className="font-bold text-slate-700 uppercase text-[11px] tracking-tight">Địa chỉ</p>
                            <p className="text-slate-600 leading-normal">{selectedBranch.address || 'Chưa cập nhật'}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 border-t pt-3">
                          <div className="flex items-start gap-3">
                            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                              <p className="font-bold text-slate-700 uppercase text-[11px] tracking-tight">Điện thoại</p>
                              <p className="text-slate-600">{selectedBranch.phone || 'Chưa cập nhật'}</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                              <p className="font-bold text-slate-700 uppercase text-[11px] tracking-tight">Email</p>
                              <p className="text-slate-600 break-all">{selectedBranch.email || 'Chưa cập nhật'}</p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* System Info */}
                    <Card className={`${ADMIN_CARD} h-fit overflow-hidden`}>
                      <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 flex items-center gap-2">
                        <History className="w-4 h-4 text-slate-500" />
                        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Hệ thống</h3>
                      </div>
                      <CardContent className="p-4 grid grid-cols-2 gap-4 text-xs">
                        <div className="space-y-1">
                          <p className="font-bold text-slate-700 uppercase text-[11px] tracking-tight">Ngày tạo</p>
                          <p className="text-slate-600 font-medium">
                            {formatVnDateTime(selectedBranch.created_at)}
                          </p>
                          <p className="text-[11px] text-slate-400 italic">
                            Bởi: {selectedBranch.created_by_staff_name || 'Hệ thống'}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="font-bold text-slate-700 uppercase text-[11px] tracking-tight">Cập nhật cuối</p>
                          <p className="text-slate-600 font-medium">
                            {formatVnDateTime(selectedBranch.updated_at)}
                          </p>
                          <p className="text-[11px] text-slate-400 italic">
                            Bởi: {selectedBranch.updated_by_staff_name || 'Hệ thống'}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* RIGHT COLUMN: BUSINESS & FOOTER INFO */}
                <div className="space-y-6">
                  {/* Footer Config */}
                  <Card className={`${ADMIN_CARD} overflow-hidden`}>
                    <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 flex items-center gap-2">
                      <Phone className="w-4 h-4 text-cyan-600" />
                      <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Cấu hình footer & bản đồ
                      </h3>
                    </div>
                    <CardContent className="p-4 space-y-4">
                      {selectedBranch.settings ? (
                        (() => {
                          try {
                            const s = JSON.parse(selectedBranch.settings);
                            return (
                              <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div className="space-y-1">
                                    <Label className="text-[11px] font-bold text-slate-500 uppercase">
                                      Tên công ty hiển thị
                                    </Label>
                                    <p className="text-sm font-semibold text-slate-800 leading-tight">
                                      {s.company_name || '-'}
                                    </p>
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-[11px] font-bold text-slate-500 uppercase">
                                      Hotline Footer
                                    </Label>
                                    <p className="text-sm font-bold text-cyan-600">{s.hotline || '-'}</p>
                                  </div>
                                  <div className="space-y-1 sm:col-span-2">
                                    <Label className="text-[11px] font-bold text-slate-500 uppercase">
                                      Địa chỉ Công ty Footer
                                    </Label>
                                    <p className="text-sm text-slate-700">{s.company_address || '-'}</p>
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-[11px] font-bold text-slate-500 uppercase">
                                      Địa điểm bản đồ
                                    </Label>
                                    <p className="text-sm text-slate-700">{s.map_query || '-'}</p>
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-[11px] font-bold text-slate-500 uppercase">
                                      Tọa độ / Plus Code
                                    </Label>
                                    <p className="text-sm text-slate-700 font-mono">{s.map_coords || '-'}</p>
                                  </div>
                                </div>
                              </div>
                            );
                          } catch {
                            return <div className="text-xs text-red-500 italic">Lỗi định dạng cấu hình JSON</div>;
                          }
                        })()
                      ) : (
                        <div className="text-center py-6 text-slate-400 italic text-sm">Chưa có cấu hình Footer</div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Legal Info */}
                  <Card className={`${ADMIN_CARD} overflow-hidden`}>
                    <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-purple-600" />
                      <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Thông tin pháp lý & bổ sung
                      </h3>
                    </div>
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        {selectedBranch.settings ? (
                          (() => {
                            try {
                              const s = JSON.parse(selectedBranch.settings);
                              const extra = s.extra_info?.filter((i: any) => i.value && i.value.trim() !== '') || [];
                              if (extra.length === 0)
                                return (
                                  <div className="text-center py-6 text-slate-400 italic text-sm">
                                    Chưa có thông tin pháp lý bổ sung
                                  </div>
                                );
                              return extra.map((info: any, idx: number) => (
                                <div
                                  key={idx}
                                  className="flex justify-between items-start gap-4 py-2.5 px-3 bg-slate-50 rounded-xl border border-slate-100"
                                >
                                  <span className="text-[11px] text-slate-500 font-bold uppercase tracking-tight mt-0.5 shrink-0">
                                    {info.label}
                                  </span>
                                  <span className="text-xs text-slate-800 font-bold text-right uppercase">
                                    {info.value}
                                  </span>
                                </div>
                              ));
                            } catch {
                              return null;
                            }
                          })()
                        ) : (
                          <div className="text-center py-6 text-slate-400 italic text-sm">Chưa có cấu hình bổ sung</div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                  {/* Banners Preview */}
                  <Card className={`${ADMIN_CARD} overflow-hidden`}>
                    <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-indigo-600" />
                        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Ảnh banner trang chủ
                        </h3>
                      </div>
                      {(() => {
                        let banners: string[] = [];
                        try {
                          if (selectedBranch.banner_images) {
                            banners = Array.isArray(selectedBranch.banner_images)
                              ? selectedBranch.banner_images
                              : JSON.parse(selectedBranch.banner_images);
                          }
                        } catch {}
                        return (
                          <Badge variant="secondary" className="text-[11px] font-bold">
                            {banners.length} ảnh
                          </Badge>
                        );
                      })()}
                    </div>
                    <CardContent className="p-4">
                      {(() => {
                        let banners: string[] = [];
                        try {
                          if (selectedBranch.banner_images) {
                            banners = Array.isArray(selectedBranch.banner_images)
                              ? selectedBranch.banner_images
                              : JSON.parse(selectedBranch.banner_images);
                          }
                        } catch {}
                        if (banners.length === 0) {
                          return (
                            <div className="text-center py-6 text-slate-400 italic text-sm">
                              Chưa có ảnh banner riêng (đang dùng banner mặc định của hệ thống)
                            </div>
                          );
                        }
                        return (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {banners.map((url, idx) => (
                              <div
                                key={idx}
                                className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-[16/9] bg-slate-900 shadow-xs"
                              >
                                <img
                                  src={optimizeCloudinaryUrl(url, 600) || url}
                                  alt={`Banner ${idx + 1}`}
                                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <a
                                    href={url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1.5 bg-white/90 hover:bg-white text-slate-800 rounded-lg shadow-sm"
                                    title="Xem ảnh gốc"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                </div>
                                <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-xs text-[11px] font-bold text-white">
                                  #{idx + 1}
                                </span>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}
      </AdminDialog>
    </AdminLayout>
  );
}

// Sections of the branch form, in page order, for the navigation bar at the top of the form
const BRANCH_FORM_SECTIONS = [
  { id: 'branch_section_basic', label: 'Thông tin chung' },
  { id: 'branch_section_banner', label: 'Banner' },
  { id: 'branch_section_footer', label: 'Liên hệ & bản đồ' },
  { id: 'branch_section_payment', label: 'Vé & thanh toán' },
  { id: 'branch_section_legal', label: 'Pháp lý' },
  { id: 'branch_section_status', label: 'Trạng thái' }
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// A phone or hotline may hold digits, spaces, dots, dashes, brackets and a leading +; it needs 8 to 15 digits
function getPhoneError(value: string): string {
  const text = (value || '').trim();
  if (!text) return '';
  if (!/^\+?[0-9\s.\-()]+$/.test(text)) return 'Chỉ nhập số, dấu cách, dấu chấm hoặc dấu gạch ngang';
  const digitCount = text.replace(/\D/g, '').length;
  if (digitCount < 8 || digitCount > 15) return 'Số điện thoại phải có từ 8 đến 15 chữ số';
  return '';
}

function BranchEditModal({ isOpen, onClose, data, onSave, branches }: any) {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    address: '',
    phone: '',
    email: '',
    is_default: false,
    is_active: true,
    is_open: true,
    banner_images: '',
    settings: ''
  });
  const [bannerImages, setBannerImages] = useState<string[]>([]);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [manualBannerUrl, setManualBannerUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCodeEditable, setIsCodeEditable] = useState(false);
  const [showQrUrlField, setShowQrUrlField] = useState(false);
  // The form as it was loaded, to tell whether the user changed anything before closing
  const loadedFormJsonRef = useRef('');
  const [settingsData, setSettingsData] = useState<any>({
    company_name: '',
    company_address: '',
    hotline: '',
    map_query: '',
    map_coords: '', // New field for exact coordinates
    show_zalo_button: true,
    show_phone_button: true,
    ticket_expiry_days: 10, // Default 10 days
    payment_config: {
      qr_code_url: '',
      bank_name: '',
      bank_code: '',
      account_number: '',
      account_name: ''
    },
    extra_info: [
      { label: 'Tên người đại diện', value: '' },
      { label: 'Số ĐKKD', value: '' },
      { label: 'Cấp tại', value: '' },
      { label: 'Đăng ký lần đầu', value: '' },
      { label: 'Đăng ký thay đổi', value: '' }
    ]
  });

  useEffect(() => {
    if (data) {
      const isFirstBranch = branches.length === 0 && data.id === 0;
      const isOnlyBranch = branches.length === 1 && data.id !== 0;

      let initialBanners: string[] = [];
      try {
        if (data.banner_images) {
          initialBanners = Array.isArray(data.banner_images)
            ? data.banner_images
            : JSON.parse(data.banner_images);
        }
      } catch {
        if (typeof data.banner_images === 'string' && data.banner_images.startsWith('http')) {
          initialBanners = [data.banner_images];
        }
      }
      setBannerImages(initialBanners);

      const loadedFormData = {
        name: data.name || '',
        code: data.code || '',
        address: data.address || '',
        phone: data.phone || '',
        email: data.email || '',
        is_default: isFirstBranch || isOnlyBranch || data.is_default || false,
        is_active: data.is_active ?? true,
        is_open: data.is_open ?? true,
        banner_images: JSON.stringify(initialBanners),
        settings: data.settings || ''
      };
      setFormData(loadedFormData);
      loadedFormJsonRef.current = JSON.stringify(loadedFormData);

      // Parse settings JSON
      try {
        const parsed = data.settings ? JSON.parse(data.settings) : {};

        // Default labels for company info if extra_info is empty
        const defaultExtra = [
          { label: 'Tên người đại diện', value: parsed.representative || '' },
          { label: 'Số ĐKKD', value: parsed.business_reg_no || '' },
          { label: 'Cấp tại', value: parsed.issued_at || '' },
          { label: 'Đăng ký lần đầu', value: parsed.first_reg_date || '' },
          { label: 'Đăng ký thay đổi', value: parsed.last_change_date || '' }
        ];

        setSettingsData({
          company_name: parsed.company_name || '',
          company_address: parsed.company_address || '',
          hotline: parsed.hotline || '',
          map_query: parsed.map_query || '',
          map_coords: parsed.map_coords || '',
          show_zalo_button: parsed.show_zalo_button ?? true,
          show_phone_button: parsed.show_phone_button ?? true,
          ticket_expiry_days: parsed.ticket_expiry_days || 10,
          payment_config: parsed.payment_config || {
            qr_code_url: '',
            bank_name: '',
            bank_code: '',
            account_number: '',
            account_name: ''
          },
          extra_info:
            Array.isArray(parsed.extra_info) && parsed.extra_info.length > 0 ? parsed.extra_info : defaultExtra
        });
      } catch (e) {
        console.error('Error parsing branch settings:', e);
      }

      setIsCodeEditable(false); // Default to locked
    }
  }, [data, branches.length]);

  const handleSettingsChange = (field: string, value: any) => {
    const newSettings = { ...settingsData, [field]: value };
    setSettingsData(newSettings);
    setFormData((prev) => ({ ...prev, settings: JSON.stringify(newSettings) }));
  };

  const addExtraInfo = () => {
    const newExtra = [...(settingsData.extra_info || []), { label: '', value: '' }];
    handleSettingsChange('extra_info', newExtra);
  };

  const removeExtraInfo = (index: number) => {
    const newExtra = settingsData.extra_info.filter((_: any, i: number) => i !== index);
    handleSettingsChange('extra_info', newExtra);
  };

  const updateExtraInfo = (index: number, field: 'label' | 'value', value: string) => {
    const newExtra = [...settingsData.extra_info];
    newExtra[index][field] = value;
    handleSettingsChange('extra_info', newExtra);
  };

  const isFormDirty = JSON.stringify(formData) !== loadedFormJsonRef.current;
  const formRef = useRef<HTMLFormElement>(null);

  // INLINE VALIDATION: a message under the field as soon as the value cannot be right (empty is allowed)
  const emailError = formData.email.trim() && !EMAIL_PATTERN.test(formData.email.trim()) ? 'Email không hợp lệ' : '';
  const phoneError = getPhoneError(formData.phone);
  const hotlineError = getPhoneError(settingsData.hotline);
  const hasFormError = Boolean(emailError || phoneError || hotlineError);

  const scrollToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasFormError) {
      notify.error('Vui lòng sửa các trường báo lỗi trước khi lưu');
      return;
    }
    setIsLoading(true);

    try {
      // Check for pending bookings when closing the branch
      if (data.id !== 0 && data.is_open && !formData.is_open) {
        if (data.pending_bookings_count > 0) {
          notify.error(
            `Có ${data.pending_bookings_count} đơn hàng đang chờ thanh toán. Vui lòng đợi họ hoàn tất hoặc hết hạn (15 phút).`
          );
          setIsLoading(false);
          return;
        }
      }

      const { createBranchApi, updateBranchApi } = await import('@/lib/api/branches');

      if (data.id === 0) {
        await createBranchApi(formData);
        notify.created('chi nhánh');
      } else {
        await updateBranchApi(data.id, formData);
        notify.saved('chi nhánh');
      }

      onSave();
      onClose();
    } catch (e: any) {
      notify.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AdminDialog
      open={isOpen}
      onClose={onClose}
      title={data.id === 0 ? 'Thêm chi nhánh mới' : 'Chỉnh sửa chi nhánh'}
      subtitle="Cấu hình thông tin hoạt động và hiển thị cho chi nhánh"
      size="xl"
      mode="form"
      dirty={isFormDirty}
      busy={isLoading}
      flushBody
      footer={
        <AdminDialogFooter
          onCancel={onClose}
          onSubmit={() => formRef.current?.requestSubmit()}
          submitText={data.id === 0 ? ADMIN_TEXT.create : ADMIN_TEXT.save}
          busy={isLoading}
        />
      }
    >
        <form ref={formRef} onSubmit={handleSubmit}>
          {/* SECTION NAVIGATION: the form is long, so each button scrolls to one section */}
          <nav className="sticky top-0 z-10 flex gap-2 overflow-x-auto border-b bg-white px-6 py-2" aria-label="Các mục của biểu mẫu">
            {BRANCH_FORM_SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => scrollToSection(section.id)}
                className="px-3 py-1 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 rounded-full whitespace-nowrap transition-colors"
              >
                {section.label}
              </button>
            ))}
          </nav>
          <div className="space-y-4 bg-slate-50/60 p-6">
            {/* SECTION 1: BASIC INFO */}
            <div id="branch_section_basic" className="scroll-mt-14">
              <FormSection title="Thông tin chi nhánh" icon={<Info className="h-4 w-4 text-blue-600" />}>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField label="Tên chi nhánh" required className="md:col-span-2">
                    <Input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className={ADMIN_INPUT}
                      placeholder="Nhập tên chi nhánh..."
                      required
                    />
                  </FormField>
                  <FormField
                    label="Mã chi nhánh"
                    required
                    helper={
                      data.id !== 0 ? 'Mã chi nhánh được khóa sau khi tạo vì các vé và đơn hàng đang dùng mã này.' : undefined
                    }
                  >
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        value={formData.code}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                        disabled={!isCodeEditable}
                        className={`${ADMIN_INPUT} flex-1 ${!isCodeEditable ? 'cursor-not-allowed bg-slate-50 text-slate-500' : ''}`}
                        required
                      />
                      {data.id === 0 && (
                        <button
                          type="button"
                          onClick={() => setIsCodeEditable(!isCodeEditable)}
                          className="h-10 rounded-xl border border-slate-200 bg-white px-3 shadow-sm transition-colors hover:bg-slate-50"
                          title={isCodeEditable ? 'Khóa mã' : 'Sửa mã'}
                          aria-label={isCodeEditable ? 'Khóa mã chi nhánh' : 'Sửa mã chi nhánh'}
                        >
                          <Edit2 className="h-4 w-4 text-slate-600" />
                        </button>
                      )}
                    </div>
                  </FormField>
                  <FormField label="Số điện thoại" error={phoneError}>
                    <Input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className={ADMIN_INPUT}
                      placeholder="Nhập số điện thoại..."
                    />
                  </FormField>
                  <FormField label="Địa chỉ" className="md:col-span-2">
                    <Input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className={ADMIN_INPUT}
                      placeholder="Nhập địa chỉ chi nhánh..."
                    />
                  </FormField>
                  <FormField label="Email" error={emailError} className="md:col-span-2">
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className={ADMIN_INPUT}
                      placeholder="email@chinhanh.com"
                    />
                  </FormField>
                </div>
              </FormSection>
            </div>

            {/* SECTION: HERO BANNER CAROUSEL */}
            <div id="branch_section_banner" className="scroll-mt-14">
              <FormSection title="Ảnh banner chi nhánh (carousel trang chủ)" icon={<ImageIcon className="h-4 w-4 text-indigo-600" />}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-slate-500">
                    Tải lên danh sách ảnh banner để tự động hiển thị trên Carousel đầu trang Landing Page
                  </p>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      disabled={isUploadingBanner}
                      onChange={async (e) => {
                        const files = e.target.files;
                        if (!files || files.length === 0) return;
                        try {
                          setIsUploadingBanner(true);
                          const uploadedUrls: string[] = [];
                          for (let i = 0; i < files.length; i++) {
                            const res = await uploadDirectToCloudinary(files[i], 'branch_banners');
                            uploadedUrls.push(res.url);
                          }
                          const nextImages = [...bannerImages, ...uploadedUrls];
                          setBannerImages(nextImages);
                          setFormData((prev) => ({ ...prev, banner_images: JSON.stringify(nextImages) }));
                          notify.success(`Đã tải lên ${uploadedUrls.length} ảnh banner`);
                        } catch (err: any) {
                          notify.error(err, 'Tải ảnh banner thất bại');
                        } finally {
                          setIsUploadingBanner(false);
                          e.target.value = '';
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isUploadingBanner}
                      className="flex h-8 items-center gap-1.5 rounded-xl border-indigo-200 text-xs text-indigo-700 hover:bg-indigo-50"
                      asChild
                    >
                      <span>
                        {isUploadingBanner ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Upload className="h-3.5 w-3.5" />
                        )}
                        Upload ảnh lên Cloudinary
                      </span>
                    </Button>
                  </label>
                </div>

                {/* Banner List & Add by URL */}
                <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                  <div className="flex items-center gap-2">
                    <Input
                      type="url"
                      placeholder="Hoặc dán URL ảnh trực tiếp (https://...)"
                      value={manualBannerUrl}
                      onChange={(e) => setManualBannerUrl(e.target.value)}
                      className={`${ADMIN_INPUT} flex-1 bg-white`}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        if (!manualBannerUrl.trim()) return;
                        const next = [...bannerImages, manualBannerUrl.trim()];
                        setBannerImages(next);
                        setFormData((prev) => ({ ...prev, banner_images: JSON.stringify(next) }));
                        setManualBannerUrl('');
                        notify.success('Đã thêm banner');
                      }}
                      className="h-10 rounded-xl px-4 text-xs font-semibold"
                    >
                      Thêm URL
                    </Button>
                  </div>

                  {bannerImages.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-3">
                      {bannerImages.map((url, idx) => (
                        <div
                          key={idx}
                          className="group relative aspect-[16/9] overflow-hidden rounded-xl border border-slate-200 bg-slate-900 shadow-xs"
                        >
                          <img
                            src={optimizeCloudinaryUrl(url, 600) || url}
                            alt={`Banner ${idx + 1}`}
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          />
                          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg bg-white/90 p-1.5 text-slate-800 shadow-sm hover:bg-white"
                              title="Xem ảnh gốc"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                            <button
                              type="button"
                              onClick={() => {
                                const next = bannerImages.filter((_, i) => i !== idx);
                                setBannerImages(next);
                                setFormData((prev) => ({ ...prev, banner_images: JSON.stringify(next) }));
                              }}
                              className="cursor-pointer rounded-lg bg-rose-600 p-1.5 text-white shadow-sm hover:bg-rose-700"
                              title="Xóa banner này"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <span className="absolute bottom-1.5 left-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-bold text-white backdrop-blur-xs">
                            #{idx + 1}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white/60 py-6 text-center">
                      <ImageIcon className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                      <p className="text-xs font-medium text-slate-500">Chưa có ảnh banner nào cho chi nhánh này</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        Bấm nút "Upload ảnh lên Cloudinary" hoặc dán URL ảnh để thêm vào danh sách
                      </p>
                    </div>
                  )}
                </div>
              </FormSection>
            </div>

            {/* SECTION 2: FOOTER CONFIG */}
            <div id="branch_section_footer" className="scroll-mt-14">
              <FormSection title="Cấu hình footer (liên hệ & bản đồ)" icon={<Phone className="h-4 w-4 text-cyan-600" />}>
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
                  <FormField label="Tên Công ty">
                    <Input
                      type="text"
                      value={settingsData.company_name}
                      onChange={(e) => handleSettingsChange('company_name', e.target.value)}
                      className={ADMIN_INPUT}
                      placeholder="CÔNG TY TNHH VR VIỆT NAM"
                    />
                  </FormField>
                  <FormField label="Hotline hỗ trợ" error={hotlineError}>
                    <Input
                      type="text"
                      value={settingsData.hotline}
                      onChange={(e) => handleSettingsChange('hotline', e.target.value)}
                      className={ADMIN_INPUT}
                      placeholder="036.6431.179"
                    />
                  </FormField>
                  <FormField label="Địa chỉ Công ty" className="md:col-span-2">
                    <Input
                      type="text"
                      value={settingsData.company_address}
                      onChange={(e) => handleSettingsChange('company_address', e.target.value)}
                      className={ADMIN_INPUT}
                      placeholder="Số 11 Sư Vạn Hạnh, Quận 10, TP. HCM..."
                    />
                  </FormField>
                  <FormField label="Tên địa điểm Bản đồ (Ưu tiên 1)">
                    <Input
                      type="text"
                      value={settingsData.map_query}
                      onChange={(e) => handleSettingsChange('map_query', e.target.value)}
                      className={ADMIN_INPUT}
                      placeholder="Ví dụ: Vạn Hạnh Mall hoặc Tên rạp..."
                    />
                  </FormField>
                  <FormField label="Link Google Maps">
                    <div className="flex items-center gap-2">
                      <Input
                        type="text"
                        value={settingsData.map_coords}
                        onChange={(e) => handleSettingsChange('map_coords', e.target.value)}
                        className={`${ADMIN_INPUT} flex-1`}
                        placeholder="Dán link Google Maps từ trình duyệt..."
                      />
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle
                              className="h-4 w-4 shrink-0 cursor-help text-slate-400 transition-colors hover:text-cyan-500"
                              aria-label="Cách lấy link Google Maps"
                            />
                          </TooltipTrigger>
                          <TooltipContent
                            side="top"
                            className="max-w-[250px] rounded-xl border-slate-700 bg-slate-800 p-3 text-white shadow-xl"
                          >
                            <div className="space-y-2 text-xs">
                              <p className="font-bold text-cyan-400">Cách lấy link chính xác nhất:</p>
                              <ul className="list-disc space-y-1 pl-4 text-slate-200">
                                <li>Truy cập Google Maps và tìm rạp của bạn.</li>
                                <li>
                                  Copy <span className="font-medium text-white">toàn bộ đường dẫn (URL)</span> trên thanh
                                  địa chỉ trình duyệt.
                                </li>
                                <li>Hệ thống sẽ render trực tiếp URL này ở chân trang.</li>
                              </ul>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </FormField>
                  <FormField label="Hiển thị nút nổi hỗ trợ trên Website" className="md:col-span-2">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                        <span className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                          <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-600 text-white">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="m3 21 1.9-5.7a8.5 8.5 11 1 1 3.8 3.8z" />
                            </svg>
                          </div>
                          Nút chat Zalo
                        </span>
                        <Switch
                          checked={settingsData.show_zalo_button}
                          aria-label="Hiện nút chat Zalo"
                          onCheckedChange={(checked) => handleSettingsChange('show_zalo_button', checked)}
                        />
                      </div>
                      <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                        <span className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                          <div className="flex h-6 w-6 items-center justify-center rounded bg-emerald-500 text-white">
                            <Phone className="h-3.5 w-3.5" />
                          </div>
                          Nút gọi điện
                        </span>
                        <Switch
                          checked={settingsData.show_phone_button}
                          aria-label="Hiện nút gọi điện"
                          onCheckedChange={(checked) => handleSettingsChange('show_phone_button', checked)}
                        />
                      </div>
                    </div>
                  </FormField>
                </div>
              </FormSection>
            </div>

            {/* SECTION 3: TICKET & PAYMENT CONFIG */}
            <div id="branch_section_payment" className="scroll-mt-14">
              <FormSection title="Cấu hình vé & thanh toán" icon={<CreditCard className="h-4 w-4 text-purple-600" />}>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField
                    label="Thời hạn sử dụng vé (ngày)"
                    helper="Số ngày vé có hiệu lực sau khi thanh toán"
                    className="md:col-span-2"
                  >
                    <Input
                      type="number"
                      min="1"
                      max="365"
                      value={settingsData.ticket_expiry_days}
                      onChange={(e) => handleSettingsChange('ticket_expiry_days', parseInt(e.target.value) || 10)}
                      className={ADMIN_INPUT}
                      placeholder="10"
                    />
                  </FormField>
                  <div className="md:col-span-2">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700">Cấu hình QR code</span>
                      <button
                        type="button"
                        onClick={() => setShowQrUrlField(!showQrUrlField)}
                        className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                      >
                        {showQrUrlField ? 'Ẩn' : 'Tùy chọn nâng cao'}
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className={showQrUrlField ? 'rotate-180' : ''}
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                    </div>
                    {showQrUrlField && (
                      <FormField
                        label="Link ảnh QR code"
                        helper="Link ảnh QR code có sẵn (nếu đã tạo từ app ngân hàng). Nếu để trống, hệ thống sẽ tự tạo từ thông tin ngân hàng bên dưới."
                      >
                        <Input
                          type="text"
                          value={settingsData.payment_config?.qr_code_url || ''}
                          onChange={(e) =>
                            handleSettingsChange('payment_config', {
                              ...settingsData.payment_config,
                              qr_code_url: e.target.value
                            })
                          }
                          className={ADMIN_INPUT}
                          placeholder="https://img.vietqr.io/image/..."
                        />
                      </FormField>
                    )}
                  </div>
                  <FormField label="Tên ngân hàng">
                    <Input
                      type="text"
                      value={settingsData.payment_config?.bank_name || ''}
                      onChange={(e) =>
                        handleSettingsChange('payment_config', {
                          ...settingsData.payment_config,
                          bank_name: e.target.value
                        })
                      }
                      className={ADMIN_INPUT}
                      placeholder="MB Bank, Vietcombank..."
                    />
                  </FormField>
                  <FormField label="Mã ngân hàng (Bank Code)" helper="Nếu để trống sẽ tự động map từ tên ngân hàng">
                    <Input
                      type="text"
                      value={settingsData.payment_config?.bank_code || ''}
                      onChange={(e) =>
                        handleSettingsChange('payment_config', {
                          ...settingsData.payment_config,
                          bank_code: e.target.value
                        })
                      }
                      className={ADMIN_INPUT}
                      placeholder="MB, VCB, BIDV... (tùy chọn)"
                    />
                  </FormField>
                  <FormField label="Số tài khoản">
                    <Input
                      type="text"
                      value={settingsData.payment_config?.account_number || ''}
                      onChange={(e) =>
                        handleSettingsChange('payment_config', {
                          ...settingsData.payment_config,
                          account_number: e.target.value
                        })
                      }
                      className={ADMIN_INPUT}
                      placeholder="0123456789"
                    />
                  </FormField>
                  <FormField label="Chủ tài khoản">
                    <Input
                      type="text"
                      value={settingsData.payment_config?.account_name || ''}
                      onChange={(e) =>
                        handleSettingsChange('payment_config', {
                          ...settingsData.payment_config,
                          account_name: e.target.value
                        })
                      }
                      className={ADMIN_INPUT}
                      placeholder="NGUYEN VAN A"
                    />
                  </FormField>
                </div>
              </FormSection>
            </div>

            {/* SECTION 4: LEGAL INFO */}
            <div id="branch_section_legal" className="scroll-mt-14">
              <FormSection title="Thông tin pháp lý" icon={<Building2 className="h-4 w-4 text-purple-600" />}>
                <div className="mb-3 flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addExtraInfo}
                    className="h-8 rounded-xl border-purple-200 text-xs font-semibold text-purple-600 hover:bg-purple-50"
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" /> Thêm thông tin
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                  {settingsData.extra_info?.map((info: any, idx: number) => (
                    <div
                      key={idx}
                      className="group flex items-center gap-3 animate-in fade-in slide-in-from-top-1 duration-200"
                    >
                      <div className="flex-1">
                        <Input
                          type="text"
                          placeholder="Nhãn (vd: Người đại diện)"
                          aria-label="Nhãn thông tin pháp lý"
                          value={info.label}
                          onChange={(e) => updateExtraInfo(idx, 'label', e.target.value)}
                          className={`${ADMIN_INPUT} bg-white`}
                        />
                      </div>
                      <div className="flex-[1.5]">
                        <Input
                          type="text"
                          placeholder="Giá trị..."
                          aria-label="Giá trị thông tin pháp lý"
                          value={info.value}
                          onChange={(e) => updateExtraInfo(idx, 'value', e.target.value)}
                          className={`${ADMIN_INPUT} bg-white`}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeExtraInfo(idx)}
                        aria-label="Xóa dòng thông tin pháp lý"
                        className="h-10 w-10 shrink-0 rounded-xl text-slate-300 transition-colors hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {(!settingsData.extra_info || settingsData.extra_info.length === 0) && (
                    <div className="py-6 text-center">
                      <p className="text-sm italic text-slate-400">
                        Chưa có thông tin pháp lý. Nhấn nút phía trên để thêm.
                      </p>
                    </div>
                  )}
                </div>
              </FormSection>
            </div>

            {/* SECTION 5: STATUS */}
            <div id="branch_section_status" className="scroll-mt-14">
              <FormSection title="Trạng thái" icon={<Info className="h-4 w-4 text-blue-600" />}>
                <div className="flex flex-wrap gap-x-8 gap-y-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="is_default"
                      checked={formData.is_default}
                      onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                      disabled={formData.is_default}
                      className={`h-5 w-5 rounded-lg border-slate-300 text-blue-600 focus:ring-blue-600/20 ${formData.is_default ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                    />
                    <label
                      htmlFor="is_default"
                      className={`text-sm font-semibold ${formData.is_default ? 'text-slate-400' : 'cursor-pointer text-slate-700'}`}
                    >
                      Chi nhánh mặc định {formData.is_default && '(Đang chọn)'}
                    </label>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="is_open"
                      checked={formData.is_open}
                      onChange={(e) => setFormData({ ...formData, is_open: e.target.checked })}
                      className="h-5 w-5 cursor-pointer rounded-lg border-slate-300 text-green-600 focus:ring-green-500/20"
                    />
                    <label htmlFor="is_open" className="cursor-pointer text-sm font-semibold text-green-700">
                      Đang mở cửa
                    </label>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Info className="h-4 w-4 shrink-0 text-blue-400" />
                    <span>
                      Trạng thái kích hoạt: <b>{formData.is_active ? ADMIN_TEXT.active : ADMIN_TEXT.inactive}</b>. Muốn đổi,
                      dùng công tắc trạng thái ở danh sách chi nhánh.
                    </span>
                  </div>
                </div>
              </FormSection>
            </div>
          </div>

        </form>
    </AdminDialog>
  );
}
