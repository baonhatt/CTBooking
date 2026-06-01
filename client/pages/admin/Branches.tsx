import React, { useEffect, useState } from 'react';
import AdminLayout from '@/admin/layouts/AdminLayout';
import { getBranches, deleteBranchApi, toggleBranchStatusApi } from '@/lib/api/branches';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useStaffStore } from '@/store/staffStore';
import { useStaffPermissions, useIsSuperAdmin } from '@/hooks/useStaffPermission';
import { Edit2, X, Search, RefreshCw, Pencil, Trash2, Plus, Building2, Eye, EyeOff, Phone, Mail, MapPin, BarChart3, History, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
        movie_count: number;
        package_count: number;
        booking_count: number;
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

                                {/* TOOLBAR */}
                                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                                        <div className="flex flex-1 gap-3 max-w-xl">
                                                <div className="relative flex-1">
                                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                                        <input
                                                                type="text"
                                                                placeholder="Tìm theo tên, mã, địa chỉ..."
                                                                value={searchQuery}
                                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                                className="w-full pl-10 pr-4 py-2 bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-blue-500 rounded-xl transition-all outline-none text-sm border"
                                                        />
                                                </div>
                                                <Button
                                                        variant="outline"
                                                        size="icon"
                                                        onClick={handleRefresh}
                                                        className="rounded-xl shadow-sm hover:rotate-180 transition-transform duration-500 shrink-0 h-10 w-10"
                                                        title="Làm mới"
                                                >
                                                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                                                </Button>
                                        </div>

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
                                                <Button
                                                        onClick={openCreate}
                                                        className="bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm gap-2 text-white h-10 px-5 font-medium"
                                                >
                                                        <Plus className="w-4 h-4" /> Thêm mới
                                                </Button>
                                        </div>
                                </div>

                                {isLoading ? (
                                        <div className="text-center py-8">Đang tải...</div>
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
                                                                                                        <Button
                                                                                                                variant="ghost"
                                                                                                                size="icon"
                                                                                                                className="h-8 w-8 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                                                                                                                onClick={() => openEdit(branch)}
                                                                                                                title="Sửa"
                                                                                                        >
                                                                                                                <Pencil className="h-3.5 w-3.5" />
                                                                                                        </Button>
                                                                                                        <Button
                                                                                                                variant="ghost"
                                                                                                                size="icon"
                                                                                                                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                                                                                onClick={() => handleDelete(branch.id)}
                                                                                                                title="Xóa"
                                                                                                        >
                                                                                                                <Trash2 className="h-3.5 w-3.5" />
                                                                                                        </Button>
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
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                {/* Basic Info */}
                                                                <Card className="border-slate-200 shadow-none bg-slate-50/50 h-fit">
                                                                        <CardContent className="p-4 space-y-4">
                                                                                <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                                                                                        <Info className="w-4 h-4 text-blue-500" />
                                                                                        <h3 className="text-sm font-semibold text-slate-800">Thông tin cơ bản</h3>
                                                                                </div>
                                                                                <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                                                                                        <div className="space-y-1">
                                                                                                <Label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Tên chi nhánh</Label>
                                                                                                <div className="text-sm font-semibold text-slate-900 leading-tight">{selectedBranch.name}</div>
                                                                                        </div>
                                                                                        <div className="space-y-1">
                                                                                                <Label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Mã chi nhánh</Label>
                                                                                                <div className="text-sm font-mono text-blue-600 font-medium">{selectedBranch.code}</div>
                                                                                        </div>
                                                                                        <div className="space-y-1 col-span-2">
                                                                                                <Label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Trạng thái</Label>
                                                                                                <div className="flex gap-2 pt-0.5">
                                                                                                        {selectedBranch.is_default && (
                                                                                                                <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none rounded-full px-2 py-0 text-[10px] h-5">Mặc định</Badge>
                                                                                                        )}
                                                                                                        <Badge className={`${selectedBranch.is_active ? 'bg-blue-100 text-blue-700 hover:bg-blue-100' : 'bg-slate-100 text-slate-600 hover:bg-slate-100'} border-none rounded-full px-2 py-0 text-[10px] h-5`}>
                                                                                                                {selectedBranch.is_active ? 'Hoạt động' : 'Ngừng'}
                                                                                                        </Badge>
                                                                                                </div>
                                                                                        </div>
                                                                                </div>
                                                                        </CardContent>
                                                                </Card>

                                                                {/* Contact Info */}
                                                                <Card className="border-slate-200 shadow-none bg-slate-50/50 h-fit">
                                                                        <CardContent className="p-4 space-y-4">
                                                                                <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                                                                                        <MapPin className="w-4 h-4 text-orange-500" />
                                                                                        <h3 className="text-sm font-semibold text-slate-800">Thông tin liên hệ</h3>
                                                                                </div>
                                                                                <div className="space-y-3">
                                                                                        <div className="flex items-start gap-3">
                                                                                                <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                                                                                                <div className="space-y-0.5">
                                                                                                        <Label className="text-[10px] font-medium text-slate-500">Địa chỉ</Label>
                                                                                                        <div className="text-sm text-slate-700 leading-tight">{selectedBranch.address || 'Chưa cập nhật'}</div>
                                                                                                </div>
                                                                                        </div>
                                                                                        <div className="grid grid-cols-2 gap-4">
                                                                                                <div className="flex items-start gap-3">
                                                                                                        <Phone className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                                                                                                        <div className="space-y-0.5">
                                                                                                                <Label className="text-[10px] font-medium text-slate-500">Điện thoại</Label>
                                                                                                                <div className="text-sm text-slate-700">{selectedBranch.phone || 'Chưa cập nhật'}</div>
                                                                                                        </div>
                                                                                                </div>
                                                                                                <div className="flex items-start gap-3">
                                                                                                        <Mail className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                                                                                                        <div className="space-y-0.5">
                                                                                                                <Label className="text-[10px] font-medium text-slate-500">Email</Label>
                                                                                                                <div className="text-sm text-slate-700 break-all leading-tight">{selectedBranch.email || 'Chưa cập nhật'}</div>
                                                                                                        </div>
                                                                                                </div>
                                                                                        </div>
                                                                                </div>
                                                                        </CardContent>
                                                                </Card>

                                                                {/* Statistics */}
                                                                <Card className="border-slate-200 shadow-none bg-slate-50/50 h-fit">
                                                                        <CardContent className="p-4 space-y-4">
                                                                                <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                                                                                        <BarChart3 className="w-4 h-4 text-purple-500" />
                                                                                        <h3 className="text-sm font-semibold text-slate-800">Thống kê hoạt động</h3>
                                                                                </div>
                                                                                <div className="grid grid-cols-3 gap-3">
                                                                                        <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm text-center space-y-1">
                                                                                                <div className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">Số phim</div>
                                                                                                <div className="text-lg font-bold text-blue-600">{selectedBranch.movie_count}</div>
                                                                                        </div>
                                                                                        <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm text-center space-y-1">
                                                                                                <div className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">Số gói vé</div>
                                                                                                <div className="text-lg font-bold text-purple-600">{selectedBranch.package_count}</div>
                                                                                        </div>
                                                                                        <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm text-center space-y-1">
                                                                                                <div className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">Booking</div>
                                                                                                <div className="text-lg font-bold text-green-600">{selectedBranch.booking_count}</div>
                                                                                        </div>
                                                                                </div>
                                                                        </CardContent>
                                                                </Card>

                                                                {/* System Info */}
                                                                <Card className="border-slate-200 shadow-none bg-slate-50/50 h-fit">
                                                                        <CardContent className="p-4 space-y-4">
                                                                                <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                                                                                        <History className="w-4 h-4 text-slate-500" />
                                                                                        <h3 className="text-sm font-semibold text-slate-800">Thông tin hệ thống</h3>
                                                                                </div>
                                                                                <div className="grid grid-cols-2 gap-4">
                                                                                        <div className="space-y-1">
                                                                                                <Label className="text-[10px] font-medium text-slate-500 uppercase tracking-tighter">Ngày tạo</Label>
                                                                                                <div className="text-xs text-slate-700 font-medium">{new Date(selectedBranch.created_at).toLocaleString('vi-VN')}</div>
                                                                                                <div className="text-[10px] text-slate-400 font-medium italic">Bởi: {selectedBranch.created_by_staff_name || 'Hệ thống'}</div>
                                                                                        </div>
                                                                                        <div className="space-y-1">
                                                                                                <Label className="text-[10px] font-medium text-slate-500 uppercase tracking-tighter">Cập nhật cuối</Label>
                                                                                                <div className="text-xs text-slate-700 font-medium">{new Date(selectedBranch.updated_at).toLocaleString('vi-VN')}</div>
                                                                                                <div className="text-[10px] text-slate-400 font-medium italic">Bởi: {selectedBranch.updated_by_staff_name || 'Hệ thống'}</div>
                                                                                        </div>
                                                                                </div>
                                                                        </CardContent>
                                                                </Card>
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
                is_active: true
        });
        const [isLoading, setIsLoading] = useState(false);
        const [isCodeEditable, setIsCodeEditable] = useState(false);

        useEffect(() => {
                if (data) {
                        setFormData({
                                name: data.name || '',
                                code: data.code || '',
                                address: data.address || '',
                                phone: data.phone || '',
                                email: data.email || '',
                                is_default: data.is_default || false,
                                is_active: data.is_active ?? true
                        });
                        setIsCodeEditable(false); // Default to locked
                }
        }, [data]);

        const handleSubmit = async (e: React.FormEvent) => {
                e.preventDefault();
                setIsLoading(true);

                try {
                        // Check if setting as default and another branch is already default
                        if (formData.is_default) {
                                const existingDefault = branches.find(b => b.is_default && b.id !== data.id);
                                if (existingDefault) {
                                        toast.error('Không thể đặt làm mặc định', {
                                                description: `Chi nhánh "${existingDefault.name}" đang là mặc định. Vui lòng bỏ mặc định của chi nhánh đó trước.`
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
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
                        <div className="bg-white rounded-lg p-6 w-full max-w-md relative" onClick={(e) => e.stopPropagation()}>
                                <div className="flex justify-between items-center mb-4 pb-4 border-b">
                                        <h2 className="text-xl font-bold text-slate-800">{data.id === 0 ? 'Thêm chi nhánh mới' : 'Sửa chi nhánh'}</h2>
                                        <button
                                                onClick={onClose}
                                                className="h-8 w-8 rounded-full hover:bg-slate-100 text-slate-400 transition-colors flex items-center justify-center"
                                        >
                                                <X className="w-5 h-5" />
                                        </button>
                                </div>
                                <form onSubmit={handleSubmit}>
                                        <div className="space-y-4">
                                                <div>
                                                        <label className="block text-sm font-medium mb-1">Tên chi nhánh *</label>
                                                        <input
                                                                type="text"
                                                                value={formData.name}
                                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                                className="w-full px-3 py-2 border rounded"
                                                                required
                                                        />
                                                </div>
                                                <div>
                                                        <label className="block text-sm font-medium mb-1">Mã chi nhánh *</label>
                                                        <div className="flex gap-2">
                                                                <input
                                                                        type="text"
                                                                        value={formData.code}
                                                                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                                                        disabled={!isCodeEditable}
                                                                        className={`flex-1 px-3 py-2 border rounded ${!isCodeEditable ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''}`}
                                                                        required
                                                                />
                                                                {data.id === 0 && (
                                                                        <button
                                                                                type="button"
                                                                                onClick={() => setIsCodeEditable(!isCodeEditable)}
                                                                                className="px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded transition-colors"
                                                                                title={isCodeEditable ? 'Khóa mã' : 'Sửa mã'}
                                                                        >
                                                                                <Edit2 className="w-4 h-4 text-slate-600" />
                                                                        </button>
                                                                )}
                                                        </div>
                                                </div>
                                                <div>
                                                        <label className="block text-sm font-medium mb-1">Địa chỉ</label>
                                                        <input
                                                                type="text"
                                                                value={formData.address}
                                                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                                                className="w-full px-3 py-2 border rounded"
                                                        />
                                                </div>
                                                <div>
                                                        <label className="block text-sm font-medium mb-1">Số điện thoại</label>
                                                        <input
                                                                type="text"
                                                                value={formData.phone}
                                                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                                                className="w-full px-3 py-2 border rounded"
                                                        />
                                                </div>
                                                <div>
                                                        <label className="block text-sm font-medium mb-1">Email</label>
                                                        <input
                                                                type="email"
                                                                value={formData.email}
                                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                                className="w-full px-3 py-2 border rounded"
                                                        />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                        <input
                                                                type="checkbox"
                                                                id="is_default"
                                                                checked={formData.is_default}
                                                                onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                                                        />
                                                        <label htmlFor="is_default" className="text-sm">
                                                                Chi nhánh mặc định
                                                        </label>
                                                </div>
                                        </div>
                                        <div className="flex justify-end gap-2 mt-6">
                                                <button type="button" onClick={onClose} className="px-4 py-2 border rounded hover:bg-gray-100">
                                                        Hủy
                                                </button>
                                                <button
                                                        type="submit"
                                                        disabled={isLoading}
                                                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                                                >
                                                        {isLoading ? 'Đang lưu...' : 'Lưu'}
                                                </button>
                                        </div>
                                </form>
                        </div>
                </div>
        );
}
