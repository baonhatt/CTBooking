import React, { useState } from 'react';
import { Clock, History, Loader2, RefreshCw, Pencil, Trash2, Info, Ticket as TicketIcon, X, Plus, Eye } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { createTicketApi, updateTicketApi, getBranches, toggleTicketStatusApi } from '@/lib/api';
import { getMoviesAdmin } from '@/lib/api/movies';
import { Skeleton } from '@/components/ui/skeleton';
import { useStaffPermissions, useIsSuperAdmin } from '@/hooks/useStaffPermission';

interface TicketPackage {
    id: number;
    name: string;
    code?: string;
    description?: string;
    price: number;
    features?: string[];
    combo?: number[];
    type?: string;
    min_group_size?: number;
    max_group_size?: number;
    is_member_only?: boolean;
    is_active?: boolean;
    display_order?: number;
    branch_id?: number;
    branch_name?: string;
    updated_at?: string;
    created_at?: string;
    created_by_staff_name?: string;
    updated_by_staff_name?: string;
}

interface Props {
    data: TicketPackage[];
    totalPages: number;
    currentPage: number;
    setPage: React.Dispatch<React.SetStateAction<number>>;
    onCreate: () => void;
    onEdit: (data: TicketPackage) => void;
    setTickets: React.Dispatch<React.SetStateAction<TicketPackage[]>>;
    isEditOpen: boolean;
    setIsEditOpen: (open: boolean) => void;
    editData: any;
    setEditData: (data: any) => void;
    onRefresh: () => Promise<void>;
    deleteTicketApi: (id: number) => Promise<any>;
    isLoading?: boolean;
    showActiveOnly: boolean;
    setShowActiveOnly: (v: boolean) => void;
    branches?: any[];
    selectedBranchId?: number | 'all' | null;
    setSelectedBranchId?: (id: number | 'all' | null) => void;
    onDelete?: (ticket: TicketPackage) => void;
    onViewDetail?: (ticket: TicketPackage) => void;
    isCodeEditable?: boolean;
    setIsCodeEditable?: (editable: boolean) => void;
}

