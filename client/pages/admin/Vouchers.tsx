import React, { useEffect, useState } from 'react';
import AdminLayout from '@/admin/layouts/AdminLayout';
import VouchersContent from '@/components/admin/content/VouchersContent';
import {
        listVouchersApi,
        deleteVoucherApi,
        restoreVoucherApi,
        getAdminBranchOptions,
        type VoucherListFilters
} from '@/lib/api';
import { useStaffPermission } from '@/hooks/useStaffPermission';
import { useStaffStore } from '@/store/staffStore';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface VoucherItem {
        id: number;
        code: string;
        name: string;
        description?: string;
        scope?: string;
        discount_type: 'percent' | 'fixed';
        discount_value: number;
        max_discount?: number | null;
        min_order_value?: number | null;
        usage_limit?: number | null;
        per_user_limit?: number;
        used_count?: number;
        redemption_total_count?: number;
        valid_from?: string | null;
        valid_until?: string | null;
        applicable_ticket_package_ids?: number[] | null;
        excluded_ticket_package_ids?: number[] | null;
        applicable_user_ids?: number[] | null;
        branch_ids?: number[] | null;
        is_active?: boolean;
        is_deleted?: boolean;
        deleted_at?: string | null;
        created_at?: string;
        updated_at?: string;
        created_by_staff_name?: string;
        updated_by_staff_name?: string;
        recent_redemptions?: any[];
}

const generateRandomCode = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let s = '';
        for (let i = 0; i < 6; i++) {
                s += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return s;
};

export default function VouchersPage() {
        const navigate = useNavigate();
        const staff = useStaffStore((state) => state.staff);
        const clearStaff = useStaffStore((state) => state.clearStaff);

        const getInitialFilters = () => {
                try {
                        const raw = localStorage.getItem('admin_vouchers_filters');
                        if (raw) return JSON.parse(raw);
                } catch { }
                return {};
        };

        const initialFilters = getInitialFilters();

        const [activeTab, setActiveTab] = useState('vouchers');
        const [vouchers, setVouchers] = useState<VoucherItem[]>([]);
        const [page, setPage] = useState(initialFilters.page || 1);
        const pageSize = 10;
        const [total, setTotal] = useState(0);
        const totalPages = Math.max(1, Math.ceil(total / pageSize));

        const [scopeFilter, setScopeFilter] = useState<VoucherListFilters['scope']>(
                initialFilters.scopeFilter || 'vr'
        );
        const [searchText, setSearchText] = useState<string>(initialFilters.searchText || '');
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

        useEffect(() => {
                if (!canViewBranches) {
                        setBranches([]);
                        return;
                }
                (async () => {
                        try {
                                const { items } = await getAdminBranchOptions({ includeInactive: true });
                                setBranches(items);
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
                try {
                        const { items, total } = await listVouchersApi({
                                page,
                                pageSize,
                                q: searchText || undefined,
                                scope: scopeFilter,
                                is_active: showActiveOnly ? 'true' : 'all',
                                branch_id: (selectedBranchId as any) === 'all' || !selectedBranchId
                                        ? undefined
                                        : (selectedBranchId as any)
                        });
                        setVouchers(items || []);
                        setTotal(total ?? 0);
                } catch (err: any) {
                        toast.error(err.message || 'Không thể tải danh sách voucher');
                } finally {
                        setIsLoading(false);
                }
        };

        useEffect(() => {
                handleRefresh();
        }, [page, showActiveOnly, selectedBranchId, scopeFilter, searchText]);

        useEffect(() => {
                try {
                        const state = {
                                page,
                                showActiveOnly,
                                branchId: selectedBranchId,
                                scopeFilter,
                                searchText
                        };
                        localStorage.setItem('admin_vouchers_filters', JSON.stringify(state));
                } catch { }
        }, [page, showActiveOnly, selectedBranchId, scopeFilter, searchText]);

        const openCreate = () => {
                setEditData({
                        id: 0,
                        code: generateRandomCode(),
                        name: '',
                        description: '',
                        scope: scopeFilter === 'all' ? 'vr' : scopeFilter,
                        discount_type: 'percent',
                        discount_value: 10,
                        max_discount: null,
                        min_order_value: 0,
                        usage_limit: null,
                        per_user_limit: 1,
                        valid_from: null,
                        valid_until: null,
                        applicable_ticket_package_ids: [],
                        excluded_ticket_package_ids: [],
                        branch_ids: null,
                        is_active: true
                });
                setIsEditOpen(true);
        };

        const openEdit = (voucher: VoucherItem) => {
                setEditData({ ...voucher });
                setIsEditOpen(true);
        };

        const handleDelete = (voucher: VoucherItem) => {
                deleteVoucherApi(voucher.id)
                        .then(() => {
                                toast.success('Xóa voucher thành công');
                                handleRefresh();
                        })
                        .catch((err) => toast.error(err.message || 'Xóa thất bại'));
        };

        const handleRestore = (voucher: VoucherItem) => {
                restoreVoucherApi(voucher.id)
                        .then(() => {
                                toast.success('Phục hồi voucher thành công');
                                handleRefresh();
                        })
                        .catch((err) => toast.error(err.message || 'Phục hồi thất bại'));
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
                        <VouchersContent
                                data={vouchers}
                                totalPages={totalPages}
                                currentPage={page}
                                setPage={setPage}
                                onCreate={openCreate}
                                onEdit={(data) => openEdit(data)}
                                onRefresh={handleRefresh}
                                setVouchers={setVouchers}
                                isEditOpen={isEditOpen}
                                setIsEditOpen={setIsEditOpen}
                                editData={editData}
                                setEditData={setEditData}
                                deleteVoucherApi={deleteVoucherApi as any}
                                restoreVoucherApi={restoreVoucherApi as any}
                                isLoading={isLoading}
                                showActiveOnly={showActiveOnly}
                                setShowActiveOnly={setShowActiveOnly}
                                scopeFilter={scopeFilter}
                                setScopeFilter={setScopeFilter}
                                branches={branches}
                                selectedBranchId={selectedBranchId}
                                setSelectedBranchId={setSelectedBranchId}
                                searchText={searchText}
                                setSearchText={(s) => { setSearchText(s); setPage(1); }}
                                isDeletedView={false}
                                onDelete={handleDelete}
                                onRestore={handleRestore}
                        />
                </AdminLayout>
        );
}
