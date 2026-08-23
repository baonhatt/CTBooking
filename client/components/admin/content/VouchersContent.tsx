import React, { useState, useEffect } from 'react';
import {
    Ticket as TicketIcon,
    RefreshCw,
    Pencil,
    Trash2,
    Plus,
    Eye,
    X,
    Percent,
    CircleDollarSign,
    CalendarDays,
    Sparkles,
    Gamepad2,
    Film,
    ToggleLeft,
    ToggleRight,
    Tag,
    RotateCcw,
    Loader2,
    Search,
    FilterX
} from 'lucide-react';
import { format, formatDistanceToNow, isAfter, isBefore } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious
} from '@/components/ui/pagination';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { XCircle, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BranchMultiSelect } from '@/components/admin/BranchMultiSelect';
import { BranchIdsBadge } from '@/components/admin/BranchIdsBadge';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import {
    createVoucherApi,
    updateVoucherApi,
    toggleVoucherStatusApi,
    listVRTicketPackagesForVoucher,
    getAdminBranchOptions,
    listStaffOptionsApi,
    type VoucherListFilters
} from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { useStaffPermissions, useIsSuperAdmin } from '@/hooks/useStaffPermission';

interface VoucherItem {
    id: number;
    code: string;
    name: string;
    description?: string;
    note?: string;
    sale_staff_id?: number | null;
    sale_name?: string | null;
    sale_email?: string | null;
    total_revenue?: number;
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
    created_by_staff_id?: number | null;
    updated_by_staff_id?: number | null;
    created_by_staff_name?: string;
    updated_by_staff_name?: string;
    recent_redemptions?: any[];
}

interface Props {
    data: VoucherItem[];
    totalPages: number;
    currentPage: number;
    setPage: React.Dispatch<React.SetStateAction<number>>;
    onCreate: () => void;
    onEdit: (v: VoucherItem) => void;
    onRefresh: () => Promise<void>;
    setVouchers: React.Dispatch<React.SetStateAction<VoucherItem[]>>;
    isEditOpen: boolean;
    setIsEditOpen: (open: boolean) => void;
    editData: any;
    setEditData: (d: any) => void;
    deleteVoucherApi: (id: number) => Promise<any>;
    restoreVoucherApi?: (id: number) => Promise<any>;
    isLoading?: boolean;
    showActiveOnly: boolean;
    setShowActiveOnly: (v: boolean) => void;
    scopeFilter: VoucherListFilters['scope'];
    setScopeFilter: (v: VoucherListFilters['scope']) => void;
    branches?: any[];
    selectedBranchId?: number | 'all' | null;
    setSelectedBranchId?: (id: number | 'all' | null) => void;
    selectedSaleId?: string | number;
    setSelectedSaleId?: (id: string | number) => void;
    searchText: string;
    setSearchText: (s: string) => void;
    isDeletedView?: boolean;
    onDelete?: (v: VoucherItem) => void;
    onRestore?: (v: VoucherItem) => void;
}

const generateRandomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let s = '';
    for (let i = 0; i < 6; i++) {
        s += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return s;
};

