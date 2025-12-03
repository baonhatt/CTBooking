import React from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface Props {
  active:
    | "dashboard"
    | "users"
    | "movies"
    | "toys"
    | "showtimes"
    | "transactions"
    | "tickets";
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
    navigate(`/admin/${tab === "dashboard" ? "dashboard" : tab}`);
  }
  return (
    <div className="min-h-screen grid grid-cols-[240px_1fr]">
      <div className="border-r p-3 space-y-2">
        <div className="text-sm">{adminEmailState}</div>
        <div className="space-y-1">
          <Button
            variant={active === "dashboard" ? "default" : "outline"}
            onClick={() => go("dashboard")}
            className="w-full"
          >
            Bảng điều khiển
          </Button>
          <Button
            variant={active === "users" ? "default" : "outline"}
            onClick={() => go("users")}
            className="w-full"
          >
            Người dùng
          </Button>
          <Button
            variant={active === "movies" ? "default" : "outline"}
            onClick={() => go("movies")}
            className="w-full"
          >
            Phim
          </Button>
          <Button
            variant={active === "showtimes" ? "default" : "outline"}
            onClick={() => go("showtimes")}
            className="w-full"
          >
            Lịch chiếu
          </Button>
          <Button
            variant={active === "toys" ? "default" : "outline"}
            onClick={() => go("toys")}
            className="w-full"
          >
            Đồ chơi
          </Button>
          <Button
            variant={active === "tickets" ? "default" : "outline"}
            onClick={() => go("tickets")}
            className="w-full"
          >
            Gói vé
          </Button>
          <Button
            variant={active === "transactions" ? "default" : "outline"}
            onClick={() => go("transactions")}
            className="w-full"
          >
            Giao dịch
          </Button>
        </div>
        <Button variant="destructive" onClick={handleLogout} className="w-full">
          Đăng xuất
        </Button>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}
