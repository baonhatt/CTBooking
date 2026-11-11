import AdminLayout from '@/admin/layouts/AdminLayout';
import UsersContent from '@/components/admin/content/UsersContent';
import { useMemo, useState, useEffect, useCallback } from 'react';
import { getUsers } from '@/lib/api';
import { useStaffStore } from '@/store/staffStore';
import { useNavigate } from 'react-router-dom';

const PAGE_SIZE = 10;

// One row of the API list, in the shape the table uses
const mapUserRow = (u: any) => ({
  id: String(u.id),
  fullname: u.fullname,
  email: u.email,
  phone: u.phone,
  is_active: u.is_active,
  total_bookings: u.total_bookings,
  login_type: u.login_type,
  last_booking_at: u.last_booking_at,
  created_at: new Date(u.created_at)
});

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
  const [isLoading, setIsLoading] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      const { items, total } = await getUsers({
        page: usersPage,
        pageSize: PAGE_SIZE,
        q: userQuery,
        status: statusFilter
      });
      setUsers(items.map(mapUserRow));
      setTotalUsers(total);
    } catch (err) {
      console.error('Lỗi load users:', err);
    } finally {
      setIsLoading(false);
    }
  }, [usersPage, userQuery, statusFilter]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const usersTotalPages = useMemo(() => Math.max(1, Math.ceil(totalUsers / PAGE_SIZE)), [totalUsers]);

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
        usersLength={totalUsers}
        onRefresh={loadUsers}
        isLoading={isLoading}
      />
    </AdminLayout>
  );
}
