'use client';
import { useEffect, useState } from 'react';
<<<<<<< HEAD
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, usePathname } from 'next/navigation';
import { buildUrl } from '@/lib/api/http';
=======
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useBranch } from '@/hooks/useBranch';
>>>>>>> preview

// Components

// Assets

import { useActiveSection } from '@/hooks/useActiveSection';
import { useAuthHandlers } from '@/hooks/useAuthHandlers';
import { useAuthState } from '@/hooks/useAuthState';
import { useScrollDetect } from '@/hooks/useScrollDetect';
<<<<<<< HEAD
import { lazy, Suspense } from 'react';
=======
>>>>>>> preview
import { NavItem } from '@/components/NavItem';
import { UserMenu } from '@/components/UserMenu';
import { NAV_ITEMS } from '@/components/constants';
import { HeaderProps, ErrorModalState } from '@/components/filetypes/IType.model';
import { MobileMenu } from '@/components/MobileMenu';
<<<<<<< HEAD
import MovieSchedulePanel from '@/components/MovieSchedulePanel';
import { Calendar } from 'lucide-react';

// Lazy load dialogs to reduce initial JS payload
const LoginDialog = lazy(() => import('@/components/LoginDialog').then((m) => ({ default: m.LoginDialog })));
const RegisterDialog = lazy(() => import('@/components/RegisterDialog').then((m) => ({ default: m.RegisterDialog })));
const ForgetPasswordDialog = lazy(() =>
        import('@/components/ForgetPasswordDialog').then((m) => ({ default: m.ForgetPasswordDialog }))
);
const ErrorModal = lazy(() => import('@/components/ErrorModal').then((m) => ({ default: m.ErrorModal })));
=======
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
import { Calendar, ChevronDown, Gamepad2, MapPin, ShoppingCart } from 'lucide-react';
import { useCart } from '@/store/cartStore';
const LoginDialog = dynamic(() => import('@/components/LoginDialog'), { ssr: false });
const RegisterDialog = dynamic(() => import('@/components/RegisterDialog'), { ssr: false });
const ForgetPasswordDialog = dynamic(() => import('@/components/ForgetPasswordDialog'), { ssr: false });
const ErrorModal = dynamic(() => import('@/components/ErrorModal'), { ssr: false });
const MovieSchedulePanel = dynamic(() => import('@/components/MovieSchedulePanel'), { ssr: false });
>>>>>>> preview

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
<<<<<<< HEAD
=======
        const searchParams = useSearchParams();
>>>>>>> preview

        // Custom hooks
        const isScrolled = useScrollDetect(50);
        const isPostsRoute = pathname === '/bai-viet' || pathname.startsWith('/bai-viet/');
