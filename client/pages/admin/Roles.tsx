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
import { request } from '@/lib/api/http';
import AdminLayout from '@/admin/layouts/AdminLayout';
import { useStaffStore } from '@/store/staffStore';
import { useNavigate } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';

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

        // Form state for create
        const [formData, setFormData] = useState({
                name: '',
                description: '',
                level: '0'
        });

        // Fetch roles
        const { data: rolesData, isLoading: rolesLoading } = useQuery({
                queryKey: ['roles'],
                queryFn: async () => {
                        return request('/api/admin/roles?pageSize=100');
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
                                                <div className="flex justify-between items-center">
                                                        <CardTitle>Quản lý vai trò</CardTitle>
                                                        <div className="flex gap-2">
                                                                <Button variant="outline" onClick={handleSeed} disabled={seedMutation.isPending}>
                                                                        {seedMutation.isPending ? 'Đang seed...' : 'Seed vai trò mặc định'}
                                                                </Button>
                                                                <Button
                                                                        onClick={() => {
                                                                                resetForm();
                                                                                setIsCreateDialogOpen(true);
                                                                        }}
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
                                                                                                <div className="flex justify-end items-center gap-2 w-[120px] ml-auto">
                                                                                                        <Button
                                                                                                                variant="outline"
                                                                                                                size="sm"
                                                                                                                className="h-8"
                                                                                                                onClick={() => navigate(`/roles/${role.id}`)}
                                                                                                        >
                                                                                                                <Pencil className="h-3.5 w-3.5" />
                                                                                                        </Button>
                                                                                                        {!role.isSystem ? (
                                                                                                                <Button
                                                                                                                        variant="outline"
                                                                                                                        size="icon"
                                                                                                                        className="h-8 w-8 text-red-500 border-red-200 hover:bg-red-50 flex-shrink-0"
                                                                                                                        onClick={() => {
                                                                                                                                if ((role.staffCount || 0) > 0) {
                                                                                                                                        toast.error(`Không thể xóa vai trò này vì đã được giao cho ${role.staffCount} nhân viên`);
                                                                                                                                        return;
                                                                                                                                }
                                                                                                                                setRoleToDelete(role);
                                                                                                                                setIsDeleteDialogOpen(true);
                                                                                                                        }}
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
                                        <DialogContent>
                                                <DialogHeader>
                                                        <DialogTitle>Tạo vai trò mới</DialogTitle>
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
                                                        <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                                                                Hủy
                                                        </Button>
                                                        <Button onClick={handleCreate} disabled={createMutation.isPending}>
                                                                {createMutation.isPending ? 'Đang tạo...' : 'Tạo'}
                                                        </Button>
                                                </DialogFooter>
                                        </DialogContent>
                                </Dialog>

                                {/* Delete Dialog */}
                                <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                                        <DialogContent>
                                                <DialogHeader>
                                                        <DialogTitle>Xác nhận xóa</DialogTitle>
                                                </DialogHeader>
                                                <p className="py-4">
                                                        Bạn có chắc chắn muốn xóa vai trò "{roleToDelete?.name}"? Hành động này không thể hoàn tác.
                                                </p>
                                                <DialogFooter>
                                                        <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                                                                Hủy
                                                        </Button>
                                                        <Button
                                                                onClick={handleDelete}
                                                                disabled={deleteMutation.isPending}
                                                                className="bg-red-600 hover:bg-red-700"
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
