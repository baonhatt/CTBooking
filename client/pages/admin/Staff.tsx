import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { request } from '@/lib/api/http';
import AdminLayout from '@/admin/layouts/AdminLayout';
import { useStaffStore } from '@/store/staffStore';
import { useNavigate } from 'react-router-dom';
import { useStaffPermissions, useIsSuperAdmin } from '@/hooks/useStaffPermission';
import { Info, X, Search, RefreshCw, Eye, FileText, Edit, Trash2, Key } from 'lucide-react';

interface Staff {
        id: number;
        email: string;
        fullname: string;
        phone?: string;
        avatar?: string;
        isSuperAdmin: boolean;
        forcePasswordChange: boolean;
        roleIds?: number[];
        roles?: string[];
        branchIds?: number[];
        branchNames?: string[];
        lastLoginAt?: string;
        createdAt: string;
        updatedAt: string;
        created_by_staff_name?: string;
        updated_by_staff_name?: string;
}

interface Role {
        id: number;
        name: string;
        description?: string;
        level: number;
}

interface Branch {
        id: number;
        name: string;
        address?: string;
}

interface StaffListResponse {
        items: Staff[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
}

export default function StaffPage() {
        const queryClient = useQueryClient();
        const navigate = useNavigate();
        const staff = useStaffStore((state) => state.staff);
        const clearStaff = useStaffStore((state) => state.clearStaff);
        const permissions = useStaffPermissions();
        const isSuperAdmin = useIsSuperAdmin();

        const [page, setPage] = useState(1);
        const [pageSize] = useState(20);
        const [search, setSearch] = useState('');
        const [filterRole, setFilterRole] = useState('');
        const [filterBranch, setFilterBranch] = useState('');
        const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
        const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
        const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
        const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
        const [isResetPasswordDialogOpen, setIsResetPasswordDialogOpen] = useState(false);
        const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

        // Permission helpers
        const hasPermission = (module: string, action: string) => {
                if (isSuperAdmin) return true;
                return permissions.some((p) => p.module === module && p.action === action);
        };

        // Form state
        const [formData, setFormData] = useState({
                email: '',
                fullname: '',
                phone: '',
                roleId: '',
                branchIds: [] as number[]
        });

        // Fetch staff list
        const { data: staffData, isLoading: staffLoading } = useQuery({
                queryKey: ['staff', page, pageSize, search, filterRole, filterBranch],
                queryFn: async () => {
                        const params = new URLSearchParams({
                                page: String(page),
                                pageSize: String(pageSize)
                        });
                        if (search) params.append('q', search);
                        if (filterRole && filterRole !== 'all') params.append('roleId', filterRole);
                        if (filterBranch && filterBranch !== 'all') params.append('branchId', filterBranch);
                        return request(`/api/admin/staff?${params}`) as Promise<StaffListResponse>;
                }
        });

        // Fetch roles
        const { data: rolesData } = useQuery({
                queryKey: ['roles'],
                queryFn: async () => {
                        return request('/api/admin/roles?pageSize=100');
                }
        });

        // Fetch branches
        const { data: branchesData } = useQuery({
                queryKey: ['branches'],
                queryFn: async () => {
                        return request('/api/admin/branches?pageSize=100');
                }
        });

        // Create staff mutation
        const createMutation = useMutation({
                mutationFn: async (data: any) => {
                        return request('/api/admin/staff', {
                                method: 'POST',
                                body: JSON.stringify(data)
                        });
                },
                onSuccess: () => {
                        toast.success('Tạo nhân viên thành công');
                        setIsCreateDialogOpen(false);
                        resetForm();
                        queryClient.invalidateQueries({ queryKey: ['staff'] });
                        queryClient.invalidateQueries({ queryKey: ['staff', page, pageSize, search, filterRole, filterBranch] });
                },
                onError: (err: any) => {
                        toast.error(err.message || 'Tạo nhân viên thất bại');
                }
        });

        // Update staff mutation
        const updateMutation = useMutation({
                mutationFn: async ({ id, data }: { id: number; data: any }) => {
                        console.log('Update staff request:', { id, data });
                        return request(`/api/admin/staff/${id}`, {
                                method: 'PUT',
                                body: JSON.stringify(data)
                        });
                },
                onSuccess: () => {
                        toast.success('Cập nhật nhân viên thành công');
                        setIsEditDialogOpen(false);
                        setSelectedStaff(null);
                        resetForm();
                        queryClient.invalidateQueries({ queryKey: ['staff'] });
                },
                onError: (err: any) => {
                        toast.error(err.message || 'Cập nhật nhân viên thất bại');
                }
        });

        // Delete staff mutation
        const deleteMutation = useMutation({
                mutationFn: async (id: number) => {
                        return request(`/api/admin/staff/${id}`, {
                                method: 'DELETE'
                        });
                },
                onSuccess: () => {
                        toast.success('Xóa nhân viên thành công');
                        setIsDeleteDialogOpen(false);
                        setSelectedStaff(null);
                        queryClient.invalidateQueries({ queryKey: ['staff'] });
                },
                onError: (err: any) => {
                        toast.error(err.message || 'Xóa nhân viên thất bại');
                }
        });

        // Reset password mutation
        const resetPasswordMutation = useMutation({
                mutationFn: async (id: number) => {
                        return request(`/api/admin/staff/${id}/reset-password`, {
                                method: 'POST'
                        });
                },
                onSuccess: (data: any) => {
                        toast.success('Đặt lại mật khẩu thành công. Thông tin mật khẩu mới đã được gửi tới email của nhân viên.');
                        setIsResetPasswordDialogOpen(false);
                        setSelectedStaff(null);
                },
                onError: (err: any) => {
                        toast.error(err.message || 'Đặt lại mật khẩu thất bại');
                }
        });

        const resetForm = () => {
                setFormData({
                        email: '',
                        fullname: '',
                        phone: '',
                        roleId: '',
                        branchIds: []
                });
        };

        const handleCreate = () => {
                const dataToSend = {
                        ...formData,
                        roleIds: formData.roleId ? [parseInt(formData.roleId)] : []
                };
                createMutation.mutate(dataToSend);
        };

        const handleUpdate = () => {
                if (!selectedStaff) return;
                const dataToSend = {
                        ...formData,
                        roleIds: formData.roleId ? [parseInt(formData.roleId)] : []
                };
                updateMutation.mutate({
                        id: selectedStaff.id,
                        data: dataToSend
                });
        };

        const handleDelete = () => {
                if (!selectedStaff) return;
                deleteMutation.mutate(selectedStaff.id);
        };

        const handleResetPassword = () => {
                if (!selectedStaff) return;
                resetPasswordMutation.mutate(selectedStaff.id);
        };

        const openEditDialog = (staff: Staff) => {
                setSelectedStaff(staff);
                setFormData({
                        email: staff.email,
                        fullname: staff.fullname,
                        phone: staff.phone || '',
                        roleId: staff.roleIds && staff.roleIds.length > 0 ? String(staff.roleIds[0]) : '',
                        branchIds: staff.branchIds || []
                });
                setIsEditDialogOpen(true);
        };

        const toggleBranch = (branchId: number) => {
                setFormData((prev) => ({
                        ...prev,
                        branchIds: prev.branchIds.includes(branchId)
                                ? prev.branchIds.filter((id) => id !== branchId)
                                : [...prev.branchIds, branchId]
                }));
        };

        const roles = (rolesData as any)?.items || [];
        const branches = (branchesData as any)?.items || [];
        const staffList = (staffData as any)?.items || [];
        const total = (staffData as any)?.total || 0;
        const totalPages = Math.ceil(total / pageSize);

        const handleLogout = () => {
                localStorage.removeItem('staffToken');
                clearStaff();
                navigate('/login');
        };

        if (staffLoading) {
                return (
                        <AdminLayout
                                active={'staff' as any}
                                setActive={() => { }}
                                adminEmailState={staff?.email || 'admin@email.com'}
                                handleLogout={handleLogout}
                        >
                                <div className="p-6">
                                        <Card>
                                                <CardHeader>
                                                        <CardTitle>Quản lý nhân viên</CardTitle>
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
                        active={'staff' as any}
                        setActive={() => { }}
                        adminEmailState={staff?.email || 'admin@email.com'}
                        handleLogout={handleLogout}
                >
                        <div className="p-6">
                                <Card>
                                        <CardHeader>
                                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                                        <div className="flex flex-col gap-1">
                                                                <CardTitle>Quản lý nhân viên</CardTitle>
                                                                <p className="text-xs text-slate-500">Tổng cộng {staffData?.total || 0} nhân viên trong hệ thống</p>
                                                        </div>
                                                        <div className="flex flex-1 w-full md:max-w-md gap-2 ml-auto">
                                                                <div className="relative flex-1">
                                                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                                                        <Input
                                                                                placeholder="Tìm theo email hoặc tên..."
                                                                                value={search}
                                                                                onChange={(e) => setSearch(e.target.value)}
                                                                                className="pl-10 pr-4 bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-blue-500 rounded-xl transition-all outline-none text-sm border"
                                                                        />
                                                                </div>
                                                                <Button
                                                                        variant="outline"
                                                                        size="icon"
                                                                        onClick={() => {
                                                                                setSearch('');
                                                                                setFilterRole('');
                                                                                setFilterBranch('');
                                                                        }}
                                                                        className="h-10 w-10"
                                                                        title="Làm mới"
                                                                >
                                                                        <RefreshCw className="h-4 w-4" />
                                                                </Button>
                                                        </div>
                                                        <div className="flex gap-2">
                                                                <Select value={filterRole} onValueChange={setFilterRole}>
                                                                        <SelectTrigger className="w-[180px] h-10">
                                                                                <SelectValue placeholder="Vai trò" />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                                <SelectItem value="all">Tất cả vai trò</SelectItem>
                                                                                {roles.map((role: Role) => (
                                                                                        <SelectItem key={role.id} value={String(role.id)}>
                                                                                                {role.name}
                                                                                        </SelectItem>
                                                                                ))}
                                                                        </SelectContent>
                                                                </Select>
                                                                <Select value={filterBranch} onValueChange={setFilterBranch}>
                                                                        <SelectTrigger className="w-[180px] h-10">
                                                                                <SelectValue placeholder="Chi nhánh" />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                                <SelectItem value="all">Tất cả chi nhánh</SelectItem>
                                                                                {branches.map((branch: Branch) => (
                                                                                        <SelectItem key={branch.id} value={String(branch.id)}>
                                                                                                {branch.name}
                                                                                        </SelectItem>
                                                                                ))}
                                                                        </SelectContent>
                                                                </Select>
                                                                {hasPermission('staff', 'create') && (
                                                                        <Button
                                                                                onClick={() => {
                                                                                        resetForm();
                                                                                        setIsCreateDialogOpen(true);
                                                                                }}
                                                                                className="bg-blue-600 hover:bg-blue-700"
                                                                        >
                                                                                Tạo nhân viên mới
                                                                        </Button>
                                                                )}
                                                        </div>
                                                </div>
                                        </CardHeader>
                                        <CardContent>
                                                {/* Table */}
                                                <div className="border rounded-lg">
                                                        <table className="w-full">
                                                                <thead>
                                                                        <tr className="border-b bg-gray-50">
                                                                                <th className="text-left p-3">Email</th>
                                                                                <th className="text-left p-3">Họ tên</th>
                                                                                <th className="text-left p-3">Vai trò</th>
                                                                                <th className="text-left p-3">Chi nhánh</th>
                                                                                <th className="text-left p-3">Trạng thái</th>
                                                                                <th className="text-left p-3">Hành động</th>
                                                                        </tr>
                                                                </thead>
                                                                <tbody>
                                                                        {staffList.map((staff: Staff) => (
                                                                                <tr key={staff.id} className="border-b hover:bg-gray-50">
                                                                                        <td className="p-3">{staff.email}</td>
                                                                                        <td className="p-3">{staff.fullname}</td>
                                                                                        <td className="p-3">{staff.roles?.join(', ') || '-'}</td>
                                                                                        <td className="p-3">{staff.branchNames?.join(', ') || '-'}</td>
                                                                                        <td className="p-3">
                                                                                                {staff.isSuperAdmin && (
                                                                                                        <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs">Super Admin</span>
                                                                                                )}
                                                                                                {staff.forcePasswordChange && (
                                                                                                        <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs ml-1">
                                                                                                                Đổi mật khẩu
                                                                                                        </span>
                                                                                                )}
                                                                                        </td>
                                                                                        <td className="p-3">
                                                                                                <div className="flex gap-1">
                                                                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => { setSelectedStaff(staff); setIsDetailDialogOpen(true); }} title="Chi tiết">
                                                                                                                <Eye className="w-4 h-4" />
                                                                                                        </Button>
                                                                                                        {hasPermission('staff', 'edit') && (
                                                                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50" onClick={() => openEditDialog(staff)} title="Sửa">
                                                                                                                        <Edit className="w-4 h-4" />
                                                                                                                </Button>
                                                                                                        )}
                                                                                                        {hasPermission('staff', 'reset_password') && (
                                                                                                                <Button
                                                                                                                        variant="ghost"
                                                                                                                        size="icon"
                                                                                                                        className="h-8 w-8 text-gray-600 hover:text-gray-700 hover:bg-gray-50"
                                                                                                                        onClick={() => {
                                                                                                                                setSelectedStaff(staff);
                                                                                                                                setIsResetPasswordDialogOpen(true);
                                                                                                                        }}
                                                                                                                        title="Đặt lại mật khẩu"
                                                                                                                >
                                                                                                                        <Key className="w-4 h-4" />
                                                                                                                </Button>
                                                                                                        )}
                                                                                                        {!staff.isSuperAdmin && hasPermission('staff', 'delete') && (
                                                                                                                <Button
                                                                                                                        variant="ghost"
                                                                                                                        size="icon"
                                                                                                                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                                                                                        onClick={() => {
                                                                                                                                setSelectedStaff(staff);
                                                                                                                                setIsDeleteDialogOpen(true);
                                                                                                                        }}
                                                                                                                        title="Xóa"
                                                                                                                >
                                                                                                                        <Trash2 className="w-4 h-4" />
                                                                                                                </Button>
                                                                                                        )}
                                                                                                </div>
                                                                                        </td>
                                                                                </tr>
                                                                        ))}
                                                                </tbody>
                                                        </table>
                                                </div>

                                                {/* Pagination */}
                                                <div className="flex justify-between items-center mt-4">
                                                        <span className="text-sm text-gray-600">Tổng {total} nhân viên</span>
                                                        <div className="flex gap-2">
                                                                <Button variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>
                                                                        Trước
                                                                </Button>
                                                                <span className="flex items-center px-3">
                                                                        Trang {page} / {totalPages || 1}
                                                                </span>
                                                                <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                                                                        Sau
                                                                </Button>
                                                        </div>
                                                </div>
                                        </CardContent>
                                </Card>

                                {/* Create Dialog */}
                                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                                        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto [&>button]:hidden">
                                                <DialogHeader className="flex flex-row items-center gap-3 space-y-0 pb-4 border-b">
                                                        <DialogTitle className="text-lg font-bold text-slate-800">Tạo nhân viên mới</DialogTitle>
                                                        <div className="flex-1" />
                                                        <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => setIsCreateDialogOpen(false)}
                                                                className="h-8 w-8 rounded-full hover:bg-slate-100 text-slate-400 transition-colors"
                                                        >
                                                                <X className="w-5 h-5" />
                                                        </Button>
                                                </DialogHeader>
                                                <form onSubmit={(e) => { e.preventDefault(); handleCreate(); }}>
                                                        <div className="space-y-4 py-4">
                                                                <div>
                                                                        <Label>Email *</Label>
                                                                        <Input value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                                                                </div>
                                                                <div>
                                                                        <Label>Họ tên *</Label>
                                                                        <Input
                                                                                value={formData.fullname}
                                                                                onChange={(e) => setFormData({ ...formData, fullname: e.target.value })}
                                                                        />
                                                                </div>
                                                                <div>
                                                                        <Label>Số điện thoại</Label>
                                                                        <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                                                                </div>
                                                                <div>
                                                                        <Label>Vai trò</Label>
                                                                        <Select value={formData.roleId} onValueChange={(v) => setFormData({ ...formData, roleId: v })}>
                                                                                <SelectTrigger>
                                                                                        <SelectValue placeholder="Chọn vai trò" />
                                                                                </SelectTrigger>
                                                                                <SelectContent>
                                                                                        {roles.map((role: Role) => (
                                                                                                <SelectItem key={role.id} value={String(role.id)}>
                                                                                                        {role.name}
                                                                                                </SelectItem>
                                                                                        ))}
                                                                                </SelectContent>
                                                                        </Select>
                                                                </div>
                                                                <div>
                                                                        <Label>Chi nhánh</Label>
                                                                        <div className="grid grid-cols-2 gap-2 mt-2 max-h-40 overflow-y-auto border rounded p-2">
                                                                                {branches.map((branch: Branch) => (
                                                                                        <div key={branch.id} className="flex items-center space-x-2">
                                                                                                <Checkbox
                                                                                                        id={`branch-${branch.id}`}
                                                                                                        checked={formData.branchIds.includes(branch.id)}
                                                                                                        onCheckedChange={() => toggleBranch(branch.id)}
                                                                                                />
                                                                                                <Label htmlFor={`branch-${branch.id}`} className="text-sm">
                                                                                                        {branch.name}
                                                                                                </Label>
                                                                                        </div>
                                                                                ))}
                                                                        </div>
                                                                </div>
                                                                <div className="flex items-start gap-2 text-xs text-gray-500 px-1">
                                                                        <Info className="w-3.5 h-3.5 mt-0.5 text-blue-400/70" />
                                                                        <span>Mật khẩu sẽ được tạo tự động và gửi qua email cho nhân viên.</span>
                                                                </div>
                                                        </div>
                                                        <DialogFooter>
                                                                <Button type="button" variant="ghost" onClick={() => setIsCreateDialogOpen(false)} className="text-slate-500 hover:bg-slate-100">
                                                                        Hủy
                                                                </Button>
                                                                <Button type="submit" disabled={createMutation.isPending} className="bg-blue-600 hover:bg-blue-700 min-w-[140px] rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-95">
                                                                        {createMutation.isPending ? 'Đang tạo...' : 'Tạo'}
                                                                </Button>
                                                        </DialogFooter>
                                                </form>
                                        </DialogContent>
                                </Dialog>

                                {/* Edit Dialog */}
                                <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                                        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto [&>button]:hidden">
                                                <DialogHeader className="flex flex-row items-center gap-3 space-y-0 pb-4 border-b">
                                                        <DialogTitle className="text-lg font-bold text-slate-800">Chỉnh sửa nhân viên</DialogTitle>
                                                        <div className="flex-1" />
                                                        <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => setIsEditDialogOpen(false)}
                                                                className="h-8 w-8 rounded-full hover:bg-slate-100 text-slate-400 transition-colors"
                                                        >
                                                                <X className="w-5 h-5" />
                                                        </Button>
                                                </DialogHeader>
                                                <form onSubmit={(e) => { e.preventDefault(); handleUpdate(); }}>
                                                        <div className="space-y-4 py-4">
                                                                <div>
                                                                        <Label>Email *</Label>
                                                                        <Input value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                                                                </div>
                                                                <div>
                                                                        <Label>Họ tên *</Label>
                                                                        <Input
                                                                                value={formData.fullname}
                                                                                onChange={(e) => setFormData({ ...formData, fullname: e.target.value })}
                                                                        />
                                                                </div>
                                                                <div>
                                                                        <Label>Số điện thoại</Label>
                                                                        <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                                                                </div>
                                                                <div>
                                                                        <Label>Vai trò</Label>
                                                                        <Select value={formData.roleId} onValueChange={(v) => setFormData({ ...formData, roleId: v })}>
                                                                                <SelectTrigger>
                                                                                        <SelectValue placeholder="Chọn vai trò" />
                                                                                </SelectTrigger>
                                                                                <SelectContent>
                                                                                        {roles.map((role: Role) => (
                                                                                                <SelectItem key={role.id} value={String(role.id)}>
                                                                                                        {role.name}
                                                                                                </SelectItem>
                                                                                        ))}
                                                                                </SelectContent>
                                                                        </Select>
                                                                </div>
                                                                <div>
                                                                        <Label>Chi nhánh</Label>
                                                                        <div className="grid grid-cols-2 gap-2 mt-2 max-h-40 overflow-y-auto border rounded p-2">
                                                                                {branches.map((branch: Branch) => (
                                                                                        <div key={branch.id} className="flex items-center space-x-2">
                                                                                                <Checkbox
                                                                                                        id={`edit-branch-${branch.id}`}
                                                                                                        checked={formData.branchIds.includes(branch.id)}
                                                                                                        onCheckedChange={() => toggleBranch(branch.id)}
                                                                                                />
                                                                                                <Label htmlFor={`edit-branch-${branch.id}`} className="text-sm">
                                                                                                        {branch.name}
                                                                                                </Label>
                                                                                        </div>
                                                                                ))}
                                                                        </div>
                                                                </div>
                                                        </div>
                                                        <div className="flex items-start gap-2 text-xs text-gray-500 px-1">
                                                                <Info className="w-3.5 h-3.5 mt-0.5 text-blue-400/70" />
                                                                <span>
                                                                        {selectedStaff?.forcePasswordChange
                                                                                ? 'Người dùng chưa đổi mật khẩu lần đầu.'
                                                                                : 'Người dùng đã đổi mật khẩu lần đầu.'}
                                                                </span>
                                                        </div>
                                                        <DialogFooter>
                                                                <Button type="button" variant="ghost" onClick={() => setIsEditDialogOpen(false)} className="text-slate-500 hover:bg-slate-100">
                                                                        Hủy
                                                                </Button>
                                                                <Button type="submit" disabled={updateMutation.isPending} className="bg-blue-600 hover:bg-blue-700 min-w-[140px] rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-95">
                                                                        {updateMutation.isPending ? 'Đang cập nhật...' : 'Lưu thay đổi'}
                                                                </Button>
                                                        </DialogFooter>
                                                </form>
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
                                                        >
                                                                <X className="w-5 h-5" />
                                                        </Button>
                                                </DialogHeader>
                                                <p className="py-4">
                                                        Bạn có chắc chắn muốn xóa nhân viên "{selectedStaff?.fullname}"? Hành động này không thể hoàn tác.
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

