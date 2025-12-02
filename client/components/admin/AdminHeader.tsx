import { SidebarTrigger } from "@/components/ui/sidebar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import React from "react";

interface AdminHeaderProps {
  adminEmailState: string;
  handleLogout: () => void;
}

const AdminHeader: React.FC<AdminHeaderProps> = ({ adminEmailState, handleLogout }) => {
  return (
    <div className="border-b px-6 py-3 flex items-center justify-between bg-white/80">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
        <div className="font-semibold">Bảng điều khiển</div>
      </div>
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 rounded-lg px-2 py-1 hover:bg-black/5">
              <div className="text-sm text-gray-700">{adminEmailState}</div>
              <Avatar className="h-8 w-8">
                <AvatarImage src="" />
                <AvatarFallback>{(adminEmailState?.split("@")[0] || "AD").slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-white">
            <DropdownMenuItem disabled>Quản trị viên</DropdownMenuItem>
            <DropdownMenuSeparator />
            {/* Logic Đăng xuất được gọi từ prop */}
            <DropdownMenuItem onClick={handleLogout}>Đăng xuất</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export default AdminHeader;