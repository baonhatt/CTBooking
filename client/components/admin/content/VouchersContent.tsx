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
    FilterX,
    ShieldAlert,
    Copy,
    FileText,
    User,
    History
} from 'lucide-react';
import { format, formatDistanceToNow, isAfter, isBefore } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
import { useConfirmUnsaved } from '@/hooks/useConfirmUnsaved';

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

const toLocalDatetimeString = (dateStr: string | Date | null | undefined): string => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => n.toString().padStart(2, '0');
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const fromLocalDatetimeString = (val: string): string | null => {
    if (!val) return null;
    const d = new Date(val);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
};

const getTodayStartIso = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
};

const getTodayEndIso = () => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d.toISOString();
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
        setSelectedBranchId = () => { },
        selectedSaleId = 'all',
        setSelectedSaleId = () => { },
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
    const [detailPackages, setDetailPackages] = useState<any[]>([]);
    const [localSearchText, setLocalSearchText] = useState(searchText);
    const [voucherToToggle, setVoucherToToggle] = useState<{ id: number; currentStatus: boolean } | null>(null);
    const [isPermanent, setIsPermanent] = useState(false);
    const [isCodeEditable, setIsCodeEditable] = useState(false);
    const [confirmSaveData, setConfirmSaveData] = useState<{ payload: any; changes: string[] } | null>(null);

    const isDirty = React.useMemo(() => {
        if (!isEditOpen || !editData) return false;

        if (!editData.id || editData.id === 0) {
            return !!(
                (editData.name && editData.name.trim() !== '') ||
                (editData.note && editData.note.trim() !== '') ||
                (editData.description && editData.description.trim() !== '') ||
                Number(editData.min_order_value || 0) > 0 ||
                Number(editData.max_discount || 0) > 0 ||
                Number(editData.usage_limit || 0) > 0 ||
                editData.discount_type !== 'percent' ||
                Number(editData.discount_value || 0) !== 10 ||
                editData.scope !== 'all' ||
                editData.sale_staff_id != null
            );
        }

        const original = data.find(v => v.id === editData.id);
        if (!original) return false;

        if (editData.code !== original.code) return true;
        if (editData.name !== original.name) return true;
        if (String(editData.discount_type) !== String(original.discount_type)) return true;
        if (Number(editData.discount_value || 0) !== Number(original.discount_value || 0)) return true;
        if (editData.note !== original.note && editData.note !== original.description) return true;
        if (Number(editData.max_discount || 0) !== Number(original.max_discount || 0)) return true;
        if (Number(editData.min_order_value || 0) !== Number(original.min_order_value || 0)) return true;

        return false;
    }, [isEditOpen, editData, data]);

    const { handleOpenChange: handleEditOpenChange, UnsavedAlert: EditAlert } = useConfirmUnsaved({
        isDirty: isDirty,
        isSubmitting: isSaving,
        onConfirmClose: () => {
            setIsEditOpen(false);
            setEditData({});
        }
    });

    useEffect(() => {
        if (isEditOpen && editData) {
            // Always reset code editability when dialog opens
            setIsCodeEditable(false);
            if (!editData.id || editData.id === 0) {
                // When creating new voucher: if no dates provided, initialize to today start & end
                if (!editData.valid_from && !editData.valid_until) {
                    setEditData({
                        ...editData,
                        valid_from: getTodayStartIso(),
                        valid_until: getTodayEndIso()
                    });
                    setIsPermanent(false);
                } else {
                    setIsPermanent(false);
                }
            } else {
                // When editing existing: permanent if both are empty/null or valid_until is null
                const isPerm = !editData.valid_until && !editData.valid_from;
                setIsPermanent(isPerm);
            }
        }
    }, [isEditOpen, editData?.id]);

    useEffect(() => {
        listStaffOptionsApi()
            .then((res) => {
                if (res?.items && Array.isArray(res.items)) {
                    setStaffList(
                        res.items.map((s: any) => ({
                            id: s.id,
                            fullname: s.fullname || s.email,
                            email: s.email
                        }))
                    );
                }
            })
            .catch(() => { });
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
            const branchFilter = isSingleBranch ? { branch_id: branchIds[0] } : undefined;
            listVRTicketPackagesForVoucher(scope, branchFilter)
                .then((res) => {
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
                                } catch { }
                            }
                            if (pkgBranchArr.length === 0 && (pkg.branch_id === undefined || pkg.branch_id === null)) {
                                return true;
                            }
                            return pkgBranchArr.some((id) => allowedIds.has(Number(id)));
                        });
                    }
                    setVrPackages(packages);
                })
                .catch(() => { });
            getAdminBranchOptions({ includeInactive: true })
                .then((res) => {
                    setBranchOptions(res.items || []);
                })
                .catch(() => { });
        }
    }, [isEditOpen, editData?.scope, JSON.stringify(editData?.branch_ids)]);

    useEffect(() => {
        if (isDetailDialogOpen && selectedVoucher) {
            const scope = selectedVoucher.scope || 'all';
            listVRTicketPackagesForVoucher(scope)
                .then((res) => {
                    setDetailPackages(res.items || []);
                })
                .catch(() => { });
        }
    }, [isDetailDialogOpen, selectedVoucher?.id, selectedVoucher?.scope]);

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

    const formatMoney = (n: number | null | undefined) => {
        if (n === null || n === undefined || isNaN(Number(n))) return '0₫';
        return Number(n).toLocaleString('vi-VN') + '₫';
    };

    const executeSave = async (payload: any) => {
        setIsSaving(true);
        try {
            if (editData.id && editData.id > 0) {
                await updateVoucherApi(editData.id, payload);
                toast.success('Cập nhật voucher thành công');
            } else {
                await createVoucherApi(payload);
                toast.success('Tạo voucher thành công');
            }
            setConfirmSaveData(null);
            setIsEditOpen(false);
            setEditData(null);
            onRefresh();
        } catch (err: any) {
            toast.error(err.message || 'Lưu voucher thất bại');
        } finally {
            setIsSaving(false);
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
        payload.min_order_value = payload.min_order_value ? Number(payload.min_order_value) : 0;
        payload.usage_limit = payload.usage_limit ? Number(payload.usage_limit) : null;
        payload.is_active = !!payload.is_active;
        if (isPermanent) {
            payload.valid_from = null;
            payload.valid_until = null;
        } else {
            payload.valid_from = payload.valid_from || null;
            payload.valid_until = payload.valid_until || null;
        }
        if (payload.scope === 'all') {
            payload.applicable_ticket_package_ids = null;
        } else {
            // If user specifically cleared all checkboxes, they cannot save.
            if (Array.isArray(payload.applicable_ticket_package_ids) && payload.applicable_ticket_package_ids.length === 0) {
                toast.error('Vui lòng chọn ít nhất 1 gói áp dụng (hoặc chọn tất cả)');
                return;
            }
            // If it has length > 0, keep it. If it is null, keep it as null (it means all).
        }

        if (editData.id && editData.id > 0) {
            const originalItem = data.find((v) => v.id === editData.id);
            if (originalItem) {
                const changes: string[] = [];
                if (originalItem.discount_type !== payload.discount_type) {
                    changes.push(
                        `Loại giảm giá: ${originalItem.discount_type === 'percent' ? 'Phần trăm (%)' : 'Số tiền cố định (đ)'} → ${payload.discount_type === 'percent' ? 'Phần trăm (%)' : 'Số tiền cố định (đ)'}`
                    );
                }
                if (Number(originalItem.discount_value) !== Number(payload.discount_value)) {
                    const oldVal =
                        originalItem.discount_type === 'percent'
                            ? `${originalItem.discount_value}%`
                            : formatMoney(originalItem.discount_value);
                    const newVal =
                        payload.discount_type === 'percent' ? `${payload.discount_value}%` : formatMoney(payload.discount_value);
                    changes.push(`Mức giảm giá: ${oldVal} → ${newVal}`);
                }
                if (Number(originalItem.max_discount || 0) !== Number(payload.max_discount || 0)) {
                    changes.push(
                        `Giảm tối đa: ${formatMoney(originalItem.max_discount)} → ${formatMoney(payload.max_discount)}`
                    );
                }
                if (Number(originalItem.min_order_value || 0) !== Number(payload.min_order_value || 0)) {
                    changes.push(
                        `Đơn hàng tối thiểu: ${formatMoney(originalItem.min_order_value)} → ${formatMoney(payload.min_order_value)}`
                    );
                }

                if (changes.length > 0) {
                    setConfirmSaveData({ payload, changes });
                    return;
                }
            }
        }

        await executeSave(payload);
    };

    const isExpired = (v: VoucherItem) => {
        if (!v.valid_until) return false;
        return isAfter(new Date(), new Date(v.valid_until));
    };

    const isFuture = (v: VoucherItem) => {
        if (!v.valid_from) return false;
        return isBefore(new Date(), new Date(v.valid_from));
    };

    const handleCopyCode = (code: string) => {
        if (!code) return;
        navigator.clipboard.writeText(code);
        toast.success('Đã sao chép mã voucher');
    };

    return (
        <div className="space-y-6 font-sans">
            {/* PAGE HEADER */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-slate-800">
                        {isDeletedView ? 'Quản lý voucher đã xóa' : 'Quản lý vouchers'}
                    </h1>
                    <p className="text-sm text-slate-400 mt-0.5">
                        {isDeletedView
                            ? `Tổng cộng ${data.length} voucher trong thùng rác`
                            : `Tổng cộng ${data.length} voucher trong hệ thống`}
                    </p>
                </div>
            </div>

            {/* TOOLBAR */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                <div className="flex flex-wrap items-center gap-3 flex-1 w-full xl:w-auto">
                    {/* Search Form */}
                    <form onSubmit={handleSearchSubmit} className="flex flex-1 min-w-[260px] max-w-md gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Tìm mã hoặc tên voucher..."
                                value={localSearchText}
                                onChange={(e) => setLocalSearchText(e.target.value)}
                                className="w-full pl-10 pr-8 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-purple-500 rounded-xl transition-all outline-none text-sm h-10"
                            />
                            {localSearchText && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setLocalSearchText('');
                                        setSearchText('');
                                        setPage(1);
                                    }}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    title="Xóa tìm kiếm"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        <Button
                            type="submit"
                            className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold px-4 flex items-center gap-1.5 shrink-0 h-10 shadow-sm"
                        >
                            <Search className="w-3.5 h-3.5" /> Tìm kiếm
                        </Button>
                    </form>

                    {/* Scope Filter Pills */}
                    <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 h-10">
                        <button
                            type="button"
                            onClick={() => {
                                setScopeFilter('all');
                                setPage(1);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${scopeFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                                }`}
                        >
                            Tất cả
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setScopeFilter('vr');
                                setPage(1);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${scopeFilter === 'vr' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'
                                }`}
                        >
                            <Gamepad2 className="w-3.5 h-3.5" /> Chỉ VR
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setScopeFilter('movie');
                                setPage(1);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${scopeFilter === 'movie' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'
                                }`}
                        >
                            <Film className="w-3.5 h-3.5" /> Chỉ Phim
                        </button>
                    </div>

                    {/* Active filter switch */}
                    {!isDeletedView && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200 h-10">
                            <span className="text-[10px] font-bold text-slate-500 uppercase whitespace-nowrap">
                                Chỉ hiện khả dụng
                            </span>
                            <Switch
                                checked={showActiveOnly}
                                onCheckedChange={setShowActiveOnly}
                                className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-gray-300 cursor-pointer"
                            />
                        </div>
                    )}
                </div>

                {/* Right actions */}
                <div className="flex flex-wrap items-center gap-2.5 w-full xl:w-auto justify-start xl:justify-end">
                    {branches.length > 0 ? (
                        <select
                            value={String(selectedBranchId ?? 'all')}
                            onChange={(e) => {
                                setSelectedBranchId(e.target.value === 'all' ? 'all' : Number(e.target.value));
                                setPage(1);
                            }}
                            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-purple-500 outline-none shadow-sm cursor-pointer h-10"
                        >
                            {isSuperAdmin && <option value="all">Tất cả chi nhánh</option>}
                            {branches.map((b) => (
                                <option key={b.id} value={String(b.id)}>
                                    {b.name}
                                </option>
                            ))}
                        </select>
                    ) : null}

                    {staffList.length > 0 && (
                        <select
                            value={String(selectedSaleId ?? 'all')}
                            onChange={(e) => {
                                setSelectedSaleId(e.target.value);
                                setPage(1);
                            }}
                            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-purple-500 outline-none shadow-sm cursor-pointer h-10"
                        >
                            <option value="all">Tất cả Sale</option>
                            {staffList.map((st) => (
                                <option key={st.id} value={String(st.id)}>
                                    {st.fullname}
                                </option>
                            ))}
                        </select>
                    )}

                    {!isDeletedView && hasPermission('vouchers', 'view_deleted') && (
                        <Button
                            variant="outline"
                            onClick={() => navigate('/deleted/vouchers')}
                            className="rounded-xl flex items-center gap-2 h-10 px-4 shadow-sm border-slate-200 text-slate-700 hover:bg-slate-50"
                        >
                            <Trash2 className="w-4 h-4 text-slate-500" />
                            <span className="hidden sm:inline text-xs font-semibold">Xem đã xóa</span>
                        </Button>
                    )}

                    {isDeletedView && (
                        <Button
                            variant="outline"
                            onClick={() => navigate('/vouchers')}
                            className="rounded-xl flex items-center gap-2 h-10 px-4 shadow-sm border-slate-200"
                        >
                            <RotateCcw className="w-4 h-4" />
                            <span className="text-xs font-semibold">Về danh sách</span>
                        </Button>
                    )}

                    {!isDeletedView && hasPermission('vouchers', 'create') && (
                        <Button
                            onClick={onCreate}
                            className="bg-purple-600 hover:bg-purple-700 rounded-xl shadow-sm gap-2 text-white h-10 px-5 font-semibold text-xs transition-all whitespace-nowrap"
                        >
                            <Plus className="w-4 h-4" />
                            {scopeFilter === 'movie'
                                ? 'Thêm voucher Phim'
                                : scopeFilter === 'all'
                                    ? 'Thêm voucher'
                                    : 'Thêm voucher VR'}
                        </Button>
                    )}

                    <Button
                        variant="outline"
                        size="icon"
                        onClick={onRefresh}
                        className="rounded-xl shadow-sm hover:rotate-180 transition-transform duration-500 shrink-0 h-10 w-10 border-slate-200"
                        title="Làm mới"
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            {/* TABLE */}
            <Card className="border border-gray-200 rounded-xl shadow-sm bg-white overflow-hidden">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-gray-50 border-b border-gray-200">
                            <TableRow className="hover:bg-transparent border-none">
                                <TableHead className="text-xs font-semibold text-gray-600 uppercase py-3.5">Mã voucher</TableHead>
                                <TableHead className="text-xs font-semibold text-gray-600 uppercase py-3.5">Tên chương trình</TableHead>
                                <TableHead className="text-xs font-semibold text-gray-600 uppercase py-3.5">Phạm vi & Sale</TableHead>
                                <TableHead className="text-xs font-semibold text-gray-600 uppercase py-3.5">Mức giảm</TableHead>
                                <TableHead className="text-xs font-semibold text-gray-600 uppercase py-3.5">
                                    Đã dùng / Giới hạn
                                </TableHead>
                                <TableHead className="text-xs font-semibold text-gray-600 uppercase py-3.5 min-w-[150px]">
                                    Thời gian hiệu lực
                                </TableHead>
                                <TableHead className="text-xs font-semibold text-gray-600 uppercase py-3.5 min-w-[120px]">
                                    Chi nhánh
                                </TableHead>
                                <TableHead className="text-center text-xs font-semibold text-gray-600 uppercase py-3.5">
                                    Trạng thái
                                </TableHead>
                                <TableHead className="text-right text-xs font-semibold text-gray-600 uppercase py-3.5 pr-6">
                                    Thao tác
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, idx) => (
                                    <TableRow key={`sk-${idx}`}>
                                        <TableCell>
                                            <Skeleton className="h-4 w-24" />
                                        </TableCell>
                                        <TableCell>
                                            <Skeleton className="h-4 w-36" />
                                        </TableCell>
                                        <TableCell>
                                            <Skeleton className="h-4 w-24" />
                                        </TableCell>
                                        <TableCell>
                                            <Skeleton className="h-4 w-20" />
                                        </TableCell>
                                        <TableCell>
                                            <Skeleton className="h-4 w-20" />
                                        </TableCell>
                                        <TableCell>
                                            <Skeleton className="h-4 w-36" />
                                        </TableCell>
                                        <TableCell>
                                            <Skeleton className="h-4 w-20" />
                                        </TableCell>
                                        <TableCell>
                                            <Skeleton className="h-5 w-14 mx-auto rounded-full" />
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Skeleton className="h-8 w-28 ml-auto rounded-lg" />
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : data.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="py-16 text-center">
                                        <div className="flex flex-col items-center gap-2 text-slate-400">
                                            <Tag className="w-10 h-10 opacity-40" />
                                            <p className="text-sm font-medium">
                                                {isDeletedView ? 'Chưa có voucher nào bị xóa' : 'Chưa có voucher nào trong hệ thống'}
                                            </p>
                                            {!isDeletedView && hasPermission('vouchers', 'create') && (
                                                <p className="text-xs">
                                                    Bấm "
                                                    {scopeFilter === 'movie'
                                                        ? 'Thêm voucher Phim'
                                                        : scopeFilter === 'all'
                                                            ? 'Thêm voucher'
                                                            : 'Thêm voucher VR'}
                                                    " để tạo ưu đãi đầu tiên
                                                </p>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                data.map((v) => {
                                    const expired = isExpired(v);
                                    const future = isFuture(v);
                                    const used = v.used_count ?? v.redemption_total_count ?? 0;
                                    const limit = v.usage_limit;
                                    return (
                                        <TableRow
                                            key={v.id}
                                            className={`group hover:bg-gray-50/80 transition-colors border-b border-gray-100 ${expired ? 'opacity-60' : future ? 'opacity-70' : ''
                                                }`}
                                        >
                                            <TableCell>
                                                <span
                                                    onClick={() => handleCopyCode(v.code)}
                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50/50 hover:bg-purple-100/80 text-purple-700 border border-purple-200 font-mono font-bold text-xs tracking-wider cursor-pointer active:scale-95 transition-all"
                                                    title="Bấm để sao chép mã"
                                                >
                                                    {v.code}
                                                    <Copy className="w-3 h-3 text-purple-400 opacity-70" />
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-800 leading-tight">{v.name}</p>
                                                    {v.min_order_value && v.min_order_value > 0 ? (
                                                        <p className="text-[11px] text-slate-500 mt-0.5">
                                                            Đơn tối thiểu: <b>{formatMoney(v.min_order_value)}</b>
                                                        </p>
                                                    ) : null}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-1">
                                                    <div>
                                                        {v.scope === 'movie' ? (
                                                            <Badge
                                                                variant="outline"
                                                                className="border-blue-200 bg-blue-50 text-blue-700 text-[10px] font-semibold gap-1"
                                                            >
                                                                <Film size={10} /> Phim
                                                            </Badge>
                                                        ) : v.scope === 'all' ? (
                                                            <Badge
                                                                variant="outline"
                                                                className="border-indigo-200 bg-indigo-50 text-indigo-700 text-[10px] font-semibold gap-1"
                                                            >
                                                                <TicketIcon size={10} /> Toàn đơn
                                                            </Badge>
                                                        ) : (
                                                            <Badge
                                                                variant="outline"
                                                                className="border-purple-200 bg-purple-50 text-purple-700 text-[10px] font-semibold gap-1"
                                                            >
                                                                <Gamepad2 size={10} /> VR
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    {v.sale_name ? (
                                                        <p className="text-[10px] text-slate-500 truncate max-w-[120px]" title={v.sale_name}>
                                                            👤 {v.sale_name}
                                                        </p>
                                                    ) : null}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {v.discount_type === 'percent' ? (
                                                    <Badge
                                                        variant="outline"
                                                        className="border-amber-300 bg-amber-50 text-amber-800 text-xs font-bold gap-1"
                                                    >
                                                        <Percent className="w-3 h-3" />
                                                        {v.discount_value}%
                                                        {v.max_discount ? (
                                                            <span className="text-[10px] ml-0.5 opacity-75 font-normal">
                                                                (tối đa {formatMoney(v.max_discount)})
                                                            </span>
                                                        ) : null}
                                                    </Badge>
                                                ) : (
                                                    <Badge
                                                        variant="outline"
                                                        className="border-emerald-300 bg-emerald-50 text-emerald-800 text-xs font-bold gap-1"
                                                    >
                                                        <CircleDollarSign className="w-3 h-3" />
                                                        {formatMoney(v.discount_value)}
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-xs font-medium text-slate-700">
                                                        <span className="text-purple-600 font-bold">{used}</span>
                                                        <span className="text-slate-400 mx-1">/</span>
                                                        <span className={limit ? 'text-slate-700 font-semibold' : 'text-slate-400'}>
                                                            {limit ? Number(limit).toLocaleString() : '∞'}
                                                        </span>
                                                    </span>
                                                    {v.total_revenue !== undefined && v.total_revenue > 0 ? (
                                                        <span className="text-[10px] font-semibold text-emerald-600">
                                                            Thu: {formatMoney(v.total_revenue)}
                                                        </span>
                                                    ) : null}
                                                    {v.per_user_limit ? (
                                                        <span className="text-[10px] text-slate-400">{v.per_user_limit} lượt/user</span>
                                                    ) : null}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-1">
                                                    {expired ? (
                                                        <Badge variant="destructive" className="w-fit text-[10px] font-semibold px-2 py-0.5">
                                                            Hết hiệu lực
                                                        </Badge>
                                                    ) : future ? (
                                                        <Badge variant="secondary" className="w-fit text-[10px] font-semibold px-2 py-0.5">
                                                            Chưa bắt đầu
                                                        </Badge>
                                                    ) : (
                                                        <Badge
                                                            variant="outline"
                                                            className="w-fit text-[10px] font-semibold px-2 py-0.5 border-emerald-300 text-emerald-700 bg-emerald-50"
                                                        >
                                                            Đang hiệu lực
                                                        </Badge>
                                                    )}
                                                    <span className="text-[11px] text-slate-500 flex items-center gap-1">
                                                        <CalendarDays className="w-3 h-3 text-slate-400 shrink-0" />
                                                        {v.valid_from ? (
                                                            <>
                                                                {format(new Date(v.valid_from), 'dd/MM/yy')}
                                                                {v.valid_until ? <> → {format(new Date(v.valid_until), 'dd/MM/yy')}</> : ' → Vĩnh viễn'}
                                                            </>
                                                        ) : v.valid_until ? (
                                                            <>→ hết {format(new Date(v.valid_until), 'dd/MM/yy')}</>
                                                        ) : (
                                                            <span className="text-slate-400 font-medium">Vĩnh viễn</span>
                                                        )}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <BranchIdsBadge branch_ids={v.branch_ids} branches={branches} className="text-[10px]" />
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {isDeletedView ? (
                                                    <Badge variant="destructive" className="text-[10px]">
                                                        Đã xóa
                                                    </Badge>
                                                ) : isTogglingId === v.id ? (
                                                    <Loader2 className="w-4 h-4 animate-spin mx-auto text-slate-400" />
                                                ) : (
                                                    <div className="flex items-center justify-center">
                                                        {hasPermission('vouchers', 'toggle_status') ? (
                                                            <AlertDialog
                                                                open={voucherToToggle?.id === v.id}
                                                                onOpenChange={(open) => {
                                                                    if (!open) setVoucherToToggle(null);
                                                                }}
                                                            >
                                                                <AlertDialogTrigger asChild>
                                                                    <Switch
                                                                        checked={!!v.is_active}
                                                                        className="scale-100 transition-all border-2 border-transparent cursor-pointer"
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
                                                                            Voucher <b className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{v.code}</b> —{' '}
                                                                            {v.name}
                                                                            <br />
                                                                            {voucherToToggle?.currentStatus ? (
                                                                                <>
                                                                                    Voucher sẽ <strong>không còn áp dụng được</strong> cho khách hàng.
                                                                                </>
                                                                            ) : (
                                                                                <>
                                                                                    Voucher sẽ <strong>hiển thị công khai</strong> và sẵn sàng cho khách hàng áp
                                                                                    dụng.
                                                                                </>
                                                                            )}
                                                                        </AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter className="mt-3">
                                                                        <AlertDialogCancel
                                                                            className="rounded-lg border-slate-200"
                                                                            onClick={() => setVoucherToToggle(null)}
                                                                        >
                                                                            Hủy
                                                                        </AlertDialogCancel>
                                                                        <AlertDialogAction
                                                                            disabled={isTogglingId === v.id}
                                                                            onClick={(e) => {
                                                                                e.preventDefault();
                                                                                if (voucherToToggle) {
                                                                                    handleToggleStatus(voucherToToggle.id, voucherToToggle.currentStatus);
                                                                                }
                                                                            }}
                                                                            className={`rounded-lg text-white ${voucherToToggle?.currentStatus
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
                                                            <Switch
                                                                checked={!!v.is_active}
                                                                disabled
                                                                className="scale-100 transition-all cursor-not-allowed border-2 border-transparent"
                                                                style={{
                                                                    opacity: 0.4,
                                                                    backgroundColor: v.is_active ? '#10b981' : '#d1d5db',
                                                                    boxShadow: 'none'
                                                                }}
                                                            />
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
                                                                        Voucher <b className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{v.code}</b> (
                                                                        {v.name}) sẽ được chuyển vào danh sách đã xóa.
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
                                })
                            )}
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
            <EditAlert />
            <Dialog open={isEditOpen} onOpenChange={handleEditOpenChange}>
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
                                            ? editData?.scope === 'movie'
                                                ? 'Chỉnh sửa Voucher Phim'
                                                : editData?.scope === 'all'
                                                    ? 'Chỉnh sửa Voucher Tổng hợp'
                                                    : 'Chỉnh sửa Voucher VR'
                                            : editData?.scope === 'movie'
                                                ? 'Thêm Voucher Phim Mới'
                                                : editData?.scope === 'all'
                                                    ? 'Thêm Voucher Mới'
                                                    : 'Thêm Voucher VR Mới'}
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
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditOpenChange(false)}
                                className="h-8 w-8 text-gray-500 hover:text-gray-700"
                            >
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
                                        <div className="flex gap-2 items-center">
                                            <Input
                                                placeholder="VD: VR20OFF"
                                                value={editData?.code || ''}
                                                onChange={(e) =>
                                                    setEditData({
                                                        ...editData,
                                                        code: e.target.value.replace(/[^a-zA-Z0-9_\-]/g, '')
                                                    })
                                                }
                                                disabled={!isCodeEditable}
                                                className={`h-9.5 text-sm flex-1 font-mono uppercase tracking-wider font-semibold ${!isCodeEditable ? 'bg-gray-100 text-gray-600' : ''}`}
                                                maxLength={30}
                                            />
                                            {editData?.code && (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={() => handleCopyCode(editData.code)}
                                                    className="h-9.5 w-9.5 shrink-0 text-gray-500 hover:text-gray-800"
                                                    title="Sao chép mã"
                                                >
                                                    <Copy className="w-3.5 h-3.5" />
                                                </Button>
                                            )}
                                            {/* Only allow editing code on NEW vouchers: show pencil + auto-gen */}
                                            {(!editData?.id || editData.id === 0) && (
                                                <>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="icon"
                                                        onClick={() => setIsCodeEditable(!isCodeEditable)}
                                                        className="h-9.5 w-9.5 shrink-0"
                                                        title={isCodeEditable ? 'Khóa mã' : 'Nhập mã thủ công'}
                                                    >
                                                        <Pencil className="w-3.5 h-3.5" />
                                                    </Button>
                                                    {isCodeEditable && (
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            onClick={() => setEditData({ ...editData, code: generateRandomCode() })}
                                                            className="h-9.5 px-3 gap-1.5 border-purple-200 text-purple-700 hover:bg-purple-50 shrink-0"
                                                        >
                                                            <Sparkles className="w-3.5 h-3.5" />
                                                            Tự tạo
                                                        </Button>
                                                    )}
                                                </>
                                            )}
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
                                                    applicable_ticket_package_ids: null,
                                                    excluded_ticket_package_ids: null
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
                                            onClick={() => setEditData({ ...editData, discount_type: 'percent' })}
                                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${editData?.discount_type !== 'fixed'
                                                    ? 'bg-white text-purple-700 shadow-sm border border-purple-200/80'
                                                    : 'text-purple-700/70 hover:text-purple-900'
                                                }`}
                                        >
                                            <Percent className="w-4 h-4" /> Theo %
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setEditData({ ...editData, discount_type: 'fixed' })}
                                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${editData?.discount_type === 'fixed'
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
                                                value={editData?.max_discount ? Number(editData.max_discount).toLocaleString('en-US') : ''}
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
                                        <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">Đơn hàng tối thiểu (VNĐ)</Label>
                                        <Input
                                            type="text"
                                            placeholder="Để trống hoặc 0 = không yêu cầu"
                                            value={editData?.min_order_value ? Number(editData.min_order_value).toLocaleString('en-US') : ''}
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
                                            <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">Tổng lượt / Hệ thống</Label>
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
                                            <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">Lượt / 1 người dùng</Label>
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
                                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                                    <div className="flex items-center justify-between border-b pb-2">
                                        <h3 className="text-xs font-bold text-gray-700 flex items-center gap-2">
                                            <CalendarDays size={14} className="text-indigo-500" />
                                            Thời gian hiệu lực
                                        </h3>
                                        <div className="flex items-center space-x-2 bg-indigo-50/70 hover:bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100 transition-colors">
                                            <Checkbox
                                                id="voucher-is-permanent"
                                                checked={isPermanent}
                                                onCheckedChange={(checked) => {
                                                    const nextPermanent = !!checked;
                                                    setIsPermanent(nextPermanent);
                                                    if (nextPermanent) {
                                                        setEditData({
                                                            ...editData,
                                                            valid_from: null,
                                                            valid_until: null
                                                        });
                                                    } else {
                                                        setEditData({
                                                            ...editData,
                                                            valid_from: editData?.valid_from || getTodayStartIso(),
                                                            valid_until: editData?.valid_until || getTodayEndIso()
                                                        });
                                                    }
                                                }}
                                            />
                                            <label
                                                htmlFor="voucher-is-permanent"
                                                className="text-xs font-bold text-indigo-700 cursor-pointer select-none"
                                            >
                                                Áp dụng vĩnh viễn
                                            </label>
                                        </div>
                                    </div>

                                    <div
                                        className={`grid grid-cols-2 gap-3 transition-opacity ${isPermanent ? 'opacity-40 pointer-events-none' : ''}`}
                                    >
                                        <div>
                                            <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">Bắt đầu từ</Label>
                                            <Input
                                                type="datetime-local"
                                                disabled={isPermanent}
                                                value={toLocalDatetimeString(editData?.valid_from)}
                                                onChange={(e) => {
                                                    const dt = e.target.value;
                                                    setEditData({
                                                        ...editData,
                                                        valid_from: dt ? fromLocalDatetimeString(dt) : null
                                                    });
                                                }}
                                                className="h-9.5 text-sm"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">Hết hạn</Label>
                                            <Input
                                                type="datetime-local"
                                                disabled={isPermanent}
                                                value={toLocalDatetimeString(editData?.valid_until)}
                                                onChange={(e) => {
                                                    const dt = e.target.value;
                                                    setEditData({
                                                        ...editData,
                                                        valid_until: dt ? fromLocalDatetimeString(dt) : null
                                                    });
                                                }}
                                                className="h-9.5 text-sm"
                                            />
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-slate-400">
                                        {isPermanent
                                            ? '✨ Voucher có hiệu lực vĩnh viễn (áp dụng ngay lập tức và không bao giờ hết hạn).'
                                            : 'Voucher bắt đầu và kết thúc theo ngày giờ đã chọn ở trên.'}
                                    </p>
                                </div>

                                {/* Applied Ticket Packages based on Scope (only for vr / movie, hidden for 'all') */}
                                {editData?.scope && editData.scope !== 'all'
                                    ? (() => {
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
                                            }
                                        }[scopeType as 'vr' | 'movie'] || {
                                            title: 'Áp dụng cho gói VR cụ thể',
                                            hint: 'Để trống = tất cả VR',
                                            empty: 'Không có gói VR — vui lòng tạo ít nhất 1 gói VR trước',
                                            icon: <Gamepad2 size={14} className="text-purple-600" />,
                                            themeClass: 'border-purple-100 bg-purple-50/10 text-purple-800',
                                            borderClass: 'border-purple-100',
                                            textTheme: 'text-purple-800',
                                            hoverClass: 'hover:bg-purple-50 hover:border-purple-100'
                                        };

                                        const appliedList: number[] = Array.isArray(editData?.applicable_ticket_package_ids)
                                            ? editData.applicable_ticket_package_ids
                                            : (editData?.applicable_ticket_package_ids === null || editData?.applicable_ticket_package_ids === undefined) ? vrPackages.map((p: any) => p.id) : [];

                                        const isAllChecked = vrPackages.length > 0 && appliedList.length === vrPackages.length;
                                        const hasAnyApplicable = appliedList.length > 0;
                                        const mode: 'all' | 'whitelist' = isAllChecked ? 'all' : 'whitelist';

                                        return (
                                            <div
                                                className={`bg-white p-4 rounded-2xl border ${scopeConfig.borderClass} ${scopeConfig.themeClass.split(' ')[1] || ''} shadow-xs space-y-3`}
                                            >
                                                <div
                                                    className={`text-xs font-bold ${scopeConfig.textTheme} border-b ${scopeConfig.borderClass} pb-2 flex flex-wrap items-center gap-2`}
                                                >
                                                    <div className="flex items-center gap-2 mr-2">
                                                        {scopeConfig.icon}
                                                        {scopeConfig.title}
                                                    </div>
                                                    {mode === 'whitelist' && (
                                                        <Badge
                                                            variant="outline"
                                                            className="text-[10px] border-green-300 bg-green-50 text-green-700 px-2 py-0 rounded-full"
                                                        >
                                                            ✓ Chỉ áp {appliedList.length} gói
                                                        </Badge>
                                                    )}
                                                    {mode === 'all' && (
                                                        <Badge
                                                            variant="outline"
                                                            className="text-[10px] border-slate-300 bg-slate-50 text-slate-600 px-2 py-0 rounded-full"
                                                        >
                                                            ○ Áp tất cả
                                                        </Badge>
                                                    )}
                                                    <span
                                                        className={`ml-auto text-[10px] font-normal ${scopeConfig.textTheme.replace('800', '500')}`}
                                                    >
                                                        {scopeConfig.hint}
                                                    </span>
                                                </div>

                                                <div
                                                    className={`border ${scopeConfig.borderClass} rounded-xl p-2.5 h-40 overflow-y-auto space-y-1.5 bg-white mt-2`}
                                                >
                                                    {vrPackages.length === 0 ? (
                                                        <p className="text-xs text-gray-400 text-center py-6">{scopeConfig.empty}</p>
                                                    ) : (
                                                        <>
                                                            <div
                                                                className={`flex items-center space-x-2 p-1.5 rounded-lg border border-transparent transition-colors mb-2 bg-slate-50 ${scopeConfig.hoverClass}`}
                                                            >
                                                                <div>
                                                                    <Checkbox
                                                                        id={`vrpkg-apply-all`}
                                                                        checked={isAllChecked}
                                                                        onCheckedChange={(checked) => {
                                                                            setEditData({
                                                                                ...editData,
                                                                                applicable_ticket_package_ids: checked ? vrPackages.map((p: any) => p.id) : [],
                                                                                excluded_ticket_package_ids: null
                                                                            });
                                                                        }}
                                                                    />
                                                                </div>
                                                                <label
                                                                    htmlFor={`vrpkg-apply-all`}
                                                                    className={`text-xs font-semibold leading-none cursor-pointer flex-1 text-slate-800`}
                                                                >
                                                                    Chọn tất cả
                                                                </label>
                                                            </div>
                                                            {vrPackages.map((pkg) => {
                                                                const applied = appliedList.includes(pkg.id);
                                                                return (
                                                                    <div
                                                                        key={pkg.id}
                                                                        className={`flex items-center space-x-2 p-1.5 rounded-lg border border-transparent transition-colors ${scopeConfig.hoverClass}`}
                                                                    >
                                                                        <div>
                                                                            <Checkbox
                                                                                id={`vrpkg-apply-${pkg.id}`}
                                                                                checked={applied}
                                                                                onCheckedChange={(checked) => {
                                                                                    const curr = appliedList;
                                                                                    const nextApplied = checked
                                                                                        ? [...curr, pkg.id]
                                                                                        : curr.filter((id: number) => id !== pkg.id);

                                                                                    setEditData({
                                                                                        ...editData,
                                                                                        applicable_ticket_package_ids: nextApplied,
                                                                                        excluded_ticket_package_ids: null // ensure it's cleared if it ever existed
                                                                                    });
                                                                                }}
                                                                            />
                                                                        </div>
                                                                        <label
                                                                            htmlFor={`vrpkg-apply-${pkg.id}`}
                                                                            className={`text-xs font-medium leading-none cursor-pointer flex-1 truncate ${applied ? 'text-slate-800 font-semibold' : 'text-slate-700'
                                                                                }`}
                                                                        >
                                                                            {pkg.name}
                                                                            <span className="ml-1 text-[10px] text-slate-400">
                                                                                ({formatMoney(pkg.price)})
                                                                            </span>
                                                                        </label>
                                                                    </div>
                                                                );
                                                            })}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })()
                                    : null}

                                {/* Branches */}
                                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                                    <h3 className="text-xs font-bold text-gray-700 border-b pb-2 flex items-center gap-2">
                                        <Film size={14} className="text-blue-500" />
                                        Chi nhánh &amp; Cài đặt
                                    </h3>
                                    <div>
                                        <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">Chi nhánh áp dụng</Label>
                                        <BranchMultiSelect
                                            branches={branchOptions.length > 0 ? branchOptions : branches}
                                            value={editData?.branch_ids ?? null}
                                            onChange={(ids) => setEditData({ ...editData, branch_ids: ids })}
                                            className="rounded-lg text-xs"
                                        />
                                        <p className="text-[10px] text-slate-400 mt-1">Để trống = áp dụng tất cả chi nhánh</p>
                                    </div>

                                    <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                                        <div>
                                            <Label className="text-xs font-semibold text-gray-700 block">Trạng thái kích hoạt</Label>
                                            <p className="text-[10px] text-slate-400">Bật = khách hàng có thể áp dụng voucher</p>
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
                                <Badge
                                    variant="outline"
                                    className="border-indigo-200 bg-indigo-50 text-indigo-700 text-[10px] font-semibold"
                                >
                                    <TicketIcon className="w-3 h-3 inline mr-1" /> Scope: Tất cả
                                </Badge>
                            ) : (
                                <Badge
                                    variant="outline"
                                    className="border-purple-200 bg-purple-50 text-purple-700 text-[10px] font-semibold"
                                >
                                    <Gamepad2 className="w-3 h-3 inline mr-1" /> Scope: VR
                                </Badge>
                            )}
                            {editData?.id ? (
                                <span>
                                    Cập nhật lần cuối:{' '}
                                    {editData.updated_at ? format(new Date(editData.updated_at), 'dd/MM/yy HH:mm') : '-'}
                                </span>
                            ) : (
                                <span>Voucher mới — mặc định code sẽ được uppercased</span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" onClick={() => setIsEditOpen(false)} disabled={isSaving} className="rounded-lg">
                                Hủy
                            </Button>
                            <Button
                                onClick={handleSave}
                                disabled={isSaving}
                                className={`${editData?.scope === 'movie'
                                        ? 'bg-blue-600 hover:bg-blue-700'
                                        : editData?.scope === 'all'
                                            ? 'bg-indigo-600 hover:bg-indigo-700'
                                            : 'bg-purple-600 hover:bg-purple-700'
                                    } text-white rounded-lg px-6 gap-2`}
                            >
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                {editData?.id ? 'Cập nhật' : 'Tạo voucher'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Detail Dialog */}
            <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 border border-slate-200 shadow-2xl rounded-2xl overflow-hidden font-sans bg-slate-100 [&>button]:hidden">
                    {selectedVoucher && (
                        <>
                            <DialogHeader className="px-6 py-4 bg-white border-b border-slate-200/80">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 rounded-xl border bg-purple-50 border-purple-100 text-purple-600 shadow-xs">
                                            <Eye size={20} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <DialogTitle className="text-lg font-bold text-slate-900">
                                                    Hồ sơ Voucher —{' '}
                                                </DialogTitle>
                                                <span className="font-mono text-purple-700 font-bold bg-purple-100/70 px-2.5 py-0.5 rounded-md border border-purple-200 text-sm">
                                                    {selectedVoucher.code}
                                                </span>
                                                {selectedVoucher.scope === 'vr' && (
                                                    <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700 text-[10px] uppercase font-bold">
                                                        🎮 CHỈ VR
                                                    </Badge>
                                                )}
                                                {selectedVoucher.scope === 'movie' && (
                                                    <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 text-[10px] uppercase font-bold">
                                                        🎬 CHỈ PHIM
                                                    </Badge>
                                                )}
                                                {(!selectedVoucher.scope || selectedVoucher.scope === 'all') && (
                                                    <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700 text-[10px] uppercase font-bold">
                                                        🎟️ MỌI DỊCH VỤ
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-500 mt-0.5 font-medium">{selectedVoucher.name}</p>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => setIsDetailDialogOpen(false)} className="h-8 w-8 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            </DialogHeader>

                            <div className="overflow-y-auto px-6 py-5 space-y-5 flex-1 text-slate-800">
                                {(() => {
                                    const toArr = (v: any): number[] => (Array.isArray(v) ? (v as number[]) : []);
                                    const applied = toArr(selectedVoucher.applicable_ticket_package_ids);
                                    const excluded = toArr(selectedVoucher.excluded_ticket_package_ids);
                                    const recent = Array.isArray(selectedVoucher.recent_redemptions)
                                        ? (selectedVoucher.recent_redemptions as any[])
                                        : [];

                                    const displayNote = (() => {
                                        if (selectedVoucher.note) return selectedVoucher.note;
                                        if (selectedVoucher.description) {
                                            try {
                                                const trimmed = selectedVoucher.description.trim();
                                                if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                                                    const parsed = JSON.parse(trimmed);
                                                    return parsed.note || parsed.text || '';
                                                }
                                            } catch {}
                                            return selectedVoucher.description;
                                        }
                                        return '';
                                    })();

                                    const displaySaleName = selectedVoucher.sale_name || (() => {
                                        if (selectedVoucher.description) {
                                            try {
                                                const trimmed = selectedVoucher.description.trim();
                                                if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                                                    const parsed = JSON.parse(trimmed);
                                                    return parsed.sale_name || null;
                                                }
                                            } catch {}
                                        }
                                        return null;
                                    })();

                                    const displaySaleEmail = selectedVoucher.sale_email || (() => {
                                        if (selectedVoucher.description) {
                                            try {
                                                const trimmed = selectedVoucher.description.trim();
                                                if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                                                    const parsed = JSON.parse(trimmed);
                                                    return parsed.sale_email || null;
                                                }
                                            } catch {}
                                        }
                                        return null;
                                    })();

                                    return (
                                        <>
                                            {/* KHỐI 1: THÔNG TIN CHUNG */}
                                            <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-4 space-y-3">
                                                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                                                    <FileText size={15} className="text-blue-500" />
                                                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">THÔNG TIN CHUNG</h3>
                                                </div>
                                                <div className="flex flex-col md:flex-row gap-4 items-start">
                                                    <div className="flex-1 space-y-3 min-w-0 w-full">
                                                        <div>
                                                            <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">TÊN CHƯƠNG TRÌNH</p>
                                                            <p className="font-bold text-slate-900 text-sm truncate">{selectedVoucher.name}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">MÔ TẢ / GHI CHÚ NỘI BỘ</p>
                                                            <div className="bg-slate-50 text-slate-700 text-xs p-2.5 rounded-lg border border-slate-100 whitespace-pre-wrap italic break-words break-all max-h-32 overflow-y-auto">
                                                                {displayNote || <span className="text-slate-400 font-normal">Không có ghi chú bổ sung</span>}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="w-full md:w-56 shrink-0 bg-blue-50/50 border border-blue-100 rounded-xl p-3.5 space-y-1">
                                                        <p className="text-[10px] uppercase font-bold text-blue-600 flex items-center gap-1.5 mb-1">
                                                            <User size={12} /> NHÂN VIÊN SALE PHỤ TRÁCH
                                                        </p>
                                                        {displaySaleName ? (
                                                            <div>
                                                                <p className="font-bold text-slate-900 text-xs truncate" title={displaySaleName}>{displaySaleName}</p>
                                                                {displaySaleEmail && (
                                                                    <p className="text-[10px] text-slate-500 truncate" title={displaySaleEmail}>{displaySaleEmail}</p>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <p className="text-xs text-slate-500 italic">Không gán Sale (Voucher hệ thống)</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* KHỐI 2: THIẾT LẬP TÀI CHÍNH */}
                                            <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-4 space-y-3">
                                                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                                    <div className="flex items-center gap-2">
                                                        <Percent size={15} className="text-emerald-500" />
                                                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">THIẾT LẬP TÀI CHÍNH</h3>
                                                    </div>
                                                    {selectedVoucher.is_active ? (
                                                        <Badge variant="outline" className="text-[10px] border-emerald-200 bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded-full">
                                                            ĐANG BẬT
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-[10px] border-slate-200 bg-slate-100 text-slate-500 font-semibold px-2 py-0.5 rounded-full">
                                                            ĐÃ VÔ HIỆU
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                                        <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">MỨC GIẢM</p>
                                                        <p className="font-black text-rose-600 text-base">
                                                            {selectedVoucher.discount_type === 'percent' ? (
                                                                <>{selectedVoucher.discount_value}%</>
                                                            ) : (
                                                                formatMoney(selectedVoucher.discount_value)
                                                            )}
                                                        </p>
                                                    </div>
                                                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                                        <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">GIẢM TỐI ĐA</p>
                                                        <p className="font-bold text-slate-800">
                                                            {selectedVoucher.discount_type === 'percent' && selectedVoucher.max_discount
                                                                ? formatMoney(selectedVoucher.max_discount)
                                                                : 'Không giới hạn'}
                                                        </p>
                                                    </div>
                                                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                                        <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">ĐƠN HÀNG TỐI THIỂU</p>
                                                        <p className="font-bold text-slate-800">{formatMoney(selectedVoucher.min_order_value || 0)}</p>
                                                    </div>
                                                    <div className="bg-emerald-50/60 rounded-xl p-3 border border-emerald-100">
                                                        <p className="text-[10px] uppercase font-bold text-emerald-700 mb-1">TỔNG DOANH THU ĐEM VỀ</p>
                                                        <p className="font-black text-emerald-700 text-base">
                                                            {formatMoney(selectedVoucher.total_revenue || 0)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* KHỐI 3: GIỚI HẠN & ĐỐI TƯỢNG */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {/* Left card */}
                                                <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-4 space-y-3">
                                                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                                                        <CalendarDays size={15} className="text-amber-500" />
                                                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">GIỚI HẠN THỜI GIAN & LƯỢT DÙNG</h3>
                                                    </div>
                                                    <div className="space-y-2.5 text-xs">
                                                        <div>
                                                            <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">THỜI GIAN HIỆU LỰC</p>
                                                            <p className="font-semibold text-slate-800">
                                                                {selectedVoucher.valid_from
                                                                    ? format(new Date(selectedVoucher.valid_from), 'dd/MM/yyyy HH:mm')
                                                                    : 'Từ khi tạo'}
                                                                {' → '}
                                                                {selectedVoucher.valid_until
                                                                    ? format(new Date(selectedVoucher.valid_until), 'dd/MM/yyyy HH:mm')
                                                                    : 'Không hết hạn'}
                                                            </p>
                                                        </div>

                                                        <div>
                                                            <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">CHI NHÁNH ÁP DỤNG</p>
                                                            <BranchIdsBadge
                                                                branch_ids={selectedVoucher.branch_ids}
                                                                branches={branches}
                                                                className="text-[11px]"
                                                            />
                                                        </div>

                                                        <div className="grid grid-cols-2 gap-2 pt-1">
                                                            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                                                <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">TIẾN ĐỘ SỬ DỤNG</p>
                                                                <p className="font-bold text-slate-800">
                                                                    <span className="text-blue-600">{selectedVoucher.used_count ?? 0}</span> /{' '}
                                                                    {selectedVoucher.usage_limit ?? '∞'}
                                                                </p>
                                                            </div>
                                                            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                                                <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">GIỚI HẠN / 1 USER</p>
                                                                <p className="font-bold text-slate-800">{selectedVoucher.per_user_limit ?? 1} Khách</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Right card: ĐỐI TƯỢNG ÁP DỤNG */}
                                                <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-4 space-y-3">
                                                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                                                        <Tag size={15} className="text-purple-500" />
                                                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">ĐỐI TƯỢNG ÁP DỤNG</h3>
                                                    </div>
                                                    <div className="text-xs space-y-3">
                                                        {(() => {
                                                            const scopeText =
                                                                selectedVoucher.scope === 'vr'
                                                                    ? 'Dịch vụ Trải nghiệm VR'
                                                                    : selectedVoucher.scope === 'movie'
                                                                        ? 'Vé xem phim & Gói phim'
                                                                        : 'Tất cả dịch vụ hệ thống';

                                                            const hasSpecificApplied = applied.length > 0;
                                                            const hasExcluded = excluded.length > 0;
                                                            const isAllPackages = !hasSpecificApplied;

                                                            return (
                                                                <div className="space-y-3">
                                                                    <div className="flex flex-wrap items-center justify-between gap-1 border-b border-slate-100 pb-2">
                                                                        <span className="text-[11px] font-medium text-slate-500 italic">
                                                                            Phạm vi: <strong className="text-slate-700 not-italic">{scopeText}</strong>
                                                                        </span>
                                                                        {isAllPackages ? (
                                                                            <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                                                                ✓ Áp dụng tất cả ({detailPackages.length > 0 ? detailPackages.length : 'Tất cả'} gói)
                                                                            </Badge>
                                                                        ) : (
                                                                            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                                                                ✓ Chỉ áp dụng {applied.length} gói chỉ định
                                                                            </Badge>
                                                                        )}
                                                                    </div>

                                                                    {/* Danh sách các gói vé được áp dụng */}
                                                                    <div>
                                                                        <p className="text-[10px] font-bold uppercase text-emerald-700 mb-1.5 flex items-center justify-between">
                                                                            <span>DANH SÁCH GÓI VÉ ĐƯỢC ÁP DỤNG:</span>
                                                                        </p>
                                                                        {detailPackages.length === 0 && !hasSpecificApplied ? (
                                                                            <div className="p-3 bg-slate-50 border border-slate-200/60 rounded-xl text-center">
                                                                                <p className="text-xs text-slate-400 italic">Đang tải danh sách gói vé...</p>
                                                                            </div>
                                                                        ) : (
                                                                            <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto p-2 bg-slate-50/80 border border-slate-200/80 rounded-xl">
                                                                                {hasSpecificApplied ? (
                                                                                    applied.map((id) => {
                                                                                        const pkg = detailPackages.find((p) => Number(p.id) === Number(id));
                                                                                        const pkgName = pkg ? pkg.name : `Gói ID #${id}`;
                                                                                        const pkgPrice = pkg?.price ? formatMoney(pkg.price) : null;
                                                                                        return (
                                                                                            <div
                                                                                                key={`app-${id}`}
                                                                                                className="bg-white border border-emerald-200/80 text-emerald-900 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center justify-between shadow-2xs"
                                                                                            >
                                                                                                <div className="flex items-center gap-2">
                                                                                                    <span className="text-emerald-600 font-black text-xs">✓</span>
                                                                                                    <span>{pkgName}</span>
                                                                                                </div>
                                                                                                {pkgPrice && (
                                                                                                    <span className="text-[11px] font-mono text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                                                                                                        {pkgPrice}
                                                                                                    </span>
                                                                                                )}
                                                                                            </div>
                                                                                        );
                                                                                    })
                                                                                ) : (
                                                                                    detailPackages.map((pkg) => (
                                                                                        <div
                                                                                            key={`app-all-${pkg.id}`}
                                                                                            className="bg-white border border-emerald-200/80 text-emerald-900 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center justify-between shadow-2xs"
                                                                                        >
                                                                                            <div className="flex items-center gap-2">
                                                                                                <span className="text-emerald-600 font-black text-xs">✓</span>
                                                                                                <span>{pkg.name}</span>
                                                                                            </div>
                                                                                            {pkg.price && (
                                                                                                <span className="text-[11px] font-mono text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                                                                                                    {formatMoney(pkg.price)}
                                                                                                </span>
                                                                                            )}
                                                                                        </div>
                                                                                    ))
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    {/* Danh sách các gói vé bị loại trừ (nếu có) */}
                                                                    {hasExcluded && (
                                                                        <div>
                                                                            <p className="text-[10px] font-bold uppercase text-rose-600 mb-1">
                                                                                ✗ LOẠI TRỪ ({excluded.length}) GÓI:
                                                                            </p>
                                                                            <div className="flex flex-col gap-1.5 max-h-24 overflow-y-auto p-2 bg-rose-50/50 border border-rose-100 rounded-xl">
                                                                                {excluded.map((id) => {
                                                                                    const pkg = detailPackages.find((p) => Number(p.id) === Number(id));
                                                                                    const pkgName = pkg ? pkg.name : `Gói ID #${id}`;
                                                                                    return (
                                                                                        <div
                                                                                            key={`ex-${id}`}
                                                                                            className="bg-white border border-rose-200 text-rose-800 text-xs font-semibold px-3 py-1 rounded-lg flex items-center gap-2"
                                                                                        >
                                                                                            <span className="text-rose-600 font-bold">✗</span>
                                                                                            <span>{pkgName}</span>
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* KHỐI 4: LỊCH SỬ REDEEM */}
                                            {recent.length > 0 && (
                                                <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-4 space-y-3">
                                                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                                                        <History size={15} className="text-slate-500" />
                                                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                                                            LỊCH SỬ GIAO DỊCH (20 LẦN DÙNG GẦN NHẤT)
                                                        </h3>
                                                    </div>
                                                    <div className="border border-slate-100 rounded-lg overflow-hidden">
                                                        <Table>
                                                            <TableHeader className="bg-slate-50">
                                                                <TableRow className="hover:bg-transparent border-none">
                                                                    <TableHead className="text-[10px] font-bold uppercase py-2">MÃ BOOKING</TableHead>
                                                                    <TableHead className="text-[10px] font-bold uppercase py-2">MỨC GIẢM</TableHead>
                                                                    <TableHead className="text-[10px] font-bold uppercase py-2">THỜI GIAN</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {recent.map((r: any, i: number) => (
                                                                    <TableRow key={`rd-${r.id || i}`} className="hover:bg-slate-50 border-t border-slate-100">
                                                                        <TableCell className="text-xs font-mono font-semibold">#{r.booking_id}</TableCell>
                                                                        <TableCell className="text-xs font-bold text-emerald-600">
                                                                            -{formatMoney(r.discount_amount_applied)}
                                                                        </TableCell>
                                                                        <TableCell className="text-[11px] text-slate-500">
                                                                            {r.redeemed_at ? format(new Date(r.redeemed_at), 'dd/MM/yyyy HH:mm') : '-'}
                                                                        </TableCell>
                                                                    </TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>
                                                    </div>
                                                </div>
                                            )}

                                            {/* KHỐI 5: FOOTER AUDIT */}
                                            <div className="bg-white border border-slate-200/80 rounded-xl p-3 text-[11px] text-slate-500 flex items-center justify-between shadow-xs">
                                                <span>
                                                    Tạo bởi: <b className="text-slate-800">{selectedVoucher.created_by_staff_name || 'Hệ thống'}</b>
                                                </span>
                                                <span>
                                                    Cập nhật lần cuối:{' '}
                                                    <b className="text-slate-800">
                                                        {selectedVoucher.updated_at
                                                            ? format(new Date(selectedVoucher.updated_at), 'dd/MM/yyyy HH:mm')
                                                            : '-'}
                                                    </b>{' '}
                                                    bởi <b className="text-slate-800">{selectedVoucher.updated_by_staff_name || 'Hệ thống'}</b>
                                                </span>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
            {/* DIALOG XÁC NHẬN SỬA TRƯỜNG QUAN TRỌNG */}
            <AlertDialog open={!!confirmSaveData} onOpenChange={(open) => !open && setConfirmSaveData(null)}>
                <AlertDialogContent className="rounded-2xl font-sans bg-white max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-slate-900 flex items-center gap-2">
                            <ShieldAlert className="w-5 h-5 text-amber-500" />
                            Xác nhận thay đổi Voucher
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild className="text-slate-600 text-sm mt-2">
                            <div>
                                <p className="mb-3">
                                    Bạn đang thay đổi các thông số quan trọng của voucher <strong>{editData?.code}</strong>:
                                </p>
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1 text-xs text-amber-900 font-medium mb-3">
                                    {confirmSaveData?.changes.map((c, i) => (
                                        <div key={i} className="flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                            <span>{c}</span>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-xs text-slate-500 italic">
                                    Thay đổi này sẽ tác động trực tiếp đến mức ưu đãi khi khách hàng áp dụng voucher cho các đơn hàng mới.
                                </p>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <AlertDialogFooter className="mt-4">
                        <AlertDialogCancel className="rounded-xl border-slate-200">Hủy bỏ</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={isSaving}
                            onClick={() => confirmSaveData && executeSave(confirmSaveData.payload)}
                            className="rounded-xl text-white bg-amber-600 hover:bg-amber-700 font-medium"
                        >
                            {isSaving ? 'Đang lưu...' : 'Xác nhận lưu'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
