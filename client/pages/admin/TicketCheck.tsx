import React, { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import TicketCheckContent from "@/components/admin/content/TicketCheckContent";

export default function TicketCheckPage() {
  const [active, setActive] = useState<"dashboard" | "users" | "movies" | "toys" | "showtimes" | "transactions" | "tickets" | "ticket-check">("ticket-check");

  const handleLogout = () => {
    localStorage.removeItem("admin-token");
    window.location.href = "/admin";
  };

  const adminEmail = localStorage.getItem("admin-email") || "";

  return (
    <AdminLayout
      active={active}
      setActive={setActive}
      adminEmailState={adminEmail}
      handleLogout={handleLogout}
    >
      <TicketCheckContent />
    </AdminLayout>
  );
}
