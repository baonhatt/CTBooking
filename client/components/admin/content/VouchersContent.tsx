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
    Tag,
    RotateCcw,
    Loader2,
    Search,
    Check,
    Copy,
    FileText,
    User,
    History,
    ArrowUp,
    ArrowDown,
    ArrowUpDown
} from 'lucide-react';
import { formatToVNDatetimeLocal, vnDatetimeLocalToUTC } from '@/lib/utils';
import { isAfter, isBefore } from 'date-fns';
import { formatVnDate, formatVnDateTime } from '@/lib/format';
import { request } from '@/lib/api/http';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BranchMultiSelect } from '@/components/admin/BranchMultiSelect';
import { BranchIdsBadge } from '@/components/admin/BranchIdsBadge';
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
import { useStaffPermissions, useIsSuperAdmin } from '@/hooks/useStaffPermission';
import { AdminDialog, AdminDialogFooter } from '@/components/admin/common/AdminDialog';
import { ConfirmDialog } from '@/components/admin/common/ConfirmDialog';
import { RowActionButton, RowActions } from '@/components/admin/common/RowActionButton';
import { StatusBadge } from '@/components/admin/common/StatusBadge';
import { PageHeader } from '@/components/admin/common/PageHeader';
import { AdminPagination } from '@/components/admin/common/AdminPagination';
import { EmptyState, TableSkeleton } from '@/components/admin/common/EmptyState';
import { FormField, FormSection } from '@/components/admin/common/FormField';
import { notify } from '@/components/admin/common/notify';
import {
    ADMIN_INPUT,
    ADMIN_BTN_OUTLINE,
    ADMIN_BTN_PRIMARY,
    ADMIN_CARD,
    ADMIN_TABLE_HEAD,
    ADMIN_TEXT,
    ADMIN_TH
} from '@/components/admin/common/adminTokens';

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
    branch_ids?: number[] | null;
    is_active?: boolean;
    is_deleted?: boolean;
    deleted_at?: string | null;
    deleted_by_staff_name?: string | null;
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
    // Status filter and sortable columns (only the active list uses them)
    statusFilter?: string;
    setStatusFilter?: (status: string) => void;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
    onSortChange?: (sortKey: string) => void;
}

// Required fields of the voucher form: the order they are checked and focused in (top to bottom on screen)
type VoucherField = 'code' | 'name' | 'discount_value' | 'valid_until' | 'packages' | 'branch_ids';
const VOUCHER_FIELD_ORDER: VoucherField[] = ['code', 'name', 'discount_value', 'valid_until', 'packages', 'branch_ids'];
const VOUCHER_FIELD_IDS: Record<VoucherField, string> = {
    code: 'fmi_voucher_code',
    name: 'fmi_voucher_name',
    discount_value: 'fmi_voucher_discount_value',
    valid_until: 'fmi_voucher_valid_until',
    packages: 'div_voucher_packages',
    branch_ids: 'div_voucher_branch_ids'
};
// Which form field's error goes away when a given editData key changes
const VOUCHER_KEY_TO_FIELD: Record<string, VoucherField> = {
    code: 'code',
    name: 'name',
    discount_value: 'discount_value',
    valid_from: 'valid_until',
    valid_until: 'valid_until',
    applicable_ticket_package_ids: 'packages',
    branch_ids: 'branch_ids'
};

// How many redemptions the detail asks for: the first page, then "xem thêm" steps (the server caps at 200)
const REDEMPTION_LIMIT_STEPS = [20, 100, 200];

// A voucher counts as "nearly out" when this share of its quota is used (same rule as the server filter)
const LOW_QUOTA_SHARE = 0.9;

// Red text under a form field
function FieldError({ message }: { message?: string }) {
    if (!message) return null;
    return (
        <p role="alert" className="text-[11px] text-red-600 mt-1">
            {message}
        </p>
    );
}

// A voucher is "permanent" when it has neither a start nor an end date
const is_voucher_permanent = (voucher: any): boolean => {
    if (!voucher || !voucher.id) return false;
    return !voucher.valid_until && !voucher.valid_from;
};

// Number list as a sorted copy (order does not matter for ids); null stays null so "all" differs from "none"
const sorted_id_list = (ids: unknown): number[] | null => {
    if (!Array.isArray(ids)) return null;
    return ids.map((id) => Number(id)).sort((a, b) => a - b);
};

// Every editable field of the voucher form in a fixed shape, so two states can be compared by content
const voucher_form_snapshot = (form: any, permanent: boolean): string => {
    const source = form || {};
    return JSON.stringify({
        code: source.code || '',
        name: source.name || '',
        sale_staff_id: source.sale_staff_id ? Number(source.sale_staff_id) : null,
        note: (source.note !== undefined ? source.note : source.description) || '',
        scope: source.scope || 'all',
        discount_type: source.discount_type || 'percent',
        discount_value: Number(source.discount_value || 0),
        max_discount: Number(source.max_discount || 0),
        min_order_value: Number(source.min_order_value || 0),
        usage_limit: source.usage_limit === null || source.usage_limit === undefined ? null : Number(source.usage_limit),
        per_user_limit: Number(source.per_user_limit ?? 1),
        valid_from: permanent ? null : source.valid_from || null,
        valid_until: permanent ? null : source.valid_until || null,
        permanent,
        applicable_ticket_package_ids: sorted_id_list(source.applicable_ticket_package_ids),
        branch_ids: sorted_id_list(source.branch_ids),
        is_active: !!(source.is_active ?? true)
    });
};

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
    return formatToVNDatetimeLocal(dateStr);
};

const fromLocalDatetimeString = (val: string): string | null => {
    if (!val) return null;
    return vnDatetimeLocalToUTC(val);
};

const getTodayStartIso = () => {
    const d = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const parts = formatter.formatToParts(d);
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';
    const dateStr = `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
    return new Date(`${dateStr}T00:00:00+07:00`).toISOString();
};

const getTodayEndIso = () => {
    const d = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const parts = formatter.formatToParts(d);
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';
    const dateStr = `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
    return new Date(`${dateStr}T23:59:59+07:00`).toISOString();
};

// Does a ticket package belong to one of the selected branches? A package with no branch set is global (all branches).
// An empty selection matches nothing.
function package_in_branches(pkg: any, allowed_branch_ids: number[]): boolean {
    if (allowed_branch_ids.length === 0) return false;
    const allowed = new Set(allowed_branch_ids.map(Number));
    let package_branches: number[] = [];
    if (Array.isArray(pkg.branch_ids)) {
        package_branches = pkg.branch_ids.map(Number);
    } else if (typeof pkg.branch_ids === 'string' && pkg.branch_ids.trim().length > 0) {
        try {
            const parsed = JSON.parse(pkg.branch_ids);
            if (Array.isArray(parsed)) package_branches = parsed.map(Number);
        } catch {
            package_branches = [];
        }
    }
    if (typeof pkg.branch_id === 'number') package_branches = [...package_branches, pkg.branch_id];
    if (package_branches.length === 0) return true;
    return package_branches.some((id) => allowed.has(id));
}

