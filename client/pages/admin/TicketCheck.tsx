import React, { useState } from 'react';
import AdminLayout from '@/admin/layouts/AdminLayout';
import TicketCheckContent from '@/components/admin/content/TicketCheckContent';

export default function TicketCheckPage() {
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
  >('ticket-check');

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminEmail');
    window.dispatchEvent(new Event('admin-auth-changed'));
    window.location.href = '/';
  };

  const adminEmail = localStorage.getItem('adminEmail') || '';

  return (
    <AdminLayout active={active} setActive={setActive} adminEmailState={adminEmail} handleLogout={handleLogout}>
      <TicketCheckContent />
    </AdminLayout>
  );
}
