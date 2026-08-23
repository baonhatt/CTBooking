import React, { useEffect, useState } from 'react';
import AdminLayout from '@/admin/layouts/AdminLayout';
import { getBranches, deleteBranchApi, toggleBranchStatusApi } from '@/lib/api/branches';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useStaffStore } from '@/store/staffStore';
import { useStaffPermissions, useIsSuperAdmin } from '@/hooks/useStaffPermission';
import { Edit2, X, Search, RefreshCw, Pencil, Trash2, Plus, Building2, Eye, EyeOff, Phone, Mail, MapPin, BarChart3, History, Info, HelpCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
        Tooltip,
        TooltipContent,
        TooltipProvider,
        TooltipTrigger,
} from "@/components/ui/tooltip";
import {
        Pagination,
        PaginationContent,
        PaginationItem,
        PaginationNext,
        PaginationPrevious
} from '@/components/ui/pagination';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

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
        const staff = useStaffStore((state) => state.staff);
        const clearStaff = useStaffStore((state) => state.clearStaff);
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
                } catch { }
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
        const [isCodeEditable, setIsCodeEditable] = useState(false);
        const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
        const [branchToDelete, setBranchToDelete] = useState<number | null>(null);
        const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
        const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
        const [toggleDialogOpen, setToggleDialogOpen] = useState(false);
        const [branchToToggle, setBranchToToggle] = useState<{ id: number; currentStatus: boolean } | null>(null);

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
                const { items, total } = await getBranches({
                        page,
                        pageSize,
                        q: searchQuery,
                        includeInactive: !showActiveOnly
                });
                setBranches(items);
                setTotal(total);
                setIsLoading(false);
        };

        useEffect(() => {
                handleRefresh();
        }, [page, showActiveOnly, searchQuery]);

        useEffect(() => {
                try {
                        const state = { page, showActiveOnly, searchQuery };
                        localStorage.setItem('admin_branches_filters', JSON.stringify(state));
                } catch { }
        }, [page, showActiveOnly, searchQuery]);

        const openCreate = () => {
                setEditData({ id: 0, name: '', code: generateCode(), is_default: false, is_active: true });
                setIsCodeEditable(false);
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
                try {
                        await deleteBranchApi(branchToDelete);
                        toast.success('Đã xóa chi nhánh thành công');
                        setDeleteDialogOpen(false);
                        handleRefresh();
                } catch (e: any) {
                        toast.error('Lỗi', {
                                description: e?.message || 'Có lỗi xảy ra'
                        });
                }
        };

        const handleToggleStatus = (id: number, currentStatus: boolean) => {
                // Find the branch to check if it's default
                const branch = branches.find(b => b.id === id);
                if (!currentStatus && branch?.is_default) {
                        toast.error('Không thể ẩn chi nhánh mặc định', {
                                description: 'Vui lòng bỏ chọn "Chi nhánh mặc định" trước khi ẩn chi nhánh này.'
                        });
                        return;
                }
                setBranchToToggle({ id, currentStatus });
                setToggleDialogOpen(true);
        };

        const handleConfirmToggle = async () => {
                if (!branchToToggle) return;
                try {
                        await toggleBranchStatusApi(branchToToggle.id);
                        toast.success(branchToToggle.currentStatus ? 'Đã ẩn chi nhánh' : 'Đã kích hoạt chi nhánh');
                        setToggleDialogOpen(false);
                        handleRefresh();
                } catch (e: any) {
                        toast.error('Lỗi', {
                                description: e?.message || 'Có lỗi xảy ra'
                        });
                }
        };

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
                        <div className="p-6 space-y-6">
                                {/* PAGE HEADER */}
                                <div className="flex items-center justify-between">
                                        <div>
                                                <h1 className="text-xl font-bold text-slate-800">Quản lý chi nhánh</h1>
                                                <p className="text-sm text-slate-400 mt-0.5">Tổng cộng {total} chi nhánh trong hệ thống</p>
                                        </div>
                                </div>

                                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                                        <form onSubmit={handleSearchBranch} className="flex flex-1 gap-2 max-w-xl">
                                                <div className="relative flex-1">
                                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                                        <input
                                                                type="text"
                                                                placeholder="Tìm theo tên, mã, địa chỉ..."
                                                                value={localSearchQuery}
                                                                onChange={(e) => setLocalSearchQuery(e.target.value)}
                                                                className="w-full pl-10 pr-4 py-2 bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500 rounded-xl transition-all outline-none text-sm border"
                                                        />
                                                </div>
                                                <Button
                                                        type="submit"
                                                        className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold px-4 flex items-center gap-1.5 shrink-0"
                                                >
                                                        <Search className="w-3.5 h-3.5" /> Tìm kiếm
                                                </Button>
                                                <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="icon"
                                                        onClick={() => {
                                                                setLocalSearchQuery('');
                                                                setSearchQuery('');
                                                                handleRefresh();
                                                        }}
                                                        className="rounded-xl shadow-sm hover:rotate-180 transition-transform duration-500 shrink-0 h-10 w-10"
                                                        title="Làm mới"
                                                >
                                                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                                                </Button>
                                        </form>

                                        <div className="flex flex-wrap items-center gap-3">
                                                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200">
                                                        <span className="text-[10px] font-bold text-slate-500 uppercase">Chỉ hiện khả dụng</span>
                                                        <Switch
                                                                checked={showActiveOnly}
                                                                onCheckedChange={setShowActiveOnly}
                                                                className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-gray-300 cursor-pointer"
                                                        />
                                                </div>
                                                {hasPermission('branches', 'view_deleted') && (
                                                        <Button
                                                                variant="outline"
                                                                onClick={() => navigate('/deleted/branches')}
                                                                className="flex items-center gap-2 h-10 px-4"
                                                        >
                                                                <Trash2 className="w-4 h-4" />
                                                                Xem đã xóa
                                                        </Button>
                                                )}
                                                {hasPermission('branches', 'create') && (
                                                <Button
                                                        onClick={openCreate}
                                                        className="bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm gap-2 text-white h-10 px-5 font-medium"
                                                >
                                                        <Plus className="w-4 h-4" /> Thêm mới
                                                </Button>
                                                )}
                                        </div>
                                </div>

                                {isLoading ? (
                                        <Card className="border border-gray-200 rounded-xl shadow-sm bg-white p-6">
                                                <div className="flex items-center justify-center gap-3 py-6 text-slate-600 font-medium">
                                                        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                                                        <span>Đang tải danh sách chi nhánh từ máy chủ...</span>
                                                </div>
                                                <div className="space-y-3">
                                                        <Skeleton className="h-10 w-full rounded-lg bg-slate-100" />
                                                        <Skeleton className="h-12 w-full rounded-lg bg-slate-100" />
                                                        <Skeleton className="h-12 w-full rounded-lg bg-slate-100" />
                                                        <Skeleton className="h-12 w-full rounded-lg bg-slate-100" />
                                                        <Skeleton className="h-12 w-full rounded-lg bg-slate-100" />
                                                </div>
                                        </Card>
                                ) : (
                                        <Card className="border border-gray-200 rounded-xl shadow-sm bg-white">
                                                <CardContent className="p-0">
                                                        <Table>
                                                                <TableHeader className="bg-gray-50">
                                                                        <TableRow className="hover:bg-transparent border-none">
                                                                                <TableHead className="text-xs font-semibold text-gray-600 uppercase py-3">Tên</TableHead>
                                                                                <TableHead className="text-xs font-semibold text-gray-600 uppercase py-3">Mã</TableHead>
                                                                                <TableHead className="text-xs font-semibold text-gray-600 uppercase py-3">Địa chỉ</TableHead>
                                                                                <TableHead className="text-center text-xs font-semibold text-gray-600 uppercase py-3">Mặc định</TableHead>
                                                                                <TableHead className="text-center text-xs font-semibold text-gray-600 uppercase py-3">Cửa hàng</TableHead>
                                                                                <TableHead className="text-center text-xs font-semibold text-gray-600 uppercase py-3">Trạng thái</TableHead>
                                                                                <TableHead className="text-right text-xs font-semibold text-gray-600 uppercase py-3 pr-6">
                                                                                        Thao tác
                                                                                </TableHead>
                                                                        </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                        {branches.map((branch) => (
                                                                                <TableRow
                                                                                        key={branch.id}
                                                                                        className="group hover:bg-gray-50 transition-colors border-b border-gray-200 h-[52px]"
                                                                                >
                                                                                        <TableCell className="font-medium text-slate-900">{branch.name}</TableCell>
                                                                                        <TableCell className="font-mono text-xs text-slate-500">{branch.code}</TableCell>
                                                                                        <TableCell className="text-sm text-slate-600">{branch.address || '-'}</TableCell>
                                                                                        <TableCell className="text-center">
                                                                                                {branch.is_default && (
                                                                                                        <Badge className="bg-green-50 text-green-700 border-green-200 rounded-full px-2 py-0.5 text-xs font-medium">
                                                                                                                Mặc định
                                                                                                        </Badge>
                                                                                                )}
                                                                                        </TableCell>
                                                                                        <TableCell className="text-center">
                                                                                                {hasPermission('branches', 'edit') ? (
                                                                                                <AlertDialog>
                                                                                                        <AlertDialogTrigger asChild>
                                                                                                                <Badge
                                                                                                                        className={`${branch.is_open ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'} border-none rounded-full px-2 py-0.5 text-xs font-medium cursor-pointer transition-colors`}
                                                                                                                >
                                                                                                                        {branch.is_open ? 'Mở cửa' : 'Đóng cửa'}
                                                                                                                </Badge>
                                                                                                        </AlertDialogTrigger>
                                                                                                        <AlertDialogContent>
                                                                                                                <AlertDialogHeader>
                                                                                                                        <AlertDialogTitle>Xác nhận thay đổi trạng thái cửa hàng</AlertDialogTitle>
                                                                                                                        <AlertDialogDescription className="space-y-3">
                                                                                                                                <p>
                                                                                                                                        {branch.is_open
                                                                                                                                                ? 'Bạn có chắc chắn muốn ĐÓNG CỬA chi nhánh này? Khách hàng sẽ không thể đặt vé mới.'
                                                                                                                                                : 'Bạn có chắc chắn muốn MỞ CỬA chi nhánh này?'}
                                                                                                                                </p>

                                                                                                                                {branch.is_open && branch.paid_unused_count > 0 && (
                                                                                                                                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                                                                                                                                                <p className="text-amber-800 font-semibold text-sm flex items-center gap-2">
                                                                                                                                                        <Info className="w-4 h-4" />
                                                                                                                                                        Cảnh báo: Có {branch.paid_unused_count} vé đã thanh toán chưa sử dụng!
                                                                                                                                                </p>
                                                                                                                                                <div className="bg-white/50 p-2 rounded border border-amber-100">
                                                                                                                                                        <p className="text-[10px] text-amber-600 uppercase font-bold mb-1">Danh sách mã vé (Để copy):</p>
                                                                                                                                                        <code className="text-xs text-slate-700 break-all leading-relaxed">
                                                                                                                                                                {branch.paid_unused_codes || 'Không có mã nào'}
                                                                                                                                                        </code>
                                                                                                                                                </div>
                                                                                                                                                <p className="text-[11px] text-amber-600 italic">
                                                                                                                                                        * Vui lòng liên hệ khách hàng hoặc đảm bảo có nhân viên trực trước khi đóng cửa.
                                                                                                                                                </p>
                                                                                                                                        </div>
                                                                                                                                )}
                                                                                                                        </AlertDialogDescription>
                                                                                                                </AlertDialogHeader>
                                                                                                                <AlertDialogFooter>
                                                                                                                        <AlertDialogCancel>Hủy</AlertDialogCancel>
                                                                                                                        <AlertDialogAction
                                                                                                                                onClick={async () => {
                                                                                                                                        if (branch.is_open) {
                                                                                                                                                if (branch.is_default) {
                                                                                                                                                        toast.error('Không thể đóng cửa chi nhánh mặc định');
                                                                                                                                                        return;
                                                                                                                                                }
                                                                                                                                                if (branch.pending_bookings_count > 0) {
                                                                                                                                                        toast.error('Không thể đóng cửa ngay lúc này', {
                                                                                                                                                                description: `Có ${branch.pending_bookings_count} đơn hàng đang chờ thanh toán.`
                                                                                                                                                        });
                                                                                                                                                        return;
                                                                                                                                                }
                                                                                                                                        }
                                                                                                                                        try {
                                                                                                                                                const { toggleBranchOpenApi } = await import('@/lib/api/branches');
                                                                                                                                                await toggleBranchOpenApi(branch.id);
                                                                                                                                                toast.success(branch.is_open ? 'Đã đóng cửa chi nhánh' : 'Đã mở cửa chi nhánh');
                                                                                                                                                handleRefresh();
                                                                                                                                        } catch (e: any) {
                                                                                                                                                toast.error('Lỗi', {
                                                                                                                                                        description: e?.message || 'Có lỗi xảy ra'
                                                                                                                                                });
                                                                                                                                        }
                                                                                                                                }}
                                                                                                                                className={branch.is_open ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}
                                                                                                                        >
                                                                                                                                Xác nhận
                                                                                                                        </AlertDialogAction>
                                                                                                                </AlertDialogFooter>
                                                                                                        </AlertDialogContent>
                                                                                                </AlertDialog>
                                                                                                ) : (
                                                                                                        <Badge
                                                                                                                className={`${branch.is_open ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} border-none rounded-full px-2 py-0.5 text-xs font-medium opacity-60`}
                                                                                                        >
                                                                                                                {branch.is_open ? 'Mở cửa' : 'Đóng cửa'}
                                                                                                        </Badge>
                                                                                                )}
                                                                                        </TableCell>
                                                                                        <TableCell className="text-center">
                                                                                                {hasPermission('branches', 'toggle_status') ? (
                                                                                                <AlertDialog>
                                                                                                        <AlertDialogTrigger asChild>
                                                                                                                <Switch
                                                                                                                        checked={branch.is_active}
                                                                                                                        className="scale-100 transition-all border-2 border-transparent cursor-pointer"
                                                                                                                        style={{
                                                                                                                                opacity: 1,
                                                                                                                                backgroundColor: branch.is_active ? '#10b981' : '#d1d5db',
                                                                                                                                boxShadow: 'none'
                                                                                                                        }}
                                                                                                                />
                                                                                                        </AlertDialogTrigger>
                                                                                                        <AlertDialogContent>
                                                                                                                <AlertDialogHeader>
                                                                                                                        <AlertDialogTitle>Xác nhận thay đổi trạng thái</AlertDialogTitle>
                                                                                                                        <AlertDialogDescription>
                                                                                                                                Bạn có chắc chắn muốn {branch.is_active ? 'ẩn' : 'kích hoạt'} chi nhánh này?
                                                                                                                        </AlertDialogDescription>
                                                                                                                </AlertDialogHeader>
                                                                                                                <AlertDialogFooter>
                                                                                                                        <AlertDialogCancel onClick={() => setBranchToToggle(null)}>Hủy</AlertDialogCancel>
                                                                                                                        <AlertDialogAction onClick={async () => {
                                                                                                                                if (branch.is_active && branch.is_default) {
                                                                                                                                        toast.error('Không thể ẩn chi nhánh mặc định', {
                                                                                                                                                description: 'Vui lòng bỏ chọn "Chi nhánh mặc định" trước khi ẩn chi nhánh này.'
                                                                                                                                        });
                                                                                                                                        return;
                                                                                                                                }
                                                                                                                                try {
                                                                                                                                        await toggleBranchStatusApi(branch.id);
                                                                                                                                        toast.success(branch.is_active ? 'Đã ẩn chi nhánh' : 'Đã kích hoạt chi nhánh');
                                                                                                                                        handleRefresh();
                                                                                                                                } catch (e: any) {
                                                                                                                                        toast.error('Lỗi', {
                                                                                                                                                description: e?.message || 'Có lỗi xảy ra'
                                                                                                                                        });
                                                                                                                                }
                                                                                                                        }}>Xác nhận</AlertDialogAction>
                                                                                                                </AlertDialogFooter>
                                                                                                        </AlertDialogContent>
                                                                                                </AlertDialog>
                                                                                                ) : (
                                                                                                        <Switch
                                                                                                                checked={branch.is_active}
                                                                                                                disabled
                                                                                                                className="scale-100 opacity-40 cursor-not-allowed"
                                                                                                                style={{ backgroundColor: branch.is_active ? '#10b981' : '#d1d5db' }}
                                                                                                        />
                                                                                                )}
                                                                                        </TableCell>
                                                                                        <TableCell className="text-right pr-6">
                                                                                                <div className="flex justify-end gap-1">
                                                                                                        <Button
                                                                                                                variant="ghost"
                                                                                                                size="icon"
                                                                                                                className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                                                                                onClick={() => {
                                                                                                                        setSelectedBranch(branch);
                                                                                                                        setIsDetailDialogOpen(true);
                                                                                                                }}
                                                                                                                title="Chi tiết"
                                                                                                        >
                                                                                                                <Eye className="h-3.5 w-3.5" />
                                                                                                        </Button>
                                                                                                        {hasPermission('branches', 'edit') && (
                                                                                                        <Button
                                                                                                                variant="ghost"
                                                                                                                size="icon"
                                                                                                                className="h-8 w-8 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                                                                                                                onClick={() => openEdit(branch)}
                                                                                                                title="Sửa"
                                                                                                        >
                                                                                                                <Pencil className="h-3.5 w-3.5" />
                                                                                                        </Button>
                                                                                                        )}
                                                                                                        {hasPermission('branches', 'delete') && (
                                                                                                        <Button
                                                                                                                variant="ghost"
                                                                                                                size="icon"
                                                                                                                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                                                                                onClick={() => handleDelete(branch.id)}
                                                                                                                title="Xóa"
                                                                                                        >
                                                                                                                <Trash2 className="h-3.5 w-3.5" />
                                                                                                        </Button>
                                                                                                        )}
                                                                                                </div>
                                                                                        </TableCell>
                                                                                </TableRow>
                                                                        ))}
                                                                </TableBody>
                                                        </Table>
                                                </CardContent>
                                        </Card>
                                )}

                                {/* FOOTER / PAGINATION */}
                                <div className="bg-white px-6 py-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                {total} chi nhánh trong hệ thống
                                        </span>
                                        <Pagination>
                                                <PaginationContent>
                                                        <PaginationItem>
                                                                <PaginationPrevious
                                                                        href="#"
                                                                        onClick={(e) => {
                                                                                e.preventDefault();
                                                                                setPage(Math.max(1, page - 1));
                                                                        }}
                                                                        aria-disabled={page === 1}
                                                                        className={page === 1 ? 'pointer-events-none opacity-30' : 'cursor-pointer rounded-lg border shadow-sm'}
                                                                />
                                                        </PaginationItem>
                                                        <PaginationItem>
                                                                <span className="flex items-center px-3 text-sm text-slate-600">
                                                                        Trang {page} / {totalPages}
                                                                </span>
                                                        </PaginationItem>
                                                        <PaginationItem>
                                                                <PaginationNext
                                                                        href="#"
                                                                        onClick={(e) => {
                                                                                e.preventDefault();
                                                                                setPage(Math.min(totalPages, page + 1));
                                                                        }}
                                                                        aria-disabled={page === totalPages}
                                                                        className={page === totalPages ? 'pointer-events-none opacity-30' : 'cursor-pointer rounded-lg border shadow-sm'}
                                                                />
                                                        </PaginationItem>
                                                </PaginationContent>
                                        </Pagination>
                                </div>
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
                        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                                <AlertDialogContent>
                                        <AlertDialogHeader>
                                                <AlertDialogTitle>Xác nhận xóa chi nhánh</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                        Bạn có chắc chắn muốn xóa chi nhánh này? Hành động này không thể hoàn tác.
                                                </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                                <AlertDialogCancel>Hủy</AlertDialogCancel>
                                                <AlertDialogAction onClick={handleConfirmDelete}>Xóa</AlertDialogAction>
                                        </AlertDialogFooter>
                                </AlertDialogContent>
                        </AlertDialog>

                        {/* Detail Dialog */}
                        <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
                                <DialogContent className="[&>button]:hidden max-w-4xl">
                                        <DialogHeader className="flex flex-row items-center gap-3 space-y-0 pb-4 border-b">
                                                <DialogTitle className="text-lg font-bold text-slate-800">Chi tiết chi nhánh</DialogTitle>
                                                <div className="flex-1" />
                                                <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => setIsDetailDialogOpen(false)}
                                                        className="h-8 w-8 rounded-full hover:bg-slate-100 text-slate-400 transition-colors"
                                                >
                                                        <X className="w-5 h-5" />
                                                </Button>
                                        </DialogHeader>
                                        {selectedBranch && (
                                                <div className="py-4 max-h-[85vh] overflow-y-auto pr-2 custom-scrollbar">
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                                                                {/* LEFT COLUMN: OPERATIONAL INFO */}
                                                                <div className="space-y-6">
                                                                        {/* Basic Info */}
                                                                        <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
                                                                                <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 flex items-center gap-2">
                                                                                        <Info className="w-4 h-4 text-blue-500" />
                                                                                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Thông tin cơ bản</h3>
                                                                                </div>
                                                                                <CardContent className="p-4 space-y-4">
                                                                                        <div className="grid grid-cols-2 gap-4">
                                                                                                <div className="space-y-1">
                                                                                                        <Label className="text-[10px] font-medium text-slate-500 uppercase">Tên chi nhánh</Label>
                                                                                                        <div className="text-sm font-bold text-slate-900">{selectedBranch.name}</div>
                                                                                                </div>
                                                                                                <div className="space-y-1">
                                                                                                        <Label className="text-[10px] font-medium text-slate-500 uppercase">Mã chi nhánh</Label>
                                                                                                        <div className="text-sm font-mono text-blue-600 font-bold">{selectedBranch.code}</div>
                                                                                                </div>
                                                                                                <div className="space-y-2 col-span-2">
                                                                                                        <Label className="text-[10px] font-medium text-slate-500 uppercase">Trạng thái hiện tại</Label>
                                                                                                        <div className="flex flex-wrap gap-2 pt-0.5">
                                                                                                                {selectedBranch.is_default && (
                                                                                                                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase">Mặc định</Badge>
                                                                                                                )}
                                                                                                                <Badge className={`${selectedBranch.is_active ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'} border-none rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase`}>
                                                                                                                        {selectedBranch.is_active ? 'Kích hoạt' : 'Đang ẩn'}
                                                                                                                </Badge>
                                                                                                                <Badge className={`${selectedBranch.is_open ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'} border-none rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase`}>
                                                                                                                        {selectedBranch.is_open ? 'Đang mở cửa' : 'Đã đóng cửa'}
                                                                                                                </Badge>
                                                                                                        </div>
                                                                                                </div>
                                                                                        </div>
                                                                                </CardContent>
                                                                        </Card>

                                                                        {/* Statistics */}
                                                                        <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
                                                                                <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 flex items-center gap-2">
                                                                                        <BarChart3 className="w-4 h-4 text-purple-500" />
                                                                                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Thống kê hoạt động</h3>
                                                                                </div>
                                                                                <CardContent className="p-4">
                                                                                        <div className="grid grid-cols-2 gap-3">
                                                                                                <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100 text-center">
                                                                                                        <div className="text-[9px] text-blue-500 uppercase font-black mb-1">Số phim</div>
                                                                                                        <div className="text-xl font-black text-blue-700">{selectedBranch.movie_count}</div>
                                                                                                </div>
                                                                                                <div className="bg-purple-50/50 p-3 rounded-xl border border-purple-100 text-center">
                                                                                                        <div className="text-[9px] text-purple-500 uppercase font-black mb-1">Số gói vé</div>
                                                                                                        <div className="text-xl font-black text-purple-700">{selectedBranch.package_count}</div>
                                                                                                </div>
                                                                                                <div className="bg-green-50/50 p-3 rounded-xl border border-green-100 text-center">
                                                                                                        <div className="text-[9px] text-green-500 uppercase font-black mb-1">Tổng Booking</div>
                                                                                                        <div className="text-xl font-black text-green-700">{selectedBranch.booking_count}</div>
                                                                                                </div>
                                                                                                <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-100 text-center">
                                                                                                        <div className="text-[9px] text-rose-500 uppercase font-black mb-1">Đang thanh toán</div>
                                                                                                        <div className="text-xl font-black text-rose-700">{selectedBranch.pending_bookings_count}</div>
                                                                                                </div>
                                                                                        </div>
                                                                                </CardContent>
                                                                        </Card>

                                                                        {/* Contact & System */}
                                                                        <div className="grid grid-cols-1 gap-6">
                                                                                {/* Contact Info */}
                                                                                <Card className="border-slate-200 shadow-sm bg-white overflow-hidden h-fit">
                                                                                        <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 flex items-center gap-2">
                                                                                                <MapPin className="w-4 h-4 text-orange-500" />
                                                                                                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Liên hệ Chi nhánh</h3>
                                                                                        </div>
                                                                                        <CardContent className="p-4 space-y-3 text-xs">
                                                                                                <div className="flex items-start gap-3">
                                                                                                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                                                                                                        <div className="space-y-1">
                                                                                                                <p className="font-bold text-slate-700 uppercase text-[9px] tracking-tight">Địa chỉ</p>
                                                                                                                <p className="text-slate-600 leading-normal">{selectedBranch.address || 'Chưa cập nhật'}</p>
                                                                                                        </div>
                                                                                                </div>
                                                                                                <div className="grid grid-cols-2 gap-4 border-t pt-3">
                                                                                                        <div className="flex items-start gap-3">
                                                                                                                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                                                                                                                <div className="space-y-1">
                                                                                                                        <p className="font-bold text-slate-700 uppercase text-[9px] tracking-tight">Điện thoại</p>
                                                                                                                        <p className="text-slate-600">{selectedBranch.phone || 'Chưa cập nhật'}</p>
                                                                                                                </div>
                                                                                                        </div>
                                                                                                        <div className="flex items-start gap-3">
                                                                                                                <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                                                                                                                <div className="space-y-1">
                                                                                                                        <p className="font-bold text-slate-700 uppercase text-[9px] tracking-tight">Email</p>
                                                                                                                        <p className="text-slate-600 break-all">{selectedBranch.email || 'Chưa cập nhật'}</p>
                                                                                                                </div>
                                                                                                        </div>
                                                                                                </div>
                                                                                        </CardContent>
                                                                                </Card>

                                                                                {/* System Info */}
                                                                                <Card className="border-slate-200 shadow-sm bg-white overflow-hidden h-fit">
                                                                                        <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 flex items-center gap-2">
                                                                                                <History className="w-4 h-4 text-slate-500" />
                                                                                                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Hệ thống</h3>
                                                                                        </div>
                                                                                        <CardContent className="p-4 grid grid-cols-2 gap-4 text-xs">
                                                                                                <div className="space-y-1">
                                                                                                        <p className="font-bold text-slate-700 uppercase text-[9px] tracking-tight">Ngày tạo</p>
                                                                                                        <p className="text-slate-600 font-medium">{new Date(selectedBranch.created_at).toLocaleString('vi-VN')}</p>
                                                                                                        <p className="text-[10px] text-slate-400 italic">Bởi: {selectedBranch.created_by_staff_name || 'Hệ thống'}</p>
                                                                                                </div>
                                                                                                <div className="space-y-1">
                                                                                                        <p className="font-bold text-slate-700 uppercase text-[9px] tracking-tight">Cập nhật cuối</p>
                                                                                                        <p className="text-slate-600 font-medium">{new Date(selectedBranch.updated_at).toLocaleString('vi-VN')}</p>
                                                                                                        <p className="text-[10px] text-slate-400 italic">Bởi: {selectedBranch.updated_by_staff_name || 'Hệ thống'}</p>
                                                                                                </div>
                                                                                        </CardContent>
                                                                                </Card>
                                                                        </div>
                                                                </div>

                                                                {/* RIGHT COLUMN: BUSINESS & FOOTER INFO */}
                                                                <div className="space-y-6">
                                                                        {/* Footer Config */}
                                                                        <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
                                                                                <div className="bg-cyan-50 px-4 py-2 border-b border-cyan-100 flex items-center gap-2">
                                                                                        <Phone className="w-4 h-4 text-cyan-600" />
                                                                                        <h3 className="text-xs font-bold text-cyan-800 uppercase tracking-wider">Cấu hình Footer & Bản đồ</h3>
                                                                                </div>
                                                                                <CardContent className="p-4 space-y-4">
                                                                                        {selectedBranch.settings ? (() => {
                                                                                                try {
                                                                                                        const s = JSON.parse(selectedBranch.settings);
                                                                                                        return (
                                                                                                                <div className="space-y-4">
                                                                                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                                                                                                <div className="space-y-1">
                                                                                                                                        <Label className="text-[10px] font-bold text-slate-500 uppercase">Tên công ty hiển thị</Label>
                                                                                                                                        <p className="text-sm font-semibold text-slate-800 leading-tight">{s.company_name || '-'}</p>
                                                                                                                                </div>
                                                                                                                                <div className="space-y-1">
                                                                                                                                        <Label className="text-[10px] font-bold text-slate-500 uppercase">Hotline Footer</Label>
                                                                                                                                        <p className="text-sm font-bold text-cyan-600">{s.hotline || '-'}</p>
                                                                                                                                </div>
                                                                                                                                <div className="space-y-1 sm:col-span-2">
                                                                                                                                        <Label className="text-[10px] font-bold text-slate-500 uppercase">Địa chỉ Công ty Footer</Label>
                                                                                                                                        <p className="text-sm text-slate-700">{s.company_address || '-'}</p>
                                                                                                                                </div>
                                                                                                                                <div className="space-y-1">
                                                                                                                                        <Label className="text-[10px] font-bold text-slate-500 uppercase">Địa điểm bản đồ</Label>
                                                                                                                                        <p className="text-sm text-slate-700">{s.map_query || '-'}</p>
                                                                                                                                </div>
                                                                                                                                <div className="space-y-1">
                                                                                                                                        <Label className="text-[10px] font-bold text-slate-500 uppercase">Tọa độ / Plus Code</Label>
                                                                                                                                        <p className="text-sm text-slate-700 font-mono">{s.map_coords || '-'}</p>
                                                                                                                                </div>
                                                                                                                        </div>
                                                                                                                </div>
                                                                                                        );
                                                                                                } catch { return <div className="text-xs text-red-500 italic">Lỗi định dạng cấu hình JSON</div>; }
                                                                                        })() : <div className="text-center py-6 text-slate-400 italic text-sm">Chưa có cấu hình Footer</div>}
                                                                                </CardContent>
                                                                        </Card>

                                                                        {/* Legal Info */}
                                                                        <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
                                                                                <div className="bg-purple-50 px-4 py-2 border-b border-purple-100 flex items-center gap-2">
                                                                                        <Building2 className="w-4 h-4 text-purple-600" />
                                                                                        <h3 className="text-xs font-bold text-purple-800 uppercase tracking-wider">Thông tin Pháp lý & Bổ sung</h3>
                                                                                </div>
                                                                                <CardContent className="p-4">
                                                                                        <div className="space-y-2">
                                                                                                {selectedBranch.settings ? (() => {
                                                                                                        try {
                                                                                                                const s = JSON.parse(selectedBranch.settings);
                                                                                                                const extra = s.extra_info?.filter((i: any) => i.value && i.value.trim() !== '') || [];
                                                                                                                if (extra.length === 0) return <div className="text-center py-6 text-slate-400 italic text-sm">Chưa có thông tin pháp lý bổ sung</div>;
                                                                                                                return extra.map((info: any, idx: number) => (
                                                                                                                        <div key={idx} className="flex justify-between items-start gap-4 py-2.5 px-3 bg-slate-50 rounded-xl border border-slate-100">
                                                                                                                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tight mt-0.5 shrink-0">{info.label}</span>
                                                                                                                                <span className="text-xs text-slate-800 font-bold text-right uppercase">{info.value}</span>
                                                                                                                        </div>
                                                                                                                ));
                                                                                                        } catch { return null; }
                                                                                                })() : <div className="text-center py-6 text-slate-400 italic text-sm">Chưa có cấu hình bổ sung</div>}
                                                                                        </div>
                                                                                </CardContent>
                                                                        </Card>
                                                                </div>
                                                        </div>
                                                </div>
                                        )}
                                </DialogContent>
                        </Dialog>
                </AdminLayout>
        );
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
                settings: ''
        });
        const [isLoading, setIsLoading] = useState(false);
        const [isCodeEditable, setIsCodeEditable] = useState(false);
        const [showQrUrlField, setShowQrUrlField] = useState(false);
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

                        setFormData({
                                name: data.name || '',
                                code: data.code || '',
                                address: data.address || '',
                                phone: data.phone || '',
                                email: data.email || '',
                                is_default: isFirstBranch || isOnlyBranch || data.is_default || false,
                                is_active: data.is_active ?? true,
                                is_open: data.is_open ?? true,
                                settings: data.settings || ''
                        });

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
                                        extra_info: Array.isArray(parsed.extra_info) && parsed.extra_info.length > 0
                                                ? parsed.extra_info
                                                : defaultExtra
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
                setFormData(prev => ({ ...prev, settings: JSON.stringify(newSettings) }));
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

        const handleSubmit = async (e: React.FormEvent) => {
                e.preventDefault();
                setIsLoading(true);

                try {
                        // Check for pending bookings when closing the branch
                        if (data.id !== 0 && data.is_open && !formData.is_open) {
                                if (data.pending_bookings_count > 0) {
                                        toast.error('Không thể đóng cửa ngay lúc này', {
                                                description: `Có ${data.pending_bookings_count} đơn hàng đang chờ thanh toán. Vui lòng đợi họ hoàn tất hoặc hết hạn (15 phút).`
                                        });
                                        setIsLoading(false);
                                        return;
                                }
                        }

                        const { createBranchApi, updateBranchApi } = await import('@/lib/api/branches');

                        if (data.id === 0) {
                                await createBranchApi(formData);
                                toast.success('Đã tạo chi nhánh thành công');
                        } else {
                                await updateBranchApi(data.id, formData);
                                toast.success('Đã cập nhật chi nhánh thành công');
                        }

                        onSave();
                        onClose();
                } catch (e: any) {
                        toast.error('Lỗi', {
                                description: e?.message || 'Có lỗi xảy ra'
                        });
                } finally {
                        setIsLoading(false);
                }
        };

        if (!isOpen) return null;

        return (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl relative max-h-[95vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                                {/* Header */}
                                <div className="flex justify-between items-center px-6 py-4 border-b bg-slate-50 rounded-t-2xl">
                                        <div>
                                                <h2 className="text-xl font-bold text-slate-800">{data.id === 0 ? 'Thêm chi nhánh mới' : 'Chỉnh sửa chi nhánh'}</h2>
                                                <p className="text-xs text-slate-500 mt-0.5">Cấu hình thông tin hoạt động và hiển thị cho chi nhánh</p>
                                        </div>
                                        <button
                                                onClick={onClose}
                                                className="h-9 w-9 rounded-full hover:bg-white hover:shadow-md text-slate-400 hover:text-slate-600 transition-all flex items-center justify-center border border-transparent hover:border-slate-200"
                                        >
                                                <X className="w-5 h-5" />
                                        </button>
                                </div>

                                <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
                                        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">

                                                {/* SECTION 1: BASIC INFO */}
                                                <section className="space-y-4">
                                                        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                                                                <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600">
                                                                        <Info className="w-4 h-4" />
                                                                </div>
                                                                <h3 className="font-bold text-slate-800">Thông tin Chi nhánh</h3>
                                                        </div>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                <div className="md:col-span-2">
                                                                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Tên chi nhánh *</label>
                                                                        <input
                                                                                type="text"
                                                                                value={formData.name}
                                                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                                                                placeholder="Nhập tên chi nhánh..."
                                                                                required
                                                                        />
                                                                </div>
                                                                <div>
                                                                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Mã chi nhánh *</label>
                                                                        <div className="flex gap-2">
                                                                                <input
                                                                                        type="text"
                                                                                        value={formData.code}
                                                                                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                                                                        disabled={!isCodeEditable}
                                                                                        className={`flex-1 px-4 py-2.5 border border-slate-200 rounded-xl outline-none transition-all ${!isCodeEditable ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : 'focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'}`}
                                                                                        required
                                                                                />
                                                                                {data.id === 0 && (
                                                                                        <button
                                                                                                type="button"
                                                                                                onClick={() => setIsCodeEditable(!isCodeEditable)}
                                                                                                className="px-3 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors shadow-sm"
                                                                                                title={isCodeEditable ? 'Khóa mã' : 'Sửa mã'}
                                                                                        >
                                                                                                <Edit2 className="w-4 h-4 text-slate-600" />
                                                                                        </button>
                                                                                )}
                                                                        </div>
                                                                </div>
                                                                <div>
                                                                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Số điện thoại</label>
                                                                        <input
                                                                                type="text"
                                                                                value={formData.phone}
                                                                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                                                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                                                                placeholder="Nhập số điện thoại..."
                                                                        />
                                                                </div>
                                                                <div className="md:col-span-2">
                                                                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Địa chỉ</label>
                                                                        <input
                                                                                type="text"
                                                                                value={formData.address}
                                                                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                                                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                                                                placeholder="Nhập địa chỉ chi nhánh..."
                                                                        />
                                                                </div>
                                                                <div className="md:col-span-2">
                                                                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Email</label>
                                                                        <input
                                                                                type="email"
                                                                                value={formData.email}
                                                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                                                                placeholder="email@chinhanh.com"
                                                                        />
                                                                </div>
                                                        </div>
                                                </section>

                                                {/* SECTION 2: FOOTER CONFIG */}
                                                <section className="space-y-4">
                                                        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                                                                <div className="p-1.5 bg-cyan-50 rounded-lg text-cyan-600">
                                                                        <Phone className="w-4 h-4" />
                                                                </div>
                                                                <h3 className="font-bold text-slate-800">Cấu hình Footer (Liên hệ & Bản đồ)</h3>
                                                        </div>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                                                                <div>
                                                                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Tên Công ty</label>
                                                                        <input
                                                                                type="text"
                                                                                value={settingsData.company_name}
                                                                                onChange={(e) => handleSettingsChange('company_name', e.target.value)}
                                                                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all text-sm"
                                                                                placeholder="CÔNG TY TNHH VR VIỆT NAM"
                                                                        />
                                                                </div>
                                                                <div>
                                                                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Hotline hỗ trợ</label>
                                                                        <input
                                                                                type="text"
                                                                                value={settingsData.hotline}
                                                                                onChange={(e) => handleSettingsChange('hotline', e.target.value)}
                                                                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all text-sm"
                                                                                placeholder="036.6431.179"
                                                                        />
                                                                </div>
                                                                <div className="md:col-span-2">
                                                                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Địa chỉ Công ty</label>
                                                                        <input
                                                                                type="text"
                                                                                value={settingsData.company_address}
                                                                                onChange={(e) => handleSettingsChange('company_address', e.target.value)}
                                                                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all text-sm"
                                                                                placeholder="Số 11 Sư Vạn Hạnh, Quận 10, TP. HCM..."
                                                                        />
                                                                </div>
                                                                <div>
                                                                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Tên địa điểm Bản đồ (Ưu tiên 1)</label>
                                                                        <input
                                                                                type="text"
                                                                                value={settingsData.map_query}
                                                                                onChange={(e) => handleSettingsChange('map_query', e.target.value)}
                                                                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all text-sm"
                                                                                placeholder="Ví dụ: Vạn Hạnh Mall hoặc Tên rạp..."
                                                                        />
                                                                </div>
                                                                <div>
                                                                        <div className="flex items-center gap-1.5 mb-1">
                                                                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">Link Google Maps</label>
                                                                                <TooltipProvider>
                                                                                        <Tooltip>
                                                                                                <TooltipTrigger asChild>
                                                                                                        <HelpCircle className="w-3.5 h-3.5 text-slate-400 cursor-help hover:text-cyan-500 transition-colors" />
                                                                                                </TooltipTrigger>
                                                                                                <TooltipContent side="top" className="max-w-[250px] p-3 bg-slate-800 text-white border-slate-700 rounded-xl shadow-xl">
                                                                                                        <div className="space-y-2 text-xs">
                                                                                                                <p className="font-bold text-cyan-400">Cách lấy link chính xác nhất:</p>
                                                                                                                <ul className="list-disc pl-4 space-y-1 text-slate-200">
                                                                                                                        <li>Truy cập Google Maps và tìm rạp của bạn.</li>
                                                                                                                        <li>Copy <span className="text-white font-medium">toàn bộ đường dẫn (URL)</span> trên thanh địa chỉ trình duyệt.</li>
                                                                                                                        <li>Hệ thống sẽ render trực tiếp URL này ở chân trang.</li>
                                                                                                                </ul>
                                                                                                        </div>
                                                                                                </TooltipContent>
                                                                                        </Tooltip>
                                                                                </TooltipProvider>
                                                                        </div>
                                                                        <input
                                                                                type="text"
                                                                                value={settingsData.map_coords}
                                                                                onChange={(e) => handleSettingsChange('map_coords', e.target.value)}
                                                                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all text-sm"
                                                                                placeholder="Dán link Google Maps từ trình duyệt..."
                                                                        />
                                                                </div>
                                                                <div className="md:col-span-2">
                                                                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Hiển thị nút nổi hỗ trợ trên Website</label>
                                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                                <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                                                                        <span className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                                                                                                <div className="w-6 h-6 rounded bg-[#0068ff] text-white flex items-center justify-center">
                                                                                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 21 1.9-5.7a8.5 8.5 11 1 1 3.8 3.8z"/></svg>
                                                                                                </div>
                                                                                                Nút Chat Zalo
                                                                                        </span>
                                                                                        <Switch 
                                                                                                checked={settingsData.show_zalo_button}
                                                                                                onCheckedChange={(checked) => handleSettingsChange('show_zalo_button', checked)}
                                                                                        />
                                                                                </div>
                                                                                <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                                                                        <span className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                                                                                                <div className="w-6 h-6 rounded bg-emerald-500 text-white flex items-center justify-center">
                                                                                                        <Phone className="w-3.5 h-3.5" />
                                                                                                </div>
                                                                                                Nút Gọi Điện
                                                                                        </span>
                                                                                        <Switch 
                                                                                                checked={settingsData.show_phone_button}
                                                                                                onCheckedChange={(checked) => handleSettingsChange('show_phone_button', checked)}
                                                                                        />
                                                                                </div>
                                                                        </div>
                                                                </div>
                                                        </div>
                                                </section>

                                                {/* SECTION 3: TICKET & PAYMENT CONFIG */}
                                                <section className="space-y-4">
                                                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                                                <div className="flex items-center gap-2">
                                                                        <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                                                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-600"><rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" x2="22" y1="10" y2="10" /></svg>
                                                                        </div>
                                                                        <h3 className="text-sm font-bold text-slate-800">Cấu hình Vé & Thanh toán</h3>
                                                                </div>
                                                        </div>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                <div>
                                                                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Thời hạn sử dụng vé (ngày)</label>
                                                                        <input
                                                                                type="number"
                                                                                min="1"
                                                                                max="365"
                                                                                value={settingsData.ticket_expiry_days}
                                                                                onChange={(e) => handleSettingsChange('ticket_expiry_days', parseInt(e.target.value) || 10)}
                                                                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all text-sm"
                                                                                placeholder="10"
                                                                        />
                                                                        <p className="text-[10px] text-slate-400 mt-1">Số ngày vé có hiệu lực sau khi thanh toán</p>
                                                                </div>
                                                                <div className="md:col-span-2">
                                                                        <div className="flex items-center justify-between mb-1">
                                                                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">Cấu hình QR Code</label>
                                                                                <button
                                                                                        type="button"
                                                                                        onClick={() => setShowQrUrlField(!showQrUrlField)}
                                                                                        className="text-[10px] text-cyan-600 hover:text-cyan-700 font-medium flex items-center gap-1"
                                                                                >
                                                                                        {showQrUrlField ? 'Ẩn' : 'Tùy chọn nâng cao'}
                                                                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={showQrUrlField ? 'rotate-180' : ''}><polyline points="6 9 12 15 18 9" /></svg>
                                                                                </button>
                                                                        </div>
                                                                        {showQrUrlField && (
                                                                                <div className="space-y-2 pt-2 border-t border-slate-100">
                                                                                        <input
                                                                                                type="text"
                                                                                                value={settingsData.payment_config?.qr_code_url || ''}
                                                                                                onChange={(e) => handleSettingsChange('payment_config', { ...settingsData.payment_config, qr_code_url: e.target.value })}
                                                                                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all text-sm"
                                                                                                placeholder="https://img.vietqr.io/image/..."
                                                                                        />
                                                                                        <p className="text-[10px] text-slate-400">Link ảnh QR code có sẵn (nếu đã tạo từ app ngân hàng). Nếu để trống, hệ thống sẽ tự tạo từ thông tin ngân hàng bên dưới.</p>
                                                                                </div>
                                                                        )}
                                                                </div>
                                                                <div>
                                                                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Tên ngân hàng</label>
                                                                        <input
                                                                                type="text"
                                                                                value={settingsData.payment_config?.bank_name || ''}
                                                                                onChange={(e) => handleSettingsChange('payment_config', { ...settingsData.payment_config, bank_name: e.target.value })}
                                                                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all text-sm"
                                                                                placeholder="MB Bank, Vietcombank..."
                                                                        />
                                                                </div>
                                                                <div>
                                                                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Mã ngân hàng (Bank Code)</label>
                                                                        <input
                                                                                type="text"
                                                                                value={settingsData.payment_config?.bank_code || ''}
                                                                                onChange={(e) => handleSettingsChange('payment_config', { ...settingsData.payment_config, bank_code: e.target.value })}
                                                                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all text-sm"
                                                                                placeholder="MB, VCB, BIDV... (tùy chọn)"
                                                                        />
                                                                        <p className="text-[10px] text-slate-400 mt-1">Nếu để trống sẽ tự động map từ tên ngân hàng</p>
                                                                </div>
                                                                <div>
                                                                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Số tài khoản</label>
                                                                        <input
                                                                                type="text"
                                                                                value={settingsData.payment_config?.account_number || ''}
                                                                                onChange={(e) => handleSettingsChange('payment_config', { ...settingsData.payment_config, account_number: e.target.value })}
                                                                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all text-sm"
                                                                                placeholder="0123456789"
                                                                        />
                                                                </div>
                                                                <div className="md:col-span-2">
                                                                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Chủ tài khoản</label>
                                                                        <input
                                                                                type="text"
                                                                                value={settingsData.payment_config?.account_name || ''}
                                                                                onChange={(e) => handleSettingsChange('payment_config', { ...settingsData.payment_config, account_name: e.target.value })}
                                                                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all text-sm"
                                                                                placeholder="NGUYEN VAN A"
                                                                        />
                                                                </div>
                                                        </div>
                                                </section>

                                                {/* SECTION 4: LEGAL INFO */}
                                                <section className="space-y-4">
                                                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                                                <div className="flex items-center gap-2">
                                                                        <div className="p-1.5 bg-purple-50 rounded-lg text-purple-600">
                                                                                <Building2 className="w-4 h-4" />
                                                                        </div>
                                                                        <h3 className="font-bold text-slate-800">Thông tin Pháp lý (Dynamic)</h3>
                                                                </div>
                                                                <Button
                                                                        type="button"
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={addExtraInfo}
                                                                        className="h-8 text-[11px] font-bold uppercase tracking-wider border-purple-200 text-purple-600 hover:bg-purple-50 rounded-xl"
                                                                >
                                                                        <Plus className="w-3.5 h-3.5 mr-1" /> Thêm thông tin
                                                                </Button>
                                                        </div>
                                                        <div className="grid grid-cols-1 gap-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                                                                {settingsData.extra_info?.map((info: any, idx: number) => (
                                                                        <div key={idx} className="flex gap-3 items-center group animate-in fade-in slide-in-from-top-1 duration-200">
                                                                                <div className="flex-1">
                                                                                        <input
                                                                                                type="text"
                                                                                                placeholder="Nhãn (vd: Người đại diện)"
                                                                                                value={info.label}
                                                                                                onChange={(e) => updateExtraInfo(idx, 'label', e.target.value)}
                                                                                                className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none"
                                                                                        />
                                                                                </div>
                                                                                <div className="flex-[1.5]">
                                                                                        <input
                                                                                                type="text"
                                                                                                placeholder="Giá trị..."
                                                                                                value={info.value}
                                                                                                onChange={(e) => updateExtraInfo(idx, 'value', e.target.value)}
                                                                                                className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none"
                                                                                        />
                                                                                </div>
                                                                                <Button
                                                                                        type="button"
                                                                                        variant="ghost"
                                                                                        size="icon"
                                                                                        onClick={() => removeExtraInfo(idx)}
                                                                                        className="h-10 w-10 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl shrink-0 transition-colors"
                                                                                >
                                                                                        <Trash2 className="w-4 h-4" />
                                                                                </Button>
                                                                        </div>
                                                                ))}
                                                                {(!settingsData.extra_info || settingsData.extra_info.length === 0) && (
                                                                        <div className="text-center py-6">
                                                                                <p className="text-sm text-slate-400 italic">Chưa có thông tin pháp lý. Nhấn nút phía trên để thêm.</p>
                                                                        </div>
                                                                )}
                                                        </div>
                                                </section>

                                                {/* SECTION 4: STATUS */}
                                                <section className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex flex-wrap gap-x-8 gap-y-4">
                                                        <div className="flex items-center gap-3">
                                                                <input
                                                                        type="checkbox"
                                                                        id="is_default"
                                                                        checked={formData.is_default}
                                                                        onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                                                                        disabled={formData.is_default}
                                                                        className={`w-5 h-5 rounded-lg border-slate-300 text-blue-600 focus:ring-blue-500/20 ${formData.is_default ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                                                                />
                                                                <label
                                                                        htmlFor="is_default"
                                                                        className={`text-sm font-semibold ${formData.is_default ? 'text-slate-400' : 'text-slate-700 cursor-pointer'}`}
                                                                >
                                                                        Chi nhánh mặc định {formData.is_default && "(Đang chọn)"}
                                                                </label>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                                <input
                                                                        type="checkbox"
                                                                        id="is_open"
                                                                        checked={formData.is_open}
                                                                        onChange={(e) => setFormData({ ...formData, is_open: e.target.checked })}
                                                                        className="w-5 h-5 rounded-lg border-slate-300 text-green-600 focus:ring-green-500/20 cursor-pointer"
                                                                />
                                                                <label htmlFor="is_open" className="text-sm font-semibold text-green-700 cursor-pointer">
                                                                        Đang mở cửa
                                                                </label>
                                                        </div>
                                                        <div className="flex items-center gap-3 opacity-60">
                                                                <input
                                                                        type="checkbox"
                                                                        id="is_active"
                                                                        checked={formData.is_active}
                                                                        readOnly
                                                                        disabled
                                                                        className="w-5 h-5 rounded-lg border-slate-300 text-slate-600 cursor-not-allowed"
                                                                />
                                                                <label htmlFor="is_active" className="text-sm font-semibold text-slate-500">
                                                                        Kích hoạt
                                                                </label>
                                                        </div>
                                                </section>
                                        </div>

                                        {/* Actions */}
                                        <div className="px-6 py-4 border-t bg-slate-50 flex justify-end gap-3 rounded-b-2xl">
                                                <Button
                                                        type="button"
                                                        variant="ghost"
                                                        onClick={onClose}
                                                        className="px-6 py-2 h-11 font-semibold text-slate-600 hover:bg-white hover:shadow-sm rounded-xl border border-transparent hover:border-slate-200 transition-all"
                                                >
                                                        Hủy bỏ
                                                </Button>
                                                <Button
                                                        type="submit"
                                                        disabled={isLoading}
                                                        className="px-10 py-2 h-11 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50"
                                                >
                                                        {isLoading ? (
                                                                <>
                                                                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                                                        Đang lưu...
                                                                </>
                                                        ) : 'Lưu cấu hình'}
                                                </Button>
                                        </div>
                                </form>
                        </div>
                </div>
        );
}
