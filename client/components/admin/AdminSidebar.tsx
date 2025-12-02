import { SidebarHeader, SidebarContent, SidebarFooter, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { LayoutDashboard, UserCircle, Home, Film, Gamepad2, CreditCard, Ticket, LogOut } from "lucide-react";
import React from "react";

interface AdminSidebarProps {
  active: string;
  // Dùng string hoặc union types rộng hơn nếu cần, nhưng tạm thời dùng các loại đã xác định
  setActive: (type: "dashboard" | "users" | "movies" | "toys" | "showtimes" | "transactions") => void;
  handleLogout: () => void;
}

const AdminSidebar: React.FC<AdminSidebarProps> = ({ active, setActive, handleLogout }) => {
  return (
    <>
      <SidebarHeader>
        <div className="px-2 text-sm">Quản lý</div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {/* Các mục menu quản lý hiện tại */}
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Bảng điều khiển" isActive={active === "dashboard"} onClick={() => setActive("dashboard")}>
              <LayoutDashboard className="mr-2" /> Bảng điều khiển
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Người dùng" isActive={active === "users"} onClick={() => setActive("users")}>
              <UserCircle className="mr-2" /> Người dùng
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Phim" isActive={active === "movies"} onClick={() => setActive("movies")}>
              <Film className="mr-2" /> Phim
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Lịch chiếu" isActive={active === "showtimes"} onClick={() => setActive("showtimes")}>
              <Ticket className="mr-2" /> Lịch chiếu
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Đồ chơi" isActive={active === "toys"} onClick={() => setActive("toys")}>
              <Gamepad2 className="mr-2" /> Đồ chơi
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Giao dịch" isActive={active === "transactions"} onClick={() => setActive("transactions")}>
              <CreditCard className="mr-2" /> Giao dịch
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="p-0">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Đăng xuất"
              onClick={handleLogout}
            >
              <LogOut className="mr-2" /> Đăng xuất
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
};

export default AdminSidebar;