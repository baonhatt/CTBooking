import React, { useState } from 'react';
import AdminLayout from '@/admin/layouts/AdminLayout';
import ActionItemsContent from '@/components/admin/content/ActionItemsContent';
import { useStaffStore } from '@/store/staffStore';

// "Đơn cần xử lý": unmatched transfers, orders not confirmed automatically, emails that failed
export default function ActionItemsPage() {
  const staff = useStaffStore((state) => state.staff);
  const [active, setActive] = useState<'action-items'>('action-items');

  return (
    <AdminLayout active={active as any} setActive={setActive as any} adminEmailState={staff?.email || ''} handleLogout={() => undefined}>
      <ActionItemsContent />
    </AdminLayout>
  );
}
