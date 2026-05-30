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
import { RefreshCw, RotateCcw, Building2 } from 'lucide-react';

interface Branch {
        id: number;
        name: string;
        code: string;
        address?: string;
        phone?: string;
        email?: string;
        is_default: boolean;
        deleted_at: string;
        deleted_by_staff_name?: string;
}

export default function DeletedBranchesPage() {
        const [activeTab, setActiveTab] = useState('deleted-branches');
        const [branches, setBranches] = useState<Branch[]>([]);
        const [page, setPage] = useState(1);
        const pageSize = 10;
        const [total, setTotal] = useState(0);
        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        const [isLoading, setIsLoading] = useState(false);
        const [searchQuery, setSearchQuery] = useState('');
        const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
        const [branchToRestore, setBranchToRestore] = useState<number | null>(null);
        const [sortField, setSortField] = useState<'name' | 'deleted_at'>('deleted_at');
        const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

        const fetchDeletedBranches = async () => {
                setIsLoading(true);
                try {
                        const token = localStorage.getItem('staffToken');
                        const params = new URLSearchParams({
                                page: String(page),
                                pageSize: String(pageSize),
                                search: searchQuery
                        });
                        const response = await fetch(`/api/admin/deleted/branches?${params}`, {
                                headers: {
                                        Authorization: `Bearer ${token}`
                                }
                        });
                        const data = await response.json();
                        // Client-side sorting
                        let sortedItems = data.items || [];
                        sortedItems.sort((a: Branch, b: Branch) => {
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
                        setBranches(sortedItems);
                        setTotal(data.total || 0);
                } catch (error) {
                        toast.error('Lỗi', {
                                description: 'Không thể tải danh sách chi nhánh đã xóa'
                        });
                } finally {
                        setIsLoading(false);
                }
        };

        useEffect(() => {
                fetchDeletedBranches();
        }, [page, searchQuery, sortField, sortDir]);

        const handleRestore = (id: number) => {
                setBranchToRestore(id);
                setRestoreDialogOpen(true);
        };

        const handleConfirmRestore = async () => {
                if (!branchToRestore) return;
                try {
                        const token = localStorage.getItem('staffToken');
                        const response = await fetch(`/api/admin/branches/${branchToRestore}/restore`, {
                                method: 'POST',
                                headers: {
                                        Authorization: `Bearer ${token}`
                                }
                        });
                        const data = await response.json();
                        if (response.ok) {
                                toast.success('Thành công', {
                                        description: 'Đã khôi phục chi nhánh'
                                });
                                setRestoreDialogOpen(false);
                                fetchDeletedBranches();
                        } else {
                                toast.error('Lỗi', {
                                        description: data.message || 'Không thể khôi phục chi nhánh'
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
                                        <h1 className="text-2xl font-bold">Chi nhánh đã xóa</h1>
                                        <Button onClick={fetchDeletedBranches} variant="outline" size="sm">
                                                <RefreshCw className="w-4 h-4 mr-2" />
                                                Làm mới
                                        </Button>
                                </div>

                                <div className="mb-4">
                                        <Input
                                                placeholder="Tìm kiếm theo tên, mã, địa chỉ..."
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
                                                                                Tên {sortField === 'name' && (sortDir === 'asc' ? '↑' : '↓')}
                                                                        </TableHead>
                                                                        <TableHead>Mã</TableHead>
                                                                        <TableHead>Địa chỉ</TableHead>
                                                                        <TableHead>SĐT</TableHead>
                                                                        <TableHead>Email</TableHead>
                                                                        <TableHead>Mặc định</TableHead>
                                                                        <TableHead>Xóa bởi</TableHead>
                                                                        <TableHead className="cursor-pointer hover:bg-gray-100" onClick={() => { setSortField('deleted_at'); setSortDir(sortField === 'deleted_at' && sortDir === 'asc' ? 'desc' : 'asc'); }}>
                                                                                Ngày xóa {sortField === 'deleted_at' && (sortDir === 'asc' ? '↑' : '↓')}
                                                                        </TableHead>
                                                                        <TableHead className="text-right">Hành động</TableHead>
                                                                </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                                {branches.map((b) => (
                                                                        <TableRow key={b.id}>
                                                                                <TableCell className="font-medium">
                                                                                        <div className="flex items-center gap-2">
                                                                                                <Building2 className="w-4 h-4 text-gray-500" />
                                                                                                {b.name}
                                                                                        </div>
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                        <Badge variant="outline">{b.code}</Badge>
                                                                                </TableCell>
                                                                                <TableCell>{b.address || '-'}</TableCell>
                                                                                <TableCell>{b.phone || '-'}</TableCell>
                                                                                <TableCell>{b.email || '-'}</TableCell>
                                                                                <TableCell>
                                                                                        {b.is_default ? (
                                                                                                <Badge variant="default">Mặc định</Badge>
                                                                                        ) : (
                                                                                                <Badge variant="outline">Không</Badge>
                                                                                        )}
                                                                                </TableCell>
                                                                                <TableCell className="text-gray-600">{b.deleted_by_staff_name || '-'}</TableCell>
                                                                                <TableCell>
                                                                                        {b.deleted_at ? new Date(b.deleted_at).toLocaleString('vi-VN') : '-'}
                                                                                </TableCell>
                                                                                <TableCell className="text-right">
                                                                                        <Button
                                                                                                onClick={() => handleRestore(b.id)}
                                                                                                variant="outline"
                                                                                                size="sm"
                                                                                        >
                                                                                                <RotateCcw className="w-4 h-4 mr-2" />
                                                                                                Khôi phục
                                                                                        </Button>
                                                                                </TableCell>
                                                                        </TableRow>
                                                                ))}
                                                                {branches.length === 0 && (
                                                                        <TableRow>
                                                                                <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                                                                                        Không có chi nhánh nào đã xóa
                                                                                </TableCell>
                                                                        </TableRow>
                                                                )}
                                                        </TableBody>
                                                </Table>
                                        </div>
                                )}

                                <div className="flex justify-between items-center mt-4">
                                        <div className="text-sm text-gray-600">
                                                Trang {page} / {totalPages} (Tổng {total} chi nhánh)
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
                                                        Bạn có chắc chắn muốn khôi phục chi nhánh này?
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