<<<<<<< HEAD
        const { userName, setUserName } = useAuthState(false);
        const effectiveDisable = disableNav || (pathname !== '/' && !isPostsRoute);
        const activeSection = useActiveSection(effectiveDisable);
        const { handleLogout } = useAuthHandlers(setUserName);

        // Check login state from localStorage (userToken) - client-side only
        const [isLoggedIn, setIsLoggedIn] = useState(false);
        const [isScheduleOpen, setIsScheduleOpen] = useState(false);

        useEffect(() => {
                if (typeof window !== 'undefined') {
                        setIsLoggedIn(!!localStorage.getItem('userToken'));
                }

                // Listen for auth changes (login/logout)
                const handleAuthChange = () => {
                        if (typeof window !== 'undefined') {
                                setIsLoggedIn(!!localStorage.getItem('userToken'));
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
=======
        const isVrRoute = pathname === '/vr' || pathname.startsWith('/vr');
        const isBookingFlow = ['/booking', '/checkout', '/qr-payment', '/success-payment', '/vr-booking'].some(route => pathname.startsWith(route));
        const { userName, setUserName } = useAuthState(false);
        const activeSection = useActiveSection(disableNav);
        const { handleLogout } = useAuthHandlers(setUserName);

        const { branches, selectedBranch, selectBranch } = useBranch();
        const { totalItemsCount, openCart } = useCart();

        const [isScheduleOpen, setIsScheduleOpen] = useState(false);
        const [mounted, setMounted] = useState(false);

        useEffect(() => {
                setMounted(true);
        }, []);

        // Responsive scroll padding
        useEffect(() => {
                const updateScrollPadding = () => {
                        const header = document.querySelector('header');
                        if (header) {
                                const headerHeight = header.offsetHeight;
                                document.documentElement.style.scrollPaddingTop = `${headerHeight + 20}px`;
                        }
                };

                updateScrollPadding();
                window.addEventListener('resize', updateScrollPadding);
                return () => window.removeEventListener('resize', updateScrollPadding);
        }, []);

        // Lock body scroll when any dialog is open
        useEffect(() => {
                const hasOpenDialog = document.querySelector('[role="dialog"][data-state="open"]');
                if (hasOpenDialog) {
                        document.body.style.overflow = 'hidden';
                } else {
                        document.body.style.overflow = 'unset';
                }
        }, []);

        // Login status
        const [isLoggedIn, setIsLoggedIn] = useState(false);

        useEffect(() => {
                const token = getCookie('token');
                setIsLoggedIn(!!token);
        }, [userName]);
>>>>>>> preview

        // Dialog states
        const [isLoginOpen, setIsLoginOpen] = useState(false);
        const [isRegisterOpen, setIsRegisterOpen] = useState(false);
        const [isForgetPassOpen, setIsForgetPassOpen] = useState(false);
<<<<<<< HEAD
        const [isUserPostsEnabled, setIsUserPostsEnabled] = useState(true);
=======
        const [pendingBranch, setPendingBranch] = useState<any>(null);
        const [showBranchConfirm, setShowBranchConfirm] = useState(false);
>>>>>>> preview
        const [errorModal, setErrorModal] = useState<ErrorModalState>({
                open: false,
                title: '',
                message: ''
        });

        // Utilities
        const scrollToSection = (id: string) => {
<<<<<<< HEAD
=======
                if (id === 'schedule') {
                        setIsScheduleOpen(true);
                        return;
                }

>>>>>>> preview
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
<<<<<<< HEAD
                if (pathname === '/') {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                        router.push('/');
=======
                const params = new URLSearchParams(searchParams.toString());
                const target = params.toString() ? `/?${params.toString()}` : '/';
                if (pathname === '/') {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                        router.push(target);
>>>>>>> preview
                        window.scrollTo(0, 0);
                }
        };

<<<<<<< HEAD
        useEffect(() => {
                const applyFromStorage = () => {
                        const stored = localStorage.getItem('admin_sidebar_hidden_tabs');
                        const hiddenTabs = stored ? JSON.parse(stored) : [];
                        const isAdminPostsEnabled = !hiddenTabs.includes('posts');
                        const isUserPostsSettingEnabled = !hiddenTabs.includes('posts-user');
                        setIsUserPostsEnabled(isAdminPostsEnabled && isUserPostsSettingEnabled);
                };

                const isProd = window.location.hostname !== 'localhost';
                if (!isProd) {
                        applyFromStorage();
                }

                window.addEventListener('storage', applyFromStorage);
                window.addEventListener('admin_sidebar_update', applyFromStorage);

                if (isProd) {
                        fetch(buildUrl('/api/admin/settings'))
                                .then((res) => res.json())
                                .then((data) => {
                                        if (data && data.settings) {
                                                localStorage.setItem('admin_sidebar_hidden_tabs', JSON.stringify(data.settings));
                                                applyFromStorage();
                                        }
                                })
                                .catch(() => { });
                }

                return () => {
                        window.removeEventListener('storage', applyFromStorage);
                        window.removeEventListener('admin_sidebar_update', applyFromStorage);
                };
        }, []);

        const navItems = isUserPostsEnabled ? [...NAV_ITEMS, { label: 'Tin tức', target: 'posts' }] : NAV_ITEMS;
=======
        const handleBranchChange = (branchId: number) => {
                const branch = branches.find((b) => b.id === branchId);
                if (!branch) return;

                const sensitiveRoutes = ['/booking', '/checkout', '/qr-payment', '/vr-booking'];
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

                        const sensitiveRoutes = ['/booking', '/checkout', '/qr-payment', '/vr-booking'];
                        const isSensitive = sensitiveRoutes.some(route => pathname.startsWith(route));

                        if (isSensitive) {
                                router.push(`/?branch_id=${pendingBranch.id}`);
                        }

                        setPendingBranch(null);
                }
                setShowBranchConfirm(false);
        };

        const navItems = NAV_ITEMS;
>>>>>>> preview

        return (
                <header
                        className={cn(
                                'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
                                forceDark
<<<<<<< HEAD
                                        ? 'bg-black/95 lg:backdrop-blur-lg border-b border-white/10 shadow-[0_10px_40px_rgba(67,97,238,0.15)]'
                                        : isScrolled
                                                ? 'bg-black/80 lg:backdrop-blur-lg border-b border-white/10 shadow-[0_10px_40px_rgba(67,97,238,0.15)]'
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
=======
                                        ? 'bg-[#050915]/95 backdrop-blur-xl border-b border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.5)]'
                                        : isScrolled
                                                ? 'bg-[#050915]/90 backdrop-blur-xl border-b border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.5)]'
                                                : 'bg-gradient-to-b from-black/90 via-black/60 to-transparent border-b border-white/5'
                        )}
                >
                        <div className="container mx-auto px-4 lg:px-8 py-3.5 flex items-center justify-between gap-4">
                                {/* Logo */}
                                <div className="flex items-center gap-3 animate-fade-in shrink-0">
                                        <img
                                                onClick={handleLogoClick}
                                                src="/logo.svg"
                                                width={72}
                                                height={72}
                                                className="cursor-pointer h-10 md:h-12 lg:h-14 w-auto drop-shadow-[0_0_20px_rgba(59,130,246,0.5)] transition-transform duration-300 hover:scale-105"
>>>>>>> preview
                                                alt="Cinesphere logo"
                                        />
                                </div>

<<<<<<< HEAD
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
                                <div className="flex items-center gap-4 animate-fade-in delay-250">
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
                                                <span className="hidden md:inline actual-text">{"\u00A0Lịch chiếu Phim\u00A0"}</span>
                                                <span aria-hidden="true" className="hidden md:inline hover-text">{"\u00A0Lịch chiếu Phim\u00A0"}</span>
=======
                                {/* Desktop Main Navigation */}
                                <nav className="hidden lg:flex items-center gap-6 xl:gap-8 animate-fade-in delay-150">
					{navItems.map((item: { label: string; target: string }) => {
						const isItemActive =
							item.target === 'posts'
								? isPostsRoute
								: item.target === 'schedule'
									? isScheduleOpen
									: pathname === '/'
										? activeSection === item.target
										: item.target === 'vr'
											? isVrRoute
											: false;
						return (
                                                        <NavItem
                                                                key={item.target}
                                                                label={item.label}
                                                                target={item.target}
                                                                isActive={isItemActive}
                                                                disabled={disableNav}
                                                                onClick={() => scrollToSection(item.target)}
                                                        />
                                                );
                                        })}
                                </nav>

                                {/* Right Actions / Utilities Cluster */}
                                <div className="flex items-center gap-2.5 sm:gap-3.5 animate-fade-in delay-200 shrink-0">
                                        {/* Branch Selector Chip */}
                                        {selectedBranch && branches.length > 1 && (
                                                <div className={cn(
                                                        "relative hidden sm:flex items-center",
                                                        isBookingFlow && "opacity-60 cursor-not-allowed"
                                                )}>
                                                        <MapPin className="w-3.5 h-3.5 text-cyan-400 absolute left-3 pointer-events-none" />
                                                        <select
                                                                value={selectedBranch.id}
                                                                onChange={(e) => handleBranchChange(Number(e.target.value))}
                                                                disabled={isBookingFlow}
                                                                aria-label="Chọn chi nhánh"
                                                                className={cn(
                                                                        "appearance-none bg-white/[0.07] hover:bg-white/[0.12] border border-white/15 rounded-full pl-8 pr-7 py-1.5 text-xs font-semibold text-slate-200 hover:text-white transition-all backdrop-blur-md",
                                                                        isBookingFlow ? "cursor-not-allowed" : "cursor-pointer"
                                                                )}
                                                        >
                                                                {branches.map((branch) => (
                                                                        <option key={branch.id} value={branch.id} className="bg-slate-900 text-white">
                                                                                {branch.name}
                                                                        </option>
                                                                ))}
                                                        </select>
                                                        <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2.5 pointer-events-none" />
                                                </div>
                                        )}

                                        {/* Shopping Cart Button */}
                                        <button
                                                type="button"
                                                onClick={openCart}
                                                aria-label="Giỏ hàng"
                                                className="relative flex items-center gap-2 text-slate-200 hover:text-white transition-all duration-200 font-semibold text-xs px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-full bg-white/[0.07] hover:bg-white/[0.14] border border-white/15 hover:border-cyan-400/50 hover:shadow-[0_0_15px_rgba(6,182,212,0.25)] touch-manipulation select-none active:scale-95 group"
                                        >
                                                <ShoppingCart className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
                                                <span className="hidden sm:inline">Giỏ hàng</span>
                                                {mounted && totalItemsCount > 0 && (
                                                        <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 px-1 text-[10px] font-black text-black shadow-md">
                                                                {totalItemsCount}
                                                        </span>
                                                )}
>>>>>>> preview
                                        </button>

                                        {/* Desktop User Menu or Login Button */}
                                        {isLoggedIn ? (
<<<<<<< HEAD
                                                <div className="hidden md:flex items-center">
=======
                                                <div className="hidden sm:flex items-center">
>>>>>>> preview
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
<<<<<<< HEAD
                                                        className="hidden md:inline-flex h-10 items-center text-white/90 hover:text-white transition-colors duration-300 font-medium text-[15px] px-5 rounded-lg hover:bg-white/10 backdrop-blur-sm whitespace-nowrap border border-white/10 hover:border-white/20"
=======
                                                        className="hidden sm:inline-flex h-8 sm:h-9 items-center text-xs font-bold text-white hover:text-white px-4 rounded-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 transition-all duration-300 shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:shadow-[0_0_20px_rgba(6,182,212,0.5)] active:scale-95 border border-cyan-400/30"
>>>>>>> preview
                                                        onClick={openLogin}
                                                >
                                                        Đăng nhập
                                                </button>
                                        )}
<<<<<<< HEAD
                                </div>
                        </div>

                        {/* Dialogs - Wrapped in Suspense for Code Splitting */}
                        <Suspense fallback={null}>
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
                        </Suspense>
=======

                                        {/* Mobile Hamburger Menu */}
                                        <div className="lg:hidden">
                                                <MobileMenu
                                                        navItems={navItems}
                                                        effectiveDisable={disableNav}
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
                                                        totalCartCount={totalItemsCount}
                                                        onOpenCart={openCart}
                                                />
                                        </div>
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
>>>>>>> preview

                        <MovieSchedulePanel
                                isOpen={isScheduleOpen}
                                onClose={() => setIsScheduleOpen(false)}
<<<<<<< HEAD
                        />
                </header>
        );
}

=======
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
>>>>>>> preview
