import React, { useEffect, useState } from 'react';
import AdminLayout from '@/admin/layouts/AdminLayout';
import TicketsContent from '@/components/admin/content/TicketsContent';
import { getTickets, deleteTicketApi, getAdminBranchOptions, getTicketById } from '@/lib/api';
import { useStaffPermission } from '@/hooks/useStaffPermission';
import { useStaffStore } from '@/store/staffStore';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { ConfirmDeleteDialog } from '@/components/admin/dialogs/ConfirmDeleteDialog';

interface TicketPackage {
  id: number;
  name: string;
  code?: string;
  description?: string;
  price: number;
  features?: string[];
  type?: string;
  combo?: number[];
  movies?: any[];
  min_group_size?: number;
  max_group_size?: number;
  is_member_only?: boolean;
  is_active?: boolean;
  display_order?: number;
  branch_id?: number;
  branch_ids?: number[] | null;
  branch_name?: string;
  cover_image?: string;
  duration_min?: number;
  vr_genre?: string;
  min_players?: number;
  max_players?: number;
  updated_at?: string;
  created_at?: string;
}

export default function TicketsPage() {
  const navigate = useNavigate();
  const staff = useStaffStore((state) => state.staff);
  const clearStaff = useStaffStore((state) => state.clearStaff);

  const getInitialFilters = () => {
    try {
      const raw = localStorage.getItem('admin_tickets_filters');
      if (raw) return JSON.parse(raw);
    } catch {}
    return {};
  };

  const initialFilters = getInitialFilters();

  const [activeTab, setActiveTab] = useState('tickets');
  const [tickets, setTickets] = useState<TicketPackage[]>([]);
  const [page, setPage] = useState(initialFilters.page || 1);
  const pageSize = 10;
  const [total, setTotal] = useState(0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const [typeFilter, setTypeFilter] = useState<'all' | 'movie' | 'vr'>(initialFilters.typeFilter || 'all');
  const [sortKey, setSortKey] = useState<string>(initialFilters.sortKey || 'updated_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(initialFilters.sortDir || 'desc');

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showActiveOnly, setShowActiveOnly] = useState(initialFilters.showActiveOnly ?? true);
  const canViewBranches = useStaffPermission('branches', 'view');
  const [selectedBranchId, setSelectedBranchId] = useState<number | 'all' | null>(() => {
    if (initialFilters.branchId !== undefined) return initialFilters.branchId;
    if (staff?.isSuperAdmin) return 'all';
    return null; // Will be set after branches load
  });
  const [branches, setBranches] = useState<any[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [ticketToDelete, setTicketToDelete] = useState<any>(null);
  const [isCodeEditable, setIsCodeEditable] = useState(false);

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  // Load branches accessible by staff (always, not just canViewBranches)
  useEffect(() => {
    (async () => {
      try {
        const { items } = await getAdminBranchOptions({ includeInactive: true });
        setBranches(items || []);

        // If not superadmin, auto-select first branch when no valid branch is set
        if (!staff?.isSuperAdmin && items && items.length > 0) {
          const hasValidSelection =
            selectedBranchId !== null &&
            selectedBranchId !== 'all' &&
            items.some((b: any) => b.id === selectedBranchId);
          if (!hasValidSelection) {
            setSelectedBranchId(items[0].id);
          }
        }
      } catch (error) {
        console.error('Error loading branches:', error);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff]);

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      const { items, total } = await getTickets({
        page,
        pageSize,
        type: typeFilter,
        includeInactive: !showActiveOnly,
        branch_id: selectedBranchId,
        sort: sortKey,
        dir: sortDir
      });
      setTickets(
        items.map((t: any) => ({
          id: t.id,
          name: t.name,
          code: t.code || undefined,
          description: t.description || undefined,
          price: Number(t.price),
          features: Array.isArray(t.features) ? t.features : [],
          combo: Array.isArray(t.combo) ? t.combo : [],
          movies: Array.isArray(t.movies) ? t.movies : [],
          type: t.type || undefined,
          min_group_size: t.min_group_size ?? undefined,
          max_group_size: t.max_group_size ?? undefined,
          is_member_only: !!t.is_member_only,
          is_active: t.is_active ?? true,
          display_order: t.display_order ?? 0,
          branch_id: t.branch_id || undefined,
          branch_ids: Array.isArray(t.branch_ids) ? t.branch_ids : (t.branch_ids ?? null),
          cover_image: t.cover_image || undefined,
          duration_min: t.duration_min !== null && t.duration_min !== undefined ? Number(t.duration_min) : undefined,
          vr_genre: t.vr_genre || undefined,
          min_players: t.min_players !== null && t.min_players !== undefined ? Number(t.min_players) : undefined,
          max_players: t.max_players !== null && t.max_players !== undefined ? Number(t.max_players) : undefined,
          updated_at: t.updated_at ? new Date(t.updated_at).toISOString() : undefined,
          created_at: t.created_at ? new Date(t.created_at).toISOString() : undefined
        }))
      );
      setTotal(total);
    } catch (error: any) {
      // Show the reason instead of leaving the previous list as if nothing happened
      toast.error('Không tải được danh sách gói vé', { description: error?.message });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    handleRefresh();
  }, [page, showActiveOnly, selectedBranchId, typeFilter, sortKey, sortDir]);

  useEffect(() => {
    try {
      const state = { page, showActiveOnly, branchId: selectedBranchId, typeFilter, sortKey, sortDir };
      localStorage.setItem('admin_tickets_filters', JSON.stringify(state));
    } catch {}
  }, [page, showActiveOnly, selectedBranchId, typeFilter, sortKey, sortDir]);

  const openCreate = () => {
    const defaultType = typeFilter === 'vr' ? 'vr' : 'movie';
    setEditData({ id: 0, name: '', code: generateCode(), price: 0, is_active: true, features: [], type: defaultType });
    setIsCodeEditable(false);
    setIsEditOpen(true);
  };

  const handleClone = (data: any) => {
    setEditData({ ...data, id: 0, code: generateCode(), name: data.name });
    setIsCodeEditable(false);
    setIsEditOpen(true);
  };

  // Orders that use the package being deleted (null while loading). The server refuses to delete a package that has
  // orders, so the dialog says so up front instead of failing after the click.
  const [ticketBookingCount, setTicketBookingCount] = useState<number | null>(null);

  const handleDelete = (ticket: any) => {
    setTicketToDelete(ticket);
    setTicketBookingCount(null);
    setIsDeleteDialogOpen(true);
    getTicketById(ticket.id)
      .then((response: any) => {
        const detail = response?.item ?? response;
        setTicketBookingCount(Number(detail?.booking_count ?? 0));
      })
      .catch(() => setTicketBookingCount(0));
  };

  const confirmDelete = async () => {
    if (!ticketToDelete) return;
    try {
      await deleteTicketApi(ticketToDelete.id);
      toast.success('Xóa gói vé thành công');
      setIsDeleteDialogOpen(false);
      setTicketToDelete(null);
      handleRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Xóa gói vé thất bại');
    }
  };

  const openEdit = (data: any) => {
    setEditData({ ...data });
    setIsCodeEditable(false);
    setIsEditOpen(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('staffToken');
    clearStaff();
    navigate('/login');
  };

  return (
    <AdminLayout
      active={activeTab as any}
      setActive={setActiveTab as any}
      adminEmailState={staff?.email || 'admin@email.com'}
      handleLogout={handleLogout}
    >
      <TicketsContent
        data={tickets}
        totalPages={totalPages}
        currentPage={page}
        setPage={setPage}
        onCreate={openCreate}
        onEdit={(data) => openEdit(data)}
        onClone={(data) => handleClone(data)}
        setTickets={setTickets}
        isEditOpen={isEditOpen}
        setIsEditOpen={setIsEditOpen}
        editData={editData}
        setEditData={setEditData}
        onRefresh={handleRefresh}
        deleteTicketApi={deleteTicketApi as any}
        isLoading={isLoading}
        branches={branches}
        onDelete={handleDelete}
        selectedBranchId={selectedBranchId}
        setSelectedBranchId={setSelectedBranchId}
        showActiveOnly={showActiveOnly}
        setShowActiveOnly={setShowActiveOnly}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        isCodeEditable={isCodeEditable}
        setIsCodeEditable={setIsCodeEditable}
        sortKey={sortKey}
        sortDir={sortDir}
        setSortKey={setSortKey}
        setSortDir={setSortDir}
      />
      <ConfirmDeleteDialog
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        description={
          <div className="space-y-2">
            <p>Bạn có chắc chắn muốn xóa gói vé "{ticketToDelete?.name}"?</p>
            {ticketBookingCount === null && <p className="text-slate-400">Đang kiểm tra số đơn đang dùng gói này...</p>}
            {ticketBookingCount !== null && ticketBookingCount > 0 && (
              <p className="rounded-lg border border-red-200 bg-red-50 p-3 font-medium text-red-700">
                Gói này đang có {ticketBookingCount} đơn đặt nên không thể xóa. Hãy tắt gói (chuyển sang "Ngừng hoạt động")
                để khách không mua được nữa.
              </p>
            )}
            {ticketBookingCount === 0 && (
              <p>Gói chưa có đơn nào. Sau khi xóa, gói nằm trong danh sách đã xóa và có thể khôi phục.</p>
            )}
          </div>
        }
        confirmDisabled={ticketBookingCount === null || ticketBookingCount > 0}
        onConfirm={confirmDelete}
      />
    </AdminLayout>
  );
}
