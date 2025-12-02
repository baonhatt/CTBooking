import { SidebarProvider, Sidebar, SidebarRail, SidebarInset } from "@/components/ui/sidebar";
import AdminSidebar from "./AdminSidebar";
import AdminHeader from "./AdminHeader";
import React from "react";

interface AdminLayoutProps {
  children: React.ReactNode;
  active: string;
  setActive: (type: any) => void;
  adminEmailState: string;
  handleLogout: () => void;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children, active, setActive, adminEmailState, handleLogout }) => {
  return (
    // Toàn bộ khối SidebarProvider được chuyển vào đây
    <SidebarProvider
      style={{
        "--sidebar-background": "220 60% 6%",
        "--sidebar-foreground": "0 0% 98%",
        "--sidebar-border": "220 20% 20%",
        "--sidebar-accent": "0 0% 98%",
        "--sidebar-accent-foreground": "240 5.9% 10%",
        "--sidebar-ring": "217.2 91.2% 59.8%",
      } as React.CSSProperties}
    >
      <Sidebar collapsible="icon" className="bg-[#0a1220] text-white">
        {/* Render Sidebar component mới */}
        <AdminSidebar active={active} setActive={setActive} handleLogout={handleLogout} />
      </Sidebar>
      <SidebarRail />
      <SidebarInset>
        {/* Render Header component mới */}
        <AdminHeader adminEmailState={adminEmailState} handleLogout={handleLogout} />
        <div className="p-6">
          {children} {/* Nội dung chính của trang Admin */}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default AdminLayout;