                                {/* Reset Password Dialog */}
                                <Dialog open={isResetPasswordDialogOpen} onOpenChange={setIsResetPasswordDialogOpen}>
                                        <DialogContent className="[&>button]:hidden">
                                                <DialogHeader className="flex flex-row items-center gap-3 space-y-0 pb-4 border-b">
                                                        <DialogTitle className="text-lg font-bold text-slate-800">Đặt lại mật khẩu</DialogTitle>
                                                        <div className="flex-1" />
                                                        <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => setIsResetPasswordDialogOpen(false)}
                                                                className="h-8 w-8 rounded-full hover:bg-slate-100 text-slate-400 transition-colors"
                                                        >
                                                                <X className="w-5 h-5" />
                                                        </Button>
                                                </DialogHeader>
                                                <p className="py-4">
                                                        Bạn có chắc chắn muốn đặt lại mật khẩu cho nhân viên "{selectedStaff?.fullname}"? Mật khẩu mới sẽ được
                                                        hiển thị sau khi xác nhận.
                                                </p>
                                                <DialogFooter>
                                                        <Button variant="outline" onClick={() => setIsResetPasswordDialogOpen(false)}>
                                                                Hủy
                                                        </Button>
                                                        <Button onClick={handleResetPassword} disabled={resetPasswordMutation.isPending}>
                                                                {resetPasswordMutation.isPending ? 'Đang xử lý...' : 'Xác nhận'}
                                                        </Button>
                                                </DialogFooter>
                                        </DialogContent>
                                </Dialog>

                                {/* Detail Dialog */}
                                <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
                                        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto [&>button]:hidden">
                                                <DialogHeader className="flex flex-row items-center gap-3 space-y-0 pb-4 border-b">
                                                        <DialogTitle className="text-lg font-bold text-slate-800">Chi tiết nhân viên</DialogTitle>
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

                                                {selectedStaff && (
                                                        <div className="space-y-4">
                                                                {/* Overview */}
                                                                <div className="space-y-4 py-4">
                                                                        <div className="grid grid-cols-2 gap-4">
                                                                                <div className="space-y-2">
                                                                                        <Label className="text-sm font-medium text-gray-500">Email</Label>
                                                                                        <div className="text-sm font-medium">{selectedStaff.email}</div>
                                                                                </div>
                                                                                <div className="space-y-2">
                                                                                        <Label className="text-sm font-medium text-gray-500">Họ tên</Label>
                                                                                        <div className="text-sm font-medium">{selectedStaff.fullname}</div>
                                                                                </div>
                                                                                <div className="space-y-2">
                                                                                        <Label className="text-sm font-medium text-gray-500">Số điện thoại</Label>
                                                                                        <div className="text-sm">{selectedStaff.phone || '-'}</div>
                                                                                </div>
                                                                                <div className="space-y-2">
                                                                                        <Label className="text-sm font-medium text-gray-500">Vai trò</Label>
                                                                                        <div className="text-sm">{selectedStaff.roles?.join(', ') || '-'}</div>
                                                                                </div>
                                                                                <div className="space-y-2">
                                                                                        <Label className="text-sm font-medium text-gray-500">Chi nhánh</Label>
                                                                                        <div className="text-sm">{selectedStaff.branchNames?.join(', ') || '-'}</div>
                                                                                </div>
                                                                                <div className="space-y-2">
                                                                                        <Label className="text-sm font-medium text-gray-500">Trạng thái</Label>
                                                                                        <div className="flex gap-2">
                                                                                                {selectedStaff.isSuperAdmin && (
                                                                                                        <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs">Super Admin</span>
                                                                                                )}
                                                                                                {selectedStaff.forcePasswordChange && (
                                                                                                        <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">Đổi mật khẩu</span>
                                                                                                )}
                                                                                        </div>
                                                                                </div>
                                                                        </div>
                                                                        <div className="border-t pt-4 mt-4">
                                                                                <h4 className="text-sm font-semibold mb-3">Thông tin tạo & cập nhật</h4>
                                                                                <div className="grid grid-cols-2 gap-4">
                                                                                        <div className="space-y-2">
                                                                                                <Label className="text-sm font-medium text-gray-500">Ngày tạo</Label>
                                                                                                <div className="text-sm">{new Date(selectedStaff.createdAt).toLocaleString('vi-VN')}</div>
                                                                                        </div>
                                                                                        <div className="space-y-2">
                                                                                                <Label className="text-sm font-medium text-gray-500">Tạo bởi</Label>
                                                                                                <div className="text-sm">{selectedStaff.created_by_staff_name || '-'}</div>
                                                                                        </div>
                                                                                        <div className="space-y-2">
                                                                                                <Label className="text-sm font-medium text-gray-500">Cập nhật lần cuối</Label>
                                                                                                <div className="text-sm">{selectedStaff.updatedAt ? new Date(selectedStaff.updatedAt).toLocaleString('vi-VN') : '-'}</div>
                                                                                        </div>
                                                                                        <div className="space-y-2">
                                                                                                <Label className="text-sm font-medium text-gray-500">Cập nhật bởi</Label>
                                                                                                <div className="text-sm">{selectedStaff.updated_by_staff_name || '-'}</div>
                                                                                        </div>
                                                                                </div>
                                                                        </div>
                                                                </div>

                                                        </div>
                                                )}
                                        </DialogContent>
                                </Dialog>
                        </div>
                </AdminLayout>
        );
}
