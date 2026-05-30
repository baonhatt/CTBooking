import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Search, RefreshCw, Pencil, Trash2, Plus, Package, Eye, X } from 'lucide-react';
import {
        Pagination,
        PaginationContent,
        PaginationItem,
        PaginationLink,
        PaginationNext,
        PaginationPrevious
} from '@/components/ui/pagination';

interface ToyData {
        id: number;
        name: string;
        category?: string;
        price: number;
        stock: number;
        status: string;
        image_url?: string;
        created_at?: string;
        updated_at?: string;
        created_by_staff_name?: string;
        updated_by_staff_name?: string;
}
interface Props {
        data: ToyData[];
        totalPages: number;
        currentPage: number;
        setPage: React.Dispatch<React.SetStateAction<number>>;
        onEdit: (type: 'toy', data: any) => void;
        onCreate: () => void;
        toysLength: number;
        deleteToyApi: (id: number) => Promise<any>;
        setToys: React.Dispatch<React.SetStateAction<ToyData[]>>;
        onRefresh: () => void;
        searchQuery?: string;
        onSearchChange?: (query: string) => void;
        isLoading?: boolean;
        showActiveOnly?: boolean;
        setShowActiveOnly?: (v: boolean) => void;
}

export default function ToysContent({
        data,
        totalPages,
        currentPage,
        setPage,
        onEdit,
        onCreate,
        toysLength,
        deleteToyApi,
        setToys,
        onRefresh,
        searchQuery = '',
        onSearchChange = () => { },
        isLoading = false,
        showActiveOnly = false,
        setShowActiveOnly = () => { }
}: Props) {
        const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
        const [selectedToy, setSelectedToy] = useState<ToyData | null>(null);

        const handleDelete = async (id: number) => {
                try {
                        // Soft delete: update status to inactive instead of deleting
                        const response = await fetch(`/api/toys/${id}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ status: 'inactive' })
                        });
                        if (!response.ok) throw new Error('Failed to update toy status');

                        // Update local state
                        setToys((prev) => prev.map((toy) => (toy.id === id ? { ...toy, status: 'inactive' } : toy)));
                } catch (e: any) {
                        alert(e?.message || 'Lỗi cập nhật trạng thái đồ chơi');
                }
        };
        return (
                <div className="space-y-6">
                        {/* PAGE HEADER */}
                        <div className="flex items-center justify-between">
                                <div>
                                        <h1 className="text-xl font-bold text-slate-800">Quản lý đồ chơi</h1>
                                        <p className="text-sm text-slate-400 mt-0.5">Tổng cộng {toysLength} sản phẩm trong kho</p>
                                </div>
                        </div>

                        {/* TOOLBAR */}
                        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                                <div className="flex flex-1 gap-3 max-w-xl">
                                        <div className="relative flex-1">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                                <input
                                                        type="text"
                                                        placeholder="Tìm kiếm..."
                                                        value={searchQuery}
                                                        onChange={(e) => onSearchChange(e.target.value)}
                                                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-blue-500 rounded-xl transition-all outline-none text-sm border"
                                                />
                                        </div>
                                        <Button
                                                variant="outline"
                                                size="icon"
                                                onClick={onRefresh}
                                                className="rounded-xl shadow-sm"
                                        >
                                                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                                        </Button>
                                </div>

                                <div className="flex flex-wrap items-center gap-3">
                                        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200">
                                                <span className="text-[10px] font-bold text-slate-500 uppercase whitespace-nowrap">
                                                        Chỉ hiện khả dụng
                                                </span>
                                                <Switch
                                                        checked={showActiveOnly}
                                                        onCheckedChange={setShowActiveOnly}
                                                        className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-gray-300 cursor-pointer"
                                                />
                                        </div>
                                        <Button
                                                onClick={onCreate}
                                                className="bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm gap-2 text-white h-10 px-5 font-medium"
                                        >
                                                <Plus className="w-4 h-4" /> Thêm mới
                                        </Button>
                                </div>
                        </div>
                        <Card className="border border-gray-200 rounded-xl shadow-sm bg-white">
                                <CardContent className="p-0">
                                        <Table>
                                                <TableHeader className="bg-gray-50">
                                                        <TableRow className="hover:bg-transparent border-none">
                                                                <TableHead className="text-xs font-semibold text-gray-600 uppercase py-3">ID</TableHead>
                                                                <TableHead className="text-xs font-semibold text-gray-600 uppercase py-3">Ảnh</TableHead>
                                                                <TableHead className="text-xs font-semibold text-gray-600 uppercase py-3">Sản phẩm</TableHead>
                                                                <TableHead className="text-xs font-semibold text-gray-600 uppercase py-3">Phân loại</TableHead>
                                                                <TableHead className="text-xs font-semibold text-gray-600 uppercase py-3 text-center">Đơn giá</TableHead>
                                                                <TableHead className="text-xs font-semibold text-gray-600 uppercase py-3 text-center">Tồn kho</TableHead>
                                                                <TableHead className="text-xs font-semibold text-gray-600 uppercase py-3 text-center">Trạng thái</TableHead>
                                                                <TableHead className="text-right text-xs font-semibold text-gray-600 uppercase py-3 pr-6">
                                                                        Thao tác
                                                                </TableHead>
                                                        </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                        {isLoading ? (
                                                                Array.from({ length: 5 }).map((_, idx) => (
                                                                        <TableRow key={`sk-${idx}`}>
                                                                                <TableCell>
                                                                                        <Skeleton className="h-4 w-8 mx-auto" />
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                        <Skeleton className="h-10 w-10 rounded-lg" />
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                        <Skeleton className="h-4 w-32" />
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                        <Skeleton className="h-4 w-24" />
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                        <Skeleton className="h-4 w-16 mx-auto" />
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                        <Skeleton className="h-4 w-16 mx-auto" />
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                        <Skeleton className="h-5 w-20 mx-auto" />
                                                                                </TableCell>
                                                                                <TableCell className="text-right">
                                                                                        <Skeleton className="h-8 w-24 ml-auto" />
                                                                                </TableCell>
                                                                        </TableRow>
                                                                ))
                                                        ) : data.length === 0 ? (
                                                                <TableRow>
                                                                        <TableCell colSpan={8} className="text-center h-32 text-muted-foreground italic">
                                                                                <div className="flex flex-col items-center gap-2">
                                                                                        <Package size={32} className="opacity-20" />
                                                                                        <span>Không có đồ chơi nào trong kho</span>
                                                                                </div>
                                                                        </TableCell>
                                                                </TableRow>
                                                        ) : (
                                                                data.map((x) => (
                                                                        <TableRow key={x.id} className="hover:bg-gray-50 transition-colors border-b border-gray-200 h-[52px]">
                                                                                <TableCell className="text-center font-mono text-xs text-slate-500">#{x.id}</TableCell>
                                                                                <TableCell>
                                                                                        <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center">
                                                                                                {x.image_url ? (
                                                                                                        <img src={x.image_url} alt={x.name} className="w-full h-full object-cover" />
                                                                                                ) : (
                                                                                                        <Package size={16} className="text-slate-300" />
                                                                                                )}
                                                                                        </div>
                                                                                </TableCell>
                                                                                <TableCell className="font-bold text-slate-700">{x.name}</TableCell>
                                                                                <TableCell>
                                                                                        {x.category ? (
                                                                                                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[11px] font-medium border border-slate-200">
                                                                                                        {x.category}
                                                                                                </span>
                                                                                        ) : (
                                                                                                <span className="text-slate-400 italic text-xs">---</span>
                                                                                        )}
                                                                                </TableCell>
                                                                                <TableCell className="text-center font-bold text-blue-600">
                                                                                        {x.price.toLocaleString('vi-VN')}đ
                                                                                </TableCell>
                                                                                <TableCell className="text-center">
                                                                                        <span className={`font-bold ${x.stock === 0 ? 'text-red-500' : 'text-slate-700'}`}>
                                                                                                {x.stock}
                                                                                        </span>
                                                                                </TableCell>
                                                                                <TableCell className="text-center">
                                                                                        {x.status === 'active' ? (
                                                                                                <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full text-xs font-medium">
                                                                                                        Hoạt động
                                                                                                </span>
                                                                                        ) : (
                                                                                                <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-500 border border-gray-200 px-2 py-0.5 rounded-full text-xs font-medium">
                                                                                                        Ngừng
                                                                                                </span>
                                                                                        )}
                                                                                </TableCell>
                                                                                <TableCell className="text-right space-x-2">
                                                                                        <Button
                                                                                                variant="outline"
                                                                                                size="sm"
                                                                                                className="h-8 rounded-lg hover:bg-blue-50 text-blue-600"
                                                                                                onClick={() => {
                                                                                                        setSelectedToy(x);
                                                                                                        setIsDetailDialogOpen(true);
                                                                                                }}
                                                                                        >
                                                                                                <Eye className="h-3.5 w-3.5" />
                                                                                        </Button>
                                                                                        <Button
                                                                                                variant="outline"
                                                                                                size="sm"
                                                                                                onClick={() => onEdit('toy', x)}
                                                                                                className="h-8 rounded-lg hover:bg-yellow-50 text-yellow-600"
                                                                                                title="Chỉnh sửa"
                                                                                        >
                                                                                                <Pencil className="h-3.5 w-3.5" />
                                                                                        </Button>
                                                                                        <Button
                                                                                                variant="outline"
                                                                                                size="sm"
                                                                                                onClick={() => handleDelete(x.id)}
                                                                                                className="h-8 rounded-lg hover:bg-red-50 text-red-600"
                                                                                                title="Xóa"
                                                                                        >
                                                                                                <Trash2 className="h-3.5 w-3.5" />
                                                                                        </Button>
                                                                                </TableCell>
                                                                        </TableRow>
                                                                ))
                                                        )}
                                                </TableBody>
                                        </Table>
                                </CardContent>
                        </Card>
                        <Pagination className="mt-4">
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

                        {/* Detail Dialog */}
                        <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
                                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto [&>button]:hidden">
                                        <DialogHeader className="flex flex-row items-center gap-3 space-y-0 pb-4 border-b">
                                                <DialogTitle className="text-lg font-bold text-slate-800">Chi tiết đồ chơi</DialogTitle>
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

                                        {selectedToy && (
                                                <div className="space-y-4">
                                                        {/* Overview */}
                                                        <div className="space-y-4 py-4">
                                                                <div className="grid grid-cols-2 gap-4">
                                                                        <div className="space-y-2">
                                                                                <Label className="text-sm font-medium text-gray-500">Tên đồ chơi</Label>
                                                                                <div className="text-sm font-medium">{selectedToy.name}</div>
                                                                        </div>
                                                                        <div className="space-y-2">
                                                                                <Label className="text-sm font-medium text-gray-500">Danh mục</Label>
                                                                                <div className="text-sm">{selectedToy.category || '-'}</div>
                                                                        </div>
                                                                        <div className="space-y-2">
                                                                                <Label className="text-sm font-medium text-gray-500">Giá</Label>
                                                                                <div className="text-sm font-medium">{new Intl.NumberFormat('vi-VN').format(selectedToy.price)} VNĐ</div>
                                                                        </div>
                                                                        <div className="space-y-2">
                                                                                <Label className="text-sm font-medium text-gray-500">Tồn kho</Label>
                                                                                <div className="text-sm">{selectedToy.stock}</div>
                                                                        </div>
                                                                        <div className="space-y-2">
                                                                                <Label className="text-sm font-medium text-gray-500">Trạng thái</Label>
                                                                                <div className="text-sm">{selectedToy.status === 'active' ? 'Hoạt động' : 'Ngừng'}</div>
                                                                        </div>
                                                                </div>
                                                                {selectedToy.image_url && (
                                                                        <div className="space-y-2">
                                                                                <Label className="text-sm font-medium text-gray-500">Hình ảnh</Label>
                                                                                <img src={selectedToy.image_url} alt={selectedToy.name} className="w-32 h-32 object-cover rounded-lg" />
                                                                        </div>
                                                                )}
                                                        </div>
                                                        <div className="border-t pt-4 mt-4">
                                                                <h4 className="text-sm font-semibold mb-3">Thông tin tạo & cập nhật</h4>
                                                                <div className="grid grid-cols-2 gap-4">
                                                                        <div className="space-y-2">
                                                                                <Label className="text-sm font-medium text-gray-500">Ngày tạo</Label>
                                                                                <div className="text-sm">{selectedToy.created_at ? new Date(selectedToy.created_at).toLocaleString('vi-VN') : '-'}</div>
                                                                        </div>
                                                                        <div className="space-y-2">
                                                                                <Label className="text-sm font-medium text-gray-500">Tạo bởi</Label>
                                                                                <div className="text-sm">{selectedToy.created_by_staff_name || '-'}</div>
                                                                        </div>
                                                                        <div className="space-y-2">
                                                                                <Label className="text-sm font-medium text-gray-500">Cập nhật lần cuối</Label>
                                                                                <div className="text-sm">{selectedToy.updated_at ? new Date(selectedToy.updated_at).toLocaleString('vi-VN') : '-'}</div>
                                                                        </div>
                                                                        <div className="space-y-2">
                                                                                <Label className="text-sm font-medium text-gray-500">Cập nhật bởi</Label>
                                                                                <div className="text-sm">{selectedToy.updated_by_staff_name || '-'}</div>
                                                                        </div>
                                                                </div>
                                                        </div>
                                                </div>
                                        )}
                                </DialogContent>
                        </Dialog>
                </div>
        );
}
