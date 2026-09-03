import { Button } from '@/components/ui/button';
import { Check, ChevronDown, MapPin, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTrigger, SheetClose, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from '@/components/ui/dropdown-menu';

interface MobileMenuProps {
  navItems: Array<{ label: string; target: string }>;
  effectiveDisable: boolean;
  scrollToSection: (id: string) => void;
  userName: string | null;
  onNavigate: (path: string) => void;
  onLogout: () => void;
  onLogin: () => void;
  onRegister: () => void;
  branches?: any[];
  selectedBranch?: any;
  selectBranch?: (branchId: number) => void;
  isBookingFlow?: boolean;
  totalCartCount?: number;
  onOpenCart?: () => void;
}

export function MobileMenu({
  navItems,
  effectiveDisable,
  scrollToSection,
  userName,
  onNavigate,
  onLogout,
  onLogin,
  onRegister,
  branches = [],
  selectedBranch = null,
  selectBranch = () => {},
  isBookingFlow = false,
  totalCartCount = 0,
  onOpenCart = () => {}
}: MobileMenuProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="default"
          aria-label="Mở menu điều hướng"
          className="bg-white/10 backdrop-blur-md border-white/20 text-white w-10 h-10 hover:bg-white/20 touch-manipulation select-none active:scale-95 transition-transform"
        >
          <Menu className="h-6 w-6" />
        </Button>
      </SheetTrigger>

      <SheetContent
        side="top"
        className="w-full h-[100dvh] bg-[#050915] border-none text-white p-0 [&>button]:hidden z-[60] touch-manipulation"
      >
        <SheetTitle className="sr-only">Menu di động</SheetTitle>
        <SheetDescription className="sr-only">Điều hướng nhanh các mục trong Cinesphere</SheetDescription>
        <div className="flex flex-col h-full p-6 sm:p-8">
          {/* Header panel */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3" onClick={() => onNavigate('/')}>
              <img
                src="/icon.svg"
                alt="CINESPHERE"
                className="h-20 w-20 cursor-pointer drop-shadow-[0_0_20px_rgba(59,130,246,0.5)]"
              />
            </div>

            <SheetClose className="rounded-full p-2 border border-white/20 hover:bg-white/10 hover:border-white transition-all duration-300">
              <X className="h-8 w-8 text-white" />
              <span className="sr-only">Close</span>
            </SheetClose>
          </div>

          {/* Branch selector */}
          {branches.length > 0 && selectedBranch && (
            <div className={cn('mb-5', isBookingFlow && 'opacity-60')}>
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-cyan-400" /> Chi Nhánh
                </span>
                {isBookingFlow && <span className="text-[10px] text-amber-400 font-medium">Đang đặt vé</span>}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger
                  disabled={isBookingFlow}
                  className={cn(
                    'w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white text-sm font-semibold transition-all duration-200 backdrop-blur-md outline-none focus:outline-none select-none group',
                    isBookingFlow ? 'cursor-not-allowed' : 'cursor-pointer'
                  )}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span className="truncate">{selectedBranch.name}</span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="bottom"
                  align="start"
                  className="w-[calc(100vw-3rem)] max-w-sm bg-[#0b1226]/95 backdrop-blur-2xl border border-white/20 p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.8)] rounded-2xl z-[100]"
                >
                  <div className="space-y-1 max-h-52 overflow-y-auto custom-scrollbar">
                    {branches.map((branch) => {
                      const isSelected = selectedBranch?.id === branch.id;
                      return (
                        <DropdownMenuItem
                          key={branch.id}
                          onClick={() => selectBranch(branch.id)}
                          className={cn(
                            'flex items-center justify-between px-3.5 py-3 rounded-xl cursor-pointer text-sm font-semibold transition-all duration-200 outline-none',
                            isSelected
                              ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/10 text-cyan-300 border border-cyan-500/30'
                              : 'text-slate-300 hover:text-white focus:bg-white/10 focus:text-white border border-transparent'
                          )}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <MapPin className={cn('w-4 h-4 shrink-0', isSelected ? 'text-cyan-400' : 'text-slate-400')} />
                            <span className="truncate">{branch.name}</span>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-cyan-400 shrink-0 ml-2" />}
                        </DropdownMenuItem>
                      );
                    })}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          {/* Navigation items */}
          <nav className="flex flex-col gap-2 flex-1 overflow-y-auto">
            <SheetClose asChild>
              <button
                className="flex items-center justify-between font-medium text-lg tracking-wide transition-colors duration-300 py-3 border-b border-white/5 text-cyan-300 hover:text-cyan-200"
                onClick={onOpenCart}
              >
                <span>Giỏ hàng</span>
                {totalCartCount > 0 && (
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-cyan-500 text-black">
                    {totalCartCount}
                  </span>
                )}
              </button>
            </SheetClose>

            {navItems.map((item) => (
              <SheetClose key={item.target} asChild>
                <button
                  className="text-left font-medium text-lg tracking-wide transition-colors duration-300 py-3 border-b border-white/5 text-white hover:text-cyan-300"
                  onClick={() => scrollToSection(item.target)}
                >
                  {item.label}
                </button>
              </SheetClose>
            ))}

            {userName && (
              <SheetClose asChild>
                <button
                  className="text-left font-medium text-lg tracking-wide transition-colors duration-300 py-3 border-b border-white/5 text-white hover:text-cyan-300"
                  onClick={() => onNavigate('/account')}
                >
                  Tài khoản ({userName})
                </button>
              </SheetClose>
            )}
          </nav>

          {/* Account section at bottom */}
          <div className="mt-auto pt-8">
            {userName ? (
              <SheetClose asChild>
                <Button
                  className="w-full h-12 text-base font-semibold rounded-full bg-red-600 hover:bg-red-700 text-white shadow-lg"
                  onClick={onLogout}
                >
                  Đăng xuất
                </Button>
              </SheetClose>
            ) : (
              <div className="grid gap-3">
                <SheetClose asChild>
                  <Button
                    className="w-full h-12 text-base font-semibold rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
                    onClick={onLogin}
                  >
                    Đăng nhập
                  </Button>
                </SheetClose>
                <SheetClose asChild>
                  <Button
                    variant="outline"
                    className="w-full h-12 text-base font-semibold rounded-full bg-white border-white text-black hover:bg-gray-100 hover:text-black"
                    onClick={onRegister}
                  >
                    Đăng ký
                  </Button>
                </SheetClose>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
