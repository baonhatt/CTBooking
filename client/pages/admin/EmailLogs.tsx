import React, { useState } from 'react';
import AdminLayout from '@/admin/layouts/AdminLayout';
import EmailLogsContent from '@/components/admin/content/EmailLogsContent';

export default function EmailLogsPage() {
  const [active, setActive] = useState<
    | 'dashboard'
    | 'users'
    | 'movies'
    | 'toys'
    | 'transactions'
    | 'tickets'
    | 'ticket-check'
    | 'uploads'
    | 'email-logs'
    | 'settings'
  >('email-logs');

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminEmail');
    window.dispatchEvent(new Event('admin-auth-changed'));
    window.location.href = '/';
  };

  const adminEmail = localStorage.getItem('adminEmail') || '';

  return (
    <AdminLayout
      active={active as any}
      setActive={setActive as any}
      adminEmailState={adminEmail}
      handleLogout={handleLogout}
    >
      <EmailLogsContent />
    </AdminLayout>
  );
}