export default function TicketsContent(props: Props) {
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
        setTickets,
        isEditOpen,
        setIsEditOpen,
        editData,
        setEditData,
        onRefresh,
        deleteTicketApi,
        showActiveOnly,
        setShowActiveOnly,
        branches = [],
        selectedBranchId = null,
        setSelectedBranchId = () => { },
        onDelete,
        onViewDetail,
        isCodeEditable = false,
        setIsCodeEditable = () => { }
    } = props;
    const { isLoading = false } = props as any;

    const [isDeletingId, setIsDeletingId] = useState<number | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [movies, setMovies] = useState<any[]>([]);
    const [branchOptions, setBranchOptions] = useState<any[]>([]);
    const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState<TicketPackage | null>(null);
    const [toggleDialogOpen, setToggleDialogOpen] = useState(false);
    const [ticketToToggle, setTicketToToggle] = useState<{ id: number; currentStatus: boolean } | null>(null);

    // Fetch movies when dialog opens or branch changes
    React.useEffect(() => {
        if (isEditOpen) {
            getMoviesAdmin({ status: 'active', pageSize: 100, branch_id: editData?.branch_id || undefined }).then((res) => {
                setMovies(res.items);
            });
            getBranches({ includeInactive: true }).then((res) => {
                setBranchOptions(res.items);
            });
        }
    }, [isEditOpen, editData?.branch_id]);

    const handleToggleStatus = async (id: number, currentStatus: boolean) => {
        try {
            await toggleTicketStatusApi(id);
            toast.success(currentStatus ? 'Đã ẩn gói vé' : 'Đã kích hoạt gói vé');
            onRefresh();
        } catch (err: any) {
            toast.error(err.message || 'Lỗi khi thay đổi trạng thái');
        }
    };

    return (
        <div className="space-y-6">
            {/* PAGE HEADER */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-slate-800">Quản lý gói vé</h1>
                    <p className="text-sm text-slate-400 mt-0.5">Tổng cộng {data.length} gói vé trong hệ thống</p>
                </div>
            </div>

            {/* TOOLBAR */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                <div className="flex flex-1 gap-3 max-w-xl">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Chỉ hiện khả dụng</span>
                        <Switch
                            checked={showActiveOnly}
                            onCheckedChange={setShowActiveOnly}
                            className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-gray-300 cursor-pointer"
                        />
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    {branches.length > 0 && (
                        <select
                            value={selectedBranchId || 'all'}
                            onChange={(e) => setSelectedBranchId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                            className="bg-white border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm cursor-pointer h-10"
                        >
                            <option value="all">Tất cả chi nhánh</option>
                            {branches.map((branch) => (
                                <option key={branch.id} value={branch.id}>
                                    {branch.name}
                                </option>
                            ))}
                        </select>
                    )}
                    {hasPermission('tickets', 'view_deleted') && (
                        <Button
                            variant="outline"
                            onClick={() => navigate('/deleted/tickets')}
                            className="rounded-xl flex items-center gap-2 h-10 px-4 shadow-sm"
                        >
                            <Trash2 className="w-4 h-4" />
                            <span className="hidden sm:inline text-sm">Xem đã xóa</span>
                        </Button>
                    )}
                    {hasPermission('tickets', 'create') && (
                        <Button
                            onClick={onCreate}
                            className="bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm gap-2 text-white h-10 px-5 font-medium"
                        >
                            <Plus className="w-4 h-4" /> Thêm mới
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
            <Card className="border border-gray-200 rounded-xl shadow-sm bg-white">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-gray-50">
                            <TableRow className="hover:bg-transparent border-none">
                                <TableHead className="text-xs font-semibold text-gray-600 uppercase py-3">Tên gói</TableHead>
                                <TableHead className="text-xs font-semibold text-gray-600 uppercase py-3">Phân loại</TableHead>
                                <TableHead className="text-xs font-semibold text-gray-600 uppercase py-3">Giá niêm yết</TableHead>
                                <TableHead className="text-xs font-semibold text-gray-600 uppercase py-3">Cập nhật</TableHead>
                                <TableHead className="text-center text-xs font-semibold text-gray-600 uppercase py-3">Trạng thái</TableHead>
                                <TableHead className="text-right text-xs font-semibold text-gray-600 uppercase py-3 pr-6">
                                    Thao tác
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading
                                ? Array.from({ length: 5 }).map((_, idx) => (
                                    <TableRow key={`sk-${idx}`}>
                                        <TableCell>
                                            <Skeleton className="h-4 w-40" />
                                        </TableCell>
                                        <TableCell>
                                            <Skeleton className="h-4 w-28" />
                                        </TableCell>
                                        <TableCell>
                                            <Skeleton className="h-4 w-20" />
                                        </TableCell>
                                        <TableCell>
                                            <Skeleton className="h-4 w-16" />
                                        </TableCell>
                                        <TableCell>
                                            <Skeleton className="h-4 w-24" />
                                        </TableCell>
                                        <TableCell>
                                            <Skeleton className="h-5 w-20" />
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Skeleton className="h-8 w-24 ml-auto" />
                                        </TableCell>
                                    </TableRow>
                                ))
                                : data.map((t) => (
                                    <TableRow
                                        key={t.id}
                                        className="group hover:bg-gray-50 transition-colors border-b border-gray-200 h-[52px]"
                                    >
                                        <TableCell className="py-4">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="font-bold text-slate-900">{t.name}</span>
                                                <span className="text-[10px] text-slate-400 font-mono">CODE: {t.code || 'N/A'}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant="outline"
                                                className="text-[10px] font-bold border-slate-200 text-slate-600 bg-white"
                                            >
                                                TYPE-{t.type || '0'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="font-black text-slate-700">
                                            {Number(t.price).toLocaleString('vi-VN')} đ
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col text-[10px]">
                                                <span className="text-slate-600 font-bold flex items-center gap-1">
                                                    <History size={10} className="text-slate-400" />
                                                    {t.updated_at ? format(new Date(t.updated_at), 'HH:mm') : '-'}
                                                </span>
                                                <span
                                                    className="text-slate-400 italic cursor-help"
                                                    title={t.updated_at ? new Date(t.updated_at).toLocaleString('vi-VN') : ''}
                                                >
                                                    {t.updated_at
                                                        ? formatDistanceToNow(new Date(t.updated_at), { addSuffix: true, locale: vi })
                                                        : ''}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {hasPermission('tickets', 'toggle_status') ? (
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Switch
                                                            checked={t.is_active}
                                                            className="scale-100 transition-all border-2 border-transparent cursor-pointer"
                                                            style={{
                                                                opacity: 1,
                                                                backgroundColor: t.is_active ? '#10b981' : '#d1d5db',
                                                                boxShadow: 'none'
                                                            }}
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                setTicketToToggle({ id: t.id, currentStatus: t.is_active });
                                                                setToggleDialogOpen(true);
                                                            }}
                                                        />
                                                    </AlertDialogTrigger>
                                                </AlertDialog>
                                            ) : (
                                                <Switch
                                                    checked={t.is_active}
                                                    disabled
                                                    className="scale-100 opacity-40 cursor-not-allowed"
                                                    style={{ backgroundColor: t.is_active ? '#10b981' : '#d1d5db' }}
                                                />
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right pr-6 space-x-1">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 rounded-lg hover:bg-blue-50 text-blue-600 border-blue-200"
                                                onClick={() => {
                                                    setSelectedTicket(t);
                                                    setIsDetailDialogOpen(true);
                                                }}
                                            >
                                                <Eye className="h-4.5 w-4.5" />
                                            </Button>
                                            {hasPermission('tickets', 'edit') && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8 rounded-lg hover:bg-yellow-50 text-yellow-600 border-yellow-200"
                                                    onClick={() => onEdit(t)}
                                                >
                                                    <Pencil className="h-4.5 w-4.5" />
                                                </Button>
                                            )}
                                            {onDelete && hasPermission('tickets', 'delete') && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8 rounded-lg hover:bg-red-50 text-red-600 border-red-200"
                                                    onClick={() => onDelete(t)}
                                                    title="Xóa"
                                                >
                                                    <Trash2 className="h-4.5 w-4.5" />
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                        </TableBody>
                    </Table>
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
                                    className={currentPage === 1 ? 'pointer-events-none opacity-30' : 'cursor-pointer rounded-lg border shadow-sm'}
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
                                    className={currentPage === totalPages ? 'pointer-events-none opacity-30' : 'cursor-pointer rounded-lg border shadow-sm'}
                                />
                            </PaginationItem>
                        </PaginationContent>
                    </Pagination>
                </CardContent>
            </Card>
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="max-w-[900px] max-h-[90vh] flex flex-col p-0 border border-gray-200 shadow-xl rounded-xl overflow-hidden font-sans bg-white [&>button]:hidden">
                    <DialogHeader className="px-6 py-5 bg-white border-b border-gray-200">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-50 rounded-xl border border-blue-100">
                                    <TicketIcon size={20} className="text-blue-600" />
                                </div>
                                <DialogTitle className="text-lg font-semibold text-gray-900">
                                    {editData?.id ? 'Chỉnh sửa gói vé' : 'Thêm gói vé'}
                                </DialogTitle>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setIsEditOpen(false)} className="h-8 w-8 text-gray-500 hover:text-gray-700">
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </DialogHeader>
                    <div className="overflow-y-auto px-5 py-4 flex-1">
                        <div className="grid grid-cols-2 gap-5 h-full">
                            {/* Cột trái: Thông tin cơ bản */}
                            <div className="flex flex-col">
                                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4 flex-1">
                                    <h3 className="text-xs font-semibold text-gray-500 border-b pb-2 flex items-center gap-2">
                                        <Info size={14} className="text-blue-500" /> Thông tin cơ bản
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label className="text-sm font-medium text-gray-900 mb-2">
                                                Tên gói <span className="text-red-500">*</span>
                                            </Label>
                                            <Input
                                                placeholder="Vd: Vé đơn"
                                                value={editData?.name || ''}
                                                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                                                className="h-10"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-sm font-medium text-gray-900 mb-2">Mã</Label>
                                            <div className="flex gap-2">
                                                <Input
                                                    placeholder="Vd: GV1"
                                                    value={editData?.code || ''}
                                                    onChange={(e) => setEditData({ ...editData, code: e.target.value })}
                                                    disabled={!isCodeEditable}
                                                    className={`h-10 flex-1 ${!isCodeEditable ? 'bg-gray-100 text-gray-600' : ''}`}
                                                />
                                                {editData?.id === 0 && (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="icon"
                                                        onClick={() => setIsCodeEditable && setIsCodeEditable(!isCodeEditable)}
                                                        className="h-10 w-10 shrink-0"
                                                        title={isCodeEditable ? 'Khóa mã' : 'Sửa mã'}
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <Label className="text-sm font-medium text-gray-900 mb-2">Loại</Label>
                                        <Input
                                            placeholder="Vd: 1"
                                            value={editData?.type || ''}
                                            onChange={(e) => setEditData({ ...editData, type: e.target.value })}
                                            className="h-10"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-sm font-medium text-gray-900 mb-2">
                                            Giá (VNĐ) <span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            type="text"
                                            placeholder="300,000"
                                            value={
                                                editData?.price !== undefined && editData?.price !== null
                                                    ? Number(editData.price).toLocaleString('en-US')
                                                    : ''
                                            }
                                            onChange={(e) => {
                                                const v = Number(e.target.value.replace(/,/g, ''));
                                                setEditData({ ...editData, price: isNaN(v) ? 0 : v });
                                            }}
                                            className="h-10"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-sm font-medium text-gray-900 mb-2">Mô tả</Label>
                                        <textarea
                                            placeholder="Vé dành cho 1 người xem cả nhân"
                                            value={editData?.description || ''}
                                            onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                                            className="w-full h-16 border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 bg-white"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-sm font-medium text-gray-900 mb-2">Tính năng (phân tách bằng dấu phẩy)</Label>
                                        <Input
                                            placeholder="ghế ấm,nệm ấm"
                                            value={editData?.features || ''}
                                            onChange={(e) =>
                                                setEditData({
                                                    ...editData,
                                                    features: e.target.value
                                                })
                                            }
                                            className="h-10"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Cột phải: Chi nhánh & Combo Phim + Cài đặt nâng cao */}
                            <div className="flex flex-col space-y-5">
                                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                                    <h3 className="text-xs font-semibold text-gray-500 border-b pb-2 flex items-center gap-2">
                                        <Info size={14} className="text-blue-500" /> Chi nhánh & Combo Phim
                                    </h3>
                                    <div>
                                        <Label className="text-sm font-medium text-gray-900 mb-2">Chi nhánh</Label>
                                        <select
                                            value={editData?.branch_id || ''}
                                            onChange={(e) =>
                                                setEditData({ ...editData, branch_id: e.target.value ? Number(e.target.value) : null })
                                            }
                                            className="w-full h-10 border border-gray-300 rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 bg-white"
                                        >
                                            <option value="">Chọn chi nhánh</option>
                                            {branchOptions.map((branch) => (
                                                <option key={branch.id} value={branch.id}>
                                                    {branch.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <Label className="text-sm font-medium text-gray-900 mb-2">Combo Phim ({editData?.combo?.length || 0})</Label>
                                        <div className="border border-gray-300 rounded-lg p-3 h-40 overflow-y-auto space-y-2 bg-gray-50">
                                            {movies.length === 0 ? (
                                                <p className="text-sm text-gray-500 text-center py-4">Không có phim nào</p>
                                            ) : (
                                                movies.map((movie) => (
                                                    <div key={movie.id} className="flex items-center space-x-2 hover:bg-white p-1.5 rounded">
                                                        <Checkbox
                                                            id={`movie-${movie.id}`}
                                                            checked={(editData.combo || []).includes(movie.id)}
                                                            onCheckedChange={(checked) => {
                                                                const current = editData.combo || [];
                                                                if (checked) {
                                                                    setEditData({
                                                                        ...editData,
                                                                        combo: [...current, movie.id]
                                                                    });
                                                                } else {
                                                                    setEditData({
                                                                        ...editData,
                                                                        combo: current.filter((id: number) => id !== movie.id)
                                                                    });
                                                                }
                                                            }}
                                                        />
                                                        <label
                                                            htmlFor={`movie-${movie.id}`}
                                                            className="text-sm font-medium leading-none cursor-pointer"
                                                        >
                                                            {movie.title}
                                                        </label>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                                    <h3 className="text-xs font-semibold text-gray-500 border-b pb-2 flex items-center gap-2">
                                        <Info size={14} className="text-blue-500" /> Cài đặt nâng cao
                                    </h3>
                                    <div>
                                        <Label className="text-sm font-medium text-gray-900 mb-2">Thứ tự hiển thị</Label>
                                        <Input
                                            type="number"
                                            placeholder="0"
                                            value={editData?.display_order ?? 0}
                                            onChange={(e) =>
                                                setEditData({
                                                    ...editData,
                                                    display_order: Number(e.target.value || 0)
                                                })
                                            }
                                            onFocus={(e) => {
                                                if (e.target.value === '0') {
                                                    e.target.value = '';
                                                }
                                            }}
                                            onBlur={(e) => {
                                                if (!e.target.value) {
                                                    setEditData({
                                                        ...editData,
                                                        display_order: 0
                                                    });
                                                }
                                            }}
                                            className="h-10"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label className="text-sm font-medium text-gray-900 mb-2">Nhóm tối thiểu</Label>
                                            <Input
                                                type="number"
                                                placeholder="0"
                                                value={editData?.min_group_size ?? 0}
                                                onChange={(e) =>
                                                    setEditData({
                                                        ...editData,
                                                        min_group_size: Number(e.target.value || 0)
                                                    })
                                                }
                                                onFocus={(e) => {
                                                    if (e.target.value === '0') {
                                                        e.target.value = '';
                                                    }
                                                }}
                                                onBlur={(e) => {
                                                    if (!e.target.value) {
                                                        setEditData({
                                                            ...editData,
                                                            min_group_size: 0
                                                        });
                                                    }
                                                }}
                                                className="h-10"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-sm font-medium text-gray-900 mb-2">Nhóm tối đa</Label>
                                            <Input
                                                type="number"
                                                placeholder="0"
                                                value={editData?.max_group_size ?? 0}
                                                onChange={(e) =>
                                                    setEditData({
                                                        ...editData,
                                                        max_group_size: Number(e.target.value || 0)
                                                    })
                                                }
                                                onFocus={(e) => {
                                                    if (e.target.value === '0') {
                                                        e.target.value = '';
                                                    }
                                                }}
                                                onBlur={(e) => {
                                                    if (!e.target.value) {
                                                        setEditData({
                                                            ...editData,
                                                            max_group_size: 0
                                                        });
                                                    }
                                                }}
                                                className="h-10"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Buttons */}
                    <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50">
                        <Button variant="outline" onClick={() => setIsEditOpen(false)} disabled={isSaving}>
                            Hủy
                        </Button>
                        <Button
                            disabled={isSaving}
                            onClick={async () => {
                                try {
                                    setIsSaving(true);
                                    if (!editData?.id) {
                                        await createTicketApi({
                                            name: editData.name,
                                            code: editData.code,
                                            description: editData.description,
                                            price: Number(editData.price || 0),
                                            features: editData.features || [],
                                            combo: editData.combo || [],
                                            type: editData.type,
                                            min_group_size: editData.min_group_size ? Number(editData.min_group_size) : undefined,
                                            max_group_size: editData.max_group_size ? Number(editData.max_group_size) : undefined,
                                            is_member_only: !!editData.is_member_only,
                                            is_active: !!editData.is_active,
                                            display_order: editData.display_order ? Number(editData.display_order) : 0,
                                            branch_id: editData.branch_id ? Number(editData.branch_id) : undefined
                                        });
                                    } else {
                                        await updateTicketApi(Number(editData.id), {
                                            name: editData.name,
                                            code: editData.code,
                                            description: editData.description,
                                            price: Number(editData.price || 0),
                                            features: editData.features || [],
                                            combo: editData.combo || [],
                                            type: editData.type,
                                            min_group_size: editData.min_group_size ? Number(editData.min_group_size) : undefined,
                                            max_group_size: editData.max_group_size ? Number(editData.max_group_size) : undefined,
                                            is_member_only: !!editData.is_member_only,
                                            is_active: !!editData.is_active,
                                            display_order: editData.display_order ? Number(editData.display_order) : 0,
                                            branch_id: editData.branch_id ? Number(editData.branch_id) : undefined
                                        });
                                    }
                                    await onRefresh();
                                    toast.success('Thành công', {
                                        description: editData?.id ? 'Cập nhật gói vé thành công' : 'Thêm gói vé thành công'
                                    });
                                } finally {
                                    setIsSaving(false);
                                    setIsEditOpen(false);
                                }
                            }}
                        >
                            {isSaving ? (
                                <span className="flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Đang lưu...
                                </span>
                            ) : (
                                'Lưu'
                            )}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Detail Dialog */}
            <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
                <DialogContent className="max-w-5xl [&>button]:hidden">
                    <DialogHeader className="flex flex-row items-center gap-3 space-y-0 pb-3 border-b">
                        <DialogTitle className="text-lg font-bold text-slate-800">Chi tiết gói vé</DialogTitle>
                        <div className="flex-1" />
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsDetailDialogOpen(false)}
                            title="Đóng"
                            className="h-8 w-8 rounded-full hover:bg-slate-100 text-slate-400 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </Button>
                    </DialogHeader>

                    {selectedTicket && (
                        <div className="py-3">
                            <div className="grid grid-cols-2 gap-4">
                                {/* Basic Info */}
                                <Card className="border border-gray-200 rounded-xl shadow-sm bg-white">
                                    <CardHeader className="pb-2 px-3">
                                        <CardTitle className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                                            <TicketIcon className="w-3.5 h-3.5" />
                                            Thông tin cơ bản
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="px-3 pb-3">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <Label className="text-[11px] font-medium text-gray-500">Tên</Label>
                                                <div className="text-sm font-semibold text-slate-800 truncate">{selectedTicket.name}</div>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[11px] font-medium text-gray-500">Mã</Label>
                                                <div className="text-sm font-mono bg-slate-50 px-2 py-0.5 rounded">{selectedTicket.code || '-'}</div>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[11px] font-medium text-gray-500">Loại</Label>
                                                <div className="text-sm">{selectedTicket.type || '-'}</div>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[11px] font-medium text-gray-500">Thứ tự</Label>
                                                <div className="text-sm">{selectedTicket.display_order ?? 0}</div>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[11px] font-medium text-gray-500">Trạng thái</Label>
                                                <Badge className={selectedTicket.is_active ? 'bg-green-100 text-green-700 border-green-200 text-[11px]' : 'bg-gray-100 text-gray-500 border-gray-200 text-[11px]'}>
                                                    {selectedTicket.is_active ? 'Hoạt động' : 'Ngừng'}
                                                </Badge>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[11px] font-medium text-gray-500">Thành viên</Label>
                                                <Badge className={selectedTicket.is_member_only ? 'bg-purple-100 text-purple-700 border-purple-200 text-[11px]' : 'bg-gray-100 text-gray-500 border-gray-200 text-[11px]'}>
                                                    {selectedTicket.is_member_only ? 'Có' : 'Không'}
                                                </Badge>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Pricing & Configuration */}
                                <Card className="border border-gray-200 rounded-xl shadow-sm bg-white">
                                    <CardHeader className="pb-2 px-3">
                                        <CardTitle className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                                            <span className="text-sm">💰</span>
                                            Giá & Cấu hình
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="px-3 pb-3">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <Label className="text-[11px] font-medium text-gray-500">Giá niêm yết</Label>
                                                <div className="text-base font-bold text-emerald-600">
                                                    {new Intl.NumberFormat('vi-VN').format(selectedTicket.price)} VNĐ
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[11px] font-medium text-gray-500">Chi nhánh</Label>
                                                <div className="text-sm">{selectedTicket.branch_id ?? 'Tất cả'}</div>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[11px] font-medium text-gray-500">Số nhóm tối thiểu</Label>
                                                <div className="text-sm">{selectedTicket.min_group_size ?? 1}</div>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[11px] font-medium text-gray-500">Số nhóm tối đa</Label>
                                                <div className="text-sm">{selectedTicket.max_group_size ?? '-'}</div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Description */}
                                <Card className="border border-gray-200 rounded-xl shadow-sm bg-white col-span-2">
                                    <CardHeader className="pb-2 px-3">
                                        <CardTitle className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                                            <span className="text-sm">📝</span>
                                            Mô tả
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="px-3 pb-3">
                                        <div className="text-sm bg-slate-50 p-2 rounded-lg border border-slate-100">
                                            {selectedTicket.description || 'Không có mô tả'}
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Features */}
                                <Card className="border border-gray-200 rounded-xl shadow-sm bg-white col-span-2">
                                    <CardHeader className="pb-2 px-3">
                                        <CardTitle className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                                            <span className="text-sm">⚡</span>
                                            Tính năng
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="px-3 pb-3">
                                        <div className="flex flex-wrap gap-1.5">
                                            {selectedTicket.features && selectedTicket.features.length > 0 ? (
                                                selectedTicket.features.map((feature, idx) => (
                                                    <Badge key={idx} variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[11px]">
                                                        {feature}
                                                    </Badge>
                                                ))
                                            ) : (
                                                <span className="text-sm text-gray-400">Không có tính năng</span>
                                            )}
                                        </div>
                                        {selectedTicket.combo && selectedTicket.combo.length > 0 && (
                                            <div className="mt-2 space-y-1">
                                                <Label className="text-[11px] font-medium text-gray-500">Combo gói</Label>
                                                <div className="text-sm">{selectedTicket.combo.join(', ')}</div>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Audit Info */}
                                <Card className="border border-gray-200 rounded-xl shadow-sm bg-white col-span-2">
                                    <CardHeader className="pb-2 px-3">
                                        <CardTitle className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                                            <History className="w-3.5 h-3.5" />
                                            Thông tin tạo & cập nhật
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="px-3 pb-3">
                                        <div className="grid grid-cols-4 gap-3">
                                            <div className="space-y-1">
                                                <Label className="text-[11px] font-medium text-gray-500">Ngày tạo</Label>
                                                <div className="text-xs">{selectedTicket.created_at ? new Date(selectedTicket.created_at).toLocaleString('vi-VN') : '-'}</div>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[11px] font-medium text-gray-500">Tạo bởi</Label>
                                                <div className="text-xs">{selectedTicket.created_by_staff_name || '-'}</div>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[11px] font-medium text-gray-500">Cập nhật lần cuối</Label>
                                                <div className="text-xs">{selectedTicket.updated_at ? new Date(selectedTicket.updated_at).toLocaleString('vi-VN') : '-'}</div>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[11px] font-medium text-gray-500">Cập nhật bởi</Label>
                                                <div className="text-xs">{selectedTicket.updated_by_staff_name || '-'}</div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Toggle Status Alert Dialog */}
            <AlertDialog open={toggleDialogOpen} onOpenChange={setToggleDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-slate-900">
                            Xác nhận thay đổi trạng thái
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-500 text-sm">
                            {ticketToToggle?.currentStatus ? (
                                <span>
                                    Bạn có muốn <strong>ẩn</strong> gói vé này không?
                                </span>
                            ) : (
                                <span>
                                    Bạn có muốn <strong>kích hoạt</strong> gói vé này không?
                                </span>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-4">
                        <AlertDialogCancel className="rounded-xl border-slate-200">Hủy</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (ticketToToggle) {
                                    handleToggleStatus(ticketToToggle.id, ticketToToggle.currentStatus);
                                }
                                setToggleDialogOpen(false);
                            }}
                            className={`rounded-xl text-white ${ticketToToggle?.currentStatus ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-600 hover:bg-emerald-700'
                                }`}
                        >
                            {ticketToToggle?.currentStatus ? 'Đồng ý ẩn' : 'Đồng ý kích hoạt'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div >
    );
}
