'use client';

import { Check, ChevronDown, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from '@/components/ui/dropdown-menu';

interface BranchSelectorProps {
  branches: Array<{ id: number; name: string }>;
  selectedBranch: { id: number; name: string };
  // True while the customer is booking: the branch cannot change then
  disabled: boolean;
  onChange: (branchId: number) => void;
}

// "HCM | CN Vạn Hạnh Mall" -> "Vạn Hạnh Mall": the chip has little room, the city and "CN" add nothing there.
// The full name stays in the chip's tooltip and in the list.
function shortBranchName(name: string): string {
  const afterCity = name.includes('|') ? name.split('|').slice(1).join('|') : name;
  return afterCity.replace(/^\s*CN\s+/i, '').trim() || name;
}

// The "chip" in the header that shows the current branch and lets the customer pick another one
export default function BranchSelector({ branches, selectedBranch, disabled, onChange }: BranchSelectorProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        title={selectedBranch.name}
        className={cn(
          'group relative flex items-center gap-1 sm:gap-2 min-h-8 py-1 sm:py-0 sm:h-9 px-2.5 sm:px-3.5 rounded-2xl sm:rounded-full text-xs font-semibold before:absolute before:-inset-1.5 before:content-[""] text-slate-200 hover:text-white transition-all duration-300 bg-white/[0.07] hover:bg-white/[0.14] border border-white/15 hover:border-cyan-400/50 backdrop-blur-md outline-none focus:outline-none select-none',
          disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
        )}
      >
        <MapPin className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform shrink-0" />
        {/* Phones: up to two small lines, so "AEON MALL Bình Dương Canary" is not cut to "AEON MALL Bìn..." */}
        <span className="line-clamp-2 max-w-[92px] whitespace-normal break-words text-left text-[11px] leading-tight min-[360px]:max-w-[108px] min-[380px]:max-w-[118px] sm:line-clamp-1 sm:max-w-[180px] sm:text-xs">
          {shortBranchName(selectedBranch.name)}
        </span>
        <ChevronDown className="w-3 h-3 text-slate-400 group-hover:text-white transition-transform duration-200 group-data-[state=open]:rotate-180 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="bottom"
        align="end"
        className="bg-[#0b1226] backdrop-blur-2xl border border-white/20 p-1.5 min-w-[260px] max-w-[calc(100vw-2rem)] shadow-[0_20px_50px_rgba(0,0,0,0.6)] animate-in fade-in-0 zoom-in-95 rounded-2xl z-[100]"
      >
        <div className="px-3 py-2 text-xs uppercase font-bold text-cyan-400/80 tracking-widest border-b border-white/5 mb-1 flex items-center justify-between">
          <span>Chọn Chi Nhánh</span>
          <MapPin className="w-3 h-3 text-cyan-400/60" />
        </div>
        <div className="space-y-1">
          {branches.map((branch) => {
            const isSelected = branch.id === selectedBranch.id;
            return (
              <DropdownMenuItem
                key={branch.id}
                onClick={() => onChange(branch.id)}
                className={cn(
                  'flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer text-xs font-semibold transition-all duration-200 outline-none',
                  isSelected
                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/10 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-100 hover:text-white focus:bg-white/10 focus:text-white border border-transparent'
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <MapPin className={cn('w-3.5 h-3.5 shrink-0', isSelected ? 'text-cyan-400' : 'text-slate-300')} />
                  <span className="whitespace-normal leading-snug">{branch.name}</span>
                </div>
                {isSelected && <Check className="w-4 h-4 text-cyan-400 shrink-0 ml-2" />}
              </DropdownMenuItem>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