export default function VouchersContent(props: Props) {
    const navigate = useNavigate();
    const permissions = useStaffPermissions();
    const isSuperAdmin = useIsSuperAdmin();

    const hasPermission = (module: string, action: string) => {
        if (isSuperAdmin) return true;
        return permissions.some((p) => p.module === module && p.action === action);
    };

    const {
        data,
        totalPages,
        currentPage,
        setPage,
        onCreate,
        onEdit,
        onRefresh,
        isEditOpen,
        setIsEditOpen,
        editData,
        setEditData,
        deleteVoucherApi,
        restoreVoucherApi,
        showActiveOnly,
        setShowActiveOnly,
        scopeFilter,
        setScopeFilter,
        branches = [],
        selectedBranchId = null,
        setSelectedBranchId = () => {},
        selectedSaleId = 'all',
        setSelectedSaleId = () => {},
        searchText,
        setSearchText,
        isDeletedView = false,
        onDelete,
        onRestore
    } = props;
    const { isLoading = false } = props as any;

    const [isDeletingId, setIsDeletingId] = useState<number | null>(null);
    const [isRestoringId, setIsRestoringId] = useState<number | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isTogglingId, setIsTogglingId] = useState<number | null>(null);
    const [vrPackages, setVrPackages] = useState<any[]>([]);
    const [branchOptions, setBranchOptions] = useState<any[]>([]);
    const [staffList, setStaffList] = useState<Array<{ id: number; fullname: string; email: string }>>([]);
    const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
    const [selectedVoucher, setSelectedVoucher] = useState<VoucherItem | null>(null);
    const [localSearchText, setLocalSearchText] = useState(searchText);
    const [voucherToToggle, setVoucherToToggle] = useState<{ id: number; currentStatus: boolean } | null>(null);

    useEffect(() => {
        listStaffOptionsApi().then((res) => {
            if (res?.items && Array.isArray(res.items)) {
                setStaffList(res.items.map((s: any) => ({
                    id: s.id,
                    fullname: s.fullname || s.email,
                    email: s.email
                })));
            }
        }).catch(() => {});
    }, []);

    useEffect(() => {
        setLocalSearchText(searchText);
    }, [searchText]);

    const handleSearchSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setSearchText(localSearchText);
        setPage(1);
    };

    useEffect(() => {
        if (isEditOpen) {
            const scope = editData?.scope || 'vr';
            const branchIds = editData?.branch_ids;
            const isSingleBranch = Array.isArray(branchIds) && branchIds.length === 1;
            const isMultiBranch = Array.isArray(branchIds) && branchIds.length > 1;
            const branchFilter = isSingleBranch
                ? { branch_id: branchIds[0] }
                : undefined;
            listVRTicketPackagesForVoucher(scope, branchFilter).then((res) => {
                let packages = res.items || [];
                if (isMultiBranch) {
                    const allowedIds = new Set(branchIds as number[]);
                    packages = packages.filter((pkg: any) => {
                        const noBranchConfig =
                            (pkg.branch_id === undefined || pkg.branch_id === null) &&
                            (pkg.branch_ids === undefined ||
                                pkg.branch_ids === null ||
                                (Array.isArray(pkg.branch_ids) && pkg.branch_ids.length === 0) ||
                                pkg.branch_ids === '[]');
                        if (noBranchConfig) return true;
                        if (typeof pkg.branch_id === 'number' && allowedIds.has(pkg.branch_id)) {
                            return true;
                        }
                        let pkgBranchArr: number[] = [];
                        if (Array.isArray(pkg.branch_ids)) {
                            pkgBranchArr = pkg.branch_ids;
                        } else if (typeof pkg.branch_ids === 'string' && pkg.branch_ids.trim().length > 0) {
                            try {
                                const parsed = JSON.parse(pkg.branch_ids);
                                if (Array.isArray(parsed)) pkgBranchArr = parsed;
                            } catch {}
                        }
                        if (pkgBranchArr.length === 0 && (pkg.branch_id === undefined || pkg.branch_id === null)) {
                            return true;
                        }
                        return pkgBranchArr.some((id) => allowedIds.has(Number(id)));
                    });
                }
                setVrPackages(packages);
            }).catch(() => {});
            getAdminBranchOptions({ includeInactive: true }).then((res) => {
                setBranchOptions(res.items || []);
            }).catch(() => {});
        }
    }, [isEditOpen, editData?.scope, JSON.stringify(editData?.branch_ids)]);

    const handleToggleStatus = async (id: number, currentStatus: boolean) => {
        setIsTogglingId(id);
        try {
            await toggleVoucherStatusApi(id);
            toast.success(!currentStatus ? 'Đã bật voucher' : 'Đã ẩn voucher');
            setVoucherToToggle(null);
            onRefresh();
        } catch (err: any) {
            toast.error(err.message || 'Lỗi khi thay đổi trạng thái');
        } finally {
            setIsTogglingId(null);
        }
    };

    const handleDeleteConfirm = async (voucher: VoucherItem) => {
        setIsDeletingId(voucher.id);
        try {
            await deleteVoucherApi(voucher.id);
            toast.success('Xóa voucher thành công');
            onRefresh();
        } catch (err: any) {
            toast.error(err.message || 'Xóa voucher thất bại');
        } finally {
            setIsDeletingId(null);
        }
    };

    const handleRestore = async (voucher: VoucherItem) => {
        if (!restoreVoucherApi) return;
        setIsRestoringId(voucher.id);
        try {
            await restoreVoucherApi(voucher.id);
            toast.success('Phục hồi voucher thành công');
            onRefresh();
        } catch (err: any) {
            toast.error(err.message || 'Phục hồi thất bại');
        } finally {
            setIsRestoringId(null);
        }
    };

    const handleSave = async () => {
        if (!editData) return;
        const payload = { ...editData };
        if (!payload.code || payload.code.trim() === '') {
            toast.error('Vui lòng nhập mã voucher');
            return;
        }
        if (!payload.name || payload.name.trim() === '') {
            toast.error('Vui lòng nhập tên chương trình');
            return;
        }
        if (!['percent', 'fixed'].includes(payload.discount_type)) {
            toast.error('Loại giảm giá không hợp lệ');
            return;
        }
        const value = Number(payload.discount_value);
        if (isNaN(value) || value <= 0) {
            toast.error('Giá trị giảm giá phải lớn hơn 0');
            return;
        }
        if (payload.discount_type === 'percent' && (value < 1 || value > 100)) {
            toast.error('Phần trăm giảm giá phải từ 1 đến 100');
            return;
        }
        payload.code = payload.code.toUpperCase().trim();
        payload.scope = editData.scope || 'all';
        payload.discount_value = value;
        payload.sale_staff_id = editData.sale_staff_id ? Number(editData.sale_staff_id) : null;
        payload.sale_name = editData.sale_name || null;
        payload.sale_email = editData.sale_email || null;
        payload.note = editData.note || editData.description || '';
        payload.max_discount =
            payload.discount_type === 'percent' && payload.max_discount
                ? Number(payload.max_discount)
                : payload.max_discount
                    ? Number(payload.max_discount)
                    : null;
        payload.min_order_value = payload.min_order_value
            ? Number(payload.min_order_value)
            : 0;
        payload.usage_limit = payload.usage_limit ? Number(payload.usage_limit) : null;
        payload.per_user_limit = payload.per_user_limit ? Number(payload.per_user_limit) : 1;
        payload.is_active = !!payload.is_active;
        payload.applicable_ticket_package_ids =
            Array.isArray(payload.applicable_ticket_package_ids) &&
            payload.applicable_ticket_package_ids.length > 0
                ? payload.applicable_ticket_package_ids
                : null;
        payload.excluded_ticket_package_ids =
            Array.isArray(payload.excluded_ticket_package_ids) &&
            payload.excluded_ticket_package_ids.length > 0
                ? payload.excluded_ticket_package_ids
                : null;

        setIsSaving(true);
        try {
            if (editData.id && editData.id > 0) {
                await updateVoucherApi(editData.id, payload);
                toast.success('Cập nhật voucher thành công');
            } else {
                await createVoucherApi(payload);
                toast.success('Tạo voucher thành công');
            }
            setIsEditOpen(false);
            setEditData(null);
            onRefresh();
        } catch (err: any) {
            toast.error(err.message || 'Lưu voucher thất bại');
        } finally {
            setIsSaving(false);
        }
    };

    const formatMoney = (n: number | null | undefined) => {
        if (n === null || n === undefined || isNaN(Number(n))) return '0₫';
        return Number(n).toLocaleString('vi-VN') + '₫';
    };

    const isExpired = (v: VoucherItem) => {
        if (!v.valid_until) return false;
        return isAfter(new Date(), new Date(v.valid_until));
    };

    const isFuture = (v: VoucherItem) => {
        if (!v.valid_from) return false;
        return isBefore(new Date(), new Date(v.valid_from));
    };

    return (
        <div className="space-y-6 font-sans">
            {/* HEADER + TOOLBAR CARD (gộp 1 khối theo chuẩn Transactions) */}
            <div className="flex flex-col gap-4 bg-white p-6 rounded-2xl border shadow-sm">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex flex-col gap-1">
                        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            {isDeletedView ? (
                                <Trash2 className="w-5 h-5 text-rose-500" />
                            ) : (
                                <Tag className="w-5 h-5 text-purple-600" />
                            )}
                            {isDeletedView ? 'Vouchers đã xóa' : 'Quản lý Vouchers (Ưu đãi)'}
                            <Badge
                                variant="secondary"
                                className="rounded-full bg-slate-100 text-slate-600 px-2 py-0 h-5 text-[10px] font-bold"
                            >
                                {data.length}
                            </Badge>
                        </h3>
                        <p className="text-xs text-slate-500">
                            {isDeletedView
                                ? 'Xem và phục hồi các voucher đã chuyển vào thùng rác.'
                                : 'Quản lý mã ưu đãi, giảm giá áp dụng cho VR, Phim hoặc Tất cả dịch vụ.'}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                        {!isDeletedView && (
                            <Button
                                variant="outline"
                                size="icon"
                                className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-100 w-11 h-11 rounded-xl transition-all shadow-sm shrink-0"
                                title="Đặt lại bộ lọc"
                                onClick={() => {
                                    setLocalSearchText('');
                                    setSearchText('');
                                    setScopeFilter('vr');
                                    setShowActiveOnly(true);
                                    setPage(1);
                                    toast.info('Đã đặt lại bộ lọc');
                                }}
                            >
                                <FilterX size={18} />
                            </Button>
                        )}
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={onRefresh}
                            className="rounded-xl shadow-sm hover:rotate-180 transition-transform duration-500 shrink-0 h-11 w-11"
                            title="Làm mới"
                        >
                            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                </div>

                <div className="h-px bg-slate-100 my-0.5" />

                {/* Row 1: Search + (Scope Pills + Active Switch) */}
                <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Search Form */}
                        <form
                            onSubmit={handleSearchSubmit}
                            className="flex flex-1 min-w-[300px] max-w-lg gap-2"
                        >
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <Input
                                    placeholder="Tìm mã voucher hoặc tên chương trình..."
                                    value={localSearchText}
                                    onChange={(e) => setLocalSearchText(e.target.value)}
                                    className="pl-10 pr-9 h-11 bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-blue-500 rounded-xl transition-all"
                                />
                                {localSearchText && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setLocalSearchText('');
                                            setSearchText('');
                                            setPage(1);
                                        }}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200/70 transition-colors"
                                        title="Xóa tìm kiếm"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                            <Button
                                type="submit"
                                className="h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold px-4 flex items-center gap-1.5 shrink-0"
                            >
                                <Search className="w-4 h-4" /> Tìm kiếm
                            </Button>
                        </form>

                        <div className="flex flex-wrap items-center gap-2">
                            {/* Scope Pills (theo chuẩn Transactions: shadow active) */}
                            <div className="flex items-center gap-1 p-1 bg-slate-50 rounded-xl border border-slate-200 h-11">
                                <button
                                    type="button"
                                    onClick={() => { setScopeFilter('all'); setPage(1); }}
                                    className={`px-3 h-8 rounded-lg text-xs font-bold transition-all ${
                                        scopeFilter === 'all'
                                            ? 'bg-slate-800 text-white shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700 hover:bg-white'
                                    }`}
                                >
                                    Tất cả
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setScopeFilter('vr'); setPage(1); }}
                                    className={`px-3 h-8 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                                        scopeFilter === 'vr'
                                            ? 'bg-purple-600 text-white shadow-sm shadow-purple-200'
                                            : 'text-slate-500 hover:text-purple-600 hover:bg-white'
                                    }`}
                                >
                                    <Gamepad2 size={12} /> Chỉ VR
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setScopeFilter('movie'); setPage(1); }}
                                    className={`px-3 h-8 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                                        scopeFilter === 'movie'
                                            ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                                            : 'text-slate-500 hover:text-blue-600 hover:bg-white'
                                    }`}
                                >
                                    <Film size={12} /> Chỉ Phim
                                </button>
                            </div>

                            {!isDeletedView && (
                                <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-xl border border-slate-200 h-11">
                                    <ToggleRight size={14} className="text-slate-400" />
                                    <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
                                        Chỉ voucher đang bật
                                    </span>
                                    <Switch
                                        checked={showActiveOnly}
                                        onCheckedChange={setShowActiveOnly}
                                        className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-slate-300 cursor-pointer"
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Row 2: Branch select + Sale select + Action buttons (Refresh, Trash, Create) */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-3">
                            {branches.length > 0 ? (
                                <div className="flex items-center gap-2 pl-3 pr-1 py-1.5 bg-slate-50 rounded-xl border border-slate-200 h-11">
                                    <Tag size={14} className="text-slate-400" />
                                    <Select
                                        value={String(selectedBranchId ?? 'all')}
                                        onValueChange={(val) => {
                                            setSelectedBranchId(val === 'all' ? 'all' : Number(val));
                                            setPage(1);
                                        }}
                                    >
                                        <SelectTrigger className="h-8 w-full sm:w-[190px] border-0 bg-transparent shadow-none p-0 focus:ring-0 text-xs text-slate-600">
                                            <SelectValue placeholder="Chi nhánh" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl border-slate-200">
                                            <SelectItem value="all">🌐 Tất cả chi nhánh</SelectItem>
                                            {branches.map((b) => (
                                                <SelectItem key={b.id} value={String(b.id)}>🏬 {b.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 h-11 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-500">
                                    <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                                    <span>Đang tải chi nhánh...</span>
                                </div>
                            )}

                            {/* Sale filter */}
                            {staffList.length > 0 && (
                                <div className="flex items-center gap-2 pl-3 pr-1 py-1.5 bg-slate-50 rounded-xl border border-slate-200 h-11">
                                    <span className="text-xs">👤</span>
                                    <Select
                                        value={String(selectedSaleId ?? 'all')}
                                        onValueChange={(val) => {
                                            setSelectedSaleId(val);
                                            setPage(1);
                                        }}
                                    >
                                        <SelectTrigger className="h-8 w-full sm:w-[180px] border-0 bg-transparent shadow-none p-0 focus:ring-0 text-xs text-slate-600">
                                            <SelectValue placeholder="Tất cả Sale" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl border-slate-200">
                                            <SelectItem value="all">👤 Tất cả Sale</SelectItem>
                                            {staffList.map((st) => (
                                                <SelectItem key={st.id} value={String(st.id)}>
                                                    {st.fullname}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            {!isDeletedView && hasPermission('vouchers', 'view_deleted') && (
                                <Button
                                    variant="outline"
                                    onClick={() => navigate('/deleted/vouchers')}
                                    className="h-11 rounded-xl flex items-center gap-2 px-4 shadow-sm border-slate-200"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    <span className="hidden sm:inline text-sm text-slate-600 font-medium">Xem đã xóa</span>
                                </Button>
                            )}
                            {isDeletedView && (
                                <Button
                                    variant="outline"
                                    onClick={() => navigate('/vouchers')}
                                    className="h-11 rounded-xl flex items-center gap-2 px-4 shadow-sm border-slate-200"
                                >
                                    <RotateCcw className="w-4 h-4" />
                                    <span className="text-sm font-medium">Về danh sách</span>
                                </Button>
                            )}
                            {!isDeletedView && hasPermission('vouchers', 'create') && (
                                <Button
                                    onClick={onCreate}
                                    className={`h-11 rounded-xl shadow-sm gap-2 text-white px-5 font-medium whitespace-nowrap ${
                                        scopeFilter === 'movie'
                                            ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
                                            : scopeFilter === 'all'
                                                ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
                                                : 'bg-purple-600 hover:bg-purple-700 shadow-purple-200'
                                    }`}
                                >
                                    <Plus className="w-4 h-4" />
                                    {scopeFilter === 'movie'
                                        ? 'Thêm voucher Phim'
                                        : scopeFilter === 'all'
                                            ? 'Thêm voucher'
                                            : 'Thêm voucher VR'}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* TABLE */}
            <Card className="border border-gray-200 rounded-xl shadow-sm bg-white">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-sky-50/80 border-b border-sky-100">
                            <TableRow className="hover:bg-transparent border-none">
                                <TableHead className="text-xs font-bold text-sky-900 uppercase py-3.5">
                                    Mã voucher
                                </TableHead>
                                <TableHead className="text-xs font-bold text-sky-900 uppercase py-3.5">
                                    Tên chương trình
                                </TableHead>
                                <TableHead className="text-xs font-bold text-sky-900 uppercase py-3.5">
                                    Sale phụ trách
                                </TableHead>
                                <TableHead className="text-xs font-bold text-sky-900 uppercase py-3.5">
                                    Giảm giá
                                </TableHead>
                                <TableHead className="text-xs font-bold text-sky-900 uppercase py-3.5">
                                    Đã dùng / Doanh thu
                                </TableHead>
                                <TableHead className="text-xs font-bold text-sky-900 uppercase py-3.5 min-w-[160px]">
                                    Hiệu lực
                                </TableHead>
                                <TableHead className="text-xs font-bold text-sky-900 uppercase py-3.5 min-w-[120px]">
                                    Chi nhánh
                                </TableHead>
                                <TableHead className="text-center text-xs font-bold text-sky-900 uppercase py-3.5">
                                    Trạng thái
                                </TableHead>
                                <TableHead className="text-right text-xs font-bold text-sky-900 uppercase py-3.5 pr-6">
                                    Thao tác
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading
                                ? Array.from({ length: 5 }).map((_, idx) => (
                                    <TableRow key={`sk-${idx}`}>
                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-14 mx-auto rounded-full" /></TableCell>
                                        <TableCell className="text-right"><Skeleton className="h-8 w-28 ml-auto rounded-lg" /></TableCell>
                                    </TableRow>
                                ))
                                : data.length === 0
                                    ? (
                                        <TableRow>
                                            <TableCell colSpan={9} className="py-16 text-center">
                                                <div className="flex flex-col items-center gap-2 text-slate-400">
                                                    <Tag className="w-10 h-10 opacity-40" />
                                                    <p className="text-sm font-medium">
                                                        {isDeletedView
                                                            ? 'Chưa có voucher nào bị xóa'
                                                            : 'Chưa có voucher nào trong hệ thống'}
                                                    </p>
                                                    {!isDeletedView && hasPermission('vouchers', 'create') && (
                                                        <p className="text-xs">Bấm "{scopeFilter === 'movie' ? 'Thêm voucher Phim' : scopeFilter === 'all' ? 'Thêm voucher' : 'Thêm voucher VR'}" để tạo ưu đãi đầu tiên</p>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )
                                    : data.map((v) => {
                                        const expired = isExpired(v);
                                        const future = isFuture(v);
                                        const used = v.used_count ?? v.redemption_total_count ?? 0;
                                        const limit = v.usage_limit;
                                        return (
                                            <TableRow
                                                key={v.id}
                                                className={`group hover:bg-purple-50/40 ${
                                                    expired ? 'opacity-60' : future ? 'opacity-70' : ''
                                                }`}
                                            >
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-purple-100 text-purple-700 border border-purple-200 font-mono font-bold text-xs tracking-wider">
                                                            {v.code}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div>
                                                        <p className="text-sm font-semibold text-slate-800 leading-tight">
                                                            {v.name}
                                                        </p>
                                                        {v.min_order_value && v.min_order_value > 0 ? (
                                                            <p className="text-[11px] text-slate-500 mt-0.5">
                                                                Đơn tối thiểu: <b>{formatMoney(v.min_order_value)}</b>
                                                            </p>
                                                        ) : null}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {v.sale_name ? (
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[11px] font-bold shrink-0">
                                                                {v.sale_name.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-xs font-semibold text-slate-800 truncate">{v.sale_name}</p>
                                                                {v.sale_email && <p className="text-[10px] text-slate-400 truncate">{v.sale_email}</p>}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-400 text-xs italic">Voucher chung</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {v.discount_type === 'percent' ? (
                                                        <Badge variant="outline" className="border-orange-300 bg-orange-50 text-orange-700 text-xs font-bold gap-1">
                                                            <Percent className="w-3 h-3" />
                                                            {v.discount_value}%
                                                            {v.max_discount ? (
                                                                <span className="text-[10px] ml-0.5 opacity-70">
                                                                    /tối đa {formatMoney(v.max_discount)}
                                                                </span>
                                                            ) : null}
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 text-xs font-bold gap-1">
                                                            <CircleDollarSign className="w-3 h-3" />
                                                            {formatMoney(v.discount_value)}
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="text-sm font-medium text-slate-700">
                                                            <span className="text-blue-600 font-bold">{used}</span>
                                                            <span className="text-slate-400 mx-1">/</span>
                                                            <span className={limit ? 'text-slate-700' : 'text-slate-400'}>
                                                                {limit ? Number(limit).toLocaleString() : '∞'}
                                                            </span>
                                                        </span>
                                                        {v.total_revenue !== undefined && v.total_revenue > 0 ? (
                                                            <span className="text-[11px] font-semibold text-emerald-600">
                                                                Thu: {formatMoney(v.total_revenue)}
                                                            </span>
                                                        ) : null}
                                                        {v.per_user_limit ? (
                                                            <span className="text-[10px] text-slate-400">
                                                                / 1 user: {v.per_user_limit} lượt
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col gap-0.5">
                                                        {expired ? (
                                                            <Badge variant="destructive" className="w-fit text-[10px] font-semibold gap-1 px-2 py-0.5">
                                                                Hết hiệu lực
                                                            </Badge>
                                                        ) : future ? (
                                                            <Badge variant="secondary" className="w-fit text-[10px] font-semibold gap-1 px-2 py-0.5">
                                                                Chưa mở bán
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="w-fit text-[10px] font-semibold gap-1 px-2 py-0.5 border-green-300 text-green-700 bg-green-50">
                                                                Đang hiệu lực
                                                            </Badge>
                                                        )}
                                                        <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-1">
                                                            <CalendarDays className="w-3 h-3" />
                                                            {v.valid_from ? (
                                                                <>
                                                                    {format(new Date(v.valid_from), 'dd/MM/yy')}
                                                                    {v.valid_until ? (
                                                                        <> → {format(new Date(v.valid_until), 'dd/MM/yy')}</>
                                                                    ) : ' → Vĩnh viễn'}
                                                                </>
                                                            ) : v.valid_until ? (
                                                                <>→ hết {format(new Date(v.valid_until), 'dd/MM/yy')}</>
                                                            ) : (
                                                                <span className="text-slate-400">Vĩnh viễn</span>
                                                            )}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <BranchIdsBadge
                                                        branch_ids={v.branch_ids}
                                                        branches={branches}
                                                        className="text-[10px]"
                                                    />
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {isDeletedView ? (
                                                        <Badge variant="destructive" className="text-[10px]">Đã xóa</Badge>
                                                    ) : isTogglingId === v.id ? (
                                                        <Loader2 className="w-4 h-4 animate-spin mx-auto text-slate-400" />
                                                    ) : (
                                                        <div className="flex items-center justify-center">
                                                            {hasPermission('vouchers', 'toggle_status') ? (
                                                                <AlertDialog
                                                                    open={
                                                                        voucherToToggle?.id === v.id
                                                                    }
                                                                    onOpenChange={(open) => {
                                                                        if (!open) setVoucherToToggle(null);
                                                                    }}
                                                                >
                                                                    <AlertDialogTrigger asChild>
                                                                        <Switch
                                                                            checked={!!v.is_active}
                                                                            className="scale-100 transition-all border-2 border-transparent cursor-pointer shrink-0"
                                                                            style={{
                                                                                opacity: 1,
                                                                                backgroundColor: v.is_active ? '#10b981' : '#d1d5db',
                                                                                boxShadow: 'none'
                                                                            }}
                                                                            onClick={(e) => {
                                                                                e.preventDefault();
                                                                                setVoucherToToggle({
                                                                                    id: v.id,
                                                                                    currentStatus: !!v.is_active
                                                                                });
                                                                            }}
                                                                        />
                                                                    </AlertDialogTrigger>
                                                                    <AlertDialogContent className="max-w-md rounded-2xl font-sans bg-white">
                                                                        <AlertDialogHeader>
                                                                            <AlertDialogTitle className="text-slate-900 flex items-center gap-2">
                                                                                {voucherToToggle?.currentStatus ? (
                                                                                    <>
                                                                                        <XCircle className="w-5 h-5 text-red-500" />
                                                                                        Xác nhận ẩn voucher
                                                                                    </>
                                                                                ) : (
                                                                                    <>
                                                                                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                                                                        Xác nhận kích hoạt voucher
                                                                                    </>
                                                                                )}
                                                                            </AlertDialogTitle>
                                                                            <AlertDialogDescription className="text-slate-500 text-sm">
                                                                                Voucher{' '}
                                                                                <b className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                                                                                    {v.code}
                                                                                </b>{' '}
                                                                                — {v.name}
                                                                                <br />
                                                                                {voucherToToggle?.currentStatus ? (
                                                                                    <>
                                                                                        Voucher sẽ <strong>không còn áp dụng được</strong> cho khách hàng.
                                                                                    </>
                                                                                ) : (
                                                                                    <>
                                                                                        Voucher sẽ <strong>hiển thị công khai</strong> và sẵn sàng cho khách hàng áp dụng.
                                                                                    </>
                                                                                )}
                                                                            </AlertDialogDescription>
                                                                        </AlertDialogHeader>
                                                                        <AlertDialogFooter className="mt-3">
                                                                            <AlertDialogCancel
                                                                                className="rounded-lg"
                                                                                onClick={() => setVoucherToToggle(null)}
                                                                            >
                                                                                Hủy
                                                                            </AlertDialogCancel>
                                                                            <AlertDialogAction
                                                                                disabled={isTogglingId === v.id}
                                                                                onClick={(e) => {
                                                                                    e.preventDefault();
                                                                                    if (voucherToToggle) {
                                                                                        handleToggleStatus(
                                                                                            voucherToToggle.id,
                                                                                            voucherToToggle.currentStatus
                                                                                        );
                                                                                    }
                                                                                }}
                                                                                className={`rounded-lg text-white ${
                                                                                    voucherToToggle?.currentStatus
                                                                                        ? 'bg-red-600 hover:bg-red-700'
                                                                                        : 'bg-emerald-600 hover:bg-emerald-700'
                                                                                }`}
                                                                            >
                                                                                {isTogglingId === v.id ? (
                                                                                    <span className="flex items-center gap-2">
                                                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                                                        Đang xử lý...
                                                                                    </span>
                                                                                ) : voucherToToggle?.currentStatus ? (
                                                                                    'Đồng ý ẩn'
                                                                                ) : (
                                                                                    'Đồng ý kích hoạt'
                                                                                )}
                                                                            </AlertDialogAction>
                                                                        </AlertDialogFooter>
                                                                    </AlertDialogContent>
                                                                </AlertDialog>
                                                            ) : (
                                                                <Badge
                                                                    variant="outline"
                                                                    className={`text-[10px] ${
                                                                        v.is_active
                                                                            ? 'bg-green-50 text-green-700 border-green-200'
                                                                            : 'bg-slate-100 text-slate-500 border-slate-200'
                                                                    }`}
                                                                >
                                                                    {v.is_active ? 'Đang bật' : 'Đã tắt'}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right pr-6">
                                                    <div className="inline-flex flex-nowrap gap-1">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-8 rounded-lg hover:bg-slate-50 text-slate-600 border-slate-200"
                                                            onClick={() => {
                                                                setSelectedVoucher(v);
                                                                setIsDetailDialogOpen(true);
                                                            }}
                                                            title="Xem chi tiết"
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                        {!isDeletedView && hasPermission('vouchers', 'edit') && (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="h-8 rounded-lg hover:bg-yellow-50 text-yellow-600 border-yellow-200"
                                                                onClick={() => onEdit(v)}
                                                                title="Sửa"
                                                            >
                                                                <Pencil className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                        {isDeletedView && restoreVoucherApi && onRestore && hasPermission('vouchers', 'restore') && (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                disabled={isRestoringId === v.id}
                                                                className="h-8 rounded-lg hover:bg-emerald-50 text-emerald-600 border-emerald-200"
                                                                onClick={() => handleRestore(v)}
                                                                title="Phục hồi"
                                                            >
                                                                {isRestoringId === v.id ? (
                                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                                ) : (
                                                                    <RotateCcw className="h-4 w-4" />
                                                                )}
                                                            </Button>
                                                        )}
                                                        {!isDeletedView && onDelete && hasPermission('vouchers', 'delete') && (
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        disabled={isDeletingId === v.id}
                                                                        className="h-8 rounded-lg hover:bg-red-50 text-red-600 border-red-200"
                                                                        title="Xóa voucher"
                                                                    >
                                                                        {isDeletingId === v.id ? (
                                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                                        ) : (
                                                                            <Trash2 className="h-4 w-4" />
                                                                        )}
                                                                    </Button>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent className="max-w-md rounded-2xl border border-slate-200 shadow-xl">
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle className="text-slate-800 flex items-center gap-2">
                                                                            <Trash2 className="w-5 h-5 text-red-500" />
                                                                            Xác nhận xóa voucher?
                                                                        </AlertDialogTitle>
                                                                        <AlertDialogDescription className="text-slate-500 text-sm leading-relaxed">
                                                                            Voucher <b className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                                                                                {v.code}
                                                                            </b> ({v.name}) sẽ được chuyển vào danh sách đã xóa.
                                                                            <br />
                                                                            Bạn có thể phục hồi lại từ mục "Xem đã xóa".
                                                                        </AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel className="rounded-lg">Hủy</AlertDialogCancel>
                                                                        <AlertDialogAction
                                                                            className="bg-red-600 hover:bg-red-700 text-white rounded-lg"
                                                                            onClick={() => handleDeleteConfirm(v)}
                                                                        >
                                                                            Xác nhận xóa
                                                                        </AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                        </TableBody>
                    </Table>
                    {totalPages > 1 && (
                        <Pagination className="mt-3">
                            <PaginationContent>
                                <PaginationItem>
                                    <PaginationPrevious
                                        href="#"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            setPage(Math.max(1, currentPage - 1));
                                        }}
                                        aria-disabled={currentPage === 1}
                                        className={
                                            currentPage === 1
                                                ? 'pointer-events-none opacity-30'
                                                : 'cursor-pointer rounded-lg border shadow-sm'
                                        }
                                    />
                                </PaginationItem>
                                <PaginationItem>
                                    <span className="flex items-center px-3 text-sm text-slate-600">
                                        Trang {currentPage} / {totalPages}
                                    </span>
                                </PaginationItem>
                                <PaginationItem>
                                    <PaginationNext
                                        href="#"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            setPage(Math.min(totalPages, currentPage + 1));
                                        }}
                                        aria-disabled={currentPage === totalPages}
                                        className={
                                            currentPage === totalPages
                                                ? 'pointer-events-none opacity-30'
                                                : 'cursor-pointer rounded-lg border shadow-sm'
                                        }
                                    />
                                </PaginationItem>
                            </PaginationContent>
                        </Pagination>
                    )}
                </CardContent>
            </Card>

            {/* Create / Edit Modal */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="max-w-[1050px] max-h-[90vh] flex flex-col p-0 border border-gray-200 shadow-xl rounded-2xl overflow-hidden font-sans bg-white [&>button]:hidden">
                    <DialogHeader className="px-6 py-4 bg-white border-b border-gray-200">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl border bg-purple-50 border-purple-100 text-purple-600">
                                    <TicketIcon size={22} />
                                </div>
                                <div>
                                    <DialogTitle className="text-lg font-bold text-gray-900">
                                        {editData?.id 
                                            ? (editData?.scope === 'movie' ? 'Chỉnh sửa Voucher Phim' : editData?.scope === 'all' ? 'Chỉnh sửa Voucher Tổng hợp' : 'Chỉnh sửa Voucher VR')
                                            : (editData?.scope === 'movie' ? 'Thêm Voucher Phim Mới' : editData?.scope === 'all' ? 'Thêm Voucher Mới' : 'Thêm Voucher VR Mới')}
                                    </DialogTitle>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {editData?.scope === 'movie' 
                                            ? 'Áp dụng cho Vé xem phim — Loại giảm, giới hạn & chi nhánh' 
                                            : editData?.scope === 'all' 
                                                ? 'Áp dụng cho Tất cả dịch vụ — Loại giảm, giới hạn & chi nhánh' 
                                                : 'Áp dụng cho Dịch vụ Trải nghiệm VR — Loại giảm, giới hạn & chi nhánh'}
                                    </p>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setIsEditOpen(false)} className="h-8 w-8 text-gray-500 hover:text-gray-700">
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </DialogHeader>

                    <div className="overflow-y-auto px-6 py-4 flex-1 bg-slate-50/30">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {/* Cột trái: Thông tin cơ bản & Giảm giá */}
                            <div className="space-y-4">
                                {/* Basic Info Card */}
                                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                                    <h3 className="text-xs font-bold text-gray-700 border-b pb-2 flex items-center gap-2">
                                        <Sparkles size={14} className="text-purple-500" />
                                        Thông tin voucher
                                    </h3>
                                    <div>
                                        <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">
                                            Mã voucher <span className="text-red-500">*</span>
                                        </Label>
                                        <div className="flex gap-2">
                                            <Input
                                                placeholder="VD: VR20OFF"
                                                value={editData?.code || ''}
                                                onChange={(e) =>
                                                    setEditData({
                                                        ...editData,
                                                        code: e.target.value.replace(/[^a-zA-Z0-9_\-]/g, '')
                                                    })
                                                }
                                                className="h-9.5 text-sm flex-1 font-mono uppercase tracking-wider font-semibold"
                                                maxLength={30}
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() =>
                                                    setEditData({ ...editData, code: generateRandomCode() })
                                                }
                                                className="h-9.5 px-3.5 gap-1.5 border-purple-200 text-purple-700 hover:bg-purple-50"
                                            >
                                                <Sparkles className="w-3.5 h-3.5" />
                                                Tự tạo
                                            </Button>
                                        </div>
                                    </div>

                                    <div>
                                        <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">
                                            Tên chương trình <span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            placeholder="VD: Khai trương VR Giảm 20%"
                                            value={editData?.name || ''}
                                            onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                                            className="h-9.5 text-sm"
                                            maxLength={150}
                                        />
                                    </div>

                                    <div>
                                        <Label className="text-xs font-semibold text-gray-700 mb-1.5 flex items-center justify-between">
                                            <span>Nhân viên Sale phụ trách</span>
                                            <span className="text-[11px] text-slate-400 font-normal">Ghi nhận hoa hồng / doanh số</span>
                                        </Label>
                                        <Select
                                            value={editData?.sale_staff_id ? String(editData.sale_staff_id) : 'none'}
                                            onValueChange={(val) => {
                                                if (val === 'none') {
                                                    setEditData({ ...editData, sale_staff_id: null, sale_name: null, sale_email: null });
                                                } else {
                                                    const selected = staffList.find((s) => String(s.id) === val);
                                                    setEditData({
                                                        ...editData,
                                                        sale_staff_id: Number(val),
                                                        sale_name: selected?.fullname || null,
                                                        sale_email: selected?.email || null
                                                    });
                                                }
                                            }}
                                        >
                                            <SelectTrigger className="h-9.5 text-sm bg-white">
                                                <SelectValue placeholder="-- Chọn nhân viên Sale phụ trách --" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl">
                                                <SelectItem value="none">-- Không gán Sale (Voucher chung) --</SelectItem>
                                                {staffList.map((st) => (
                                                    <SelectItem key={st.id} value={String(st.id)}>
                                                        👤 {st.fullname} ({st.email})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div>
                                        <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">
                                            Ghi chú / Mô tả (tùy chọn)
                                        </Label>
                                        <Textarea
                                            placeholder="Mô tả ngắn gọn về voucher hoặc ghi chú nội bộ..."
                                            value={editData?.note !== undefined ? editData.note : editData?.description || ''}
                                            onChange={(e) => setEditData({ ...editData, note: e.target.value, description: e.target.value })}
                                            rows={2}
                                            className="w-full text-xs resize-none"
                                        />
                                    </div>

                                    <div>
                                        <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">
                                            Phạm vi áp dụng (Scope) <span className="text-red-500">*</span>
                                        </Label>
                                        <Select
                                            value={editData?.scope || 'all'}
                                            onValueChange={(val) => {
                                                setEditData({
                                                    ...editData,
                                                    scope: val,
                                                    applicable_ticket_package_ids: [],
                                                    excluded_ticket_package_ids: []
                                                });
                                            }}
                                        >
                                            <SelectTrigger className="h-9.5 text-sm">
                                                <SelectValue placeholder="Chọn phạm vi áp dụng" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">🎟️ Toàn bộ hóa đơn (Tất cả dịch vụ)</SelectItem>
                                                <SelectItem value="vr">🎮 Trải nghiệm VR</SelectItem>
                                                <SelectItem value="movie">🎬 Vé xem phim</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                {/* Discount Card */}
                                <div className="bg-white p-4 rounded-2xl border border-purple-100 bg-purple-50/20 shadow-xs space-y-4">
                                    <h3 className="text-xs font-bold text-purple-800 border-b border-purple-100 pb-2 flex items-center gap-2">
                                        <Percent size={15} className="text-purple-600" />
                                        Cấu hình giảm giá
                                    </h3>

                                    {/* Discount Type Tabs */}
                                    <div className="flex gap-2 p-1 bg-purple-100/60 rounded-xl">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setEditData({ ...editData, discount_type: 'percent' })
                                            }
                                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                                                editData?.discount_type !== 'fixed'
                                                    ? 'bg-white text-purple-700 shadow-sm border border-purple-200/80'
                                                    : 'text-purple-700/70 hover:text-purple-900'
                                            }`}
                                        >
                                            <Percent className="w-4 h-4" /> Theo %
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setEditData({ ...editData, discount_type: 'fixed' })
                                            }
                                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                                                editData?.discount_type === 'fixed'
                                                    ? 'bg-white text-emerald-700 shadow-sm border border-emerald-200/80'
                                                    : 'text-emerald-700/70 hover:text-emerald-900'
                                            }`}
                                        >
                                            <CircleDollarSign className="w-4 h-4" /> Theo VND
                                        </button>
                                    </div>

                                    <div>
                                        <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">
                                            Giá trị giảm
                                            <span className="text-red-500 ml-1">*</span>
                                            <span className="ml-2 text-[10px] font-normal text-slate-400">
                                                {editData?.discount_type === 'fixed' ? 'VNĐ' : '1-100 %'}
                                            </span>
                                        </Label>
                                        <Input
                                            type="text"
                                            placeholder={editData?.discount_type === 'fixed' ? 'VD: 50000' : 'VD: 20'}
                                            value={
                                                editData?.discount_value !== undefined && editData?.discount_value !== null
                                                    ? Number(editData.discount_value).toLocaleString('en-US')
                                                    : ''
                                            }
                                            onChange={(e) => {
                                                const v = Number(e.target.value.replace(/,/g, ''));
                                                setEditData({
                                                    ...editData,
                                                    discount_value: isNaN(v) ? 0 : v
                                                });
                                            }}
                                            className="h-9.5 text-sm font-bold text-slate-800"
                                        />
                                    </div>

                                    {editData?.discount_type === 'percent' ? (
                                        <div>
                                            <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">
                                                Giảm tối đa / đơn (để trống = không giới hạn)
                                            </Label>
                                            <Input
                                                type="text"
                                                placeholder="VD: 50000"
                                                value={
                                                    editData?.max_discount
                                                        ? Number(editData.max_discount).toLocaleString('en-US')
                                                        : ''
                                                }
                                                onChange={(e) => {
                                                    const v = Number(e.target.value.replace(/,/g, ''));
                                                    setEditData({
                                                        ...editData,
                                                        max_discount: isNaN(v) || v <= 0 ? null : v
                                                    });
                                                }}
                                                className="h-9.5 text-sm text-slate-800"
                                            />
                                        </div>
                                    ) : null}

                                    <div>
                                        <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">
                                            Đơn hàng tối thiểu (VNĐ)
                                        </Label>
                                        <Input
                                            type="text"
                                            placeholder="Để trống hoặc 0 = không yêu cầu"
                                            value={
                                                editData?.min_order_value
                                                    ? Number(editData.min_order_value).toLocaleString('en-US')
                                                    : ''
                                            }
                                            onChange={(e) => {
                                                const v = Number(e.target.value.replace(/,/g, ''));
                                                setEditData({
                                                    ...editData,
                                                    min_order_value: isNaN(v) || v <= 0 ? 0 : v
                                                });
                                            }}
                                            className="h-9.5 text-sm text-slate-800"
                                        />
                                    </div>
                                </div>

                                {/* Limits */}
                                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                                    <h3 className="text-xs font-bold text-gray-700 border-b pb-2 flex items-center gap-2">
                                        <Tag size={14} className="text-blue-500" />
                                        Giới hạn lượt dùng
                                    </h3>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">
                                                Tổng lượt / Hệ thống
                                            </Label>
                                            <Input
                                                placeholder="Để trống = không giới hạn"
                                                value={editData?.usage_limit ?? ''}
                                                onChange={(e) => {
                                                    const v = e.target.value;
                                                    setEditData({
                                                        ...editData,
                                                        usage_limit: v === '' ? null : Number(v)
                                                    });
                                                }}
                                                type="number"
                                                min="0"
                                                className="h-9.5 text-sm"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">
                                                Lượt / 1 người dùng
                                            </Label>
                                            <Input
                                                placeholder="Mặc định 1"
                                                value={editData?.per_user_limit ?? 1}
                                                onChange={(e) => {
                                                    const v = Number(e.target.value);
                                                    setEditData({
                                                        ...editData,
                                                        per_user_limit: isNaN(v) || v <= 0 ? 1 : v
                                                    });
                                                }}
                                                type="number"
                                                min="1"
                                                className="h-9.5 text-sm"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Cột phải: Hiệu lực / Áp dụng gói / Chi nhánh */}
                            <div className="space-y-4">
                                {/* Validity Period */}
                                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                                    <h3 className="text-xs font-bold text-gray-700 border-b pb-2 flex items-center gap-2">
                                        <CalendarDays size={14} className="text-indigo-500" />
                                        Thời gian hiệu lực
                                    </h3>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">
                                                Bắt đầu từ
                                            </Label>
                                            <Input
                                                type="datetime-local"
                                                value={
                                                    editData?.valid_from
                                                        ? new Date(editData.valid_from).toISOString().slice(0, 16)
                                                        : ''
                                                }
                                                onChange={(e) => {
                                                    const dt = e.target.value;
                                                    setEditData({
                                                        ...editData,
                                                        valid_from: dt ? new Date(dt).toISOString() : null
                                                    });
                                                }}
                                                className="h-9.5 text-sm"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">
                                                Hết hạn
                                            </Label>
                                            <Input
                                                type="datetime-local"
                                                value={
                                                    editData?.valid_until
                                                        ? new Date(editData.valid_until).toISOString().slice(0, 16)
                                                        : ''
                                                }
                                                onChange={(e) => {
                                                    const dt = e.target.value;
                                                    setEditData({
                                                        ...editData,
                                                        valid_until: dt ? new Date(dt).toISOString() : null
                                                    });
                                                }}
                                                className="h-9.5 text-sm"
                                            />
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-slate-400">
                                        Để trống "Hết hạn" = voucher không bao giờ hết hạn; Để trống "Bắt đầu" = hiệu lực ngay lập tức.
                                    </p>
                                </div>

                                {/* Applied Ticket Packages based on Scope */}
                                {(() => {
                                    const scopeType = editData?.scope || 'vr';
                                    const scopeConfig = {
                                        vr: {
                                            title: 'Áp dụng cho gói VR cụ thể',
                                            hint: 'Để trống = tất cả VR',
                                            empty: 'Không có gói VR — vui lòng tạo ít nhất 1 gói VR trước',
                                            icon: <Gamepad2 size={14} className="text-purple-600" />,
                                            themeClass: 'border-purple-100 bg-purple-50/10 text-purple-800',
                                            borderClass: 'border-purple-100',
                                            textTheme: 'text-purple-800',
                                            hoverClass: 'hover:bg-purple-50 hover:border-purple-100'
                                        },
                                        movie: {
                                            title: 'Áp dụng cho gói phim cụ thể',
                                            hint: 'Để trống = tất cả gói phim',
                                            empty: 'Không có gói phim — vui lòng tạo ít nhất 1 gói phim trước',
                                            icon: <Film size={14} className="text-blue-600" />,
                                            themeClass: 'border-blue-100 bg-blue-50/10 text-blue-800',
                                            borderClass: 'border-blue-100',
                                            textTheme: 'text-blue-800',
                                            hoverClass: 'hover:bg-blue-50 hover:border-blue-100'
                                        },
                                        all: {
                                            title: 'Áp dụng cho gói vé cụ thể',
                                            hint: 'Để trống = tất cả gói vé',
                                            empty: 'Không có gói vé nào — vui lòng tạo ít nhất 1 gói vé trước',
                                            icon: <TicketIcon size={14} className="text-indigo-600" />,
                                            themeClass: 'border-indigo-100 bg-indigo-50/10 text-indigo-800',
                                            borderClass: 'border-indigo-100',
                                            textTheme: 'text-indigo-800',
                                            hoverClass: 'hover:bg-indigo-50 hover:border-indigo-100'
                                        }
                                    }[scopeType as 'vr' | 'movie' | 'all'] || {
                                        title: 'Áp dụng cho gói VR cụ thể',
                                        hint: 'Để trống = tất cả VR',
                                        empty: 'Không có gói VR — vui lòng tạo ít nhất 1 gói VR trước',
                                        icon: <Gamepad2 size={14} className="text-purple-600" />,
                                        themeClass: 'border-purple-100 bg-purple-50/10 text-purple-800',
                                        borderClass: 'border-purple-100',
                                        textTheme: 'text-purple-800',
                                        hoverClass: 'hover:bg-purple-50 hover:border-purple-100'
                                    };

                                    const appliedList: number[] =
                                        Array.isArray(editData?.applicable_ticket_package_ids)
                                            ? editData.applicable_ticket_package_ids
                                            : [];
                                    const excludedList: number[] =
                                        Array.isArray(editData?.excluded_ticket_package_ids)
                                            ? editData.excluded_ticket_package_ids
                                            : [];
                                    const hasAnyApplicable = appliedList.length > 0;
                                    const hasAnyExcluded = excludedList.length > 0;
                                    const mode: 'all' | 'whitelist' | 'blacklist' = hasAnyApplicable
                                        ? 'whitelist'
                                        : hasAnyExcluded
                                        ? 'blacklist'
                                        : 'all';

                                    return (
                                        <div className={`bg-white p-4 rounded-2xl border ${scopeConfig.borderClass} ${scopeConfig.themeClass.split(' ')[1] || ''} shadow-xs space-y-3`}>
                                            <div className={`text-xs font-bold ${scopeConfig.textTheme} border-b ${scopeConfig.borderClass} pb-2 flex flex-wrap items-center gap-2`}>
                                                <div className="flex items-center gap-2 mr-2">
                                                    {scopeConfig.icon}
                                                    {scopeConfig.title}
                                                </div>
                                                {mode === 'whitelist' && (
                                                    <Badge variant="outline" className="text-[10px] border-green-300 bg-green-50 text-green-700 px-2 py-0 rounded-full">
                                                        ✓ Chỉ áp {appliedList.length} gói
                                                    </Badge>
                                                )}
                                                {mode === 'blacklist' && (
                                                    <Badge variant="outline" className="text-[10px] border-red-300 bg-red-50 text-red-700 px-2 py-0 rounded-full">
                                                        ✗ Loại trừ {excludedList.length} gói
                                                    </Badge>
                                                )}
                                                {mode === 'all' && (
                                                    <Badge variant="outline" className="text-[10px] border-slate-300 bg-slate-50 text-slate-600 px-2 py-0 rounded-full">
                                                        ○ Áp tất cả
                                                    </Badge>
                                                )}
                                                <span className={`ml-auto text-[10px] font-normal ${scopeConfig.textTheme.replace('800', '500')}`}>
                                                    {scopeConfig.hint}
                                                </span>
                                            </div>

                                            {mode !== 'all' && (
                                                <div
                                                    className={`rounded-lg px-3 py-2 border text-[11px] flex items-center gap-2 ${
                                                        mode === 'whitelist'
                                                            ? 'bg-green-50 border-green-200 text-green-700'
                                                            : 'bg-red-50 border-red-200 text-red-700'
                                                    }`}
                                                >
                                                    {mode === 'whitelist' ? (
                                                        <>
                                                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                                            <span>
                                                                <b>Chỉ áp gói:</b> bỏ hết tick cột Áp dụng → mới tick được Loại trừ.
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <XCircle className="w-3.5 h-3.5 shrink-0" />
                                                            <span>
                                                                <b>Áp tất cả trừ:</b> bỏ hết tick cột Loại trừ → mới tick được Áp dụng.
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            )}

                                            <div className={`border ${scopeConfig.borderClass} rounded-xl p-2.5 h-40 overflow-y-auto space-y-1.5 bg-white`}>
                                                {vrPackages.length === 0 ? (
                                                    <p className="text-xs text-gray-400 text-center py-6">
                                                        {scopeConfig.empty}
                                                    </p>
                                                ) : (
                                                    vrPackages.map((pkg) => {
                                                        const applied = appliedList.includes(pkg.id);
                                                        const excluded = excludedList.includes(pkg.id);
                                                        const applyDisabled = excluded || hasAnyExcluded;
                                                        const excludeDisabled = applied || hasAnyApplicable;
                                                        return (
                                                            <div
                                                                key={pkg.id}
                                                                className={`flex items-center space-x-2 p-1.5 rounded-lg border border-transparent transition-colors ${scopeConfig.hoverClass}`}
                                                            >
                                                                <div className={applyDisabled && !applied ? 'opacity-60' : ''}>
                                                                    <Checkbox
                                                                        id={`vrpkg-apply-${pkg.id}`}
                                                                        checked={applied}
                                                                        disabled={applyDisabled}
                                                                        onCheckedChange={(checked) => {
                                                                            const curr =
                                                                                editData?.applicable_ticket_package_ids || [];
                                                                            const nextApplied = checked
                                                                                ? [...curr, pkg.id]
                                                                                : curr.filter((id: number) => id !== pkg.id);
                                                                            const nextEditData: any = {
                                                                                ...editData,
                                                                                applicable_ticket_package_ids:
                                                                                    nextApplied.length > 0 ? nextApplied : null
                                                                            };
                                                                            if (nextApplied.length > 0 && hasAnyExcluded) {
                                                                                nextEditData.excluded_ticket_package_ids = null;
                                                                                toast.info(
                                                                                    'Đã chuyển Chỉ áp gói — danh sách Loại trừ đã xóa.'
                                                                                );
                                                                            }
                                                                            setEditData(nextEditData);
                                                                        }}
                                                                    />
                                                                </div>
                                                                <label
                                                                    htmlFor={`vrpkg-apply-${pkg.id}`}
                                                                    className={`text-xs font-medium leading-none cursor-pointer flex-1 truncate ${
                                                                        applyDisabled && !applied ? 'text-slate-400' : 'text-slate-700'
                                                                    }`}
                                                                    title={applyDisabled && !applied
                                                                        ? 'Bỏ hết Loại trừ → mới tick được Áp dụng'
                                                                        : undefined
                                                                    }
                                                                >
                                                                    {pkg.name}
                                                                    <span className="ml-1 text-[10px] text-slate-400">
                                                                        ({formatMoney(pkg.price)})
                                                                    </span>
                                                                </label>
                                                                <div className={excludeDisabled && !excluded ? 'opacity-60' : ''}>
                                                                    <Checkbox
                                                                        id={`vrpkg-ex-${pkg.id}`}
                                                                        checked={excluded}
                                                                        disabled={excludeDisabled}
                                                                        onCheckedChange={(checked) => {
                                                                            const curr =
                                                                                editData?.excluded_ticket_package_ids || [];
                                                                            const nextExcluded = checked
                                                                                ? [...curr, pkg.id]
                                                                                : curr.filter((id: number) => id !== pkg.id);
                                                                            if (nextExcluded.length > 0 && hasAnyApplicable) {
                                                                                setEditData({
                                                                                    ...editData,
                                                                                    applicable_ticket_package_ids: null,
                                                                                    excluded_ticket_package_ids:
                                                                                        nextExcluded.length > 0 ? nextExcluded : null
                                                                                });
                                                                                toast.info(
                                                                                    'Đã chuyển Loại trừ — các mục Áp dụng đã xóa.'
                                                                                );
                                                                            } else {
                                                                                setEditData({
                                                                                    ...editData,
                                                                                    excluded_ticket_package_ids:
                                                                                        nextExcluded.length > 0 ? nextExcluded : null
                                                                                });
                                                                            }
                                                                        }}
                                                                    />
                                                                </div>
                                                                {excluded ? (
                                                                    <label
                                                                        htmlFor={`vrpkg-ex-${pkg.id}`}
                                                                        className="text-[10px] text-red-500 cursor-pointer font-semibold"
                                                                        title="Bỏ chọn để hủy loại trừ gói này"
                                                                    >
                                                                        Loại trừ
                                                                    </label>
                                                                ) : null}
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Branches */}
                                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                                    <h3 className="text-xs font-bold text-gray-700 border-b pb-2 flex items-center gap-2">
                                        <Film size={14} className="text-blue-500" />
                                        Chi nhánh &amp; Cài đặt
                                    </h3>
                                    <div>
                                        <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">
                                            Chi nhánh áp dụng
                                        </Label>
                                        <BranchMultiSelect
                                            branches={branchOptions.length > 0 ? branchOptions : branches}
                                            value={editData?.branch_ids ?? null}
                                            onChange={(ids) => setEditData({ ...editData, branch_ids: ids })}
                                            className="rounded-lg text-xs"
                                        />
                                        <p className="text-[10px] text-slate-400 mt-1">
                                            Để trống = áp dụng tất cả chi nhánh
                                        </p>
                                    </div>

                                    <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                                        <div>
                                            <Label className="text-xs font-semibold text-gray-700 block">
                                                Trạng thái kích hoạt
                                            </Label>
                                            <p className="text-[10px] text-slate-400">
                                                Bật = khách hàng có thể áp dụng voucher
                                            </p>
                                        </div>
                                        <Switch
                                            checked={!!(editData?.is_active ?? true)}
                                            onCheckedChange={(v) => setEditData({ ...editData, is_active: v })}
                                            className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-gray-300"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer action bar */}
                    <div className="px-6 py-4 bg-white border-t border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                            {editData?.scope === 'movie' ? (
                                <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 text-[10px] font-semibold">
                                    <Film className="w-3 h-3 inline mr-1" /> Scope: Phim
                                </Badge>
                            ) : editData?.scope === 'all' ? (
                                <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700 text-[10px] font-semibold">
                                    <TicketIcon className="w-3 h-3 inline mr-1" /> Scope: Tất cả
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700 text-[10px] font-semibold">
                                    <Gamepad2 className="w-3 h-3 inline mr-1" /> Scope: VR
                                </Badge>
                            )}
                            {editData?.id ? (
                                <span>Cập nhật lần cuối: {editData.updated_at ? format(new Date(editData.updated_at), 'dd/MM/yy HH:mm') : '-'}</span>
                            ) : (
                                <span>Voucher mới — mặc định code sẽ được uppercased</span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setIsEditOpen(false)}
                                disabled={isSaving}
                                className="rounded-lg"
                            >
                                Hủy
                            </Button>
                            <Button
                                onClick={handleSave}
                                disabled={isSaving}
                                className={`${
                                    editData?.scope === 'movie' 
                                        ? 'bg-blue-600 hover:bg-blue-700' 
                                        : editData?.scope === 'all' 
                                            ? 'bg-indigo-600 hover:bg-indigo-700' 
                                            : 'bg-purple-600 hover:bg-purple-700'
                                } text-white rounded-lg px-6 gap-2`}
                            >
                                {isSaving ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Sparkles className="w-4 h-4" />
                                )}
                                {editData?.id ? 'Cập nhật' : 'Tạo voucher'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Detail Dialog */}
            <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 border border-gray-200 shadow-xl rounded-2xl overflow-hidden font-sans bg-white [&>button]:hidden">
                    <DialogHeader className="px-6 py-4 bg-white border-b border-gray-200">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl border bg-slate-50 border-slate-100 text-slate-600">
                                    <Eye size={22} />
                                </div>
                                <div>
                                    <DialogTitle className="text-lg font-bold text-gray-900">
                                        Chi tiết voucher &mdash;{' '}
                                        <span className="font-mono text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-100">
                                            {selectedVoucher?.code}
                                        </span>
                                    </DialogTitle>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {selectedVoucher?.name}
                                    </p>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setIsDetailDialogOpen(false)} className="h-8 w-8">
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </DialogHeader>
                    {selectedVoucher && (
                        <div className="overflow-y-auto px-6 py-5 space-y-4 flex-1">
                            {(() => {
                                const toArr = (v: any): number[] =>
                                    Array.isArray(v) ? (v as number[]) : [];
                                const applied = toArr(selectedVoucher.applicable_ticket_package_ids);
                                const excluded = toArr(selectedVoucher.excluded_ticket_package_ids);
                                const recent = Array.isArray(selectedVoucher.recent_redemptions)
                                    ? (selectedVoucher.recent_redemptions as any[])
                                    : [];
                                return (
                                    <>
                            {/* Info Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                    <p className="text-[10px] uppercase font-semibold text-slate-500 mb-1">Loại giảm</p>
                                    <p className="font-bold text-slate-800">
                                        {selectedVoucher.discount_type === 'percent' ? (
                                            <>
                                                {selectedVoucher.discount_value}%
                                                {selectedVoucher.max_discount ? (
                                                    <span className="text-[10px] text-slate-500 font-normal ml-1">
                                                        (tối đa {formatMoney(selectedVoucher.max_discount)})
                                                    </span>
                                                ) : null}
                                            </>
                                        ) : (
                                            formatMoney(selectedVoucher.discount_value)
                                        )}
                                    </p>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                    <p className="text-[10px] uppercase font-semibold text-slate-500 mb-1">Đơn tối thiểu</p>
                                    <p className="font-bold text-slate-800">{formatMoney(selectedVoucher.min_order_value || 0)}</p>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                    <p className="text-[10px] uppercase font-semibold text-slate-500 mb-1">Đã dùng / Giới hạn</p>
                                    <p className="font-bold text-slate-800">
                                        <span className="text-blue-600">{selectedVoucher.used_count ?? 0}</span> /{' '}
                                        {selectedVoucher.usage_limit ?? '∞'}
                                    </p>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                    <p className="text-[10px] uppercase font-semibold text-slate-500 mb-1">/1 user</p>
                                    <p className="font-bold text-slate-800">{selectedVoucher.per_user_limit ?? 1} lượt</p>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                    <p className="text-[10px] uppercase font-semibold text-slate-500 mb-1">Hiệu lực</p>
                                    <p className="font-semibold text-slate-800">
                                        {selectedVoucher.valid_from
                                            ? format(new Date(selectedVoucher.valid_from), 'dd/MM/yy')
                                            : 'ngay'}
                                        {' → '}
                                        {selectedVoucher.valid_until
                                            ? format(new Date(selectedVoucher.valid_until), 'dd/MM/yy')
                                            : 'vĩnh viễn'}
                                    </p>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                    <p className="text-[10px] uppercase font-semibold text-slate-500 mb-1">Trạng thái</p>
                                    <p className="font-bold text-slate-800">
                                        {selectedVoucher.is_active ? '✓ Bật' : '✗ Tắt'}
                                    </p>
                                </div>
                            </div>

                            {/* Branch badge row */}
                            <div>
                                <Label className="text-[10px] font-bold uppercase text-slate-500 block mb-1.5">Chi nhánh áp dụng</Label>
                                <BranchIdsBadge
                                    branch_ids={selectedVoucher.branch_ids}
                                    branches={branches}
                                    className="text-[11px]"
                                />
                            </div>

                            {/* Applied package lists */}
                            {(applied.length || excluded.length) && (
                                <div className="grid grid-cols-2 gap-3">
                                    {applied.length ? (
                                        <div>
                                            <Label className="text-[10px] font-bold uppercase text-green-600 block mb-1.5">
                                                ✓ Áp dụng cho ({applied.length}) gói
                                            </Label>
                                            <div className="space-y-1 max-h-36 overflow-y-auto border border-green-100 rounded-xl p-2 bg-green-50/40">
                                                {applied.map((id) => (
                                                    <Badge key={id} variant="outline" className="border-green-200 bg-white text-green-700 text-[10px]">
                                                        ID #{id}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    ) : null}
                                    {excluded.length ? (
                                        <div>
                                            <Label className="text-[10px] font-bold uppercase text-red-600 block mb-1.5">
                                                ✗ Loại trừ ({excluded.length}) gói
                                            </Label>
                                            <div className="space-y-1 max-h-36 overflow-y-auto border border-red-100 rounded-xl p-2 bg-red-50/40">
                                                {excluded.map((id) => (
                                                    <Badge key={id} variant="outline" className="border-red-200 bg-white text-red-700 text-[10px]">
                                                        ID #{id}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            )}

                            {/* Recent redemptions */}
                            {recent.length > 0 && (
                                <div>
                                    <Label className="text-[10px] font-bold uppercase text-slate-600 block mb-1.5">
                                        20 giao dịch redeem gần nhất
                                    </Label>
                                    <div className="border border-slate-100 rounded-xl overflow-hidden">
                                        <Table>
                                            <TableHeader className="bg-slate-50">
                                                <TableRow className="hover:bg-transparent border-none">
                                                    <TableHead className="text-[10px] font-semibold uppercase py-2">Booking</TableHead>
                                                    <TableHead className="text-[10px] font-semibold uppercase py-2">Discount</TableHead>
                                                    <TableHead className="text-[10px] font-semibold uppercase py-2">Thời gian</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {recent.map((r: any, i: number) => (
                                                    <TableRow key={`rd-${r.id || i}`} className="hover:bg-slate-50 border-t border-slate-100">
                                                        <TableCell className="text-xs font-mono">#{r.booking_id}</TableCell>
                                                        <TableCell className="text-xs font-semibold text-green-700">
                                                            -{formatMoney(r.discount_amount_applied)}
                                                        </TableCell>
                                                        <TableCell className="text-[11px] text-slate-500">
                                                            {r.redeemed_at ? format(new Date(r.redeemed_at), 'dd/MM/yy HH:mm') : '-'}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            )}

                            {/* Audit */}
                            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-[11px] text-slate-500 flex items-center justify-between">
                                <span>
                                    Tạo bởi: <b className="text-slate-700">{selectedVoucher.created_by_staff_name || '-'}</b>
                                </span>
                                <span>
                                    Cập nhật lần cuối:{' '}
                                    <b className="text-slate-700">
                                        {selectedVoucher.updated_at
                                            ? format(new Date(selectedVoucher.updated_at), 'dd/MM/yy HH:mm')
                                            : '-'}
                                    </b>{' '}
                                    của <b className="text-slate-700">{selectedVoucher.updated_by_staff_name || '-'}</b>
                                </span>
                            </div>
                                    </>
                                );
                            })()}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
