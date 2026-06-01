import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { X, Search, RefreshCw, Eye, Trash2 } from 'lucide-react';
import { request } from '@/lib/api/http';
import AdminLayout from '@/admin/layouts/AdminLayout';
import { useStaffStore } from '@/store/staffStore';
import { useNavigate } from 'react-router-dom';

interface Role {
        id: number;
        name: string;
        description?: string;
        level: number;
        isSystem: boolean;
        staffCount?: number;
        permissionIds?: number[];
}

export default function RolesPage() {
        const queryClient = useQueryClient();
        const navigate = useNavigate();
        const staff = useStaffStore((state) => state.staff);
        const clearStaff = useStaffStore((state) => state.clearStaff);
        const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
        const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
        const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
        const [searchQuery, setSearchQuery] = useState('');
        const [showSystemOnly, setShowSystemOnly] = useState(false);

        // Form state for create
        const [formData, setFormData] = useState({
                name: '',
                description: '',
                level: '0'
        });

        // Fetch roles
        const { data: rolesData, isLoading: rolesLoading } = useQuery({
                queryKey: ['roles', searchQuery, showSystemOnly],
                queryFn: async () => {
                        const params = new URLSearchParams();
                        params.set('pageSize', '100');
                        if (searchQuery) params.set('q', searchQuery);
                        if (showSystemOnly) params.set('isSystem', 'true');
                        return request(`/api/admin/roles?${params.toString()}`);
                }
        });

        // Create role mutation
        const createMutation = useMutation({
                mutationFn: async (data: any) => {
                        return request('/api/admin/roles', {
                                method: 'POST',
                                body: JSON.stringify(data)
                        });
                },
                onSuccess: (data: any) => {
                        toast.success('Tạo vai trò thành công');
                        setIsCreateDialogOpen(false);
                        resetForm();
                        queryClient.invalidateQueries({ queryKey: ['roles'] });
                },
                onError: (err: any) => {
                        toast.error(err.message || 'Tạo vai trò thất bại');
                }
        });

        // Delete role mutation
        const deleteMutation = useMutation({
                mutationFn: async (id: number) => {
                        return request(`/api/admin/roles/${id}`, {
                                method: 'DELETE'
                        });
                },
                onSuccess: () => {
                        toast.success('Xóa vai trò thành công');
                        setIsDeleteDialogOpen(false);
                        setRoleToDelete(null);
                        queryClient.invalidateQueries({ queryKey: ['roles'] });
                },
                onError: (err: any) => {
                        toast.error(err.message || 'Xóa vai trò thất bại');
                }
        });

        // Seed roles mutation
        const seedMutation = useMutation({
                mutationFn: async () => {
                        return request('/api/admin/setup/seed-roles', {
                                method: 'POST'
                        });
                },
                onSuccess: () => {
                        toast.success('Seed vai trò mặc định thành công');
                        queryClient.invalidateQueries({ queryKey: ['roles'] });
                },
                onError: (err: any) => {
                        toast.error(err.message || 'Seed vai trò thất bại');
                }
        });

        const resetForm = () => {
                setFormData({
                        name: '',
                        description: '',
                        level: '0'
                });
        };

        const handleCreate = () => {
                createMutation.mutate({
                        name: formData.name,
                        description: formData.description,
                        level: parseInt(formData.level),
                        permissionIds: []
                });
        };

        const handleDelete = () => {
                if (!roleToDelete) return;
                deleteMutation.mutate(roleToDelete.id);
        };

        const handleSeed = () => {
                seedMutation.mutate();
        };

        const handleLogout = () => {
                localStorage.removeItem('staffToken');
                clearStaff();
                navigate('/login');
        };

        const roles = (rolesData as any)?.items || [];

        if (rolesLoading) {
                return (
                        <AdminLayout
                                active={'roles' as any}
                                setActive={() => { }}
                                adminEmailState={staff?.email || 'admin@email.com'}
                                handleLogout={handleLogout}
                        >
                                <div className="p-6">
                                        <Card>
                                                <CardHeader>
                                                        <CardTitle>Quản lý vai trò</CardTitle>
                                                </CardHeader>
                                                <CardContent>
                                                        <div className="space-y-4">
                                                                <Skeleton className="h-10 w-full" />
                                                                <Skeleton className="h-10 w-full" />
                                                                <Skeleton className="h-10 w-full" />
                                                        </div>
                                                </CardContent>
                                        </Card>
                                </div>
                        </AdminLayout>
                );
        }

        return (
                <AdminLayout
                        active={'roles' as any}
                        setActive={() => { }}
                        adminEmailState={staff?.email || 'admin@email.com'}
                        handleLogout={handleLogout}
                >
                        <div className="p-6">
                                <Card>
                                        <CardHeader>
                                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                                        <div className="flex flex-col gap-1">
                                                                <CardTitle>Quản lý vai trò</CardTitle>
                                                                <p className="text-xs text-slate-500">Tổng cộng {roles.length} vai trò trong hệ thống</p>
                                                        </div>
                                                        <div className="flex flex-1 w-full md:max-w-md gap-2 ml-auto">
                                                                <div className="relative flex-1">
                                                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                                                        <input
                                                                                className="w-full pl-10 pr-4 py-2 bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-blue-500 rounded-xl transition-all outline-none text-sm border"
                                                                                value={searchQuery}
                                                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                                                placeholder="Tìm theo tên vai trò..."
                                                                        />
                                                                </div>
                                                                <Button
                                                                        variant="outline"
                                                                        size="icon"
                                                                        onClick={() => {
                                                                                setSearchQuery('');
                                                                                setShowSystemOnly(false);
                                                                                queryClient.invalidateQueries({ queryKey: ['roles'] });
                                                                        }}
                                                                        className="h-10 w-10 hover:rotate-180 transition-transform duration-500"
                                                                        title="Làm mới"
                                                                >
                                                                        <RefreshCw className="h-4 w-4" />
                                                                </Button>
                                                        </div>
                                                        <div className="flex gap-2">
                                                                <Button variant="outline" onClick={handleSeed} disabled={seedMutation.isPending}>
                                                                        {seedMutation.isPending ? 'Đang seed...' : 'Seed vai trò mặc định'}
                                                                </Button>
                                                                <Button
                                                                        onClick={() => {
                                                                                resetForm();
                                                                                setIsCreateDialogOpen(true);
                                                                        }}
                                                                        className="bg-blue-600 hover:bg-blue-700"
                                                                >
                                                                        Tạo vai trò mới
                                                                </Button>
                                                        </div>
                                                </div>
                                        </CardHeader>
                                        <CardContent>
                                                <div className="overflow-x-auto">
                                                        <table className="w-full">
                                                                <thead>
                                                                        <tr className="bg-gray-50">
                                                                                <th className="text-left p-3 border-b">Tên vai trò</th>
                                                                                <th className="text-left p-3 border-b">Loại</th>
                                                                                <th className="text-left p-3 border-b">Level · Nhân viên</th>
                                                                                <th className="text-left p-3 border-b">Mô tả</th>
                                                                                <th className="text-right p-3 border-b w-[140px]">Hành động</th>
                                                                        </tr>
                                                                </thead>
                                                                <tbody>
                                                                        {roles.map((role: Role) => (
                                                                                <tr key={role.id} className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/roles/${role.id}`)}>
                                                                                        <td className="p-3 font-medium capitalize">{role.name}</td>
                                                                                        <td className="p-3">
                                                                                                {role.isSystem ? (
                                                                                                        <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">System</span>
                                                                                                ) : (
                                                                                                        <span className="bg-blue-100 text-blue-600 px-2 py-1 rounded text-xs">Custom</span>
                                                                                                )}
                                                                                        </td>
                                                                                        <td className="p-3">Lv{role.level} · {role.staffCount || 0} nhân viên</td>
                                                                                        <td className="p-3 text-sm text-gray-600">{role.description || '-'}</td>
                                                                                        <td className="p-3" onClick={(e) => e.stopPropagation()}>
                                                                                                <div className="flex justify-end items-center gap-1 w-[100px] ml-auto">
                                                                                                        <Button
                                                                                                                variant="ghost"
                                                                                                                size="icon"
                                                                                                                className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 flex-shrink-0"
                                                                                                                onClick={() => navigate(`/roles/${role.id}`)}
                                                                                                                title="Chi tiết"
                                                                                                        >
                                                                                                                <Eye className="h-3.5 w-3.5" />
                                                                                                        </Button>
                                                                                                        {!role.isSystem ? (
                                                                                                                <Button
                                                                                                                        variant="ghost"
                                                                                                                        size="icon"
                                                                                                                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                                                                                                                        onClick={() => {
                                                                                                                                if ((role.staffCount || 0) > 0) {
                                                                                                                                        toast.error(`Không thể xóa vai trò này vì đã được giao cho ${role.staffCount} nhân viên`);
                                                                                                                                        return;
                                                                                                                                }
                                                                                                                                setRoleToDelete(role);
                                                                                                                                setIsDeleteDialogOpen(true);
                                                                                                                        }}
                                                                                                                        title="Xóa"
                                                                                                                >
                                                                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                                                                </Button>
                                                                                                        ) : (
                                                                                                                <span className="h-8 w-8 flex-shrink-0" />
                                                                                                        )}
                                                                                                </div>
                                                                                        </td>
                                                                                </tr>
                                                                        ))}
                                                                </tbody>
                                                        </table>
                                                </div>
                                        </CardContent>
                                </Card>

                                {/* Create Dialog */}
                                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                                        <DialogContent className="[&>button]:hidden">
                                                <DialogHeader className="flex flex-row items-center gap-3 space-y-0 pb-4 border-b">
                                                        <DialogTitle className="text-lg font-bold text-slate-800">Tạo vai trò mới</DialogTitle>
                                                        <div className="flex-1" />
                                                        <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => setIsCreateDialogOpen(false)}
                                                                className="h-8 w-8 rounded-full hover:bg-slate-100 text-slate-400 transition-colors"
                                                                title="Đóng"
                                                        >
                                                                <X className="w-5 h-5" />
                                                        </Button>
                                                </DialogHeader>
                                                <div className="space-y-4 py-4">
                                                        <div>
                                                                <Label>Tên vai trò *</Label>
                                                                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                                                        </div>
                                                        <div>
                                                                <Label>Mô tả</Label>
                                                                <Input
                                                                        value={formData.description}
                                                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                                                />
                                                        </div>
                                                        <div>
                                                                <Label>Level</Label>
                                                                <Select value={formData.level} onValueChange={(v) => setFormData({ ...formData, level: v })}>
                                                                        <SelectTrigger>
                                                                                <SelectValue placeholder="Chọn level" />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                                <SelectItem value="0">Staff (0)</SelectItem>
                                                                                <SelectItem value="1">Manager (1)</SelectItem>
                                                                                <SelectItem value="2">Admin (2)</SelectItem>
                                                                        </SelectContent>
                                                                </Select>
                                                        </div>
                                                </div>
                                                <DialogFooter>
                                                        <Button variant="ghost" onClick={() => setIsCreateDialogOpen(false)} className="text-slate-500 hover:bg-slate-100">
                                                                Hủy
                                                        </Button>
                                                        <Button onClick={handleCreate} disabled={createMutation.isPending} className="bg-blue-600 hover:bg-blue-700 min-w-[140px] rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-95">
                                                                {createMutation.isPending ? 'Đang tạo...' : 'Tạo'}
                                                        </Button>
                                                </DialogFooter>
                                        </DialogContent>
                                </Dialog>

                                {/* Delete Dialog */}
                                <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                                        <DialogContent className="[&>button]:hidden">
                                                <DialogHeader className="flex flex-row items-center gap-3 space-y-0 pb-4 border-b">
                                                        <DialogTitle className="text-lg font-bold text-slate-800">Xác nhận xóa</DialogTitle>
                                                        <div className="flex-1" />
                                                        <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => setIsDeleteDialogOpen(false)}
                                                                className="h-8 w-8 rounded-full hover:bg-slate-100 text-slate-400 transition-colors"
                                                                title="Đóng"
                                                        >
                                                                <X className="w-5 h-5" />
                                                        </Button>
                                                </DialogHeader>
                                                <p className="py-4">
                                                        Bạn có chắc chắn muốn xóa vai trò "{roleToDelete?.name}"? Hành động này không thể hoàn tác.
                                                </p>
                                                <DialogFooter>
                                                        <Button variant="ghost" onClick={() => setIsDeleteDialogOpen(false)} className="text-slate-500 hover:bg-slate-100">
                                                                Hủy
                                                        </Button>
                                                        <Button
                                                                onClick={handleDelete}
                                                                disabled={deleteMutation.isPending}
                                                                className="bg-red-600 hover:bg-red-700 min-w-[140px] rounded-xl shadow-lg shadow-red-500/20 transition-all active:scale-95"
                                                        >
                                                                {deleteMutation.isPending ? 'Đang xóa...' : 'Xóa'}
                                                        </Button>
                                                </DialogFooter>
                                        </DialogContent>
                                </Dialog>
                        </div>
                </AdminLayout>
        );
}
