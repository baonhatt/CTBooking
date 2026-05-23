'use client';
import { User, LogOut, Settings, LayoutDashboard, UserCircle } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface UserMenuProps {
  userName: string;
  tooltipPrefix?: string;
  extraMenuOptions: Array<{ label: string; action: () => void }>;
  onNavigateAccount: () => void;
  onLogout: () => void;
}

export function UserMenu({ userName, tooltipPrefix, extraMenuOptions, onNavigateAccount, onLogout }: UserMenuProps) {
  const getIconForLabel = (label: string) => {
    const l = label.toLowerCase();
    if (l.includes('admin') || l.includes('quản trị') || l.includes('dashboard')) {
      return <LayoutDashboard className="h-4 w-4" />;
    }
    return <Settings className="h-4 w-4" />;
  };

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 group outline-none focus:outline-none">
              <div className="w-10 h-10 rounded-full bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center group-hover:border-blue-500/50 group-hover:bg-blue-500/10 transition-all duration-500 shadow-inner overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <User className="h-5 w-5 text-white/70 group-hover:text-blue-400 transition-colors duration-300 relative z-10" />
              </div>
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="center"
          className="bg-neutral-900/90 backdrop-blur-md border border-white/10 text-white text-xs py-1.5 px-3 rounded-lg shadow-xl"
        >
          {(tooltipPrefix || 'Chào') + ', ' + (userName || 'bạn')}
        </TooltipContent>
      </Tooltip>

      <DropdownMenuContent
        side="bottom"
        align="end"
        className="bg-[#0a0a0a]/95 backdrop-blur-2xl border border-white/10 p-1.5 min-w-[240px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 rounded-2xl z-[100]"
      >
        <DropdownMenuLabel className="px-4 py-4 select-none">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-[0.12em] font-bold text-blue-500/90">
              Tài khoản cá nhân
            </span>
            <span className="text-base font-bold text-white leading-tight truncate">{userName}</span>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="bg-white/5 mx-1" />

        <div className="p-1.5 space-y-1">
          <DropdownMenuItem
            onClick={onNavigateAccount}
            className="flex items-center gap-3.5 px-3 py-3 rounded-xl cursor-pointer text-white/80 hover:text-white focus:bg-white/5 focus:text-white transition-all duration-200 group border border-transparent focus:border-white/5"
          >
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform duration-300">
              <UserCircle className="h-5 w-5" />
            </div>
            <span className="text-[15px] font-semibold tracking-wide">Hồ sơ của tôi</span>
          </DropdownMenuItem>

          {extraMenuOptions.map((opt, idx) => (
            <DropdownMenuItem
              key={`extra-${idx}`}
              onClick={opt.action}
              className="flex items-center gap-3.5 px-3 py-3 rounded-xl cursor-pointer text-white/80 hover:text-white focus:bg-white/5 focus:text-white transition-all duration-200 group border border-transparent focus:border-white/5"
            >
              <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-transform duration-300">
                {getIconForLabel(opt.label)}
              </div>
              <span className="text-[15px] font-semibold tracking-wide">{opt.label}</span>
            </DropdownMenuItem>
          ))}
        </div>

        <DropdownMenuSeparator className="bg-white/5 mx-1" />

        <div className="p-1.5">
          <DropdownMenuItem
            onClick={onLogout}
            className="flex items-center gap-3.5 px-3 py-3 rounded-xl cursor-pointer text-red-400 focus:bg-red-500/5 focus:text-red-400 transition-all duration-200 group border border-transparent focus:border-red-500/5"
          >
            <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500 group-hover:scale-105 transition-transform duration-300">
              <LogOut className="h-5 w-5" />
            </div>
            <span className="text-[15px] font-semibold tracking-wide">Đăng xuất</span>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
