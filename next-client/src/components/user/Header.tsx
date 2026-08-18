'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useBranch } from '@/hooks/useBranch';

// Components

// Assets

import { useActiveSection } from '@/hooks/useActiveSection';
import { useAuthHandlers } from '@/hooks/useAuthHandlers';
import { useAuthState } from '@/hooks/useAuthState';
import { useScrollDetect } from '@/hooks/useScrollDetect';
import { NavItem } from '@/components/NavItem';
import { UserMenu } from '@/components/UserMenu';
import { NAV_ITEMS } from '@/components/constants';
import { HeaderProps, ErrorModalState } from '@/components/filetypes/IType.model';
import { MobileMenu } from '@/components/MobileMenu';
import { getCookie } from '@/lib/cookies';
import {
        AlertDialog,
        AlertDialogAction,
        AlertDialogCancel,
        AlertDialogContent,
        AlertDialogDescription,
        AlertDialogFooter,
        AlertDialogHeader,
        AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Calendar } from 'lucide-react';
const LoginDialog = dynamic(() => import('@/components/LoginDialog'), { ssr: false });
const RegisterDialog = dynamic(() => import('@/components/RegisterDialog'), { ssr: false });
const ForgetPasswordDialog = dynamic(() => import('@/components/ForgetPasswordDialog'), { ssr: false });
const ErrorModal = dynamic(() => import('@/components/ErrorModal'), { ssr: false });
const MovieSchedulePanel = dynamic(() => import('@/components/MovieSchedulePanel'), { ssr: false });

