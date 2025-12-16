import React from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import iconCine from "@/assets/images/iconCine.svg";
import {
  LayoutDashboard,
  Users as UsersIcon,
  Clapperboard,
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
  | "transactions"
  | "tickets"
  | "ticket-check"
  | "uploads";
  setActive: (x: Props["active"]) => void;
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
    `w-full justify-start gap-2 rounded-md ${isActive ? "bg-white/10 text-white" : "text-white/90"} hover:bg-white/10`;

  const menu = [
    { key: "dashboard" as const, label: "Bảng điều khiển", icon: <LayoutDashboard className="h-4 w-4" /> },
    { key: "users" as const, label: "Người dùng", icon: <UsersIcon className="h-4 w-4" /> },
    { key: "movies" as const, label: "Phim", icon: <Clapperboard className="h-4 w-4" /> },
    { key: "toys" as const, label: "Đồ chơi", icon: <Package className="h-4 w-4" /> },
    { key: "tickets" as const, label: "Gói vé", icon: <TicketIcon className="h-4 w-4" /> },
    { key: "transactions" as const, label: "Giao dịch", icon: <CreditCard className="h-4 w-4" /> },
    { key: "ticket-check" as const, label: "Kiểm Tra Vé", icon: <ScanLine className="h-4 w-4" /> },
    { key: "uploads" as const, label: "Uploads", icon: <Clapperboard className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen grid grid-cols-[260px_1fr]">
      <aside className="sticky top-0 h-screen overflow-y-auto bg-gradient-to-b from-[#0e1b3d] to-[#15325f] border-r border-white/10 p-4 text-white">
        <div className="flex items-center gap-3 mb-4 px-1">
          <img src={iconCine} alt="CINESPHERE" className="h-10 w-auto" />
          <div className="font-bold tracking-widest">CINESPHERE ADMIN</div>
        </div>
        <div className="text-xs text-white/70 mb-3">{adminEmailState}</div>
        <div className="space-y-1">
          {menu.map((item) => (
            <Button
              key={item.key}
              variant="ghost"
              onClick={() => go(item.key)}
              className={itemClass(active === item.key)}
            >
              {item.icon} {item.label}
            </Button>
          ))}
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

