'use client';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTrigger, SheetClose, SheetTitle, SheetDescription } from '@/components/ui/sheet';

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
        selectBranch = () => { },
        isBookingFlow = false
}: MobileMenuProps) {
        return (
                <Sheet>
                        <SheetTrigger asChild>
                                <Button
                                        variant="default"
                                        className="bg-white/10 backdrop-blur-md border-white/20 text-white w-10 h-10 hover:bg-white/20"
                                >
                                        <Menu className="h-6 w-6" />
                                </Button>
                        </SheetTrigger>

                        <SheetContent
                                side="top"
                                className="w-full h-[100dvh] bg-[#050915] border-none text-white p-0 [&>button]:hidden z-[60]"
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
                                        {branches.length > 0 && (
                                                <div className={cn("mb-4", isBookingFlow && "opacity-60")}>
                                                        <label className="text-xs font-bold text-white/50 uppercase tracking-widest mb-2 block">Chi nhánh</label>
                                                        <select
                                                                value={selectedBranch?.id || ''}
                                                                disabled={isBookingFlow}
                                                                onChange={(e) => {
                                                                        selectBranch(Number(e.target.value));
                                                                }}
                                                                className={cn(
                                                                        "w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500",
                                                                        isBookingFlow ? "cursor-not-allowed" : "cursor-pointer"
                                                                )}
                                                        >
                                                                {branches.map((branch) => (
                                                                        <option key={branch.id} value={branch.id} className="bg-gray-900 text-white">
                                                                                {branch.name}
                                                                        </option>
                                                                ))}
                                                        </select>
                                                </div>
                                        )}

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