export default function Header({
        onBookClick = () => { },
        disableNav = false,
        tooltipPrefix,
        extraMenuOptions = [],
        forceDark = false
}: HeaderProps) {
        const auth = useAuth();
        const router = useRouter();
        const pathname = usePathname();
        const searchParams = useSearchParams();

        // Custom hooks
        const isScrolled = useScrollDetect(50);
        const isPostsRoute = pathname === '/bai-viet' || pathname.startsWith('/bai-viet/');
        const isBookingFlow = ['/booking', '/checkout', '/qr-payment', '/success-payment'].some(route => pathname.startsWith(route));
        const { userName, setUserName } = useAuthState(false);
        const effectiveDisable = disableNav || (pathname !== '/' && !isPostsRoute);
        const activeSection = useActiveSection(effectiveDisable);
        const { handleLogout } = useAuthHandlers(setUserName);
        const { selectedBranch, branches, selectBranch } = useBranch();

        // Check login state from cookie/localStorage - client-side only
        const [isLoggedIn, setIsLoggedIn] = useState(false);
        const [isScheduleOpen, setIsScheduleOpen] = useState(false);

        useEffect(() => {
                if (typeof window !== 'undefined') {
                        setIsLoggedIn(!!getCookie('userToken') || !!localStorage.getItem('userToken'));
                }

                // Listen for auth changes (login/logout)
                const handleAuthChange = () => {
                        if (typeof window !== 'undefined') {
                                setIsLoggedIn(!!getCookie('userToken') || !!localStorage.getItem('userToken'));
                        }
                };

                // Listen for open-login event (triggered by route guard)
                const handleOpenLogin = () => {
                        setIsLoginOpen(true);
                };

                window.addEventListener('user-auth-changed', handleAuthChange);
                window.addEventListener('open-login', handleOpenLogin);
                return () => {
                        window.removeEventListener('user-auth-changed', handleAuthChange);
                        window.removeEventListener('open-login', handleOpenLogin);
                };
        }, []);

        // Prefetch các trang chính để tránh lag khi điều hướng
        useEffect(() => {
                router.prefetch('/booking');
                router.prefetch('/bai-viet');
                router.prefetch('/account');
        }, [router]);

        // Dialog states
        const [isLoginOpen, setIsLoginOpen] = useState(false);
        const [isRegisterOpen, setIsRegisterOpen] = useState(false);
        const [isForgetPassOpen, setIsForgetPassOpen] = useState(false);
        const [pendingBranch, setPendingBranch] = useState<any>(null);
        const [showBranchConfirm, setShowBranchConfirm] = useState(false);
        const [errorModal, setErrorModal] = useState<ErrorModalState>({
                open: false,
                title: '',
                message: ''
        });

        // Utilities
        const scrollToSection = (id: string) => {
                if (id === 'posts') {
                        router.push('/bai-viet');
                        return;
                }

                if (pathname !== '/') {
                        router.push('/');
                        setTimeout(() => {
                                const element = document.getElementById(id);
                                if (!element) return;
                                const headerEl = document.querySelector('header') as HTMLElement | null;
                                const headerOffset = headerEl?.offsetHeight || 72;
                                const rect = element.getBoundingClientRect();
                                const absoluteTop = window.scrollY + rect.top;
                                window.scrollTo({ top: Math.max(0, absoluteTop - headerOffset), behavior: 'smooth' });
                        }, 180);
                        return;
                }

                const element = document.getElementById(id);
                if (!element) return;
                const headerEl = document.querySelector('header') as HTMLElement | null;
                const headerOffset = headerEl?.offsetHeight || 72;
                const rect = element.getBoundingClientRect();
                const absoluteTop = window.scrollY + rect.top;
                window.scrollTo({ top: Math.max(0, absoluteTop - headerOffset), behavior: 'smooth' });
        };

        const openRegister = () => {
                setIsRegisterOpen(true);
                setIsLoginOpen(false);
        };

        const openLogin = () => {
                setIsLoginOpen(true);
                setIsRegisterOpen(false);
        };

        const openForgetPass = () => {
                setIsForgetPassOpen(true);
                setIsLoginOpen(false);
        };

        const handleLogoClick = () => {
                const params = new URLSearchParams(searchParams.toString());
                const target = params.toString() ? `/?${params.toString()}` : '/';
                if (pathname === '/') {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                        router.push(target);
                        window.scrollTo(0, 0);
                }
        };

        const handleBranchChange = (branchId: number) => {
                const branch = branches.find((b) => b.id === branchId);
                if (!branch) return;

                const sensitiveRoutes = ['/booking', '/checkout', '/qr-payment'];
                const isSensitive = sensitiveRoutes.some(route => pathname.startsWith(route));

                if (isSensitive) {
                        setPendingBranch(branch);
                        setShowBranchConfirm(true);
                } else {
                        selectBranch(branch);
                }
        };

        const confirmBranchChange = () => {
                if (pendingBranch) {
                        selectBranch(pendingBranch);

                        const sensitiveRoutes = ['/booking', '/checkout', '/qr-payment'];
                        const isSensitive = sensitiveRoutes.some(route => pathname.startsWith(route));

                        if (isSensitive) {
                                router.push(`/?branch_id=${pendingBranch.id}`);
                        }

                        setPendingBranch(null);
                }
                setShowBranchConfirm(false);
        };

        const navItems = [...NAV_ITEMS, { label: 'Tin tức', target: 'posts' }];

        return (
                <header
                        className={cn(
                                'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
                                forceDark
                                        ? 'bg-black/95 backdrop-blur-lg border-b border-white/10 shadow-[0_10px_40px_rgba(67,97,238,0.15)]'
                                        : isScrolled
                                                ? 'bg-black/80 backdrop-blur-lg border-b border-white/10 shadow-[0_10px_40px_rgba(67,97,238,0.15)]'
                                                : 'bg-gradient-to-b from-black/80 via-black/60 to-transparent border-b border-white/10'
                        )}
                >
                        <div className="container mx-auto px-3 md:px-6 lg:px-8 py-4 md:py-[10px] flex items-center gap-3 md:gap-8 justify-between">
                                {/* Logo */}
                                <div className="flex items-center gap-3 md:gap-4 animate-fade-in">
                                        <img
                                                onClick={handleLogoClick}
                                                src="/logo.svg"
                                                width={80}
                                                height={80}
                                                className="cursor-pointer h-12 w-12 md:h-16 md:w-16 lg:h-20 lg:w-20 drop-shadow-[0_0_30px_rgba(59,130,246,0.6)] transition-transform duration-300 hover:scale-110"
                                                alt="Cinesphere logo"
                                        />
                                </div>

                                {/* Desktop Navigation */}
                                <nav className="hidden md:flex items-center gap-6 lg:gap-8 animate-fade-in delay-200">
                                        {navItems.map((item: { label: string; target: string }) => (
                                                <NavItem
                                                        key={item.target}
                                                        label={item.label}
                                                        target={item.target}
                                                        isActive={item.target === 'posts' ? pathname.startsWith('/bai-viet') : activeSection === item.target}
                                                        disabled={item.target === 'posts' ? false : effectiveDisable}
                                                        onClick={() => scrollToSection(item.target)}
                                                />
                                        ))}
                                </nav>

                                {/* Action Buttons */}
                                <div className="flex items-center gap-3 md:gap-4 animate-fade-in delay-250">
                                        {/* Branch Selector */}
                                        {selectedBranch && branches.length > 1 && (
                                                <div className={cn(
                                                        "relative group",
                                                        isBookingFlow && "opacity-60 cursor-not-allowed"
                                                )}>
                                                        <select
                                                                value={selectedBranch.id}
                                                                onChange={(e) => handleBranchChange(Number(e.target.value))}
                                                                disabled={isBookingFlow}
                                                                className={cn(
                                                                        "appearance-none bg-white/10 border border-white/20 rounded-lg px-3 py-2 pr-8 text-sm text-white/90 transition-colors backdrop-blur-sm min-w-[140px] md:min-w-[160px]",
                                                                        isBookingFlow ? "cursor-not-allowed" : "hover:bg-white/20 hover:text-white cursor-pointer"
                                                                )}
                                                        >
                                                                {branches.map((branch) => (
                                                                        <option key={branch.id} value={branch.id} className="bg-gray-900 text-white">
                                                                                {branch.name}
                                                                        </option>
                                                                ))}
                                                        </select>
                                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                                                                <svg className="w-4 h-4 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                                </svg>
                                                        </div>
                                                </div>
                                        )}

                                        {/* Mobile Menu */}
                                        <div className="md:hidden">
                                                <MobileMenu
                                                        navItems={navItems}
                                                        effectiveDisable={effectiveDisable}
                                                        scrollToSection={scrollToSection}
                                                        userName={userName}
                                                        onNavigate={router.push as any}
                                                        onLogout={handleLogout}
                                                        onLogin={() => setIsLoginOpen(true)}
                                                        onRegister={() => setIsRegisterOpen(true)}
                                                        branches={branches}
                                                        selectedBranch={selectedBranch}
                                                        selectBranch={handleBranchChange}
                                                        isBookingFlow={isBookingFlow}
                                                />
                                        </div>

                                        {/* Schedule Button (in header) */}
                                        <button
                                                type="button"
                                                onClick={() => setIsScheduleOpen(true)}
                                                aria-label="Xem lịch chiếu phim"
                                                className="uiverse-schedule-btn inline-flex items-center gap-2 text-white/90 hover:text-white transition-colors duration-300 font-medium text-[15px] px-3 py-2 rounded-lg hover:bg-white/8 border border-white/10"
                                                data-text={"\u00A0Lịch chiếu Phim\u00A0"}
                                        >
                                                <Calendar className="w-4 h-4 text-green-300" />
                                                <span className="actual-text">{"\u00A0Lịch chiếu Phim\u00A0"}</span>
                                                <span aria-hidden="true" className="hover-text">{"\u00A0Lịch chiếu Phim\u00A0"}</span>
                                        </button>

                                        {/* Desktop User Menu or Login Button */}
                                        {isLoggedIn ? (
                                                <div className="hidden md:flex items-center">
                                                        <UserMenu
                                                                userName={userName || 'User'}
                                                                tooltipPrefix={tooltipPrefix}
                                                                extraMenuOptions={extraMenuOptions}
                                                                onNavigateAccount={() => router.push('/account')}
                                                                onLogout={handleLogout}
                                                        />
                                                </div>
                                        ) : (
                                                <button
                                                        className="hidden md:inline-flex h-10 items-center text-white/90 hover:text-white transition-colors duration-300 font-medium text-[15px] px-5 rounded-lg hover:bg-white/10 backdrop-blur-sm whitespace-nowrap border border-white/10 hover:border-white/20"
                                                        onClick={openLogin}
                                                >
                                                        Đăng nhập
                                                </button>
                                        )}
                                </div>
                        </div>

                        <LoginDialog
                                isOpen={isLoginOpen}
                                onOpenChange={setIsLoginOpen}
                                onRegister={openRegister}
                                onForgetPassword={openForgetPass}
                                auth={auth}
                                setUserName={setUserName}
                                setErrorModal={setErrorModal}
                        />

                        <RegisterDialog
                                isOpen={isRegisterOpen}
                                onOpenChange={setIsRegisterOpen}
                                onLogin={openLogin}
                                auth={auth}
                                setUserName={setUserName}
                                setErrorModal={setErrorModal}
                        />

                        <ForgetPasswordDialog
                                isOpen={isForgetPassOpen}
                                onOpenChange={setIsForgetPassOpen}
                                onBackToLogin={() => {
                                        setIsForgetPassOpen(false);
                                        setIsLoginOpen(true);
                                }}
                                auth={auth}
                        />

                        <ErrorModal
                                open={errorModal.open}
                                title={errorModal.title}
                                message={errorModal.message}
                                onOpenChange={(open) => setErrorModal((prev) => ({ ...prev, open }))}
                        />

                        <MovieSchedulePanel
                                isOpen={isScheduleOpen}
                                onClose={() => setIsScheduleOpen(false)}
                                branchId={selectedBranch?.id}
                                branchName={selectedBranch?.name}
                        />

                        <AlertDialog open={showBranchConfirm} onOpenChange={setShowBranchConfirm}>
                                <AlertDialogContent className="bg-slate-900 border-slate-800 text-white">
                                        <AlertDialogHeader>
                                                <AlertDialogTitle className="text-xl font-bold">Xác nhận chuyển chi nhánh?</AlertDialogTitle>
                                                <AlertDialogDescription className="text-slate-400">
                                                        Bạn đang trong quá trình đặt vé. Nếu chuyển sang chi nhánh khác, tiến trình đặt vé hiện tại sẽ bị hủy bỏ. Bạn có chắc chắn muốn tiếp tục?
                                                </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                                <AlertDialogCancel className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700 hover:text-white">
                                                        Hủy bỏ
                                                </AlertDialogCancel>
                                                <AlertDialogAction
                                                        onClick={confirmBranchChange}
                                                        className="bg-cyan-600 hover:bg-cyan-700 text-white border-none"
                                                >
                                                        Tiếp tục chuyển
                                                </AlertDialogAction>
                                        </AlertDialogFooter>
                                </AlertDialogContent>
                        </AlertDialog>
                </header>
        );
}
