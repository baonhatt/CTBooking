import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
        Pagination,
        PaginationContent,
        PaginationItem,
        PaginationNext,
        PaginationPrevious
} from '@/components/ui/pagination';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
        Eye,
        Pencil,
        Clock,
        Star,
        Search,
        FilterX,
        RefreshCw,
        Plus,
        History,
        Trash2,
        FileText,
        Image,
        ShieldAlert,
        Globe,
        Calendar,
        X,
        MessageSquare,
        Ticket,
        AlertCircle,
        SortDesc,
        SortAsc
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { getMovieById } from '@/lib/api';
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
import { optimizeCloudinaryUrl } from '@/lib/utils';

interface MovieData {
        id: string | number;
        title: string;
        duration: string;
        genres: string[];
        posterUrl: string;
        release_date: string | null;
        rating: number | null;
        updated_at: string;
        cover_image?: string;
        created_by_staff_name?: string;
        updated_by_staff_name?: string;
}

interface Props {
        data: MovieData[];
        totalPages: number;
        currentPage: number;
        setPage: (p: number) => void;
        movieStatus: Record<string, string>; // Changed from "active" | "inactive" to string
        onToggleStatus: (id: string | number, currentStatus: boolean) => void;
        onEdit: (type: 'movie', data: any) => void;
        onCreate: () => void;
        moviesLength: number;
        onRefresh: () => void;
        searchQuery?: string;
        onSearchChange?: (query: string) => void;
        sortKey?: string;
        sortDir?: 'asc' | 'desc';
        setSortKey?: (k: any) => void;
        setSortDir?: (d: 'asc' | 'desc') => void;
        isLoading?: boolean;
        showActiveOnly?: boolean;
        setShowActiveOnly?: (v: boolean) => void;
        isDetailsOpen: boolean;
        setIsDetailsOpen: (v: boolean) => void;
        selectedMovieId: number | null;
        setSelectedMovieId: (id: number | null) => void;
        branches?: any[];
        selectedBranchId?: number | null;
        setSelectedBranchId?: (id: number | null) => void;
        onDelete?: (id: number) => void;
}

