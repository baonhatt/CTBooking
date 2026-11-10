import AdminLayout from '@/admin/layouts/AdminLayout';
import UsersContent from '@/components/admin/content/UsersContent';
// Modal sửa tài khoản khách bị tắt (20261110): nút Lưu của nó chỉ đổi dữ liệu trên màn hình và báo thành công giả, vì server không có API sửa khách hàng, và danh sách không có nút gọi nó. Làm API thật rồi mới bật lại.
// import { UserEditModal } from '@/components/admin/dialogs/UserEditModal';
import React, { useMemo, useState, useEffect } from 'react';
import { getUsers } from '@/lib/api';
import { useStaffStore } from '@/store/staffStore';
import { useNavigate } from 'react-router-dom';

export default function UsersPage() {
  const navigate = useNavigate();
  const staff = useStaffStore((state) => state.staff);
  const clearStaff = useStaffStore((state) => state.clearStaff);
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState<any[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [usersPage, setUsersPage] = useState(1);
  const [userQuery, setUserQuery] = useState('');
  // 'all', 'active' or 'inactive'
  const [statusFilter, setStatusFilter] = useState('all');
  const pageSize = 10;
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setIsLoading(true);
        const { items, total } = await getUsers({
          page: usersPage,
          pageSize,
          q: userQuery,
          status: statusFilter
        });
        setUsers(
          items.map((u: any) => ({
            id: String(u.id),
            fullname: u.fullname,
            email: u.email,
            phone: u.phone,
            is_active: u.is_active,
            total_bookings: u.total_bookings,
            login_type: u.login_type,
            last_booking_at: u.last_booking_at,
            created_at: new Date(u.created_at)
          }))
        );
        setTotalUsers(total);
      } catch (err) {
        console.error('Lỗi load users:', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [usersPage, userQuery, statusFilter, pageSize]);
  const usersTotalPages = useMemo(() => Math.max(1, Math.ceil(totalUsers / pageSize)), [totalUsers]);

  const handleOpenEdit = (_type: 'user', data: any) => {
    setEditData(data);
    setIsEditOpen(true);
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    const { items, total } = await getUsers({
      page: usersPage,
      pageSize,
      q: userQuery,
      status: statusFilter
    });
    setUsers(
      items.map((u: any) => ({
        id: String(u.id),
        fullname: u.fullname,
        email: u.email,
        phone: u.phone,
        is_active: u.is_active,
        total_bookings: u.total_bookings,
        login_type: u.login_type,
        last_booking_at: u.last_booking_at,
        created_at: new Date(u.created_at)
      }))
    );
    setTotalUsers(total);
    setIsLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('staffToken');
    clearStaff();
    navigate('/login');
  };

  return (
    <AdminLayout
      active={activeTab as any}
      setActive={setActiveTab as any}
      adminEmailState={staff?.email || 'admin@email.com'}
      handleLogout={handleLogout}
    >
      <UsersContent
        data={users}
        totalPages={usersTotalPages}
        currentPage={usersPage}
        setPage={setUsersPage}
        userQuery={userQuery}
        setUserQuery={setUserQuery}
        statusFilter={statusFilter}
        setStatusFilter={(value) => {
          setStatusFilter(value);
          setUsersPage(1);
        }}
        onEdit={handleOpenEdit}
        usersLength={totalUsers}
        onRefresh={handleRefresh}
        isLoading={isLoading}
      />
      {/* Modal sửa tài khoản khách bị tắt (20261110): nút Lưu của nó chỉ đổi dữ liệu trên màn hình và báo thành công giả, vì server không có API sửa khách hàng, và danh sách không có nút gọi nó. Làm API thật rồi mới bật lại. */}
      {/*
      <UserEditModal
        isEditOpen={isEditOpen}
        setIsEditOpen={setIsEditOpen}
        editData={editData}
        setEditData={setEditData}
        setUsers={setUsers}
      />
      */}
    </AdminLayout>
  );
}
