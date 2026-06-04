import React, { useEffect, useState } from 'react';
import AdminLayout from '@/admin/layouts/AdminLayout';
import TicketsContent from '@/components/admin/content/TicketsContent';
import { getTickets, deleteTicketApi, getBranches } from '@/lib/api';
import { useStaffPermission } from '@/hooks/useStaffPermission';
import { useStaffStore } from '@/store/staffStore';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface TicketPackage {
        id: number;
        name: string;
        code?: string;
        description?: string;
        price: number;
        features?: string[];
        type?: string;
        min_group_size?: number;
        max_group_size?: number;
        is_member_only?: boolean;
        is_active?: boolean;
        display_order?: number;
        branch_id?: number;
        branch_name?: string;
        updated_at?: string;
}

export default function TicketsPage() {
        const navigate = useNavigate();
        const staff = useStaffStore((state) => state.staff);
        const clearStaff = useStaffStore((state) => state.clearStaff);

        const getInitialFilters = () => {
                try {
                        const raw = localStorage.getItem('admin_tickets_filters');
                        if (raw) return JSON.parse(raw);
                } catch { }
                return {};
        };

        const initialFilters = getInitialFilters();

        const [activeTab, setActiveTab] = useState('tickets');
        const [tickets, setTickets] = useState<TicketPackage[]>([]);
        const [page, setPage] = useState(initialFilters.page || 1);
        const pageSize = 10;
        const [total, setTotal] = useState(0);
        const totalPages = Math.max(1, Math.ceil(total / pageSize));

        const [isEditOpen, setIsEditOpen] = useState(false);
        const [editData, setEditData] = useState<any>(null);
        const [isLoading, setIsLoading] = useState(false);
        const [showActiveOnly, setShowActiveOnly] = useState(initialFilters.showActiveOnly ?? true);
        const canViewBranches = useStaffPermission('branches', 'view');
        const [selectedBranchId, setSelectedBranchId] = useState<number | 'all' | null>(() => {
                if (initialFilters.branchId !== undefined) return initialFilters.branchId;
                if (staff?.isSuperAdmin) return 'all';
                return null;
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

        // Load branches only when branch viewing is allowed
        useEffect(() => {
                if (!canViewBranches) {
                        setBranches([]);
                        return;
                }

                (async () => {
                        try {
                                const { items } = await getBranches({ includeInactive: true });
                                setBranches(items);

                                // If not superadmin and no branch selected, default to first branch
                                if (!staff?.isSuperAdmin && selectedBranchId === null && items.length > 0) {
                                        setSelectedBranchId(items[0].id);
                                }
                        } catch (error) {
                                console.error('Error loading branches:', error);
                        }
                })();
        }, [staff, canViewBranches, selectedBranchId]);

        const handleRefresh = async () => {
                setIsLoading(true);
                const { items, total } = await getTickets({
                        page,
                        pageSize,
                        includeInactive: !showActiveOnly,
                        branch_id: selectedBranchId
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
                                updated_at: t.updated_at ? new Date(t.updated_at).toISOString() : undefined
                        }))
                );
                setTotal(total);
                setIsLoading(false);
        };

        useEffect(() => {
                handleRefresh();
        }, [page, showActiveOnly, selectedBranchId]);

        useEffect(() => {
                try {
                        const state = { page, showActiveOnly, branchId: selectedBranchId };
                        localStorage.setItem('admin_tickets_filters', JSON.stringify(state));
                } catch { }
        }, [page, showActiveOnly, selectedBranchId]);

        const openCreate = () => {
                setEditData({ id: 0, name: '', code: generateCode(), price: 0, is_active: true, features: [] });
                setIsCodeEditable(false);
                setIsEditOpen(true);
        };

        const handleDelete = (ticket: any) => {
                setTicketToDelete(ticket);
                setIsDeleteDialogOpen(true);
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
                                isCodeEditable={isCodeEditable}
                                setIsCodeEditable={setIsCodeEditable}
                        />
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
                                                Bạn có chắc chắn muốn xóa gói vé "{ticketToDelete?.name}"? Hành động này không thể hoàn tác.
                                        </p>
                                        <DialogFooter>
                                                <Button variant="ghost" onClick={() => setIsDeleteDialogOpen(false)} className="text-slate-500 hover:bg-slate-100">
                                                        Hủy
                                                </Button>
                                                <Button onClick={confirmDelete} className="bg-red-600 hover:bg-red-700 min-w-[140px] rounded-xl shadow-lg shadow-red-500/20 transition-all active:scale-95">
                                                        Xóa
                                                </Button>
                                        </DialogFooter>
                                </DialogContent>
                        </Dialog>
                </AdminLayout>
        );
}
