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
import { useNavigate } from 'react-router-dom';
import { useStaffStore } from '@/store/staffStore';
import { RefreshCw, RotateCcw, ArrowLeft } from 'lucide-react';
import { buildUrl } from '@/lib/api/http';
import { useHasStaffPermission } from '@/hooks/useStaffPermission';

interface Staff {
        id: number;
        email: string;
        fullname: string;
        phone?: string;
        is_active: boolean;
        deleted_at: string;
        role?: string;
        deleted_by_staff_name?: string;
}

export default function DeletedStaffPage() {
        const navigate = useNavigate();
        const hasPermission = useHasStaffPermission();
        const staffStore = useStaffStore();
        const [activeTab, setActiveTab] = useState('deleted-staff');
        const [staff, setStaff] = useState<Staff[]>([]);
        const [page, setPage] = useState(1);
        const pageSize = 10;
        const [total, setTotal] = useState(0);
        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        const [isLoading, setIsLoading] = useState(false);
        const [searchQuery, setSearchQuery] = useState('');
        const [localSearchQuery, setLocalSearchQuery] = useState('');

        const handleSearch = (e?: React.FormEvent) => {
                if (e) e.preventDefault();
                setSearchQuery(localSearchQuery);
                setPage(1);
        };
        const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
        const [staffToRestore, setStaffToRestore] = useState<number | null>(null);
        const [sortField, setSortField] = useState<'fullname' | 'deleted_at'>('deleted_at');
        const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

        const fetchDeletedStaff = async () => {
                setIsLoading(true);
                try {
                        const token = localStorage.getItem('staffToken');
                        const params = new URLSearchParams({
                                page: String(page),
                                pageSize: String(pageSize),
                                search: searchQuery
                        });
                        const response = await fetch(buildUrl(`/api/admin/deleted/staff?${params}`), {
                                headers: {
                                        Authorization: `Bearer ${token}`
                                }
                        });
                        const data = await response.json();
                        // Client-side sorting
                        let sortedItems = data.items || [];
                        sortedItems.sort((a: Staff, b: Staff) => {
                                let valA: any, valB: any;
                                if (sortField === 'fullname') {
                                        valA = a.fullname.toLowerCase();
                                        valB = b.fullname.toLowerCase();
                                } else {
                                        valA = new Date(a.deleted_at).getTime();
                                        valB = new Date(b.deleted_at).getTime();
                                }
                                if (valA < valB) return sortDir === 'asc' ? -1 : 1;
                                if (valA > valB) return sortDir === 'asc' ? 1 : -1;
                                return 0;
                        });
                        setStaff(sortedItems);
                        setTotal(data.total || 0);
                } catch (error) {
                        toast.error('Lỗi', {
                                description: 'Không thể tải danh sách nhân viên đã xóa'
                        });
                } finally {
                        setIsLoading(false);
                }
        };

        useEffect(() => {
                fetchDeletedStaff();
        }, [page, searchQuery, sortField, sortDir]);

        const handleRestore = (id: number) => {
                setStaffToRestore(id);
                setRestoreDialogOpen(true);
        };

        const handleConfirmRestore = async () => {
                if (!staffToRestore) return;
                try {
                        const token = localStorage.getItem('staffToken');
                        const response = await fetch(buildUrl(`/api/admin/staff/${staffToRestore}/restore`), {
                                method: 'POST',
                                headers: {
                                        Authorization: `Bearer ${token}`
                                }
                        });
                        const data = await response.json();
                        if (response.ok) {
                                toast.success('Thành công', {
                                        description: 'Đã khôi phục nhân viên'
                                });
                                setRestoreDialogOpen(false);
                                fetchDeletedStaff();
                        } else {
                                toast.error('Lỗi', {
                                        description: data.message || 'Không thể khôi phục nhân viên'
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
                        adminEmailState={staffStore.staff?.email || 'admin@email.com'}
                        handleLogout={() => {
                                staffStore.clearStaff();
                                localStorage.removeItem('staffToken');
                                navigate('/login');
                        }}
                >
                        <div className="p-6">
                                <div className="flex items-center gap-4 mb-6">
                                        <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => navigate('/staff')}
                                                className="rounded-full"
                                                title="Quay lại"
                                        >
                                                <ArrowLeft className="w-5 h-5" />
                                        </Button>
                                        <h1 className="text-2xl font-bold">Nhân viên đã xóa</h1>
                                        <div className="flex-1" />
                                        <Button onClick={fetchDeletedStaff} variant="outline" size="sm">
                                                <RefreshCw className="w-4 h-4 mr-2" />
                                                Làm mới
                                        </Button>
                                </div>

                                <form onSubmit={handleSearch} className="mb-4 flex gap-2 max-w-sm">
                                         <Input
                                                 placeholder="Tìm kiếm theo email, tên..."
                                                 value={localSearchQuery}
                                                 onChange={(e) => setLocalSearchQuery(e.target.value)}
                                                 className="flex-1"
                                         />
                                         <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white gap-1 text-xs">
                                                 Tìm kiếm
                                         </Button>
                                 </form>

                                {isLoading ? (
                                        <div className="text-center py-8">Đang tải...</div>
                                ) : (
                                        <div className="overflow-x-auto">
                                                <Table>
                                                        <TableHeader>
                                                                <TableRow>
                                                                        <TableHead>Email</TableHead>
                                                                        <TableHead className="cursor-pointer hover:bg-gray-100" onClick={() => { setSortField('fullname'); setSortDir(sortField === 'fullname' && sortDir === 'asc' ? 'desc' : 'asc'); }}>
                                                                                Họ tên {sortField === 'fullname' && (sortDir === 'asc' ? '↑' : '↓')}
                                                                        </TableHead>
                                                                        <TableHead>SĐT</TableHead>
                                                                        <TableHead>Vai trò</TableHead>
                                                                        <TableHead>Xóa bởi</TableHead>
                                                                        <TableHead className="cursor-pointer hover:bg-gray-100" onClick={() => { setSortField('deleted_at'); setSortDir(sortField === 'deleted_at' && sortDir === 'asc' ? 'desc' : 'asc'); }}>
                                                                                Ngày xóa {sortField === 'deleted_at' && (sortDir === 'asc' ? '↑' : '↓')}
                                                                        </TableHead>
                                                                        <TableHead className="text-right">Hành động</TableHead>
                                                                </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                                {staff.map((s) => (
                                                                        <TableRow key={s.id}>
                                                                                <TableCell className="font-medium">{s.email}</TableCell>
                                                                                <TableCell>{s.fullname}</TableCell>
                                                                                <TableCell>{s.phone || '-'}</TableCell>
                                                                                <TableCell>
                                                                                        <Badge variant="outline">{s.role || '-'}</Badge>
                                                                                </TableCell>
                                                                                <TableCell className="text-gray-600">{s.deleted_by_staff_name || '-'}</TableCell>
                                                                                <TableCell>
                                                                                        {s.deleted_at ? new Date(s.deleted_at).toLocaleString('vi-VN') : '-'}
                                                                                </TableCell>
                                                                                <TableCell className="text-right">
                                                                                        {hasPermission('staff', 'restore') && (
                                                                                        <Button
                                                                                                onClick={() => handleRestore(s.id)}
                                                                                                variant="outline"
                                                                                                size="sm"
                                                                                        >
                                                                                                <RotateCcw className="w-4 h-4 mr-2" />
                                                                                                Khôi phục
                                                                                        </Button>
                                                                                        )}
                                                                                </TableCell>
                                                                        </TableRow>
                                                                ))}
                                                                {staff.length === 0 && (
                                                                        <TableRow>
                                                                                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                                                                                        Không có nhân viên nào đã xóa
                                                                                </TableCell>
                                                                        </TableRow>
                                                                )}
                                                        </TableBody>
                                                </Table>
                                        </div>
                                )}

                                <div className="flex justify-between items-center mt-4">
                                        <div className="text-sm text-gray-600">
                                                Trang {page} / {totalPages} (Tổng {total} nhân viên)
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
                                                        Bạn có chắc chắn muốn khôi phục nhân viên này?
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