export default function VouchersContent(props: Props) {
    const navigate = useNavigate();
    const permissions = useStaffPermissions();
    const isSuperAdmin = useIsSuperAdmin();

    const hasPermission = (module: string, action: string) => {
        if (isSuperAdmin) return true;
        return permissions.some((p) => p.module === module && p.action === action);
    };

    // A voucher for all branches, for no branch, or for a branch the staff member does not manage can only be changed by
    // the Super Admin. The server enforces this too; here the Save button is locked and the reason shown.
    const isVoucherLockedForStaff = (branchIds: unknown, managedBranchIds: number[]) => {
        if (isSuperAdmin) return false;
        if (!Array.isArray(branchIds) || branchIds.length === 0) return true;
        return branchIds.some((id) => !managedBranchIds.includes(Number(id)));
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
        onRestore,
        statusFilter = 'all',
        setStatusFilter,
        sortBy = 'created_at',
        sortDir = 'desc',
        onSortChange
    } = props;
    const { isLoading = false } = props as any;

    const [isDeletingId, setIsDeletingId] = useState<number | null>(null);
    // The voucher a confirm dialog is about (one dialog for the whole list, not one per row)
    const [voucherToDelete, setVoucherToDelete] = useState<VoucherItem | null>(null);
    const [voucherToRestore, setVoucherToRestore] = useState<VoucherItem | null>(null);
    // Asks before the edit form is cancelled while it has unsaved changes
    const [askDiscardEdit, setAskDiscardEdit] = useState(false);
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
    // Initialised from the voucher being edited, so the first render of the dialog already shows the right value
    const [isPermanent, setIsPermanent] = useState(() => (isEditOpen ? is_voucher_permanent(editData) : false));
    // Which voucher the form was last set up for ('' = dialog closed); re-syncs isPermanent during render, before paint
    const form_key = isEditOpen && editData ? String(editData.id || 0) : '';
    const [synced_form_key, setSyncedFormKey] = useState(form_key);
    if (synced_form_key !== form_key) {
        setSyncedFormKey(form_key);
        if (form_key) setIsPermanent(is_voucher_permanent(editData));
    }
    // The form as it was right after it was set up; null until the open effect has initialised it
    const [initial_form_snapshot, setInitialFormSnapshot] = useState<string | null>(null);
    const [isCodeEditable, setIsCodeEditable] = useState(false);
    const [confirmSaveData, setConfirmSaveData] = useState<{ payload: any; changes: string[] } | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Partial<Record<VoucherField, string>>>({});
    const [redemptionLimitStep, setRedemptionLimitStep] = useState(0);
    const [isLoadingDetail, setIsLoadingDetail] = useState(false);

    // Dirty = any editable field differs from the snapshot taken when the form was set up
    const isDirty = React.useMemo(() => {
        if (!isEditOpen || !editData || initial_form_snapshot === null) return false;
        return voucher_form_snapshot(editData, isPermanent) !== initial_form_snapshot;
    }, [isEditOpen, editData, isPermanent, initial_form_snapshot]);

    // Called by AdminDialog after the unsaved-changes prompt (if any) was accepted
    const close_edit_dialog = () => {
        setAskDiscardEdit(false);
        setIsEditOpen(false);
        setEditData({});
    };

    // The footer "Hủy" button: ask first when the form has unsaved changes
    const request_close_edit = () => {
        if (isDirty) {
            setAskDiscardEdit(true);
            return;
        }
        close_edit_dialog();
    };

    useEffect(() => {
        if (isEditOpen && editData) {
            // Always reset code editability (and old form errors) when dialog opens
            setIsCodeEditable(false);
            setFieldErrors({});
            let initialForm = editData;
            if (!editData.id || editData.id === 0) {
                // When creating new voucher: if no dates provided, initialize to today start & end
                if (!editData.valid_from && !editData.valid_until) {
                    initialForm = {
                        ...editData,
                        valid_from: getTodayStartIso(),
                        valid_until: getTodayEndIso()
                    };
                    setEditData(initialForm);
                }
            }
            // Snapshot AFTER the defaults above, so opening the form never counts as a change
            setInitialFormSnapshot(voucher_form_snapshot(initialForm, is_voucher_permanent(initialForm)));
        } else {
            setInitialFormSnapshot(null);
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

    // Packages of the chosen scope, narrowed to the chosen branches. Reloads when the scope or the branches change.
    const packagesScopeRef = React.useRef<string | null>(null);
    useEffect(() => {
        if (!isEditOpen) {
            packagesScopeRef.current = null;
            return;
        }
        let cancelled = false;
        const scope = editData?.scope || 'vr';
        const branchIds = editData?.branch_ids;
        // Do not show packages of the previous scope while the new list loads
        if (packagesScopeRef.current !== scope) {
            setVrPackages([]);
            packagesScopeRef.current = scope;
        }
        listVRTicketPackagesForVoucher(scope)
            .then((res) => {
                if (cancelled) return;
                const packages = res.items || [];
                setVrPackages(Array.isArray(branchIds) ? packages.filter((pkg: any) => package_in_branches(pkg, branchIds as number[])) : packages);
            })
            .catch(() => { });
        return () => {
            cancelled = true;
        };
    }, [isEditOpen, editData?.scope, JSON.stringify(editData?.branch_ids)]);

    useEffect(() => {
        if (!isEditOpen) return;
        getAdminBranchOptions({ includeInactive: true })
            .then((res) => {
                setBranchOptions(res.items || []);
            })
            .catch(() => { });
    }, [isEditOpen]);

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

    // The list rows carry no redemption history or creator name, so the detail endpoint is read when the detail opens
    useEffect(() => {
        if (!isDetailDialogOpen || !selectedVoucher) return;
        const voucherId = selectedVoucher.id;
        let cancelled = false;
        setIsLoadingDetail(true);
        request<any>(`/api/admin/vouchers/${voucherId}?redemption_limit=${REDEMPTION_LIMIT_STEPS[redemptionLimitStep]}`)
            .then((detail) => {
                if (cancelled || !detail) return;
                // used_count and total_revenue stay as the list computed them
                const { used_count: _usedCount, total_revenue: _totalRevenue, ...detailFields } = detail;
                setSelectedVoucher((current) => (current && current.id === voucherId ? { ...current, ...detailFields } : current));
            })
            .catch(() => { })
            .finally(() => {
                if (!cancelled) setIsLoadingDetail(false);
            });
        return () => {
            cancelled = true;
        };
    }, [isDetailDialogOpen, selectedVoucher?.id, redemptionLimitStep]);

    const openDetail = (voucher: VoucherItem) => {
        setRedemptionLimitStep(0);
        setSelectedVoucher(voucher);
        setIsDetailDialogOpen(true);
    };

    const handleCopyBookingCode = (bookingCode: string) => {
        navigator.clipboard.writeText(bookingCode);
        notify.copied('mã đặt chỗ');
    };

    const handleToggleStatus = async (id: number, currentStatus: boolean) => {
        setIsTogglingId(id);
        try {
            await toggleVoucherStatusApi(id);
            notify.success(!currentStatus ? 'Đã bật voucher' : 'Đã ẩn voucher');
            setVoucherToToggle(null);
            onRefresh();
        } catch (err: any) {
            notify.error(err, 'Lỗi khi thay đổi trạng thái');
        } finally {
            setIsTogglingId(null);
        }
    };

    const handleDeleteConfirm = async (voucher: VoucherItem) => {
        setIsDeletingId(voucher.id);
        try {
            await deleteVoucherApi(voucher.id);
            notify.deleted('voucher');
            setVoucherToDelete(null);
            onRefresh();
        } catch (err: any) {
            notify.error(err, 'Xóa voucher thất bại');
        } finally {
            setIsDeletingId(null);
        }
    };

    const handleRestore = async (voucher: VoucherItem) => {
        if (!restoreVoucherApi) return;
        setIsRestoringId(voucher.id);
        try {
            await restoreVoucherApi(voucher.id);
            notify.restored('voucher');
            setVoucherToRestore(null);
            onRefresh();
        } catch (err: any) {
            notify.error(err, 'Khôi phục thất bại');
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
                notify.saved('voucher');
            } else {
                await createVoucherApi(payload);
                notify.created('voucher');
            }
            setConfirmSaveData(null);
            setIsEditOpen(false);
            setEditData(null);
            onRefresh();
        } catch (err: any) {
            const message = err.message || 'Lưu voucher thất bại';
            if (String(message).includes('đã tồn tại')) {
                // Duplicate code: show it under the code field
                setConfirmSaveData(null);
                show_field_errors({ code: message });
            } else {
                notify.error(message);
            }
        } finally {
            setIsSaving(false);
        }
    };

    const isEditLocked = !!editData?.id && isVoucherLockedForStaff(editData?.branch_ids, branchOptions.map((b) => b.id));

    // Changes some fields of the form and clears the errors those fields had
    const update_fields = (patch: Record<string, any>) => {
        setEditData({ ...editData, ...patch });
        if (Object.keys(fieldErrors).length === 0) return;
        const nextErrors = { ...fieldErrors };
        Object.keys(patch).forEach((key) => {
            const field = VOUCHER_KEY_TO_FIELD[key];
            if (field) delete nextErrors[field];
        });
        setFieldErrors(nextErrors);
    };

    // Shows the errors under their fields and puts the cursor on the first one
    const show_field_errors = (errors: Partial<Record<VoucherField, string>>) => {
        setFieldErrors(errors);
        const firstField = VOUCHER_FIELD_ORDER.find((field) => errors[field]);
        if (!firstField) return;
        const element = document.getElementById(VOUCHER_FIELD_IDS[firstField]);
        if (!element) return;
        element.scrollIntoView({ block: 'center' });
        element.focus();
    };

    // What is wrong with the form, field by field. A limited staff member names branches of their own; nobody saves an empty list.
    const collect_voucher_errors = (payload: any, discountValue: number) => {
        const errors: Partial<Record<VoucherField, string>> = {};
        if (!payload.code || payload.code.trim() === '') errors.code = 'Vui lòng nhập mã voucher';
        if (!payload.name || payload.name.trim() === '') errors.name = 'Vui lòng nhập tên chương trình';
        if (isNaN(discountValue) || discountValue <= 0) {
            errors.discount_value = 'Giá trị giảm giá phải lớn hơn 0';
        } else if (payload.discount_type === 'percent' && (discountValue < 1 || discountValue > 100)) {
            errors.discount_value = 'Phần trăm giảm giá phải từ 1 đến 100';
        }
        if (!isPermanent && payload.valid_from && payload.valid_until) {
            if (new Date(payload.valid_until).getTime() <= new Date(payload.valid_from).getTime()) {
                errors.valid_until = 'Ngày hết hạn phải sau ngày bắt đầu';
            }
        }
        if (
            (payload.scope || 'all') !== 'all' &&
            Array.isArray(payload.applicable_ticket_package_ids) &&
            payload.applicable_ticket_package_ids.length === 0
        ) {
            errors.packages = 'Vui lòng chọn ít nhất 1 gói áp dụng (hoặc chọn tất cả)';
        }
        if (!isSuperAdmin) {
            const chosen = payload.branch_ids ?? branchOptions.map((b) => b.id);
            if (!Array.isArray(chosen) || chosen.length === 0) errors.branch_ids = 'Vui lòng chọn ít nhất một chi nhánh';
        } else if (Array.isArray(payload.branch_ids) && payload.branch_ids.length === 0) {
            errors.branch_ids = 'Vui lòng chọn ít nhất một chi nhánh hoặc chọn "Tất cả chi nhánh"';
        }
        return errors;
    };

    const handleSave = async () => {
        if (!editData) return;
        const payload = { ...editData };
        if (!['percent', 'fixed'].includes(payload.discount_type)) {
            notify.error('Loại giảm giá không hợp lệ');
            return;
        }
        const value = Number(payload.discount_value);
        const errors = collect_voucher_errors(payload, value);
        if (Object.keys(errors).length > 0) {
            show_field_errors(errors);
            return;
        }
        setFieldErrors({});
        // A limited staff member who left the branches empty saves for all the branches they manage
        if (!isSuperAdmin) payload.branch_ids = payload.branch_ids ?? branchOptions.map((b) => b.id);
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
            // An empty list was refused above. A list is kept as it is; null means all packages.
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
        notify.copied('mã voucher');
    };

    // Column header; a button that sorts the list when the page supports it
    const sort_head = (label: string, sortKey: string, extraClass = '') => {
        const isSorted = sortBy === sortKey;
        const SortIcon = isSorted ? (sortDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
        return (
            <TableHead
                className={`${ADMIN_TH} py-3.5 ${extraClass}`}
                aria-sort={isSorted ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
            >
                {onSortChange && !isDeletedView ? (
                    <button
                        type="button"
                        onClick={() => onSortChange(sortKey)}
                        className="inline-flex items-center gap-1 uppercase hover:text-slate-900"
                        title="Bấm để sắp xếp"
                    >
                        {label}
                        <SortIcon className={`w-3 h-3 ${isSorted ? 'text-blue-600' : 'text-gray-400'}`} />
                    </button>
                ) : (
                    label
                )}
            </TableHead>
        );
    };

    // Nothing in the list: "Chưa có" when the list is really empty, "Không tìm thấy" when a filter hides everything
    const renderEmptyState = () => {
        if (isDeletedView) return <EmptyState title="Chưa có voucher nào bị xóa" icon={<Tag className="h-6 w-6" />} />;
        const isFiltered = !!searchText || statusFilter !== 'all' || scopeFilter !== 'all';
        const createLabel =
            scopeFilter === 'movie' ? 'Thêm voucher phim' : scopeFilter === 'all' ? 'Thêm voucher' : 'Thêm voucher VR';
        if (isFiltered) {
            return <EmptyState title="Không tìm thấy voucher phù hợp" icon={<Tag className="h-6 w-6" />} />;
        }
        return (
            <EmptyState
                title="Chưa có voucher nào"
                description={hasPermission('vouchers', 'create') ? `Bấm "${createLabel}" để tạo ưu đãi đầu tiên` : undefined}
                icon={<Tag className="h-6 w-6" />}
            />
        );
    };

    return (
        <div className="space-y-6 font-sans">
            {/* PAGE HEADER */}
            <PageHeader
                title={isDeletedView ? 'Quản lý mã giảm giá đã xóa' : 'Quản lý mã giảm giá'}
                description={
                    isDeletedView
                        ? `Đang hiển thị ${data.length} voucher trong thùng rác`
                        : `Đang hiển thị ${data.length} voucher`
                }
            />

            {/* TOOLBAR */}
            <div className={`${ADMIN_CARD} flex flex-col items-start justify-between gap-4 p-4 xl:flex-row xl:items-center`}>
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
                                className="w-full pl-10 pr-8 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500 rounded-xl transition-all outline-none text-sm h-10"
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
                        <Button type="submit" className={`${ADMIN_BTN_PRIMARY} flex shrink-0 items-center gap-1.5`}>
                            <Search className="w-3.5 h-3.5" /> {ADMIN_TEXT.search}
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
                            <span className="text-[11px] font-bold text-slate-500 uppercase whitespace-nowrap">
                                Chỉ hiện khả dụng
                            </span>
                            <Switch
                                checked={showActiveOnly}
                                aria-label="Chỉ hiện voucher khả dụng"
                                onCheckedChange={setShowActiveOnly}
                                className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-gray-300 cursor-pointer"
                            />
                        </div>
                    )}

                    {/* Status filter: expired / not started / quota */}
                    {!isDeletedView && setStatusFilter && (
                        <select
                            aria-label="Lọc theo tình trạng voucher"
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value);
                                setPage(1);
                            }}
                            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none shadow-sm cursor-pointer h-10"
                        >
                            <option value="all">Mọi tình trạng</option>
                            <option value="expired">Đã hết hạn</option>
                            <option value="upcoming">Chưa bắt đầu</option>
                            <option value="low_quota">Sắp hết lượt</option>
                            <option value="out_of_quota">Hết lượt dùng</option>
                        </select>
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
                            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none shadow-sm cursor-pointer h-10"
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
                            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none shadow-sm cursor-pointer h-10"
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
                            className={`${ADMIN_BTN_OUTLINE} flex items-center gap-2`}
                        >
                            <Trash2 className="w-4 h-4 text-slate-500" />
                            <span className="hidden sm:inline">Xem đã xóa</span>
                        </Button>
                    )}

                    {isDeletedView && (
                        <Button
                            variant="outline"
                            onClick={() => navigate('/vouchers')}
                            className={`${ADMIN_BTN_OUTLINE} flex items-center gap-2`}
                        >
                            <RotateCcw className="w-4 h-4" />
                            <span>Về danh sách</span>
                        </Button>
                    )}

                    {!isDeletedView && hasPermission('vouchers', 'create') && (
                        <Button
                            onClick={onCreate}
                            className={`${ADMIN_BTN_PRIMARY} gap-2 whitespace-nowrap`}
                        >
                            <Plus className="w-4 h-4" />
                            {scopeFilter === 'movie'
                                ? 'Thêm voucher phim'
                                : scopeFilter === 'all'
                                    ? 'Thêm voucher'
                                    : 'Thêm voucher VR'}
                        </Button>
                    )}

                    <Button
                        variant="outline"
                        onClick={onRefresh}
                        className={`${ADMIN_BTN_OUTLINE} w-10 shrink-0 px-0`}
                        title={ADMIN_TEXT.refresh}
                        aria-label="Làm mới danh sách"
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            {/* TABLE */}
            <div className={`${ADMIN_CARD} overflow-hidden`}>
                <Table className="[&_td]:px-3 [&_th]:px-3">
                    <TableHeader className={ADMIN_TABLE_HEAD}>
                        <TableRow className="hover:bg-transparent border-none">
                            {sort_head('Mã voucher', 'code')}
                            {sort_head('Tên chương trình', 'name')}
                            {sort_head('Mức giảm', 'discount_value')}
                            {sort_head('Đã dùng / Còn lại', 'used_count')}
                            {sort_head('Thời gian hiệu lực', 'valid_until', 'min-w-[140px]')}
                            <TableHead className={`${ADMIN_TH} hidden min-w-[120px] py-3.5 2xl:table-cell`}>Chi nhánh</TableHead>
                            <TableHead className={`${ADMIN_TH} py-3.5 text-center`}>Trạng thái</TableHead>
                            <TableHead className={`${ADMIN_TH} py-3.5 pr-4 text-right`}>{ADMIN_TEXT.actionColumn}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow className="hover:bg-transparent">
                                <TableCell colSpan={8} className="p-0">
                                    <TableSkeleton rows={5} />
                                </TableCell>
                            </TableRow>
                        ) : data.length === 0 ? (
                            <TableRow className="hover:bg-transparent">
                                <TableCell colSpan={8} className="p-0">
                                    {renderEmptyState()}
                                </TableCell>
                            </TableRow>
                        ) : (
                            data.map((v) => {
                                const expired = isExpired(v);
                                const future = isFuture(v);
                                const used = v.used_count ?? v.redemption_total_count ?? 0;
                                const limit = v.usage_limit;
                                const remaining = limit ? Math.max(0, Number(limit) - used) : null;
                                const isOutOfQuota = !!limit && used >= Number(limit);
                                const isLowQuota = !!limit && !isOutOfQuota && used >= Number(limit) * LOW_QUOTA_SHARE;
                                return (
                                    <TableRow
                                        key={v.id}
                                        className={`group border-b border-slate-100 transition-colors hover:bg-slate-50 ${expired ? 'opacity-60' : future ? 'opacity-70' : ''}`}
                                    >
                                        <TableCell>
                                            <div className="flex flex-col items-start gap-1.5">
                                                <span
                                                    onClick={() => handleCopyCode(v.code)}
                                                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50/50 px-2.5 py-1 font-mono text-xs font-bold tracking-wider text-purple-700 transition-all hover:bg-purple-100/80 active:scale-95"
                                                    title="Bấm để sao chép mã"
                                                >
                                                    {v.code}
                                                    <Copy className="h-3 w-3 text-purple-400 opacity-70" />
                                                </span>
                                                {/* Below 2xl the Branch column is hidden, so the branches sit under the code */}
                                                <div className="2xl:hidden">
                                                    <BranchIdsBadge branch_ids={v.branch_ids} branches={branches} className="text-[11px]" />
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col items-start gap-1">
                                                <p className="max-w-[200px] truncate text-sm font-semibold leading-tight text-slate-800 2xl:max-w-[260px]" title={v.name}>
                                                    {v.name}
                                                </p>
                                                {v.min_order_value && v.min_order_value > 0 ? (
                                                    <p className="text-[11px] text-slate-500">
                                                        Đơn tối thiểu: <b>{formatMoney(v.min_order_value)}</b>
                                                    </p>
                                                ) : null}
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    {v.scope === 'movie' ? (
                                                        <Badge variant="outline" className="gap-1 border-blue-200 bg-blue-50 text-[11px] font-semibold text-blue-700">
                                                            <Film size={10} /> Phim
                                                        </Badge>
                                                    ) : v.scope === 'all' ? (
                                                        <Badge variant="outline" className="gap-1 border-indigo-200 bg-indigo-50 text-[11px] font-semibold text-indigo-700">
                                                            <TicketIcon size={10} /> Toàn đơn
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="gap-1 border-purple-200 bg-purple-50 text-[11px] font-semibold text-purple-700">
                                                            <Gamepad2 size={10} /> VR
                                                        </Badge>
                                                    )}
                                                    {v.sale_name ? (
                                                        <span className="inline-flex max-w-[120px] items-center gap-1 truncate text-[11px] text-slate-500" title={v.sale_name}>
                                                            <User className="h-3 w-3 shrink-0" /> {v.sale_name}
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {v.discount_type === 'percent' ? (
                                                <div className="flex flex-col items-start gap-0.5">
                                                    <Badge variant="outline" className="gap-1 whitespace-nowrap border-amber-300 bg-amber-50 text-xs font-bold text-amber-800">
                                                        <Percent className="h-3 w-3" />
                                                        {v.discount_value}%
                                                    </Badge>
                                                    {v.max_discount ? (
                                                        <span className="text-[11px] text-slate-500">tối đa {formatMoney(v.max_discount)}</span>
                                                    ) : null}
                                                </div>
                                            ) : (
                                                <Badge variant="outline" className="gap-1 whitespace-nowrap border-emerald-300 bg-emerald-50 text-xs font-bold text-emerald-800">
                                                    <CircleDollarSign className="h-3 w-3" />
                                                    {formatMoney(v.discount_value)}
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-xs font-medium text-slate-700">
                                                    <span className="font-bold text-purple-600">{used}</span>
                                                    <span className="mx-1 text-slate-400">/</span>
                                                    <span className={limit ? 'font-semibold text-slate-700' : 'text-slate-400'}>
                                                        {limit ? Number(limit).toLocaleString() : '∞'}
                                                    </span>
                                                </span>
                                                {remaining !== null ? (
                                                    isOutOfQuota ? (
                                                        <StatusBadge tone="danger" className="w-fit">
                                                            Hết lượt
                                                        </StatusBadge>
                                                    ) : (
                                                        <span className={`text-[11px] font-semibold ${isLowQuota ? 'text-amber-600' : 'text-slate-500'}`}>
                                                            Còn {remaining.toLocaleString()} lượt{isLowQuota ? ' - sắp hết' : ''}
                                                        </span>
                                                    )
                                                ) : null}
                                                {v.total_revenue !== undefined && v.total_revenue > 0 ? (
                                                    <span className="text-[11px] font-semibold text-emerald-600">Thu: {formatMoney(v.total_revenue)}</span>
                                                ) : null}
                                                {v.per_user_limit ? (
                                                    <span className="text-[11px] text-slate-400">{v.per_user_limit} lượt/người dùng</span>
                                                ) : null}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col items-start gap-1">
                                                {expired ? (
                                                    <StatusBadge tone="danger">Hết hiệu lực</StatusBadge>
                                                ) : future ? (
                                                    <StatusBadge tone="info">Chưa bắt đầu</StatusBadge>
                                                ) : (
                                                    <StatusBadge tone="success">Đang hiệu lực</StatusBadge>
                                                )}
                                                <span className="flex items-center gap-1 text-[11px] text-slate-500">
                                                    <CalendarDays className="h-3 w-3 shrink-0 text-slate-400" />
                                                    {v.valid_from ? (
                                                        <>
                                                            {formatVnDate(v.valid_from)}
                                                            {v.valid_until ? <> → {formatVnDate(v.valid_until)}</> : ' → Vĩnh viễn'}
                                                        </>
                                                    ) : v.valid_until ? (
                                                        <>→ hết {formatVnDate(v.valid_until)}</>
                                                    ) : (
                                                        <span className="font-medium text-slate-400">Vĩnh viễn</span>
                                                    )}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="hidden 2xl:table-cell">
                                            <BranchIdsBadge branch_ids={v.branch_ids} branches={branches} className="text-[11px]" />
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {isDeletedView ? (
                                                <div className="flex flex-col items-center gap-1">
                                                    <StatusBadge tone="danger">Đã xóa</StatusBadge>
                                                    {v.deleted_at && (
                                                        <span className="text-[11px] text-slate-500">{formatVnDateTime(v.deleted_at)}</span>
                                                    )}
                                                    {v.deleted_by_staff_name && (
                                                        <span className="text-[11px] text-slate-500">bởi {v.deleted_by_staff_name}</span>
                                                    )}
                                                </div>
                                            ) : isTogglingId === v.id ? (
                                                <Loader2 className="mx-auto h-4 w-4 animate-spin text-slate-400" />
                                            ) : hasPermission('vouchers', 'toggle_status') ? (
                                                <div className="flex items-center justify-center">
                                                    <Switch
                                                        checked={!!v.is_active}
                                                        aria-label={`Đổi trạng thái voucher ${v.code}`}
                                                        className="cursor-pointer border-2 border-transparent opacity-100 shadow-none transition-all data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-gray-300"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            setVoucherToToggle({ id: v.id, currentStatus: !!v.is_active });
                                                        }}
                                                    />
                                                </div>
                                            ) : (
                                                <StatusBadge status={v.is_active ? 'active' : 'inactive'} />
                                            )}
                                        </TableCell>
                                        <TableCell className="pr-4">
                                            <RowActions>
                                                <RowActionButton action="view" label={`Xem chi tiết voucher ${v.code}`} onClick={() => openDetail(v)} />
                                                {!isDeletedView && hasPermission('vouchers', 'edit') && (
                                                    <RowActionButton action="edit" label={`Chỉnh sửa voucher ${v.code}`} onClick={() => onEdit(v)} />
                                                )}
                                                {isDeletedView && restoreVoucherApi && onRestore && hasPermission('vouchers', 'restore') && (
                                                    <RowActionButton
                                                        action="restore"
                                                        label={`Khôi phục voucher ${v.code}`}
                                                        disabled={isRestoringId === v.id}
                                                        onClick={() => setVoucherToRestore(v)}
                                                    />
                                                )}
                                                {!isDeletedView && onDelete && hasPermission('vouchers', 'delete') && (
                                                    <RowActionButton
                                                        action="delete"
                                                        label={`Xóa voucher ${v.code}`}
                                                        disabled={isDeletingId === v.id}
                                                        onClick={() => setVoucherToDelete(v)}
                                                    />
                                                )}
                                            </RowActions>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
                <div className="border-t border-slate-200 px-4">
                    <AdminPagination page={currentPage} totalPages={totalPages} onPageChange={setPage} />
                </div>
            </div>

            {/* CREATE / EDIT DIALOG */}
            <AdminDialog
                open={isEditOpen}
                onClose={close_edit_dialog}
                mode="form"
                size="xl"
                dirty={isDirty}
                busy={isSaving}
                icon={<TicketIcon className="h-5 w-5" />}
                title={
                    editData?.id
                        ? editData?.scope === 'movie'
                            ? 'Chỉnh sửa voucher phim'
                            : editData?.scope === 'all'
                                ? 'Chỉnh sửa voucher tổng hợp'
                                : 'Chỉnh sửa voucher VR'
                        : editData?.scope === 'movie'
                            ? 'Thêm voucher phim mới'
                            : editData?.scope === 'all'
                                ? 'Thêm voucher mới'
                                : 'Thêm voucher VR mới'
                }
                subtitle={
                    editData?.scope === 'movie'
                        ? 'Áp dụng cho vé xem phim — loại giảm, giới hạn & chi nhánh'
                        : editData?.scope === 'all'
                            ? 'Áp dụng cho tất cả dịch vụ — loại giảm, giới hạn & chi nhánh'
                            : 'Áp dụng cho dịch vụ trải nghiệm VR — loại giảm, giới hạn & chi nhánh'
                }
                footer={
                    <AdminDialogFooter
                        onCancel={request_close_edit}
                        onSubmit={handleSave}
                        submitText={editData?.id ? ADMIN_TEXT.save : ADMIN_TEXT.create}
                        busy={isSaving}
                        submitDisabled={isEditLocked}
                        leading={
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                {editData?.scope === 'movie' ? (
                                    <Badge variant="outline" className="border-blue-200 bg-blue-50 text-[11px] font-semibold text-blue-700">
                                        <Film className="mr-1 inline h-3 w-3" /> Phạm vi: Phim
                                    </Badge>
                                ) : editData?.scope === 'all' ? (
                                    <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-[11px] font-semibold text-indigo-700">
                                        <TicketIcon className="mr-1 inline h-3 w-3" /> Phạm vi: Tất cả
                                    </Badge>
                                ) : (
                                    <Badge variant="outline" className="border-purple-200 bg-purple-50 text-[11px] font-semibold text-purple-700">
                                        <Gamepad2 className="mr-1 inline h-3 w-3" /> Phạm vi: VR
                                    </Badge>
                                )}
                                <span className="hidden md:inline">
                                    {editData?.id
                                        ? `Cập nhật lần cuối: ${formatVnDateTime(editData.updated_at)}`
                                        : 'Voucher mới: mã sẽ được viết hoa tự động'}
                                </span>
                            </div>
                        }
                    />
                }
            >
                <div>
                    <div>
                        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                            {/* Cột trái: Thông tin cơ bản & Giảm giá */}
                            <div className="space-y-4">
                                {/* Basic Info Card */}
                                <FormSection
                                    title="Thông tin voucher"
                                    icon={<Sparkles size={14} className="text-purple-500" />}
                                    className="space-y-4"
                                >
                                    <FormField label="Mã voucher" htmlFor="fmi_voucher_code" required error={fieldErrors.code}>
                                        <div className="flex gap-2 items-center">
                                            <Input
                                                id="fmi_voucher_code"
                                                aria-invalid={!!fieldErrors.code}
                                                placeholder="VD: VR20OFF"
                                                value={editData?.code || ''}
                                                onChange={(e) => update_fields({ code: e.target.value.replace(/[^a-zA-Z0-9_\-]/g, '') })}
                                                disabled={!isCodeEditable}
                                                className={`${ADMIN_INPUT} flex-1 font-mono uppercase tracking-wider font-semibold ${!isCodeEditable ? 'bg-gray-100 text-gray-600' : ''}`}
                                                maxLength={30}
                                            />
                                            {editData?.code && (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={() => handleCopyCode(editData.code)}
                                                    className="h-10 rounded-xl w-10 shrink-0 text-gray-500 hover:text-gray-800"
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
                                                        className="h-10 rounded-xl w-10 shrink-0"
                                                        title={isCodeEditable ? 'Khóa mã' : 'Nhập mã thủ công'}
                                                    >
                                                        <Pencil className="w-3.5 h-3.5" />
                                                    </Button>
                                                    {isCodeEditable && (
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            onClick={() => update_fields({ code: generateRandomCode() })}
                                                            className="h-10 rounded-xl px-3 gap-1.5 border-purple-200 text-purple-700 hover:bg-purple-50 shrink-0"
                                                        >
                                                            <Sparkles className="w-3.5 h-3.5" />
                                                            Tự tạo
                                                        </Button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </FormField>

                                    <FormField label="Tên chương trình" htmlFor="fmi_voucher_name" required error={fieldErrors.name}>
                                        <Input
                                            id="fmi_voucher_name"
                                            aria-invalid={!!fieldErrors.name}
                                            placeholder="VD: Khai trương VR Giảm 20%"
                                            value={editData?.name || ''}
                                            onChange={(e) => update_fields({ name: e.target.value })}
                                            className={ADMIN_INPUT}
                                            maxLength={150}
                                        />
                                    </FormField>

                                    <FormField label="Nhân viên Sale phụ trách" helper="Ghi nhận hoa hồng / doanh số">
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
                                            <SelectTrigger className={`${ADMIN_INPUT} bg-white`}>
                                                <SelectValue placeholder="-- Chọn nhân viên Sale phụ trách --" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl">
                                                <SelectItem value="none">-- Không gán Sale (voucher chung) --</SelectItem>
                                                {staffList.map((st) => (
                                                    <SelectItem key={st.id} value={String(st.id)}>
                                                        {st.fullname} ({st.email})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </FormField>

                                    <FormField label="Ghi chú / Mô tả (tùy chọn)">
                                        <Textarea
                                            placeholder="Mô tả ngắn gọn về voucher hoặc ghi chú nội bộ..."
                                            value={editData?.note !== undefined ? editData.note : editData?.description || ''}
                                            onChange={(e) => setEditData({ ...editData, note: e.target.value, description: e.target.value })}
                                            rows={2}
                                            className="w-full text-xs resize-none"
                                        />
                                    </FormField>

                                    <FormField label="Phạm vi áp dụng" required>
                                        <Select
                                            value={editData?.scope || 'all'}
                                            onValueChange={(val) => {
                                                update_fields({ scope: val, applicable_ticket_package_ids: null });
                                            }}
                                        >
                                            <SelectTrigger className={ADMIN_INPUT}>
                                                <SelectValue placeholder="Chọn phạm vi áp dụng" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Toàn bộ hóa đơn (tất cả dịch vụ)</SelectItem>
                                                <SelectItem value="vr">Trải nghiệm VR</SelectItem>
                                                <SelectItem value="movie">Vé xem phim</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </FormField>
                                </FormSection>

                                {/* Discount Card */}
                                <FormSection
                                    title="Cấu hình giảm giá"
                                    icon={<Percent size={15} className="text-purple-600" />}
                                    className="space-y-4 border-purple-100 bg-purple-50/20"
                                >

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

                                    <FormField
                                        label={`Giá trị giảm (${editData?.discount_type === 'fixed' ? 'VNĐ' : '1-100 %'})`}
                                        htmlFor="fmi_voucher_discount_value"
                                        required
                                        error={fieldErrors.discount_value}
                                    >
                                        <Input
                                            id="fmi_voucher_discount_value"
                                            aria-invalid={!!fieldErrors.discount_value}
                                            type="text"
                                            placeholder={editData?.discount_type === 'fixed' ? 'VD: 50000' : 'VD: 20'}
                                            value={
                                                editData?.discount_value !== undefined && editData?.discount_value !== null
                                                    ? Number(editData.discount_value).toLocaleString('vi-VN')
                                                    : ''
                                            }
                                            onChange={(e) => {
                                                const v = Number(e.target.value.replace(/[^\d]/g, ''));
                                                update_fields({ discount_value: isNaN(v) ? 0 : v });
                                            }}
                                            className={`${ADMIN_INPUT} font-bold text-slate-800`}
                                        />
                                    </FormField>

                                    {editData?.discount_type === 'percent' ? (
                                        <FormField label="Giảm tối đa / đơn (để trống = không giới hạn)">
                                            <Input
                                                type="text"
                                                placeholder="VD: 50000"
                                                value={editData?.max_discount ? Number(editData.max_discount).toLocaleString('vi-VN') : ''}
                                                onChange={(e) => {
                                                    const v = Number(e.target.value.replace(/[^\d]/g, ''));
                                                    setEditData({
                                                        ...editData,
                                                        max_discount: isNaN(v) || v <= 0 ? null : v
                                                    });
                                                }}
                                                className={`${ADMIN_INPUT} text-slate-800`}
                                            />
                                        </FormField>
                                    ) : null}

                                    <FormField label="Đơn hàng tối thiểu (VNĐ)">
                                        <Input
                                            type="text"
                                            placeholder="Để trống hoặc 0 = không yêu cầu"
                                            value={editData?.min_order_value ? Number(editData.min_order_value).toLocaleString('vi-VN') : ''}
                                            onChange={(e) => {
                                                const v = Number(e.target.value.replace(/[^\d]/g, ''));
                                                setEditData({
                                                    ...editData,
                                                    min_order_value: isNaN(v) || v <= 0 ? 0 : v
                                                });
                                            }}
                                            className={`${ADMIN_INPUT} text-slate-800`}
                                        />
                                    </FormField>
                                </FormSection>

                                {/* Limits */}
                                <FormSection
                                    title="Giới hạn lượt dùng"
                                    icon={<Tag size={14} className="text-blue-500" />}
                                    className="space-y-4"
                                >

                                    <div className="grid grid-cols-2 gap-3">
                                        <FormField label="Tổng lượt / hệ thống">
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
                                                className={ADMIN_INPUT}
                                            />
                                        </FormField>
                                        <FormField label="Lượt / 1 người dùng">
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
                                                className={ADMIN_INPUT}
                                            />
                                        </FormField>
                                    </div>
                                </FormSection>
                            </div>

                            {/* Cột phải: Hiệu lực / Áp dụng gói / Chi nhánh */}
                            <div className="space-y-4">
                                {/* Validity Period */}
                                <FormSection
                                    title="Thời gian hiệu lực"
                                    icon={<CalendarDays size={14} className="text-indigo-500" />}
                                    className="space-y-3"
                                >
                                    <div className="flex items-center justify-end">
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
                                        <FormField label="Bắt đầu từ" htmlFor="fmi_voucher_valid_from">
                                            <Input
                                                id="fmi_voucher_valid_from"
                                                type="datetime-local"
                                                disabled={isPermanent}
                                                value={toLocalDatetimeString(editData?.valid_from)}
                                                onChange={(e) => {
                                                    const dt = e.target.value;
                                                    update_fields({ valid_from: dt ? fromLocalDatetimeString(dt) : null });
                                                }}
                                                className={ADMIN_INPUT}
                                            />
                                        </FormField>
                                        <FormField label="Hết hạn" htmlFor="fmi_voucher_valid_until" error={fieldErrors.valid_until}>
                                            <Input
                                                id="fmi_voucher_valid_until"
                                                aria-invalid={!!fieldErrors.valid_until}
                                                type="datetime-local"
                                                disabled={isPermanent}
                                                value={toLocalDatetimeString(editData?.valid_until)}
                                                onChange={(e) => {
                                                    const dt = e.target.value;
                                                    update_fields({ valid_until: dt ? fromLocalDatetimeString(dt) : null });
                                                }}
                                                className={ADMIN_INPUT}
                                            />
                                        </FormField>
                                    </div>
                                    <p className="text-[11px] text-slate-400">
                                        {isPermanent
                                            ? 'Voucher có hiệu lực vĩnh viễn (áp dụng ngay lập tức và không bao giờ hết hạn).'
                                            : 'Voucher bắt đầu và kết thúc theo ngày giờ đã chọn ở trên.'}
                                    </p>
                                </FormSection>

                                {/* Applied Ticket Packages based on Scope (only for vr / movie, hidden for 'all') */}
                                {editData?.scope && editData.scope !== 'all'
                                    ? (() => {
                                        const scopeType = editData?.scope || 'vr';
                                        const scopeConfig = {
                                            vr: {
                                                title: 'Áp dụng cho gói VR cụ thể',
                                                hint: 'Để trống = tất cả VR',
                                                empty: 'Không có gói VR — vui lòng tạo ít nhất 1 gói VR trước',
                                                icon: <Gamepad2 size={14} className="text-purple-500" />
                                            },
                                            movie: {
                                                title: 'Áp dụng cho gói phim cụ thể',
                                                hint: 'Để trống = tất cả gói phim',
                                                empty: 'Không có gói phim — vui lòng tạo ít nhất 1 gói phim trước',
                                                icon: <Film size={14} className="text-blue-500" />
                                            }
                                        }[scopeType as 'vr' | 'movie'] || {
                                            title: 'Áp dụng cho gói VR cụ thể',
                                            hint: 'Để trống = tất cả VR',
                                            empty: 'Không có gói VR — vui lòng tạo ít nhất 1 gói VR trước',
                                            icon: <Gamepad2 size={14} className="text-purple-500" />
                                        };

                                        const appliedList: number[] = Array.isArray(editData?.applicable_ticket_package_ids)
                                            ? editData.applicable_ticket_package_ids
                                            : (editData?.applicable_ticket_package_ids === null || editData?.applicable_ticket_package_ids === undefined) ? vrPackages.map((p: any) => p.id) : [];

                                        const isAllChecked = vrPackages.length > 0 && appliedList.length === vrPackages.length;
                                        const hasAnyApplicable = appliedList.length > 0;
                                        const mode: 'all' | 'whitelist' = isAllChecked ? 'all' : 'whitelist';

                                        return (
                                            <FormSection title={scopeConfig.title} icon={scopeConfig.icon} className="space-y-3">
                                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                                    {mode === 'whitelist' && (
                                                        <Badge
                                                            variant="outline"
                                                            className="text-[11px] border-green-300 bg-green-50 text-green-700 px-2 py-0 rounded-full"
                                                        >
                                                            <Check className="mr-1 inline h-3 w-3" />
                                                            Chỉ áp {appliedList.length} gói
                                                        </Badge>
                                                    )}
                                                    {mode === 'all' && (
                                                        <Badge
                                                            variant="outline"
                                                            className="text-[11px] border-slate-300 bg-slate-50 text-slate-600 px-2 py-0 rounded-full"
                                                        >
                                                            Áp tất cả
                                                        </Badge>
                                                    )}
                                                    <span className="ml-auto text-[11px] font-normal text-slate-500">{scopeConfig.hint}</span>
                                                </div>

                                                <div
                                                    id="div_voucher_packages"
                                                    tabIndex={-1}
                                                    className="border border-slate-200 rounded-xl p-2.5 h-40 overflow-y-auto space-y-1.5 bg-white"
                                                >
                                                    {vrPackages.length === 0 ? (
                                                        <p className="text-xs text-gray-400 text-center py-6">
                                                            {Array.isArray(editData?.branch_ids) && editData.branch_ids.length === 0
                                                                ? 'Chọn chi nhánh áp dụng để xem các gói'
                                                                : scopeConfig.empty}
                                                        </p>
                                                    ) : (
                                                        <>
                                                            <div
                                                                className={`flex items-center space-x-2 p-1.5 rounded-lg border border-transparent transition-colors mb-2 bg-slate-50 hover:bg-slate-100`}
                                                            >
                                                                <div>
                                                                    <Checkbox
                                                                        id={`vrpkg-apply-all`}
                                                                        checked={isAllChecked}
                                                                        onCheckedChange={(checked) => {
                                                                            update_fields({
                                                                                applicable_ticket_package_ids: checked ? vrPackages.map((p: any) => p.id) : []
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
                                                                        className={`flex items-center space-x-2 p-1.5 rounded-lg border border-transparent transition-colors hover:bg-slate-50`}
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

                                                                                    update_fields({ applicable_ticket_package_ids: nextApplied });
                                                                                }}
                                                                            />
                                                                        </div>
                                                                        <label
                                                                            htmlFor={`vrpkg-apply-${pkg.id}`}
                                                                            className={`text-xs font-medium leading-none cursor-pointer flex-1 truncate ${applied ? 'text-slate-800 font-semibold' : 'text-slate-700'
                                                                                }`}
                                                                        >
                                                                            {pkg.name}
                                                                            <span className="ml-1 text-[11px] text-slate-400">
                                                                                ({formatMoney(pkg.price)})
                                                                            </span>
                                                                        </label>
                                                                    </div>
                                                                );
                                                            })}
                                                        </>
                                                    )}
                                                </div>
                                                <FieldError message={fieldErrors.packages} />
                                            </FormSection>
                                        );
                                    })()
                                    : null}

                                {/* Branches */}
                                <FormSection
                                    title="Chi nhánh & cài đặt"
                                    icon={<Film size={14} className="text-blue-500" />}
                                    className="space-y-3"
                                >
                                    <FormField
                                        label="Chi nhánh áp dụng"
                                        required
                                        error={
                                            fieldErrors.branch_ids ||
                                            (isEditLocked ? 'Voucher thuộc nhiều chi nhánh, chỉ Super Admin được sửa' : undefined)
                                        }
                                        helper={
                                            isSuperAdmin
                                                ? 'Chọn "Tất cả chi nhánh" hoặc ít nhất một chi nhánh'
                                                : 'Chọn ít nhất một chi nhánh bạn quản lý'
                                        }
                                    >
                                        <div id="div_voucher_branch_ids" tabIndex={-1} className="outline-none">
                                        {isEditLocked ? (
                                            // Read-only summary: the staff member cannot change branches they do not manage
                                            <BranchIdsBadge branch_ids={editData?.branch_ids} branches={branches} className="text-[11px]" />
                                        ) : (
                                            <BranchMultiSelect
                                                branches={branchOptions.length > 0 ? branchOptions : branches}
                                                value={editData?.branch_ids ?? null}
                                                // Changing the branches shows that branch's packages with every one ticked (null = all packages)
                                                onChange={(ids) => update_fields({ branch_ids: ids, applicable_ticket_package_ids: null })}
                                                allowAll={isSuperAdmin}
                                                className="rounded-lg text-xs"
                                            />
                                        )}
                                        </div>
                                    </FormField>

                                    <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                                        <div>
                                            <Label htmlFor="fmi_voucher_is_active" className="text-xs font-semibold text-gray-700 block">Trạng thái kích hoạt</Label>
                                            <p className="text-[11px] text-slate-400">Bật = khách hàng có thể áp dụng voucher</p>
                                        </div>
                                        <Switch
                                            id="fmi_voucher_is_active"
                                            checked={!!(editData?.is_active ?? true)}
                                            onCheckedChange={(v) => setEditData({ ...editData, is_active: v })}
                                            className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-gray-300"
                                        />
                                    </div>
                                </FormSection>
                            </div>
                        </div>
                    </div>
                </div>
            </AdminDialog>

            {/* UNSAVED CHANGES (footer Hủy button) */}
            <ConfirmDialog
                open={askDiscardEdit}
                onOpenChange={setAskDiscardEdit}
                variant="warning"
                title="Thay đổi chưa được lưu"
                description="Bạn đang có thay đổi chưa lưu. Nếu thoát bây giờ, nội dung vừa nhập sẽ bị mất."
                confirmText="Thoát, bỏ thay đổi"
                cancelText="Tiếp tục chỉnh sửa"
                onConfirm={close_edit_dialog}
            />

            {/* DETAIL DIALOG */}
            <AdminDialog
                open={isDetailDialogOpen}
                onClose={() => setIsDetailDialogOpen(false)}
                mode="view"
                size="lg"
                icon={<Eye className="h-5 w-5" />}
                title="Hồ sơ voucher"
                titleExtra={
                    selectedVoucher ? (
                        <>
                            <span className="rounded-md border border-purple-200 bg-purple-100/70 px-2.5 py-0.5 font-mono text-sm font-bold text-purple-700">
                                {selectedVoucher.code}
                            </span>
                            {selectedVoucher.scope === 'vr' && (
                                <Badge variant="outline" className="gap-1 border-purple-200 bg-purple-50 text-[11px] font-bold uppercase text-purple-700">
                                    <Gamepad2 className="h-3 w-3" /> Chỉ VR
                                </Badge>
                            )}
                            {selectedVoucher.scope === 'movie' && (
                                <Badge variant="outline" className="gap-1 border-blue-200 bg-blue-50 text-[11px] font-bold uppercase text-blue-700">
                                    <Film className="h-3 w-3" /> Chỉ phim
                                </Badge>
                            )}
                            {(!selectedVoucher.scope || selectedVoucher.scope === 'all') && (
                                <Badge variant="outline" className="gap-1 border-indigo-200 bg-indigo-50 text-[11px] font-bold uppercase text-indigo-700">
                                    <TicketIcon className="h-3 w-3" /> Mọi dịch vụ
                                </Badge>
                            )}
                        </>
                    ) : undefined
                }
                subtitle={selectedVoucher?.name}
                footer={
                    <>
                        <Button variant="outline" onClick={() => setIsDetailDialogOpen(false)} className={ADMIN_BTN_OUTLINE}>
                            {ADMIN_TEXT.close}
                        </Button>
                        {selectedVoucher && !isDeletedView && hasPermission('vouchers', 'edit') && (
                            <Button
                                onClick={() => {
                                    // Edit the list row: the detail copy carries extra read-only fields
                                    const listRow = data.find((row) => row.id === selectedVoucher.id) ?? selectedVoucher;
                                    setIsDetailDialogOpen(false);
                                    onEdit(listRow);
                                }}
                                className={`${ADMIN_BTN_PRIMARY} gap-2`}
                            >
                                <Pencil className="h-4 w-4" /> {ADMIN_TEXT.edit}
                            </Button>
                        )}
                    </>
                }
            >
                {selectedVoucher && (
                    <>
                        <>
                            <div className="space-y-5 text-slate-800">
                                {(() => {
                                    const toArr = (v: any): number[] => (Array.isArray(v) ? (v as number[]) : []);
                                    const applied = toArr(selectedVoucher.applicable_ticket_package_ids);
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
                                            <div className={`${ADMIN_CARD} p-4 space-y-3`}>
                                                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                                                    <FileText size={15} className="text-blue-500" />
                                                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">THÔNG TIN CHUNG</h3>
                                                </div>
                                                <div className="flex flex-col md:flex-row gap-4 items-start">
                                                    <div className="flex-1 space-y-3 min-w-0 w-full">
                                                        <div>
                                                            <p className="text-[11px] uppercase font-bold text-slate-400 mb-0.5">TÊN CHƯƠNG TRÌNH</p>
                                                            <p className="font-bold text-slate-900 text-sm truncate" title={selectedVoucher.name}>{selectedVoucher.name}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[11px] uppercase font-bold text-slate-400 mb-0.5">MÔ TẢ / GHI CHÚ NỘI BỘ</p>
                                                            <div className="bg-slate-50 text-slate-700 text-xs p-2.5 rounded-lg border border-slate-100 whitespace-pre-wrap italic break-words break-all max-h-32 overflow-y-auto">
                                                                {displayNote || <span className="text-slate-400 font-normal">Không có ghi chú bổ sung</span>}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="w-full md:w-56 shrink-0 bg-blue-50/50 border border-blue-100 rounded-xl p-3.5 space-y-1">
                                                        <p className="text-[11px] uppercase font-bold text-blue-600 flex items-center gap-1.5 mb-1">
                                                            <User size={12} /> NHÂN VIÊN SALE PHỤ TRÁCH
                                                        </p>
                                                        {displaySaleName ? (
                                                            <div>
                                                                <p className="font-bold text-slate-900 text-xs truncate" title={displaySaleName}>{displaySaleName}</p>
                                                                {displaySaleEmail && (
                                                                    <p className="text-[11px] text-slate-500 truncate" title={displaySaleEmail}>{displaySaleEmail}</p>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <p className="text-xs text-slate-500 italic">Không gán Sale (Voucher hệ thống)</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* KHỐI 2: THIẾT LẬP TÀI CHÍNH */}
                                            <div className={`${ADMIN_CARD} p-4 space-y-3`}>
                                                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                                    <div className="flex items-center gap-2">
                                                        <Percent size={15} className="text-emerald-500" />
                                                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">THIẾT LẬP TÀI CHÍNH</h3>
                                                    </div>
                                                    <StatusBadge status={selectedVoucher.is_active ? 'active' : 'inactive'} />
                                                </div>
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                                        <p className="text-[11px] uppercase font-bold text-slate-400 mb-1">MỨC GIẢM</p>
                                                        <p className="font-black text-rose-600 text-base">
                                                            {selectedVoucher.discount_type === 'percent' ? (
                                                                <>{selectedVoucher.discount_value}%</>
                                                            ) : (
                                                                formatMoney(selectedVoucher.discount_value)
                                                            )}
                                                        </p>
                                                    </div>
                                                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                                        <p className="text-[11px] uppercase font-bold text-slate-400 mb-1">GIẢM TỐI ĐA</p>
                                                        <p className="font-bold text-slate-800">
                                                            {selectedVoucher.discount_type === 'percent' && selectedVoucher.max_discount
                                                                ? formatMoney(selectedVoucher.max_discount)
                                                                : 'Không giới hạn'}
                                                        </p>
                                                    </div>
                                                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                                        <p className="text-[11px] uppercase font-bold text-slate-400 mb-1">ĐƠN HÀNG TỐI THIỂU</p>
                                                        <p className="font-bold text-slate-800">{formatMoney(selectedVoucher.min_order_value || 0)}</p>
                                                    </div>
                                                    <div className="bg-emerald-50/60 rounded-xl p-3 border border-emerald-100">
                                                        <p className="text-[11px] uppercase font-bold text-emerald-700 mb-1">TỔNG DOANH THU</p>
                                                        <p className="font-black text-emerald-700 text-base">
                                                            {formatMoney(selectedVoucher.total_revenue || 0)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* KHỐI 3: GIỚI HẠN & ĐỐI TƯỢNG */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {/* Left card */}
                                                <div className={`${ADMIN_CARD} p-4 space-y-3`}>
                                                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                                                        <CalendarDays size={15} className="text-amber-500" />
                                                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">GIỚI HẠN THỜI GIAN & LƯỢT DÙNG</h3>
                                                    </div>
                                                    <div className="space-y-2.5 text-xs">
                                                        <div>
                                                            <p className="text-[11px] uppercase font-bold text-slate-400 mb-1">THỜI GIAN HIỆU LỰC</p>
                                                            <p className="font-semibold text-slate-800">
                                                                {selectedVoucher.valid_from ? formatVnDateTime(selectedVoucher.valid_from) : 'Từ khi tạo'}
                                                                {' → '}
                                                                {selectedVoucher.valid_until ? formatVnDateTime(selectedVoucher.valid_until) : 'Không hết hạn'}
                                                            </p>
                                                        </div>

                                                        <div>
                                                            <p className="text-[11px] uppercase font-bold text-slate-400 mb-1">CHI NHÁNH ÁP DỤNG</p>
                                                            <BranchIdsBadge
                                                                branch_ids={selectedVoucher.branch_ids}
                                                                branches={branches}
                                                                className="text-[11px]"
                                                            />
                                                        </div>

                                                        <div className="grid grid-cols-2 gap-2 pt-1">
                                                            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                                                <p className="text-[11px] uppercase font-bold text-slate-400 mb-0.5">TIẾN ĐỘ SỬ DỤNG</p>
                                                                <p className="font-bold text-slate-800">
                                                                    <span className="text-blue-600">{selectedVoucher.used_count ?? 0}</span> /{' '}
                                                                    {selectedVoucher.usage_limit ?? '∞'}
                                                                </p>
                                                                {selectedVoucher.usage_limit ? (
                                                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                                                        Còn {Math.max(0, Number(selectedVoucher.usage_limit) - (selectedVoucher.used_count ?? 0)).toLocaleString()} lượt
                                                                    </p>
                                                                ) : null}
                                                            </div>
                                                            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                                                <p className="text-[11px] uppercase font-bold text-slate-400 mb-0.5">GIỚI HẠN / 1 NGƯỜI DÙNG</p>
                                                                <p className="font-bold text-slate-800">{selectedVoucher.per_user_limit ?? 1} lượt</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Right card: ĐỐI TƯỢNG ÁP DỤNG */}
                                                <div className={`${ADMIN_CARD} p-4 space-y-3`}>
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
                                                                        ? 'Vé xem phim & gói phim'
                                                                        : 'Tất cả dịch vụ hệ thống';

                                                            const hasSpecificApplied = applied.length > 0;
                                                            const isAllPackages = !hasSpecificApplied;

                                                            return (
                                                                <div className="space-y-3">
                                                                    <div className="flex flex-wrap items-center justify-between gap-1 border-b border-slate-100 pb-2">
                                                                        <span className="text-[11px] font-medium text-slate-500 italic">
                                                                            Phạm vi: <strong className="text-slate-700 not-italic">{scopeText}</strong>
                                                                        </span>
                                                                        {isAllPackages ? (
                                                                            <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                                                                                Áp dụng tất cả ({detailPackages.length > 0 ? detailPackages.length : 'Tất cả'} gói)
                                                                            </Badge>
                                                                        ) : (
                                                                            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                                                                                Chỉ áp dụng {applied.length} gói chỉ định
                                                                            </Badge>
                                                                        )}
                                                                    </div>

                                                                    {/* Danh sách các gói vé được áp dụng */}
                                                                    <div>
                                                                        <p className="text-[11px] font-bold uppercase text-emerald-700 mb-1.5 flex items-center justify-between">
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
                                                                                        const pkgName = pkg ? pkg.name : 'Gói không còn khả dụng';
                                                                                        const pkgPrice = pkg?.price ? formatMoney(pkg.price) : null;
                                                                                        return (
                                                                                            <div
                                                                                                key={`app-${id}`}
                                                                                                className="bg-white border border-emerald-200/80 text-emerald-900 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center justify-between shadow-sm"
                                                                                            >
                                                                                                <div className="flex items-center gap-2">
                                                                                                    <Check className="h-3.5 w-3.5 text-emerald-600" />
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
                                                                                            className="bg-white border border-emerald-200/80 text-emerald-900 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center justify-between shadow-sm"
                                                                                        >
                                                                                            <div className="flex items-center gap-2">
                                                                                                <Check className="h-3.5 w-3.5 text-emerald-600" />
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

                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* KHỐI 4: LỊCH SỬ REDEEM */}
                                            {recent.length > 0 && (
                                                <div className={`${ADMIN_CARD} p-4 space-y-3`}>
                                                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                                                        <History size={15} className="text-slate-500" />
                                                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                                                            LỊCH SỬ GIAO DỊCH ({recent.length}
                                                            {selectedVoucher.redemption_total_count ? ` / ${selectedVoucher.redemption_total_count}` : ''} LẦN DÙNG GẦN NHẤT)
                                                        </h3>
                                                    </div>
                                                    <div className="border border-slate-100 rounded-lg overflow-hidden">
                                                        <Table>
                                                            <TableHeader className="bg-slate-50">
                                                                <TableRow className="hover:bg-transparent border-none">
                                                                    <TableHead className="text-[11px] font-bold uppercase py-2">MÃ BOOKING</TableHead>
                                                                    <TableHead className="text-[11px] font-bold uppercase py-2">MỨC GIẢM</TableHead>
                                                                    <TableHead className="text-[11px] font-bold uppercase py-2">THỜI GIAN</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {recent.map((r: any, i: number) => (
                                                                    <TableRow key={`rd-${r.id || i}`} className="hover:bg-slate-50 border-t border-slate-100">
                                                                        <TableCell className="text-xs font-mono font-semibold">
                                                                            {r.booking_code ? (
                                                                                <span className="inline-flex items-center gap-1.5">
                                                                                    {r.booking_code}
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => handleCopyBookingCode(r.booking_code)}
                                                                                        className="text-slate-400 hover:text-slate-700"
                                                                                        aria-label="Sao chép mã đặt chỗ"
                                                                                        title="Sao chép mã đặt chỗ (dán vào ô tìm kiếm ở mục Giao dịch)"
                                                                                    >
                                                                                        <Copy className="w-3 h-3" />
                                                                                    </button>
                                                                                </span>
                                                                            ) : (
                                                                                '-'
                                                                            )}
                                                                        </TableCell>
                                                                        <TableCell className="text-xs font-bold text-emerald-600">
                                                                            -{formatMoney(r.discount_amount_applied)}
                                                                        </TableCell>
                                                                        <TableCell className="text-[11px] text-slate-500">
                                                                            {formatVnDateTime(r.redeemed_at)}
                                                                        </TableCell>
                                                                    </TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>
                                                    </div>
                                                    {(selectedVoucher.redemption_total_count ?? 0) > recent.length &&
                                                        redemptionLimitStep < REDEMPTION_LIMIT_STEPS.length - 1 && (
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                disabled={isLoadingDetail}
                                                                onClick={() => setRedemptionLimitStep(redemptionLimitStep + 1)}
                                                                className="w-full rounded-lg text-xs"
                                                            >
                                                                {isLoadingDetail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Xem thêm'}
                                                            </Button>
                                                        )}
                                                </div>
                                            )}

                                            {/* KHỐI 5: FOOTER AUDIT */}
                                            <div className={`${ADMIN_CARD} flex flex-wrap items-center justify-between gap-2 p-3 text-[11px] text-slate-500`}>
                                                <span>
                                                    Tạo lúc: <b className="text-slate-800">{formatVnDateTime(selectedVoucher.created_at)}</b> bởi{' '}
                                                    <b className="text-slate-800">{selectedVoucher.created_by_staff_name || 'Hệ thống'}</b>
                                                </span>
                                                <span>
                                                    Cập nhật lần cuối:{' '}
                                                    <b className="text-slate-800">
                                                        {formatVnDateTime(selectedVoucher.updated_at)}
                                                    </b>{' '}
                                                    bởi <b className="text-slate-800">{selectedVoucher.updated_by_staff_name || 'Hệ thống'}</b>
                                                </span>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        </>
                    </>
                )}
            </AdminDialog>

            {/* DIALOG XÁC NHẬN SỬA TRƯỜNG QUAN TRỌNG */}
            <ConfirmDialog
                open={!!confirmSaveData}
                onOpenChange={(open) => !open && setConfirmSaveData(null)}
                variant="warning"
                title="Xác nhận thay đổi voucher"
                description={
                    <span className="block space-y-3">
                        <span className="block">
                            Bạn đang thay đổi các thông số quan trọng của voucher <strong>{editData?.code}</strong>:
                        </span>
                        <span className="block space-y-1 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-900">
                            {confirmSaveData?.changes.map((change) => (
                                <span key={change} className="flex items-center gap-1.5">
                                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                                    <span>{change}</span>
                                </span>
                            ))}
                        </span>
                        <span className="block text-xs italic text-slate-500">
                            Thay đổi này sẽ tác động trực tiếp đến mức ưu đãi khi khách hàng áp dụng voucher cho các đơn hàng mới.
                        </span>
                    </span>
                }
                confirmText="Xác nhận lưu"
                busy={isSaving}
                onConfirm={() => confirmSaveData && executeSave(confirmSaveData.payload)}
            />

            {/* TOGGLE STATUS CONFIRM */}
            <ConfirmDialog
                open={!!voucherToToggle}
                onOpenChange={(open) => !open && setVoucherToToggle(null)}
                variant={voucherToToggle?.currentStatus ? 'warning' : 'info'}
                title={voucherToToggle?.currentStatus ? 'Xác nhận ẩn voucher' : 'Xác nhận kích hoạt voucher'}
                description={(() => {
                    const toggled = data.find((row) => row.id === voucherToToggle?.id);
                    return (
                        <span className="block space-y-1">
                            <span className="block">
                                Voucher <b className="rounded bg-slate-100 px-1.5 py-0.5 font-mono">{toggled?.code}</b>
                                {toggled?.name ? ` — ${toggled.name}` : ''}
                            </span>
                            <span className="block">
                                {voucherToToggle?.currentStatus ? (
                                    <>
                                        Voucher sẽ <strong>không còn áp dụng được</strong> cho khách hàng.
                                    </>
                                ) : (
                                    <>
                                        Voucher sẽ <strong>hiển thị công khai</strong> và sẵn sàng cho khách hàng áp dụng.
                                    </>
                                )}
                            </span>
                        </span>
                    );
                })()}
                confirmText={voucherToToggle?.currentStatus ? 'Đồng ý ẩn' : 'Đồng ý kích hoạt'}
                busy={isTogglingId !== null}
                onConfirm={() => {
                    if (voucherToToggle) handleToggleStatus(voucherToToggle.id, voucherToToggle.currentStatus);
                }}
            />

            {/* DELETE CONFIRM */}
            <ConfirmDialog
                open={!!voucherToDelete}
                onOpenChange={(open) => !open && setVoucherToDelete(null)}
                variant="danger"
                title="Xác nhận xóa voucher?"
                description={
                    <span className="block space-y-1">
                        <span className="block">
                            Voucher <b className="rounded bg-slate-100 px-1.5 py-0.5 font-mono">{voucherToDelete?.code}</b> ({voucherToDelete?.name}) sẽ
                            được chuyển vào danh sách đã xóa.
                        </span>
                        <span className="block">Bạn có thể khôi phục lại từ mục "Xem đã xóa".</span>
                    </span>
                }
                confirmText="Xác nhận xóa"
                busy={isDeletingId !== null}
                onConfirm={() => voucherToDelete && handleDeleteConfirm(voucherToDelete)}
            />

            {/* RESTORE CONFIRM */}
            <ConfirmDialog
                open={!!voucherToRestore}
                onOpenChange={(open) => !open && setVoucherToRestore(null)}
                variant="restore"
                title="Khôi phục voucher?"
                description={
                    <span className="block">
                        Voucher <b className="rounded bg-slate-100 px-1.5 py-0.5 font-mono">{voucherToRestore?.code}</b> ({voucherToRestore?.name}) sẽ được đưa
                        trở lại danh sách đang dùng.
                    </span>
                }
                confirmText={ADMIN_TEXT.restore}
                busy={isRestoringId !== null}
                onConfirm={() => voucherToRestore && handleRestore(voucherToRestore)}
            />
        </div>
    );
}
