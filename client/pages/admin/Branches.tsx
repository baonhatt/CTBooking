import React, { useEffect, useState } from 'react';
import AdminLayout from '@/admin/layouts/AdminLayout';
import { getBranches, deleteBranchApi } from '@/lib/api/branches';
import { toast } from 'sonner';
import { Edit2 } from 'lucide-react';
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
}

export default function BranchesPage() {
        const [branches, setBranches] = useState<Branch[]>([]);
        const [page, setPage] = useState(1);
        const pageSize = 10;
        const [total, setTotal] = useState(0);
        const totalPages = Math.max(1, Math.ceil(total / pageSize));

        const [isEditOpen, setIsEditOpen] = useState(false);
        const [editData, setEditData] = useState<any>(null);
        const [isLoading, setIsLoading] = useState(false);
        const [showActiveOnly, setShowActiveOnly] = useState(true);
        const [searchQuery, setSearchQuery] = useState('');
        const [isCodeEditable, setIsCodeEditable] = useState(false);
        const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
        const [branchToDelete, setBranchToDelete] = useState<number | null>(null);

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

        return (
                <AdminLayout
                        active={'branches' as any}
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
                                        <h1 className="text-2xl font-bold">Quản lý chi nhánh</h1>
                                        <button onClick={openCreate} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                                                Thêm chi nhánh
                                        </button>
                                </div>

                                <div className="mb-4 flex gap-4">
                                        <input
                                                type="text"
                                                placeholder="Tìm kiếm theo tên, mã, địa chỉ..."
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                className="px-4 py-2 border rounded-lg w-64"
                                        />
                                        <label className="flex items-center gap-2">
                                                <input type="checkbox" checked={showActiveOnly} onChange={(e) => setShowActiveOnly(e.target.checked)} />
                                                Chỉ hiển thị hoạt động
                                        </label>
                                </div>

                                {isLoading ? (
                                        <div className="text-center py-8">Đang tải...</div>
                                ) : (
                                        <div className="overflow-x-auto">
                                                <table className="w-full border-collapse">
                                                        <thead>
                                                                <tr className="bg-gray-100">
                                                                        <th className="px-4 py-3 text-left border">Tên</th>
                                                                        <th className="px-4 py-3 text-left border">Mã</th>
                                                                        <th className="px-4 py-3 text-left border">Địa chỉ</th>
                                                                        <th className="px-4 py-3 text-left border">SĐT</th>
                                                                        <th className="px-4 py-3 text-left border">Email</th>
                                                                        <th className="px-4 py-3 text-center border">Mặc định</th>
                                                                        <th className="px-4 py-3 text-center border">Trạng thái</th>
                                                                        <th className="px-4 py-3 text-center border">Phim</th>
                                                                        <th className="px-4 py-3 text-center border">Gói vé</th>
                                                                        <th className="px-4 py-3 text-center border">Booking</th>
                                                                        <th className="px-4 py-3 text-center border">Hành động</th>
                                                                </tr>
                                                        </thead>
                                                        <tbody>
                                                                {branches.map((branch) => (
                                                                        <tr key={branch.id} className="hover:bg-gray-50">
                                                                                <td className="px-4 py-3 border font-medium">{branch.name}</td>
                                                                                <td className="px-4 py-3 border">{branch.code}</td>
                                                                                <td className="px-4 py-3 border">{branch.address || '-'}</td>
                                                                                <td className="px-4 py-3 border">{branch.phone || '-'}</td>
                                                                                <td className="px-4 py-3 border">{branch.email || '-'}</td>
                                                                                <td className="px-4 py-3 border text-center">
                                                                                        {branch.is_default && (
                                                                                                <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">Mặc định</span>
                                                                                        )}
                                                                                </td>
                                                                                <td className="px-4 py-3 border text-center">
                                                                                        <span
                                                                                                className={`px-2 py-1 rounded text-xs ${branch.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
                                                                                        >
                                                                                                {branch.is_active ? 'Hoạt động' : 'Ngừng'}
                                                                                        </span>
                                                                                </td>
                                                                                <td className="px-4 py-3 border text-center">{branch.movie_count}</td>
                                                                                <td className="px-4 py-3 border text-center">{branch.package_count}</td>
                                                                                <td className="px-4 py-3 border text-center">{branch.booking_count}</td>
                                                                                <td className="px-4 py-3 border text-center">
                                                                                        <button
                                                                                                onClick={() => openEdit(branch)}
                                                                                                className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 mr-2"
                                                                                        >
                                                                                                Sửa
                                                                                        </button>
                                                                                        <button
                                                                                                onClick={() => handleDelete(branch.id)}
                                                                                                className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                                                                                        >
                                                                                                Xóa
                                                                                        </button>
                                                                                </td>
                                                                        </tr>
                                                                ))}
                                                        </tbody>
                                                </table>
                                        </div>
                                )}

                                <div className="flex justify-between items-center mt-4">
                                        <div className="text-sm text-gray-600">
                                                Trang {page} / {totalPages} (Tổng {total} chi nhánh)
                                        </div>
                                        <div className="flex gap-2">
                                                <button
                                                        onClick={() => setPage(Math.max(1, page - 1))}
                                                        disabled={page === 1}
                                                        className="px-4 py-2 border rounded hover:bg-gray-100 disabled:opacity-50"
                                                >
                                                        Trước
                                                </button>
                                                <button
                                                        onClick={() => setPage(Math.min(totalPages, page + 1))}
                                                        disabled={page === totalPages}
                                                        className="px-4 py-2 border rounded hover:bg-gray-100 disabled:opacity-50"
                                                >
                                                        Sau
                                                </button>
                                        </div>
                                </div>
                        </div>

                        {isEditOpen && (
                                <BranchEditModal
                                        isOpen={isEditOpen}
                                        onClose={() => setIsEditOpen(false)}
                                        data={editData}
                                        onSave={handleRefresh}
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
                </AdminLayout>
        );
}

function BranchEditModal({ isOpen, onClose, data, onSave }: any) {
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
                        setIsCodeEditable(data.id !== 0); // Allow edit for existing branches
                }
        }, [data]);

        const handleSubmit = async (e: React.FormEvent) => {
                e.preventDefault();
                setIsLoading(true);

                try {
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
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg p-6 w-full max-w-md">
                                <h2 className="text-xl font-bold mb-4">{data.id === 0 ? 'Thêm chi nhánh mới' : 'Sửa chi nhánh'}</h2>
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
                                                                        className={`flex-1 px-3 py-2 border rounded ${!isCodeEditable ? 'bg-gray-100 text-gray-600' : ''}`}
                                                                        required
                                                                />
                                                                <button
                                                                        type="button"
                                                                        onClick={() => setIsCodeEditable(!isCodeEditable)}
                                                                        className="px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded"
                                                                        title={isCodeEditable ? 'Khóa mã' : 'Sửa mã'}
                                                                >
                                                                        <Edit2 className="w-4 h-4" />
                                                                </button>
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
                                                <div className="flex items-center gap-2">
                                                        <input
                                                                type="checkbox"
                                                                id="is_active"
                                                                checked={formData.is_active}
                                                                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                                        />
                                                        <label htmlFor="is_active" className="text-sm">
                                                                Hoạt động
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
