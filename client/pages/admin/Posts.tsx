import React, { useState } from 'react';
import AdminLayout from '@/admin/layouts/AdminLayout';
import { PostManagement } from '@/components/admin/content/PostManagement';
<<<<<<< HEAD

export default function PostsPage() {
        const [active, setActive] = useState<
                | 'dashboard'
                | 'users'
                | 'movies'
                | 'toys'
                | 'posts'
                | 'transactions'
                | 'tickets'
                | 'ticket-check'
                | 'uploads'
                | 'email-logs'
                | 'settings'
        >('posts');

        const handleLogout = () => {
                localStorage.removeItem('adminToken');
                localStorage.removeItem('adminEmail');
                window.dispatchEvent(new Event('admin-auth-changed'));
                window.location.href = '/';
        };

        const adminEmail = localStorage.getItem('adminEmail') || '';

        return (
                <AdminLayout active={active} setActive={setActive} adminEmailState={adminEmail} handleLogout={handleLogout}>
                        <PostManagement />
                </AdminLayout>
        );
=======
import { useStaffStore } from '@/store/staffStore';
import { useNavigate } from 'react-router-dom';

export default function PostsPage() {
  const navigate = useNavigate();
  const staff = useStaffStore((state) => state.staff);
  const clearStaff = useStaffStore((state) => state.clearStaff);
  const [active, setActive] = useState<
    | 'dashboard'
    | 'users'
    | 'movies'
    | 'toys'
    | 'posts'
    | 'transactions'
    | 'tickets'
    | 'ticket-check'
    | 'uploads'
    | 'email-logs'
    | 'settings'
    | 'branches'
    | 'staff'
    | 'roles'
    | 'audit-logs'
  >('posts');

  const handleLogout = () => {
    localStorage.removeItem('staffToken');
    clearStaff();
    navigate('/login');
  };

  return (
    <AdminLayout
      active={active}
      setActive={setActive}
      adminEmailState={staff?.email || 'admin@email.com'}
      handleLogout={handleLogout}
    >
      <PostManagement />
    </AdminLayout>
  );
>>>>>>> preview
}
