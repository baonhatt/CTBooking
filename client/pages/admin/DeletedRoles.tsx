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
import { RefreshCw, RotateCcw, Shield, ArrowLeft } from 'lucide-react';
import { buildUrl } from '@/lib/api/http';
import { useHasStaffPermission } from '@/hooks/useStaffPermission';

interface Role {
        id: number;
        name: string;
        description?: string;
        deleted_at: string;
        staff_count?: number;
        deleted_by_staff_name?: string;
}

export default function DeletedRolesPage() {
        const navigate = useNavigate();
        const hasPermission = useHasStaffPermission();
        const staffStore = useStaffStore();
        const [activeTab, setActiveTab] = useState('deleted-roles');
        const [roles, setRoles] = useState<Role[]>([]);
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
        const [roleToRestore, setRoleToRestore] = useState<number | null>(null);
        const [sortField, setSortField] = useState<'name' | 'deleted_at'>('deleted_at');
        const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

        const fetchDeletedRoles = async () => {
                setIsLoading(true);
                try {
                        const token = localStorage.getItem('staffToken');
                        const params = new URLSearchParams({
                                page: String(page),
                                pageSize: String(pageSize),
                                search: searchQuery
                        });
                        const response = await fetch(buildUrl(`/api/admin/deleted/roles?${params}`), {
                                headers: {
                                        Authorization: `Bearer ${token}`
                                }
                        });
                        const data = await response.json();
                        // Client-side sorting
                        let sortedItems = data.items || [];
                        sortedItems.sort((a: Role, b: Role) => {
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
                        setRoles(sortedItems);
                        setTotal(data.total || 0);
                } catch (error) {
                        toast.error('Lỗi', {
                                description: 'Không thể tải danh sách vai trò đã xóa'
                        });
                } finally {
                        setIsLoading(false);
                }
        };

        useEffect(() => {
                fetchDeletedRoles();
        }, [page, searchQuery, sortField, sortDir]);

        const handleRestore = (id: number) => {
                setRoleToRestore(id);
                setRestoreDialogOpen(true);
        };

        const handleConfirmRestore = async () => {
                if (!roleToRestore) return;
                try {
                        const token = localStorage.getItem('staffToken');
                        const response = await fetch(buildUrl(`/api/admin/roles/${roleToRestore}/restore`), {
                                method: 'POST',
                                headers: {
                                        Authorization: `Bearer ${token}`
                                }
                        });
                        const data = await response.json();
                        if (response.ok) {
                                toast.success('Thành công', {
                                        description: 'Đã khôi phục vai trò'
                                });
                                setRestoreDialogOpen(false);
                                fetchDeletedRoles();
                        } else {
                                toast.error('Lỗi', {
                                        description: data.message || 'Không thể khôi phục vai trò'
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
                                                onClick={() => navigate('/roles')}
                                                className="rounded-full"
                                                title="Quay lại"
                                        >
                                                <ArrowLeft className="w-5 h-5" />
                                        </Button>
                                        <h1 className="text-2xl font-bold">Vai trò đã xóa</h1>
                                        <div className="flex-1" />
                                        <Button onClick={fetchDeletedRoles} variant="outline" size="sm">
                                                <RefreshCw className="w-4 h-4 mr-2" />
                                                Làm mới
                                        </Button>
                                </div>

                                 <form onSubmit={handleSearch} className="mb-4 flex gap-2 max-w-sm">
                                         <Input
                                                 placeholder="Tìm kiếm theo tên vai trò..."
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
                                                                        <TableHead className="cursor-pointer hover:bg-gray-100" onClick={() => { setSortField('name'); setSortDir(sortField === 'name' && sortDir === 'asc' ? 'desc' : 'asc'); }}>
                                                                                Tên vai trò {sortField === 'name' && (sortDir === 'asc' ? '↑' : '↓')}
                                                                        </TableHead>
                                                                        <TableHead>Mô tả</TableHead>
                                                                        <TableHead>Số nhân viên</TableHead>
                                                                        <TableHead>Xóa bởi</TableHead>
                                                                        <TableHead className="cursor-pointer hover:bg-gray-100" onClick={() => { setSortField('deleted_at'); setSortDir(sortField === 'deleted_at' && sortDir === 'asc' ? 'desc' : 'asc'); }}>
                                                                                Ngày xóa {sortField === 'deleted_at' && (sortDir === 'asc' ? '↑' : '↓')}
                                                                        </TableHead>
                                                                        <TableHead className="text-right">Hành động</TableHead>
                                                                </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                                {roles.map((r) => (
                                                                        <TableRow key={r.id}>
                                                                                <TableCell className="font-medium">
                                                                                        <div className="flex items-center gap-2">
                                                                                                <Shield className="w-4 h-4 text-gray-500" />
                                                                                                {r.name}
                                                                                        </div>
                                                                                </TableCell>
                                                                                <TableCell className="text-gray-600">{r.description || '-'}</TableCell>
                                                                                <TableCell>
                                                                                        <Badge variant="outline">{r.staff_count || 0} nhân viên</Badge>
                                                                                </TableCell>
                                                                                <TableCell className="text-gray-600">{r.deleted_by_staff_name || '-'}</TableCell>
                                                                                <TableCell>
                                                                                        {r.deleted_at ? new Date(r.deleted_at).toLocaleString('vi-VN') : '-'}
                                                                                </TableCell>
                                                                                <TableCell className="text-right">
                                                                                        {hasPermission('roles', 'restore') && (
                                                                                        <Button
                                                                                                onClick={() => handleRestore(r.id)}
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
                                                                {roles.length === 0 && (
                                                                        <TableRow>
                                                                                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                                                                                        Không có vai trò nào đã xóa
                                                                                </TableCell>
                                                                        </TableRow>
                                                                )}
                                                        </TableBody>
                                                </Table>
                                        </div>
                                )}

                                <div className="flex justify-between items-center mt-4">
                                        <div className="text-sm text-gray-600">
                                                Trang {page} / {totalPages} (Tổng {total} vai trò)
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
                                                        Bạn có chắc chắn muốn khôi phục vai trò này?
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
