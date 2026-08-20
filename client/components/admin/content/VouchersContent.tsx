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
    Search
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
    type VoucherListFilters
} from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { useStaffPermissions, useIsSuperAdmin } from '@/hooks/useStaffPermission';

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
    const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
    const [selectedVoucher, setSelectedVoucher] = useState<VoucherItem | null>(null);
    const [localSearchText, setLocalSearchText] = useState(searchText);

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
            listVRTicketPackagesForVoucher(scope).then((res) => {
                setVrPackages(res.items || []);
            }).catch(() => {});
            getAdminBranchOptions({ includeInactive: true }).then((res) => {
                setBranchOptions(res.items || []);
            }).catch(() => {});
        }
    }, [isEditOpen, editData?.scope]);

    const handleToggleStatus = async (id: number, currentStatus: boolean) => {
        setIsTogglingId(id);
        try {
            await toggleVoucherStatusApi(id);
            toast.success(!currentStatus ? 'Đã bật voucher' : 'Đã ẩn voucher');
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
        payload.scope = editData.scope || 'vr';
        payload.discount_value = value;
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
        <div className="space-y-6">
            {/* PAGE HEADER */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2.5">
                        <TicketIcon className="w-5.5 h-5.5 text-purple-600" />
                        {isDeletedView ? 'Thùng rác Vouchers' : 'Quản lý Vouchers (Ưu đãi)'}
                    </h1>
                    <p className="text-sm text-slate-400 mt-0.5">
                        {isDeletedView
                            ? `${data.length} voucher đã xóa trong thùng rác`
                            : `Tổng cộng ${data.length} voucher — áp dụng cho Trải nghiệm VR`}
                    </p>
                </div>
            </div>

            {/* TOOLBAR */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                    {/* Search */}
                    <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 md:min-w-[320px] md:max-w-md">
                        <div className="relative flex-1">
                            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input
                                placeholder="Tìm theo mã hoặc tên voucher..."
                                value={localSearchText}
                                onChange={(e) => setLocalSearchText(e.target.value)}
                                className="pl-9 h-10 bg-slate-50 border-slate-200 focus:bg-white rounded-xl"
                            />
                        </div>
                        <Button
                            type="submit"
                            className="h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold px-4 flex items-center gap-1.5 shrink-0"
                        >
                            <Search className="w-3.5 h-3.5" /> Tìm kiếm
                        </Button>
                    </form>

                    {/* Scope Filter Pills */}
                    <div className="flex items-center bg-slate-50 p-1 rounded-xl border border-slate-200 gap-1">
                        <button
                            type="button"
                            onClick={() => { setScopeFilter('all'); setPage(1); }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                                scopeFilter === 'all'
                                    ? 'bg-slate-800 text-white shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'
                            }`}
                        >
                            <TicketIcon className="w-3.5 h-3.5" /> Tất cả
                        </button>
                        <button
                            type="button"
                            onClick={() => { setScopeFilter('vr'); setPage(1); }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                                scopeFilter === 'vr'
                                    ? 'bg-purple-600 text-white shadow-sm'
                                    : 'text-purple-600 hover:text-purple-100 hover:bg-purple-50/50'
                            }`}
                        >
                            <Gamepad2 className="w-3.5 h-3.5" /> Chỉ VR
                        </button>
                        <button
                            type="button"
                            onClick={() => { setScopeFilter('movie'); setPage(1); }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                                scopeFilter === 'movie'
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'text-blue-600 hover:text-blue-100 hover:bg-blue-50/50'
                            }`}
                        >
                            <Film className="w-3.5 h-3.5" /> Chỉ Phim
                        </button>
                    </div>

                    {!isDeletedView && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Chỉ voucher bật</span>
                            <Switch
                                checked={showActiveOnly}
                                onCheckedChange={setShowActiveOnly}
                                className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-gray-300 cursor-pointer"
                            />
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                    {branches.length > 0 ? (
                        <select
                            value={selectedBranchId || 'all'}
                            onChange={(e) => {
                                setSelectedBranchId(e.target.value === 'all' ? 'all' : Number(e.target.value));
                                setPage(1);
                            }}
                            className="bg-white border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none shadow-sm cursor-pointer h-10"
                        >
                            <option value="all">Tất cả chi nhánh</option>
                            {branches.map((b) => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    ) : (
                        <div className="flex items-center gap-2 h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-500">
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600" />
                            <span>Đang tải chi nhánh...</span>
                        </div>
                    )}
                    {!isDeletedView && hasPermission('vouchers', 'view_deleted') && (
                        <Button
                            variant="outline"
                            onClick={() => navigate('/admin/deleted/vouchers')}
                            className="rounded-xl flex items-center gap-2 h-10 px-4 shadow-sm"
                        >
                            <Trash2 className="w-4 h-4" />
                            <span className="hidden sm:inline text-sm">Thùng rác</span>
                        </Button>
                    )}
                    {isDeletedView && (
                        <Button
                            variant="outline"
                            onClick={() => navigate('/admin/vouchers')}
                            className="rounded-xl flex items-center gap-2 h-10 px-4 shadow-sm"
                        >
                            <RotateCcw className="w-4 h-4" />
                            <span className="text-sm">Về danh sách</span>
                        </Button>
                    )}
                    {!isDeletedView && hasPermission('vouchers', 'create') && (
                        <Button
                            onClick={onCreate}
                            className="bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm gap-2 text-white h-10 px-5 font-medium"
                        >
                            <Plus className="w-4 h-4" /> Thêm voucher VR
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={onRefresh}
                        className="rounded-xl shadow-sm hover:rotate-180 transition-transform duration-500 shrink-0 h-10 w-10"
                        title="Làm mới"
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            {/* TABLE */}
            <Card className="border border-gray-200 rounded-xl shadow-sm bg-white">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-gray-50">
                            <TableRow className="hover:bg-transparent border-none">
                                <TableHead className="text-xs font-semibold text-gray-600 uppercase py-3">
                                    Mã voucher
                                </TableHead>
                                <TableHead className="text-xs font-semibold text-gray-600 uppercase py-3">
                                    Tên chương trình
                                </TableHead>
                                <TableHead className="text-xs font-semibold text-gray-600 uppercase py-3">
                                    Giảm giá
                                </TableHead>
                                <TableHead className="text-xs font-semibold text-gray-600 uppercase py-3">
                                    Đã dùng / Giới hạn
                                </TableHead>
                                <TableHead className="text-xs font-semibold text-gray-600 uppercase py-3 min-w-[160px]">
                                    Hiệu lực
                                </TableHead>
                                <TableHead className="text-xs font-semibold text-gray-600 uppercase py-3 min-w-[120px]">
                                    Chi nhánh
                                </TableHead>
                                <TableHead className="text-center text-xs font-semibold text-gray-600 uppercase py-3">
                                    Trạng thái
                                </TableHead>
                                <TableHead className="text-right text-xs font-semibold text-gray-600 uppercase py-3 pr-6">
                                    Thao tác
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading
                                ? Array.from({ length: 5 }).map((_, idx) => (
                                    <TableRow key={`sk-${idx}`}>
                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-14 mx-auto rounded-full" /></TableCell>
                                        <TableCell className="text-right"><Skeleton className="h-8 w-28 ml-auto rounded-lg" /></TableCell>
                                    </TableRow>
                                ))
                                : data.length === 0
                                    ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="py-16 text-center">
                                                <div className="flex flex-col items-center gap-2 text-slate-400">
                                                    <Tag className="w-10 h-10 opacity-40" />
                                                    <p className="text-sm font-medium">
                                                        {isDeletedView
                                                            ? 'Thùng rác trống'
                                                            : 'Chưa có voucher nào trong hệ thống'}
                                                    </p>
                                                    {!isDeletedView && hasPermission('vouchers', 'create') && (
                                                        <p className="text-xs">Bấm "Thêm voucher VR" để tạo ưu đãi đầu tiên</p>
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
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleToggleStatus(v.id, !!v.is_active)}
                                                                    className="transition-transform hover:scale-110"
                                                                    title={v.is_active ? 'Tắt voucher' : 'Bật voucher'}
                                                                >
                                                                    {v.is_active ? (
                                                                        <ToggleRight className="w-9 h-9 text-green-600" strokeWidth={2} />
                                                                    ) : (
                                                                        <ToggleLeft className="w-9 h-9 text-slate-400" strokeWidth={2} />
                                                                    )}
                                                                </button>
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
                                                                            </b> ({v.name}) sẽ được chuyển vào thùng rác.
                                                                            <br />
                                                                            Bạn có thể phục hồi lại từ menu "Thùng rác".
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
                                        <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">
                                            Mô tả (tùy chọn)
                                        </Label>
                                        <Textarea
                                            placeholder="Mô tả ngắn gọn về chương trình này..."
                                            value={editData?.description || ''}
                                            onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                                            rows={3}
                                            className="w-full text-xs resize-none"
                                        />
                                    </div>

                                    <div>
                                        <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">
                                            Phạm vi áp dụng (Scope) <span className="text-red-500">*</span>
                                        </Label>
                                        <Select
                                            value={editData?.scope || 'vr'}
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
                                                <SelectItem value="vr">🎮 Trải nghiệm VR</SelectItem>
                                                <SelectItem value="movie">🎬 Vé xem phim</SelectItem>
                                                <SelectItem value="all">🎟️ Tất cả dịch vụ</SelectItem>
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

                                    return (
                                        <div className={`bg-white p-4 rounded-2xl border ${scopeConfig.borderClass} ${scopeConfig.themeClass.split(' ')[1] || ''} shadow-xs space-y-3`}>
                                            <h3 className={`text-xs font-bold ${scopeConfig.textTheme} border-b ${scopeConfig.borderClass} pb-2 flex items-center gap-2`}>
                                                {scopeConfig.icon}
                                                {scopeConfig.title}
                                                <span className={`ml-auto text-[10px] font-normal ${scopeConfig.textTheme.replace('800', '500')}`}>
                                                    {scopeConfig.hint}
                                                </span>
                                            </h3>
                                            <div className={`border ${scopeConfig.borderClass} rounded-xl p-2.5 h-40 overflow-y-auto space-y-1.5 bg-white`}>
                                                {vrPackages.length === 0 ? (
                                                    <p className="text-xs text-gray-400 text-center py-6">
                                                        {scopeConfig.empty}
                                                    </p>
                                                ) : (
                                                    vrPackages.map((pkg) => {
                                                        const applied = (
                                                            editData?.applicable_ticket_package_ids || []
                                                        ).includes(pkg.id);
                                                        const excluded = (
                                                            editData?.excluded_ticket_package_ids || []
                                                        ).includes(pkg.id);
                                                        return (
                                                            <div
                                                                key={pkg.id}
                                                                className={`flex items-center space-x-2 p-1.5 rounded-lg border border-transparent transition-colors ${scopeConfig.hoverClass}`}
                                                            >
                                                                <Checkbox
                                                                    id={`vrpkg-apply-${pkg.id}`}
                                                                    checked={applied}
                                                                    disabled={excluded}
                                                                    onCheckedChange={(checked) => {
                                                                        const curr =
                                                                            editData?.applicable_ticket_package_ids || [];
                                                                        setEditData({
                                                                            ...editData,
                                                                            applicable_ticket_package_ids: checked
                                                                                ? [...curr, pkg.id]
                                                                                : curr.filter((id: number) => id !== pkg.id)
                                                                        });
                                                                    }}
                                                                />
                                                                <label
                                                                    htmlFor={`vrpkg-apply-${pkg.id}`}
                                                                    className="text-xs font-medium leading-none cursor-pointer flex-1 text-slate-700 truncate"
                                                                >
                                                                    {pkg.name}
                                                                    <span className="ml-1 text-[10px] text-slate-400">
                                                                        ({formatMoney(pkg.price)})
                                                                    </span>
                                                                </label>
                                                                <Checkbox
                                                                    id={`vrpkg-ex-${pkg.id}`}
                                                                    checked={excluded}
                                                                    disabled={applied}
                                                                    onCheckedChange={(checked) => {
                                                                        const curr =
                                                                            editData?.excluded_ticket_package_ids || [];
                                                                        setEditData({
                                                                            ...editData,
                                                                            excluded_ticket_package_ids: checked
                                                                                ? [...curr, pkg.id]
                                                                                : curr.filter((id: number) => id !== pkg.id)
                                                                        });
                                                                    }}
                                                                />
                                                                <label
                                                                    htmlFor={`vrpkg-ex-${pkg.id}`}
                                                                    className="text-[10px] text-red-500 cursor-pointer"
                                                                    title="Loại trừ gói này khỏi voucher"
                                                                >
                                                                    {excluded ? 'Loại trừ' : 'Bỏ qua'}
                                                                </label>
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
                            {(selectedVoucher.applicable_ticket_package_ids?.length || selectedVoucher.excluded_ticket_package_ids?.length) && (
                                <div className="grid grid-cols-2 gap-3">
                                    {selectedVoucher.applicable_ticket_package_ids?.length ? (
                                        <div>
                                            <Label className="text-[10px] font-bold uppercase text-green-600 block mb-1.5">
                                                ✓ Áp dụng cho ({selectedVoucher.applicable_ticket_package_ids.length}) gói
                                            </Label>
                                            <div className="space-y-1 max-h-36 overflow-y-auto border border-green-100 rounded-xl p-2 bg-green-50/40">
                                                {selectedVoucher.applicable_ticket_package_ids.map((id) => (
                                                    <Badge key={id} variant="outline" className="border-green-200 bg-white text-green-700 text-[10px]">
                                                        ID #{id}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    ) : null}
                                    {selectedVoucher.excluded_ticket_package_ids?.length ? (
                                        <div>
                                            <Label className="text-[10px] font-bold uppercase text-red-600 block mb-1.5">
                                                ✗ Loại trừ ({selectedVoucher.excluded_ticket_package_ids.length}) gói
                                            </Label>
                                            <div className="space-y-1 max-h-36 overflow-y-auto border border-red-100 rounded-xl p-2 bg-red-50/40">
                                                {selectedVoucher.excluded_ticket_package_ids.map((id) => (
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
                            {selectedVoucher.recent_redemptions?.length > 0 && (
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
                                                {selectedVoucher.recent_redemptions.map((r: any, i: number) => (
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
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
