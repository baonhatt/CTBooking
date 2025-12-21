import { User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface UserMenuProps {
  userName: string;
  tooltipPrefix?: string;
  extraMenuOptions: Array<{ label: string; action: () => void }>;
  onNavigateAccount: () => void;
  onLogout: () => void;
}

export function UserMenu({ 
  userName, 
  tooltipPrefix, 
  extraMenuOptions, 
  onNavigateAccount, 
  onLogout 
}: UserMenuProps) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 text-white font-medium hover:text-cyan-300 transition-colors duration-300">
              <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center hover:border-cyan-400 hover:bg-cyan-500/20 transition-all duration-300 shadow-lg">
                <User className="h-5 w-5" />
              </div>
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="center" className="bg-black/90 border border-white/20 text-white">
          {(tooltipPrefix || "Chào") + ", " + (userName || "bạn")}
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent side="bottom" align="end" className="bg-black/90 border border-white/20 text-white">
        <DropdownMenuItem onClick={onNavigateAccount}>
          Tài khoản
        </DropdownMenuItem>
        {extraMenuOptions.map((opt, idx) => (
          <DropdownMenuItem key={`extra-${idx}`} onClick={opt.action}>
            {opt.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem onClick={onLogout}>
          Đăng xuất
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}