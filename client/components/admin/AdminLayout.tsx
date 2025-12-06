import React from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import iconCine from "@/assets/images/iconCine.svg";
import {
  LayoutDashboard,
  Users as UsersIcon,
  Clapperboard,
  CalendarDays,
  Package,
  Ticket as TicketIcon,
  CreditCard,
  ScanLine,
  LogOut,
} from "lucide-react";

interface Props {
  active:
  | "dashboard"
  | "users"
  | "movies"
  | "toys"
  | "showtimes"
  | "transactions"
  | "tickets"
  | "ticket-check";
  setActive: (x: any) => void;
  adminEmailState: string;
  handleLogout: () => void;
  children: React.ReactNode;
}

export default function AdminLayout({
  active,
  setActive,
  adminEmailState,
  handleLogout,
  children,
}: Props) {
  const navigate = useNavigate();
  function go(tab: Props["active"]) {
    setActive(tab);
    if (tab === "ticket-check") {
      navigate("/admin/ticket-check");
    } else {
      navigate(`/admin/${tab === "dashboard" ? "dashboard" : tab}`);
    }
  }
  const itemClass = (isActive: boolean) =>
    `w-full justify-start gap-2 rounded-md ${
      isActive ? "bg-white/10 text-white" : "text-white/90"
    } hover:bg-white/10`;

  return (
    <div className="min-h-screen grid grid-cols-[260px_1fr]">
      <aside className="sticky top-0 h-screen overflow-y-auto bg-gradient-to-b from-[#0e1b3d] to-[#15325f] border-r border-white/10 p-4 text-white">
        <div className="flex items-center gap-3 mb-4 px-1">
          <img src={iconCine} alt="CINESPHERE" className="h-10 w-auto" />
          <div className="font-bold tracking-widest">CINESPHERE ADMIN</div>
        </div>
        <div className="text-xs text-white/70 mb-3">{adminEmailState}</div>
        <div className="space-y-1">
          <Button
            variant="ghost"
            onClick={() => go("dashboard")}
            className={itemClass(active === "dashboard")}
          >
            <LayoutDashboard className="h-4 w-4" /> Bảng điều khiển
          </Button>
          <Button
            variant="ghost"
            onClick={() => go("users")}
            className={itemClass(active === "users")}
          >
            <UsersIcon className="h-4 w-4" /> Người dùng
          </Button>
          <Button
            variant="ghost"
            onClick={() => go("movies")}
            className={itemClass(active === "movies")}
          >
            <Clapperboard className="h-4 w-4" /> Phim
          </Button>
          <Button
            variant="ghost"
            onClick={() => go("showtimes")}
            className={itemClass(active === "showtimes")}
          >
            <CalendarDays className="h-4 w-4" /> Lịch chiếu
          </Button>
          <Button
            variant="ghost"
            onClick={() => go("toys")}
            className={itemClass(active === "toys")}
          >
            <Package className="h-4 w-4" /> Đồ chơi
          </Button>
          <Button
            variant="ghost"
            onClick={() => go("tickets")}
            className={itemClass(active === "tickets")}
          >
            <TicketIcon className="h-4 w-4" /> Gói vé
          </Button>
          <Button
            variant="ghost"
            onClick={() => go("transactions")}
            className={itemClass(active === "transactions")}
          >
            <CreditCard className="h-4 w-4" /> Giao dịch
          </Button>
          <Button
            variant="ghost"
            onClick={() => go("ticket-check")}
            className={itemClass(active === "ticket-check")}
          >
            <ScanLine className="h-4 w-4" /> Kiểm Tra Vé
          </Button>
        </div>
        <div className="mt-4">
          <Button
            variant="destructive"
            onClick={handleLogout}
            className="w-full justify-center gap-2"
          >
            <LogOut className="h-4 w-4" /> Đăng xuất
          </Button>
        </div>
      </aside>
      <main className="p-6">{children}</main>
    </div>
  );
}
