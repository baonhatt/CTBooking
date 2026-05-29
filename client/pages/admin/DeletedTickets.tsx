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
import { RefreshCw, RotateCcw, Ticket as TicketIcon } from 'lucide-react';

interface TicketPackage {
        id: number;
        name: string;
        code?: string;
        description?: string;
        price: string;
        type?: string;
        is_member_only: boolean;
        deleted_at: string;
        branch_id?: number;
        branch_name?: string;
        deleted_by_staff_name?: string;
}

export default function DeletedTicketsPage() {
        const [tickets, setTickets] = useState<TicketPackage[]>([]);
        const [page, setPage] = useState(1);
        const pageSize = 10;
        const [total, setTotal] = useState(0);
        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        const [isLoading, setIsLoading] = useState(false);
        const [searchQuery, setSearchQuery] = useState('');
        const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
        const [ticketToRestore, setTicketToRestore] = useState<number | null>(null);
        const [sortField, setSortField] = useState<'name' | 'deleted_at'>('deleted_at');
        const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

        const fetchDeletedTickets = async () => {
                setIsLoading(true);
                try {
                        const token = localStorage.getItem('staffToken');
                        const params = new URLSearchParams({
                                page: String(page),
                                pageSize: String(pageSize),
                                search: searchQuery
                        });
                        const response = await fetch(`/api/admin/deleted/tickets?${params}`, {
                                headers: {
                                        Authorization: `Bearer ${token}`
                                }
                        });
                        const data = await response.json();
                        // Client-side sorting
                        let sortedItems = data.items || [];
                        sortedItems.sort((a: TicketPackage, b: TicketPackage) => {
                                let valA: any, valB: any;
                                if (sortField === 'name') {
                                        valA = a.name.toLowerCase();
                                        valB = b.name.toLowerCase();
                                } else {
                                        valA = new Date(a.deleted_at).getTime();
                                        valB = new Date(b.deleted_at).getTime();
                                }
                                if (valA < valB) return sortDir === 'asc' ? -1 : 1;
                                if (valA > valB) return sortDir === 'asc' ? 1 : -1;
                                return 0;
                        });
                        setTickets(sortedItems);
                        setTotal(data.total || 0);
                } catch (error) {
                        toast.error('Lỗi', {
                                description: 'Không thể tải danh sách gói vé đã xóa'
                        });
                } finally {
                        setIsLoading(false);
                }
        };

        useEffect(() => {
                fetchDeletedTickets();
        }, [page, searchQuery, sortField, sortDir]);

        const handleRestore = (id: number) => {
                setTicketToRestore(id);
                setRestoreDialogOpen(true);
        };

        const handleConfirmRestore = async () => {
                if (!ticketToRestore) return;
                try {
                        const token = localStorage.getItem('staffToken');
                        const response = await fetch(`/api/admin/tickets/${ticketToRestore}/restore`, {
                                method: 'POST',
                                headers: {
                                        Authorization: `Bearer ${token}`
                                }
                        });
                        const data = await response.json();
                        if (response.ok) {
                                toast.success('Thành công', {
                                        description: 'Đã khôi phục gói vé'
                                });
                                setRestoreDialogOpen(false);
                                fetchDeletedTickets();
                        } else {
                                toast.error('Lỗi', {
                                        description: data.message || 'Không thể khôi phục gói vé'
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
                        active={'deleted-tickets' as any}
                        setActive={(() => { }) as any}
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
                                        <h1 className="text-2xl font-bold">Gói vé đã xóa</h1>
                                        <Button onClick={fetchDeletedTickets} variant="outline" size="sm">
                                                <RefreshCw className="w-4 h-4 mr-2" />
                                                Làm mới
                                        </Button>
                                </div>

                                <div className="mb-4">
                                        <Input
                                                placeholder="Tìm kiếm theo tên gói vé..."
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
                                                                        <TableHead className="cursor-pointer hover:bg-gray-100" onClick={() => { setSortField('name'); setSortDir(sortField === 'name' && sortDir === 'asc' ? 'desc' : 'asc'); }}>
                                                                                Tên gói vé {sortField === 'name' && (sortDir === 'asc' ? '↑' : '↓')}
                                                                        </TableHead>
                                                                        <TableHead>Mã</TableHead>
                                                                        <TableHead>Loại</TableHead>
                                                                        <TableHead>Giá</TableHead>
                                                                        <TableHead>Thành viên</TableHead>
                                                                        <TableHead>Chi nhánh</TableHead>
                                                                        <TableHead>Xóa bởi</TableHead>
                                                                        <TableHead className="cursor-pointer hover:bg-gray-100" onClick={() => { setSortField('deleted_at'); setSortDir(sortField === 'deleted_at' && sortDir === 'asc' ? 'desc' : 'asc'); }}>
                                                                                Ngày xóa {sortField === 'deleted_at' && (sortDir === 'asc' ? '↑' : '↓')}
                                                                        </TableHead>
                                                                        <TableHead className="text-right">Hành động</TableHead>
                                                                </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                                {tickets.map((t) => (
                                                                        <TableRow key={t.id}>
                                                                                <TableCell className="font-medium">
                                                                                        <div className="flex items-center gap-2">
                                                                                                <TicketIcon className="w-4 h-4 text-gray-500" />
                                                                                                {t.name}
                                                                                        </div>
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                        <Badge variant="outline">{t.code || '-'}</Badge>
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                        <Badge variant="secondary">{t.type || '-'}</Badge>
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                        {new Intl.NumberFormat('vi-VN', {
                                                                                                style: 'currency',
                                                                                                currency: 'VND'
                                                                                        }).format(Number(t.price))}
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                        {t.is_member_only ? (
                                                                                                <Badge variant="default">Có</Badge>
                                                                                        ) : (
                                                                                                <Badge variant="outline">Không</Badge>
                                                                                        )}
                                                                                </TableCell>
                                                                                <TableCell>{t.branch_name || '-'}</TableCell>
                                                                                <TableCell className="text-gray-600">{t.deleted_by_staff_name || '-'}</TableCell>
                                                                                <TableCell>
                                                                                        {t.deleted_at ? new Date(t.deleted_at).toLocaleString('vi-VN') : '-'}
                                                                                </TableCell>
                                                                                <TableCell className="text-right">
                                                                                        <Button
                                                                                                onClick={() => handleRestore(t.id)}
                                                                                                variant="outline"
                                                                                                size="sm"
                                                                                        >
                                                                                                <RotateCcw className="w-4 h-4 mr-2" />
                                                                                                Khôi phục
                                                                                        </Button>
                                                                                </TableCell>
                                                                        </TableRow>
                                                                ))}
                                                                {tickets.length === 0 && (
                                                                        <TableRow>
                                                                                <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                                                                                        Không có gói vé nào đã xóa
                                                                                </TableCell>
                                                                        </TableRow>
                                                                )}
                                                        </TableBody>
                                                </Table>
                                        </div>
                                )}

                                <div className="flex justify-between items-center mt-4">
                                        <div className="text-sm text-gray-600">
                                                Trang {page} / {totalPages} (Tổng {total} gói vé)
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
                                                        Bạn có chắc chắn muốn khôi phục gói vé này?
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
