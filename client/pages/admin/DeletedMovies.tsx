import React, { useEffect, useState } from 'react';
import AdminLayout from '@/admin/layouts/AdminLayout';
import { toast } from 'sonner';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
        AlertDialog,
        AlertDialogAction,
        AlertDialogCancel,
        AlertDialogContent,
        AlertDialogDescription,
        AlertDialogFooter,
        AlertDialogHeader,
        AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { RefreshCw, RotateCcw, Image as ImageIcon } from 'lucide-react';

interface Movie {
        id: number;
        title: string;
        genres: string[];
        duration_min?: number;
        rating?: number;
        release_date?: string;
        cover_image?: string;
        deleted_at: string;
        branch_id?: number;
        branch_name?: string;
        deleted_by_staff_name?: string;
}

export default function DeletedMoviesPage() {
        const [activeTab, setActiveTab] = useState('deleted-movies');
        const [movies, setMovies] = useState<Movie[]>([]);
        const [page, setPage] = useState(1);
        const pageSize = 10;
        const [total, setTotal] = useState(0);
        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        const [isLoading, setIsLoading] = useState(false);
        const [searchQuery, setSearchQuery] = useState('');
        const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
        const [movieToRestore, setMovieToRestore] = useState<number | null>(null);
        const [sortField, setSortField] = useState<'title' | 'deleted_at'>('deleted_at');
        const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

        const fetchDeletedMovies = async () => {
                setIsLoading(true);
                try {
                        const token = localStorage.getItem('staffToken');
                        const params = new URLSearchParams({
                                page: String(page),
                                pageSize: String(pageSize),
                                search: searchQuery
                        });
                        const response = await fetch(`/api/admin/deleted/movies?${params}`, {
                                headers: {
                                        Authorization: `Bearer ${token}`
                                }
                        });
                        const data = await response.json();
                        // Client-side sorting
                        let sortedItems = data.items || [];
                        sortedItems.sort((a: Movie, b: Movie) => {
                                let valA: any, valB: any;
                                if (sortField === 'title') {
                                        valA = a.title.toLowerCase();
                                        valB = b.title.toLowerCase();
                                } else {
                                        valA = new Date(a.deleted_at).getTime();
                                        valB = new Date(b.deleted_at).getTime();
                                }
                                if (valA < valB) return sortDir === 'asc' ? -1 : 1;
                                if (valA > valB) return sortDir === 'asc' ? 1 : -1;
                                return 0;
                        });
                        setMovies(sortedItems);
                        setTotal(data.total || 0);
                } catch (error) {
                        toast.error('Lỗi', {
                                description: 'Không thể tải danh sách phim đã xóa'
                        });
                } finally {
                        setIsLoading(false);
                }
        };

        useEffect(() => {
                fetchDeletedMovies();
        }, [page, searchQuery, sortField, sortDir]);

        const handleRestore = (id: number) => {
                setMovieToRestore(id);
                setRestoreDialogOpen(true);
        };

        const handleConfirmRestore = async () => {
                if (!movieToRestore) return;
                try {
                        const token = localStorage.getItem('staffToken');
                        const response = await fetch(`/api/admin/movies/${movieToRestore}/restore`, {
                                method: 'POST',
                                headers: {
                                        Authorization: `Bearer ${token}`
                                }
                        });
                        const data = await response.json();
                        if (response.ok) {
                                toast.success('Thành công', {
                                        description: 'Đã khôi phục phim'
                                });
                                setRestoreDialogOpen(false);
                                fetchDeletedMovies();
                        } else {
                                toast.error('Lỗi', {
                                        description: data.message || 'Không thể khôi phục phim'
                                });
                        }
                } catch (error) {
                        toast.error('Lỗi', {
                                description: 'Có lỗi xảy ra'
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
                        <div className="p-6">
                                <div className="flex justify-between items-center mb-6">
                                        <h1 className="text-2xl font-bold">Phim đã xóa</h1>
                                        <Button onClick={fetchDeletedMovies} variant="outline" size="sm">
                                                <RefreshCw className="w-4 h-4 mr-2" />
                                                Làm mới
                                        </Button>
                                </div>

                                <div className="mb-4">
                                        <Input
                                                placeholder="Tìm kiếm theo tên phim..."
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                className="w-64"
                                        />
                                </div>

                                {isLoading ? (
                                        <div className="text-center py-8">Đang tải...</div>
                                ) : (
                                        <div className="overflow-x-auto">
                                                <Table>
                                                        <TableHeader>
                                                                <TableRow>
                                                                        <TableHead>Poster</TableHead>
                                                                        <TableHead className="cursor-pointer hover:bg-gray-100" onClick={() => { setSortField('title'); setSortDir(sortField === 'title' && sortDir === 'asc' ? 'desc' : 'asc'); }}>
                                                                                Tên phim {sortField === 'title' && (sortDir === 'asc' ? '↑' : '↓')}
                                                                        </TableHead>
                                                                        <TableHead>Thể loại</TableHead>
                                                                        <TableHead>Thời lượng</TableHead>
                                                                        <TableHead>Đánh giá</TableHead>
                                                                        <TableHead>Ngày phát hành</TableHead>
                                                                        <TableHead>Xóa bởi</TableHead>
                                                                        <TableHead className="cursor-pointer hover:bg-gray-100" onClick={() => { setSortField('deleted_at'); setSortDir(sortField === 'deleted_at' && sortDir === 'asc' ? 'desc' : 'asc'); }}>
                                                                                Ngày xóa {sortField === 'deleted_at' && (sortDir === 'asc' ? '↑' : '↓')}
                                                                        </TableHead>
                                                                        <TableHead className="text-right">Hành động</TableHead>
                                                                </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                                {movies.map((m) => (
                                                                        <TableRow key={m.id}>
                                                                                <TableCell>
                                                                                        {m.cover_image ? (
                                                                                                <img
                                                                                                        src={m.cover_image}
                                                                                                        alt={m.title}
                                                                                                        className="w-12 h-16 object-cover rounded"
                                                                                                />
                                                                                        ) : (
                                                                                                <div className="w-12 h-16 bg-gray-200 rounded flex items-center justify-center">
                                                                                                        <ImageIcon className="w-6 h-6 text-gray-400" />
                                                                                                </div>
                                                                                        )}
                                                                                </TableCell>
                                                                                <TableCell className="font-medium">{m.title}</TableCell>
                                                                                <TableCell>
                                                                                        {m.genres && m.genres.length > 0 ? (
                                                                                                <div className="flex flex-wrap gap-1">
                                                                                                        {m.genres.slice(0, 2).map((g, i) => (
                                                                                                                <Badge key={i} variant="secondary" className="text-xs">
                                                                                                                        {g}
                                                                                                                </Badge>
                                                                                                        ))}
                                                                                                        {m.genres.length > 2 && (
                                                                                                                <Badge variant="secondary" className="text-xs">
                                                                                                                        +{m.genres.length - 2}
                                                                                                                </Badge>
                                                                                                        )}
                                                                                                </div>
                                                                                        ) : (
                                                                                                '-'
                                                                                        )}
                                                                                </TableCell>
                                                                                <TableCell>{m.duration_min ? `${m.duration_min} phút` : '-'}</TableCell>
                                                                                <TableCell>
                                                                                        {m.rating ? (
                                                                                                <Badge variant="outline">⭐ {m.rating}</Badge>
                                                                                        ) : (
                                                                                                '-'
                                                                                        )}
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                        {m.release_date ? new Date(m.release_date).toLocaleDateString('vi-VN') : '-'}
                                                                                </TableCell>
                                                                                <TableCell className="text-gray-600">{m.deleted_by_staff_name || '-'}</TableCell>
                                                                                <TableCell>
                                                                                        {m.deleted_at ? new Date(m.deleted_at).toLocaleString('vi-VN') : '-'}
                                                                                </TableCell>
                                                                                <TableCell className="text-right">
                                                                                        <Button
                                                                                                onClick={() => handleRestore(m.id)}
                                                                                                variant="outline"
                                                                                                size="sm"
                                                                                        >
                                                                                                <RotateCcw className="w-4 h-4 mr-2" />
                                                                                                Khôi phục
                                                                                        </Button>
                                                                                </TableCell>
                                                                        </TableRow>
                                                                ))}
                                                                {movies.length === 0 && (
                                                                        <TableRow>
                                                                                <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                                                                                        Không có phim nào đã xóa
                                                                                </TableCell>
                                                                        </TableRow>
                                                                )}
                                                        </TableBody>
                                                </Table>
                                        </div>
                                )}

                                <div className="flex justify-between items-center mt-4">
                                        <div className="text-sm text-gray-600">
                                                Trang {page} / {totalPages} (Tổng {total} phim)
                                        </div>
                                        <div className="flex gap-2">
                                                <Button
                                                        onClick={() => setPage(Math.max(1, page - 1))}
                                                        disabled={page === 1}
                                                        variant="outline"
                                                        size="sm"
                                                >
                                                        Trước
                                                </Button>
                                                <Button
                                                        onClick={() => setPage(Math.min(totalPages, page + 1))}
                                                        disabled={page === totalPages}
                                                        variant="outline"
                                                        size="sm"
                                                >
                                                        Sau
                                                </Button>
                                        </div>
                                </div>
                        </div>

                        <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
                                <AlertDialogContent>
                                        <AlertDialogHeader>
                                                <AlertDialogTitle>Xác nhận khôi phục</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                        Bạn có chắc chắn muốn khôi phục phim này?
                                                </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                                <AlertDialogCancel>Hủy</AlertDialogCancel>
                                                <AlertDialogAction onClick={handleConfirmRestore}>Khôi phục</AlertDialogAction>
                                        </AlertDialogFooter>
                                </AlertDialogContent>
                        </AlertDialog>
                </AdminLayout>
        );
}