export default function MoviesContent({
        data,
        totalPages,
        currentPage,
        setPage,
        movieStatus,
        onToggleStatus,
        onEdit,
        onCreate,
        moviesLength,
        onRefresh,
        searchQuery = '',
        onSearchChange = () => { },
        sortKey = 'updated_at',
        setSortKey = () => { },
        sortDir = 'desc',
        setSortDir = () => { },
        isLoading = false,
        showActiveOnly = false,
        setShowActiveOnly = () => { },
        isDetailsOpen = false,
        setIsDetailsOpen = () => { },
        selectedMovieId = null,
        setSelectedMovieId = () => { },
        branches = [],
        selectedBranchId = null,
        setSelectedBranchId = () => { },
        onDelete
}: Props) {
        console.log(data);
        const [movieDetails, setMovieDetails] = useState<any>(null);
        const [isLoadingDetails, setIsLoadingDetails] = useState(false);

        const InfoRow = ({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) => (
                <div className="flex justify-between items-center">
                        <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1.5">
                                {icon} {label}
                        </span>
                        <span className="text-[11px] font-bold text-slate-800">{value}</span>
                </div>
        );

        useEffect(() => {
                if (isDetailsOpen && selectedMovieId) {
                        (async () => {
                                try {
                                        setIsLoadingDetails(true);
                                        const details = await getMovieById(selectedMovieId);
                                        setMovieDetails(details);
                                        console.log(movieDetails);
                                } catch (err) {
                                        console.error('Lỗi load chi tiết:', err);
                                } finally {
                                        setIsLoadingDetails(false);
                                }
                        })();
                } else {
                        setMovieDetails(null);
                }
        }, [isDetailsOpen, selectedMovieId]);

        return (
                <div className="space-y-6 font-sans">
                        {/* PAGE HEADER */}
                        <div className="flex items-center justify-between">
                                <div>
                                        <h1 className="text-xl font-bold text-slate-800">Quản lý phim</h1>
                                        <p className="text-sm text-slate-400 mt-0.5">Tổng cộng {moviesLength} phim trong hệ thống</p>
                                </div>
                        </div>

                        {/* TOOLBAR */}
                        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                                <div className="flex flex-1 w-full gap-3">
                                        <div className="relative flex-1 max-w-md">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                                <input
                                                        type="text"
                                                        placeholder="Tìm tên phim..."
                                                        value={searchQuery}
                                                        onChange={(e) => onSearchChange(e.target.value)}
                                                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-blue-500 rounded-xl transition-all outline-none text-sm"
                                                />
                                        </div>
                                        <Button
                                                variant="outline"
                                                size="icon"
                                                onClick={onRefresh}
                                                className="rounded-xl shadow-sm hover:rotate-180 transition-transform duration-500"
                                        >
                                                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                                        </Button>
                                </div>

                                <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto font-sans">
                                        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200">
                                                <span className="text-[10px] font-bold text-slate-500 uppercase">Chỉ hiện đang chiếu</span>
                                                <Switch
                                                        checked={showActiveOnly}
                                                        onCheckedChange={setShowActiveOnly}
                                                        className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-gray-300 cursor-pointer"
                                                />
                                        </div>

                                        <select
                                                value={sortKey}
                                                onChange={(e) => setSortKey(e.target.value as any)}
                                                className="bg-white border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm cursor-pointer"
                                        >
                                                <option value="updated_at">Mới cập nhật</option>
                                                <option value="rating">Đánh giá cao</option>
                                                <option value="release_date">Ngày phát hành</option>
                                        </select>

                                        {branches.length > 0 && (
                                                <select
                                                        value={selectedBranchId || ''}
                                                        onChange={(e) => setSelectedBranchId(e.target.value ? Number(e.target.value) : null)}
                                                        className="bg-white border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm cursor-pointer"
                                                >
                                                        <option value="">Tất cả chi nhánh</option>
                                                        {branches.map((branch) => (
                                                                <option key={branch.id} value={branch.id}>
                                                                        {branch.name}
                                                                </option>
                                                        ))}
                                                </select>
                                        )}
                                        {/* BỔ SUNG NÚT ĐẢO CHIỀU TẠI ĐÂY */}
                                        <Button
                                                variant="outline"
                                                size="icon"
                                                onClick={() => setSortDir?.(sortDir === 'asc' ? 'desc' : 'asc')}
                                                className="rounded-xl border-slate-200 hover:bg-slate-50 active:scale-95 transition-all shadow-sm"
                                                title={sortDir === 'asc' ? 'Tăng dần' : 'Giảm dần'}
                                        >
                                                {sortDir === 'desc' ? (
                                                        <SortDesc className="w-4 h-4 text-slate-600" />
                                                ) : (
                                                        <SortAsc className="w-4 h-4 text-slate-600" />
                                                )}
                                        </Button>
                                        {/* KẾT THÚC BỔ SUNG */}

                                        <Button
                                                onClick={onCreate}
                                                className="bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm gap-2 text-white h-10 px-5 font-medium"
                                        >
                                                <Plus className="w-4 h-4" /> Thêm mới
                                        </Button>
                                </div>
                        </div>

                        {/* TABLE */}
                        <Card className="border border-gray-200 rounded-xl shadow-sm bg-white">
                                <CardContent className="p-0 font-sans">
                                        <Table>
                                                <TableHeader className="bg-gray-50">
                                                        <TableRow className="hover:bg-transparent border-none">
                                                                <TableHead className="text-xs font-semibold text-gray-600 uppercase py-3">ID</TableHead>
                                                                <TableHead className="min-w-[300px] text-xs font-semibold text-gray-600 uppercase py-3">
                                                                        Phim & Thể loại
                                                                </TableHead>
                                                                <TableHead className="text-xs font-semibold text-gray-600 uppercase py-3 text-center">Đánh giá</TableHead>
                                                                <TableHead className="text-xs font-semibold text-gray-600 uppercase py-3">Cập nhật</TableHead>
                                                                <TableHead className="text-center text-xs font-semibold text-gray-600 uppercase py-3">Trạng thái</TableHead>
                                                                <TableHead className="text-right text-xs font-semibold text-gray-600 uppercase py-3 pr-8">
                                                                        Thao tác
                                                                </TableHead>
                                                        </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                        {isLoading ? (
                                                                Array.from({ length: 5 }).map((_, idx) => (
                                                                        <TableRow key={idx}>
                                                                                <TableCell colSpan={6}>
                                                                                        <Skeleton className="h-16 w-full rounded-xl" />
                                                                                </TableCell>
                                                                        </TableRow>
                                                                ))
                                                        ) : data.length === 0 ? (
                                                                <TableRow>
                                                                        <TableCell colSpan={6} className="h-64 text-center">
                                                                                <div className="flex flex-col items-center justify-center text-slate-400 gap-2">
                                                                                        <FilterX size={48} className="opacity-20 mb-2" />
                                                                                        <p className="text-sm font-medium text-slate-500">Không tìm thấy bộ phim nào phù hợp</p>
                                                                                        <Button variant="link" onClick={onRefresh} className="text-blue-500 text-xs">
                                                                                                Xóa bộ lọc & Thử lại
                                                                                        </Button>
                                                                                </div>
                                                                        </TableCell>
                                                                </TableRow>
                                                        ) : (
                                                                data.map((movie) => {
                                                                        const isActive = movieStatus[movie.id] === 'active';
                                                                        return (
                                                                                <TableRow
                                                                                        key={movie.id}
                                                                                        className="group hover:bg-gray-50 transition-colors border-b border-gray-200 h-[52px]"
                                                                                >
                                                                                        <TableCell className="text-center font-mono text-[11px] text-slate-400">{movie.id}</TableCell>
                                                                                        <TableCell>
                                                                                                <div className="flex items-center gap-4 py-2">
                                                                                                        <div className="relative shrink-0 transition-transform group-hover:scale-105">
                                                                                                                <img
                                                                                                                        src={
                                                                                                                                optimizeCloudinaryUrl(movie.posterUrl, 200) ||
                                                                                                                                'https://placehold.co/400x600?text=No+Poster'
                                                                                                                        }
                                                                                                                        loading="lazy"
                                                                                                                        className="w-12 h-16 object-cover rounded-lg shadow-sm border border-slate-100"
                                                                                                                        alt=""
                                                                                                                />
                                                                                                                <div className="absolute -bottom-1 -right-1 bg-white shadow-sm border text-[8px] text-slate-600 px-1 rounded flex items-center gap-0.5 font-bold">
                                                                                                                        <Clock size={8} /> {movie.duration}′
                                                                                                                </div>
                                                                                                        </div>
                                                                                                        <div className="flex flex-col gap-0.5 min-w-0">
                                                                                                                <h4 className="font-bold text-slate-900 leading-tight line-clamp-1">{movie.title}</h4>
                                                                                                                <p className="text-[11px] text-slate-500 line-clamp-1">{movie.genres.join(' • ')}</p>
                                                                                                        </div>
                                                                                                </div>
                                                                                        </TableCell>
                                                                                        <TableCell className="text-center">
                                                                                                <div className="inline-flex items-center gap-1 bg-yellow-50 px-2 py-0.5 rounded-md border border-yellow-100">
                                                                                                        <Star size={10} className="fill-yellow-500 text-yellow-500" />
                                                                                                        <span className="text-xs font-black text-yellow-700">{movie.rating || '0'}</span>
                                                                                                </div>
                                                                                        </TableCell>
                                                                                        <TableCell>
                                                                                                <div className="flex flex-col text-[11px]">
                                                                                                        <span className="text-slate-600 font-medium flex items-center gap-1">
                                                                                                                <History size={10} className="text-slate-400" />
                                                                                                                {movie.updated_at ? format(new Date(movie.updated_at), 'HH:mm') : '-'}
                                                                                                        </span>
                                                                                                        <span
                                                                                                                className="text-slate-400 italic cursor-help"
                                                                                                                title={movie.updated_at ? new Date(movie.updated_at).toLocaleString('vi-VN') : ''}
                                                                                                        >
                                                                                                                {movie.updated_at
                                                                                                                        ? formatDistanceToNow(new Date(movie.updated_at), { addSuffix: true, locale: vi })
                                                                                                                        : ''}
                                                                                                        </span>
                                                                                                </div>
                                                                                        </TableCell>
                                                                                        <TableCell>
                                                                                                <div className="flex items-center justify-center gap-4 py-2">
                                                                                                        <div className="flex shrink-0 w-12 justify-center">
                                                                                                                <AlertDialog>
                                                                                                                        <AlertDialogTrigger asChild>
                                                                                                                                <Switch
                                                                                                                                        checked={isActive}
                                                                                                                                        className="scale-100 transition-all border-2 border-transparent cursor-pointer"
                                                                                                                                        style={{
                                                                                                                                                opacity: 1,
                                                                                                                                                backgroundColor: isActive ? '#10b981' : '#d1d5db',
                                                                                                                                                boxShadow: 'none'
                                                                                                                                        }}
                                                                                                                                />
                                                                                                                        </AlertDialogTrigger>

                                                                                                                        {/* Phần nội dung Alert không còn rỗng */}
                                                                                                                        <AlertDialogContent className="rounded-2xl font-sans bg-white">
                                                                                                                                <AlertDialogHeader>
                                                                                                                                        <AlertDialogTitle className="text-slate-900">
                                                                                                                                                Xác nhận thay đổi trạng thái
                                                                                                                                        </AlertDialogTitle>
                                                                                                                                        <AlertDialogDescription className="text-slate-500 text-sm">
                                                                                                                                                {isActive ? (
                                                                                                                                                        <span>
                                                                                                                                                                Bạn có muốn <strong>ẩn</strong> phim này không?
                                                                                                                                                                <br />
                                                                                                                                                                Hành động này sẽ khiến phim không xuất hiện trên giao diện người dùng.
                                                                                                                                                        </span>
                                                                                                                                                ) : (
                                                                                                                                                        <span>
                                                                                                                                                                Bạn có muốn <strong>kích hoạt</strong> phim này không?
                                                                                                                                                                <br />
                                                                                                                                                                Phim sẽ bắt đầu hiển thị công khai trên website.
                                                                                                                                                        </span>
                                                                                                                                                )}
                                                                                                                                        </AlertDialogDescription>
                                                                                                                                </AlertDialogHeader>

                                                                                                                                <AlertDialogFooter className="mt-4">
                                                                                                                                        <AlertDialogCancel className="rounded-xl border-slate-200">Hủy</AlertDialogCancel>
                                                                                                                                        <AlertDialogAction
                                                                                                                                                onClick={() => onToggleStatus(movie.id, isActive)}
                                                                                                                                                className={`rounded-xl text-white ${isActive ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-600 hover:bg-emerald-700'
                                                                                                                                                        }`}
                                                                                                                                        >
                                                                                                                                                {isActive ? 'Đồng ý ẩn' : 'Đồng ý kích hoạt'}
                                                                                                                                        </AlertDialogAction>
                                                                                                                                </AlertDialogFooter>
                                                                                                                        </AlertDialogContent>
                                                                                                                </AlertDialog>
                                                                                                        </div>

                                                                                                        {/* Badge trạng thái */}
                                                                                                        <div className="w-20 flex shrink-0">
                                                                                                                <Badge
                                                                                                                        className={`text-xs font-medium px-2 py-0.5 rounded-full border whitespace-nowrap justify-center w-full transition-all duration-200
                              ${isActive
                                                                                                                                        ? 'bg-green-50 text-green-700 border-green-200'
                                                                                                                                        : 'bg-gray-100 text-gray-500 border-gray-200'
                                                                                                                                }`}
                                                                                                                >
                                                                                                                        {isActive ? 'Hoạt động' : 'Ngừng'}
                                                                                                                </Badge>
                                                                                                        </div>
                                                                                                </div>
                                                                                        </TableCell>

                                                                                        <TableCell className="text-right pr-6">
                                                                                                <div className="flex justify-end gap-2">
                                                                                                        <Button
                                                                                                                variant="outline"
                                                                                                                size="sm"
                                                                                                                className="h-8 rounded-lg hover:bg-blue-50 text-blue-600"
                                                                                                                onClick={() => {
                                                                                                                        setSelectedMovieId(Number(movie.id));
                                                                                                                        setIsDetailsOpen(true);
                                                                                                                }}
                                                                                                                title="Xem chi tiết"
                                                                                                        >
                                                                                                                <Eye className="h-3.5 w-3.5" />
                                                                                                        </Button>
                                                                                                        <Button
                                                                                                                variant="outline"
                                                                                                                size="sm"
                                                                                                                className="h-8 rounded-lg hover:bg-yellow-50 text-yellow-600"
                                                                                                                onClick={() => onEdit('movie', movie)}
                                                                                                                title="Chỉnh sửa"
                                                                                                        >
                                                                                                                <Pencil className="h-3.5 w-3.5" />
                                                                                                        </Button>
                                                                                                        {onDelete && (
                                                                                                                <Button
                                                                                                                        variant="outline"
                                                                                                                        size="sm"
                                                                                                                        className="h-8 rounded-lg hover:bg-red-50 text-red-600"
                                                                                                                        onClick={() => onDelete(Number(movie.id))}
                                                                                                                        title="Xóa"
                                                                                                                >
                                                                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                                                                </Button>
                                                                                                        )}
                                                                                                </div>
                                                                                        </TableCell>
                                                                                </TableRow>
                                                                        );
                                                                })
                                                        )}
                                                </TableBody>
                                        </Table>
                                </CardContent>
                        </Card>

                        {/* PAGINATION */}
                        <div className="flex flex-col sm:flex-row justify-between items-center bg-white px-6 py-4 rounded-2xl border shadow-sm gap-4">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                        {moviesLength} phim trong hệ thống
                                </span>
                                <Pagination className="justify-end w-auto mx-0">
                                        <PaginationContent className="gap-1">
                                                <PaginationItem>
                                                        <PaginationPrevious
                                                                href="#"
                                                                onClick={(e) => {
                                                                        e.preventDefault();
                                                                        setPage(Math.max(1, currentPage - 1));
                                                                }}
                                                                className={
                                                                        currentPage === 1 ? 'opacity-30 pointer-events-none' : 'cursor-pointer rounded-lg border shadow-sm'
                                                                }
                                                        />
                                                </PaginationItem>
                                                <PaginationItem>
                                                        <span className="text-xs font-bold px-3">
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
                                                                className={
                                                                        currentPage === totalPages
                                                                                ? 'opacity-30 pointer-events-none'
                                                                                : 'cursor-pointer rounded-lg border shadow-sm'
                                                                }
                                                        />
                                                </PaginationItem>
                                        </PaginationContent>
                                </Pagination>
                        </div>

                        {/* MODAL CHI TIẾT */}
                        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                                <DialogContent className="max-w-[700px] rounded-xl p-0 overflow-hidden border border-gray-200 shadow-xl bg-white font-sans [&>button]:hidden">
                                        <DialogTitle className="sr-only">Chi tiết phim</DialogTitle>
                                        {isLoadingDetails ? (
                                                <div className="py-20 flex flex-col items-center gap-3">
                                                        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Đang tải dữ liệu...</p>
                                                </div>
                                        ) : movieDetails ? (
                                                <div className="flex flex-col">
                                                        {/* HEADER: White & Professional */}
                                                        <div className="bg-white px-6 py-4 flex items-center justify-between border-b">
                                                                <div className="flex items-center gap-4">
                                                                        <div className="bg-gray-100 p-1 rounded border border-gray-200">
                                                                                <img
                                                                                        src={optimizeCloudinaryUrl(movieDetails.cover_image, 400)}
                                                                                        className="w-10 h-14 object-cover rounded"
                                                                                        alt=""
                                                                                        onError={(e) => { e.currentTarget.src = 'https://placehold.co/80x112?text=No+Image'; }}
                                                                                />
                                                                        </div>
                                                                        <div className="flex-1">
                                                                                <div className="flex items-center gap-3">
                                                                                        <span className="font-mono text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100">
                                                                                                ID: {movieDetails.id}
                                                                                        </span>
                                                                                        <h2 className="text-base font-semibold text-gray-900 tracking-tight leading-none">
                                                                                                {movieDetails.title}
                                                                                        </h2>
                                                                                        <Button
                                                                                                variant="ghost"
                                                                                                size="icon"
                                                                                                onClick={() =>
                                                                                                        onEdit('movie', {
                                                                                                                id: movieDetails.id,
                                                                                                                title: movieDetails.title,
                                                                                                                description: movieDetails.description,
                                                                                                                genres: movieDetails.genres,
                                                                                                                rating: movieDetails.rating,
                                                                                                                duration: movieDetails.duration_min,
                                                                                                                posterUrl: movieDetails.cover_image,
                                                                                                                is_active: movieDetails.is_active,
                                                                                                                release_date: movieDetails.release_date
                                                                                                        })
                                                                                                }
                                                                                                className="h-7 w-7 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded-full transition-colors ml-1"
                                                                                                title="Chỉnh sửa phim"
                                                                                        >
                                                                                                <Pencil className="h-4 w-4" />
                                                                                        </Button>
                                                                                </div>
                                                                                {/* THỂ LOẠI: Hiển thị rõ ràng dạng Tag - max 4 tags */}
                                                                                <div className="flex flex-wrap gap-1.5 mt-2.5">
                                                                                        {Array.isArray(movieDetails.genres) && movieDetails.genres.length > 0 ? (
                                                                                                <>
                                                                                                        {movieDetails.genres.slice(0, 4).map((genre: string) => (
                                                                                                                <span
                                                                                                                        key={genre}
                                                                                                                        className="text-[9px] font-medium px-2 py-0.5 bg-gray-100 text-gray-600 rounded border border-gray-200"
                                                                                                                >
                                                                                                                        {genre}
                                                                                                                </span>
                                                                                                        ))}
                                                                                                        {movieDetails.genres.length > 4 && (
                                                                                                                <span className="text-[9px] font-medium px-2 py-0.5 bg-gray-200 text-gray-500 rounded border border-gray-300">
                                                                                                                        +{movieDetails.genres.length - 4} more
                                                                                                                </span>
                                                                                                        )}
                                                                                                </>
                                                                                        ) : (
                                                                                                <span className="text-[9px] text-gray-500 italic">Chưa có thể loại</span>
                                                                                        )}
                                                                                </div>
                                                                        </div>
                                                                </div>

                                                                <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={() => setIsDetailsOpen(false)}
                                                                        className="h-8 w-8 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors mr-2"
                                                                >
                                                                        <X size={20} />
                                                                </Button>
                                                        </div>

                                                        {/* BODY SECTION */}
                                                        <div className="p-6 space-y-6">
                                                                {/* Stats Row - 4 cards flex */}
                                                                <div className="flex gap-3 flex-wrap">
                                                                        {[
                                                                                {
                                                                                        label: 'Đánh giá',
                                                                                        val: `${movieDetails.rating}/10`,
                                                                                        icon: <Star size={12} />,
                                                                                        color: 'text-blue-600'
                                                                                },
                                                                                {
                                                                                        label: 'Trạng thái',
                                                                                        val: movieDetails.is_active === true ? 'Đang chiếu' : 'Đã ẩn',
                                                                                        color: movieDetails.is_active === true ? 'text-emerald-600' : 'text-slate-400'
                                                                                },
                                                                                {
                                                                                        label: 'Thời lượng',
                                                                                        val: `${movieDetails.duration_min} phút`,
                                                                                        icon: <Clock size={12} />,
                                                                                        color: 'text-slate-700'
                                                                                },
                                                                                {
                                                                                        label: 'Ngày phát hành',
                                                                                        val: movieDetails.release_date
                                                                                                ? format(new Date(movieDetails.release_date), 'dd/MM/yyyy')
                                                                                                : '-',
                                                                                        icon: <Calendar size={12} />,
                                                                                        color: 'text-slate-700'
                                                                                }
                                                                        ].map((stat, i) => (
                                                                                <div key={i} className="flex-1 min-w-[120px] bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                                                                        <div className="flex items-center gap-1.5 mb-1">
                                                                                                <span className="text-slate-400">{stat.icon}</span>
                                                                                                <p className="text-[9px] text-slate-400 uppercase font-black">{stat.label}</p>
                                                                                        </div>
                                                                                        <p className={`text-lg font-bold ${stat.color || 'text-slate-700'}`}>{stat.val}</p>
                                                                                </div>
                                                                        ))}
                                                                </div>

                                                                {/* Single row: Ticket packages | Metadata */}
                                                                <div className="flex gap-6">
                                                                        {/* LEFT: Ticket packages */}
                                                                        <div className="flex-1">
                                                                                <section className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                                                                        <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                                                                                                <h3 className="text-[11px] font-bold text-slate-600 uppercase flex items-center gap-2 tracking-tight">
                                                                                                        <Ticket size={14} className="text-indigo-500" /> Phân loại gói vé áp dụng
                                                                                                </h3>
                                                                                                <Button variant="ghost" size="sm" className="h-6 text-[10px] text-blue-600 hover:bg-blue-50">
                                                                                                        Cấu hình
                                                                                                </Button>
                                                                                        </div>
                                                                                        <div className="p-4 flex flex-wrap gap-3">
                                                                                                {Array.isArray(movieDetails.applicable_packages) &&
                                                                                                        movieDetails.applicable_packages.length > 0 ? (
                                                                                                        movieDetails.applicable_packages.map((pkg: any, index: number) => {
                                                                                                                const isVip =
                                                                                                                        pkg.code?.toLowerCase().includes('vip') || pkg.name?.toLowerCase().includes('vip');
                                                                                                                return (
                                                                                                                        <div
                                                                                                                                key={pkg.id || index}
                                                                                                                                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border ${isVip ? 'bg-indigo-50 border-indigo-100' : 'bg-emerald-50 border-emerald-100'
                                                                                                                                        }`}
                                                                                                                        >
                                                                                                                                <div
                                                                                                                                        className={`w-2 h-2 rounded-full ${isVip ? 'bg-indigo-500 animate-pulse' : 'bg-emerald-500'
                                                                                                                                                }`}
                                                                                                                                />
                                                                                                                                <span
                                                                                                                                        className={`text-xs font-semibold ${isVip ? 'text-indigo-700' : 'text-emerald-700'}`}
                                                                                                                                >
                                                                                                                                        {pkg.name} ({Number(pkg.price || 0).toLocaleString()}
                                                                                                                                        đ)
                                                                                                                                </span>
                                                                                                                        </div>
                                                                                                                );
                                                                                                        })
                                                                                                ) : (
                                                                                                        <div className="text-xs text-slate-400 italic py-2">
                                                                                                                Chưa có gói vé nào được áp dụng cho phim này
                                                                                                        </div>
                                                                                                )}
                                                                                                <button className="px-4 py-2 border border-dashed border-slate-300 rounded-lg text-slate-400 text-xs hover:bg-slate-50 hover:border-slate-400 transition-all">
                                                                                                        + Gán gói mới
                                                                                                </button>
                                                                                        </div>
                                                                                </section>
                                                                        </div>

                                                                        {/* RIGHT: Metadata - fixed width */}
                                                                        <div className="w-[260px]">
                                                                                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm space-y-3 h-full">
                                                                                        <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                                                                                                Metadata
                                                                                        </h3>
                                                                                        <div className="space-y-3">
                                                                                                <div className="flex justify-between text-xs">
                                                                                                        <span className="text-slate-400">Thời lượng:</span>
                                                                                                        <span className="font-bold text-slate-700">{movieDetails.duration_min} phút</span>
                                                                                                </div>
                                                                                                <div className="flex justify-between text-xs">
                                                                                                        <span className="text-slate-400">Ngày phát hành:</span>
                                                                                                        <span className="font-bold text-slate-700 px-1.5 py-0.5 bg-slate-100 rounded text-[10px]">
                                                                                                                {movieDetails.release_date
                                                                                                                        ? format(new Date(movieDetails.release_date), 'dd/MM/yyyy HH:mm')
                                                                                                                        : '-'}
                                                                                                        </span>
                                                                                                </div>
                                                                                                <div className="flex items-center justify-between text-[11px]">
                                                                                                        <span className="text-slate-400 flex items-center gap-1.5">
                                                                                                                <Calendar size={12} /> Ngày tạo:
                                                                                                        </span>
                                                                                                        <span className="font-mono text-slate-600">
                                                                                                                {movieDetails.created_at
                                                                                                                        ? format(new Date(movieDetails.created_at), 'dd/MM/yyyy HH:mm')
                                                                                                                        : '-'}
                                                                                                        </span>
                                                                                                </div>
                                                                                                <div className="flex items-center justify-between text-[11px]">
                                                                                                        <span className="text-slate-400">Tạo bởi:</span>
                                                                                                        <span className="font-medium text-slate-700">{movieDetails.created_by_staff_name || '-'}</span>
                                                                                                </div>
                                                                                                <div className="flex items-center justify-between text-[11px]">
                                                                                                        <span className="text-slate-400 flex items-center gap-1.5">
                                                                                                                <History size={12} /> Cập nhật:
                                                                                                        </span>
                                                                                                        <span className="font-mono text-slate-600">
                                                                                                                {movieDetails.updated_at
                                                                                                                        ? format(new Date(movieDetails.updated_at), 'dd/MM/yyyy HH:mm')
                                                                                                                        : '-'}
                                                                                                        </span>
                                                                                                </div>
                                                                                                <div className="flex items-center justify-between text-[11px]">
                                                                                                        <span className="text-slate-400">Cập nhật bởi:</span>
                                                                                                        <span className="font-medium text-slate-700">{movieDetails.updated_by_staff_name || '-'}</span>
                                                                                                </div>
                                                                                        </div>
                                                                                </div>
                                                                        </div>
                                                                </div>

                                                                {/* Description - full width at bottom */}
                                                                <section className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                                                        <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                                                                                <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                                                                        <FileText size={14} className="text-blue-500" /> Mô tả hệ thống
                                                                                </h3>
                                                                        </div>
                                                                        <div className="p-5 text-[13px] text-slate-600 leading-relaxed min-h-[80px] line-clamp-6">
                                                                                {movieDetails.description || 'Chưa có mô tả nội dung cho phim này.'}
                                                                        </div>
                                                                </section>
                                                        </div>
                                                </div>
                                        ) : null}
                                </DialogContent>
                        </Dialog>
                </div>
        );
}
