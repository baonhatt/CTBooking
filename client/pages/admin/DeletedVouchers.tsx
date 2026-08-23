import React, { useEffect, useState } from 'react';
import AdminLayout from '@/admin/layouts/AdminLayout';
import VouchersContent from '@/components/admin/content/VouchersContent';
import {
        listDeletedVouchersApi,
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

export default function DeletedVouchersPage() {
        const navigate = useNavigate();
        const staff = useStaffStore((state) => state.staff);
        const clearStaff = useStaffStore((state) => state.clearStaff);

        const [activeTab, setActiveTab] = useState('deleted-vouchers');
        const [vouchers, setVouchers] = useState<VoucherItem[]>([]);
        const [page, setPage] = useState(1);
        const pageSize = 10;
        const [total, setTotal] = useState(0);
        const totalPages = Math.max(1, Math.ceil(total / pageSize));

        const [scopeFilter, setScopeFilter] = useState<VoucherListFilters['scope']>('vr');
        const [searchText, setSearchText] = useState('');
        const [isEditOpen, setIsEditOpen] = useState(false);
        const [editData, setEditData] = useState<any>(null);
        const [isLoading, setIsLoading] = useState(false);
        const [showActiveOnly, setShowActiveOnly] = useState(false);
        const canViewBranches = useStaffPermission('branches', 'view');
        const [selectedBranchId, setSelectedBranchId] = useState<number | 'all' | null>(() => {
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
                        const { items, total } = await listDeletedVouchersApi({
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
                        toast.error(err.message || 'Không thể tải thùng rác voucher');
                } finally {
                        setIsLoading(false);
                }
        };

        useEffect(() => {
                handleRefresh();
        }, [page, showActiveOnly, selectedBranchId, scopeFilter, searchText]);

        const openEdit = (voucher: VoucherItem) => {
                setEditData({ ...voucher });
                setIsEditOpen(true);
        };

        const handleDelete = () => {}; // Không cho xóa cứng trong view deleted
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
                                onCreate={() => navigate('/admin/vouchers')}
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
                                isDeletedView={true}
                                onDelete={handleDelete}
                                onRestore={handleRestore}
                        />
                </AdminLayout>
        );
}
