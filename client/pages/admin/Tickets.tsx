import React, { useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import TicketsContent from "@/components/admin/content/TicketsContent";
import { getTickets, deleteTicketApi } from "@/lib/api";

interface TicketPackage {
  id: number;
  name: string;
  code?: string;
  description?: string;
  price: number;
  features?: string[];
  type?: string;
  min_group_size?: number;
  max_group_size?: number;
  is_member_only?: boolean;
  is_active?: boolean;
  display_order?: number;
}

export default function TicketsPage() {
  const [tickets, setTickets] = useState<TicketPackage[]>([]);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [total, setTotal] = useState(0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editData, setEditData] = useState<any>(null);

  const handleRefresh = async () => {
    const { items, total } = await getTickets({ page, pageSize });
    setTickets(
      items.map((t: any) => ({
        id: t.id,
        name: t.name,
        code: t.code || undefined,
        description: t.description || undefined,
        price: Number(t.price),
        features: Array.isArray(t.features) ? t.features : [],
        type: t.type || undefined,
        min_group_size: t.min_group_size ?? undefined,
        max_group_size: t.max_group_size ?? undefined,
        is_member_only: !!t.is_member_only,
        is_active: t.is_active ?? true,
        display_order: t.display_order ?? 0,
      })),
    );
    setTotal(total);
  };

  useEffect(() => {
    handleRefresh();
  }, [page]);

  const openCreate = () => {
    setEditData({ id: 0, name: "", price: 0, is_active: true, features: [] });
    setIsEditOpen(true);
  };

  const openEdit = (data: any) => {
    setEditData({ ...data });
    setIsEditOpen(true);
  };

  return (
    <AdminLayout
      active="tickets"
      setActive={() => { }}
      adminEmailState={localStorage.getItem("adminEmail") || "admin@email.com"}
      handleLogout={() => { }}
    >
      <TicketsContent
        data={tickets}
        totalPages={totalPages}
        currentPage={page}
        setPage={setPage}
        onCreate={openCreate}
        onEdit={(data) => openEdit(data)}
        setTickets={setTickets}
        isEditOpen={isEditOpen}
        setIsEditOpen={setIsEditOpen}
        editData={editData}
        setEditData={setEditData}
        onRefresh={handleRefresh}
        deleteTicketApi={deleteTicketApi as any}
      />
    </AdminLayout>
  );
}
