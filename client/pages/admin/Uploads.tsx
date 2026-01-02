import React, { useState } from "react";
import AdminLayout from "@/admin/layouts/AdminLayout";
import UploadsContent from "@/components/admin/content/UploadsContent";

export default function UploadsPage() {
        const [active, setActive] = useState<
                "dashboard" | "users" | "movies" | "toys" | "transactions" | "tickets" | "ticket-check" | "uploads" | "email-logs" | "settings"
        >("uploads");

        const handleLogout = () => {
                localStorage.removeItem("adminToken");
                localStorage.removeItem("adminEmail");
                window.dispatchEvent(new Event("admin-auth-changed"));
                window.location.href = "/admin";
        };

        const adminEmail = localStorage.getItem("adminEmail") || "";

        return (
                <AdminLayout
                        active={active}
                        setActive={setActive}
                        adminEmailState={adminEmail}
                        handleLogout={handleLogout}
                >
                        <UploadsContent />
                </AdminLayout>
        );
}
