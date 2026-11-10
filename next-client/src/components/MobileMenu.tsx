import { Button } from '@/components/ui/button';
import { MapPin, Menu, Phone, ShoppingCart, X } from 'lucide-react';
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

// The hotline shown in the menu: the branch's own, else the site-wide one
const DEFAULT_HOTLINE = '036 643 1179';

function branchHotline(branch: any): string {
  if (branch?.phone) return String(branch.phone);
  try {
    const settings = typeof branch?.settings === 'string' ? JSON.parse(branch.settings) : branch?.settings;
    if (settings?.hotline) return String(settings.hotline);
  } catch {
    // A broken settings text means "use the default"
  }
  return DEFAULT_HOTLINE;
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
          className="relative before:absolute before:-inset-1.5 before:content-[''] bg-white/10 backdrop-blur-md border-white/20 text-white h-8 w-8 sm:h-9 sm:w-9 p-0 rounded-full hover:bg-white/20 touch-manipulation select-none active:scale-95 transition-transform flex items-center justify-center"
        >
          <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
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
                alt="Cinesphere"
                className="h-14 w-14 cursor-pointer drop-shadow-[0_0_20px_rgba(59,130,246,0.5)]"
              />
            </div>

            <SheetClose className="rounded-full p-2 border border-white/20 hover:bg-white/10 hover:border-white transition-all duration-300">
              <X className="h-8 w-8 text-white" />
              <span className="sr-only">Đóng</span>
            </SheetClose>
          </div>



          {/* Navigation items */}
          <nav className="flex flex-col gap-2 flex-1 overflow-y-auto">
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

            {/* The cart sits with the other links now: same look, an icon, and the count */}
            <SheetClose asChild>
              <button
                className="flex items-center justify-between font-medium text-lg tracking-wide transition-colors duration-300 py-3 border-b border-white/5 text-white hover:text-cyan-300"
                onClick={onOpenCart}
              >
                <span className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-cyan-400" />
                  Giỏ hàng
                </span>
                {totalCartCount > 0 && (
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-cyan-500 text-black">
                    {totalCartCount}
                  </span>
                )}
              </button>
            </SheetClose>

            {userName && (
              <SheetClose asChild>
                <button
                  className="text-left transition-colors duration-300 py-3 border-b border-white/5 text-white hover:text-cyan-300"
                  onClick={() => onNavigate('/account')}
                >
                  <span className="block font-medium text-lg tracking-wide">Vé &amp; tài khoản của tôi</span>
                  <span className="block text-sm text-slate-400 truncate">{userName}</span>
                </button>
              </SheetClose>
            )}

            {/* Branch and hotline: what a customer reaches for most */}
            <div className="py-4 space-y-3">
              {branches.length > 1 && (
                <div className="space-y-2">
                  <p className="flex items-center gap-1.5 text-xs uppercase tracking-widest font-bold text-slate-400">
                    <MapPin className="h-3.5 w-3.5 text-cyan-400" /> Chi nhánh
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {branches.map((branch: any) => {
                      const isSelected = selectedBranch?.id === branch.id;
                      return (
                        <SheetClose asChild key={branch.id}>
                          <button
                            type="button"
                            disabled={isBookingFlow}
                            onClick={() => selectBranch(branch.id)}
                            className={cn(
                              'min-h-[44px] px-4 rounded-full border text-sm font-semibold transition-colors disabled:opacity-60',
                              isSelected
                                ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-200'
                                : 'bg-white/5 border-white/15 text-slate-200 hover:bg-white/10'
                            )}
                          >
                            {branch.name}
                          </button>
                        </SheetClose>
                      );
                    })}
                  </div>
                  {isBookingFlow && (
                    <p className="text-xs text-slate-400">Đang đặt vé nên chưa đổi được chi nhánh.</p>
                  )}
                </div>
              )}
              <a
                href={`tel:${branchHotline(selectedBranch).replace(/[^0-9+]/g, '')}`}
                className="inline-flex items-center gap-2 min-h-[44px] text-base font-semibold text-cyan-300 hover:text-cyan-200"
              >
                <Phone className="h-4 w-4" />
                Hotline {branchHotline(selectedBranch)}
              </a>
            </div>
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
