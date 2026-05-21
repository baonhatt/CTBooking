'use client';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, usePathname } from 'next/navigation';
import { buildUrl } from '@/lib/api/http';

// Components

// Assets

import { useActiveSection } from '@/hooks/useActiveSection';
import { useAuthHandlers } from '@/hooks/useAuthHandlers';
import { useAuthState } from '@/hooks/useAuthState';
import { useScrollDetect } from '@/hooks/useScrollDetect';
import { lazy, Suspense } from 'react';
import { NavItem } from '@/components/NavItem';
import { UserMenu } from '@/components/UserMenu';
import { NAV_ITEMS } from '@/components/constants';
import { HeaderProps, ErrorModalState } from '@/components/filetypes/IType.model';
import { MobileMenu } from '@/components/MobileMenu';

// Lazy load dialogs to reduce initial JS payload
const LoginDialog = lazy(() => import('@/components/LoginDialog').then((m) => ({ default: m.LoginDialog })));
const RegisterDialog = lazy(() => import('@/components/RegisterDialog').then((m) => ({ default: m.RegisterDialog })));
const ForgetPasswordDialog = lazy(() =>
        import('@/components/ForgetPasswordDialog').then((m) => ({ default: m.ForgetPasswordDialog }))
);
const ErrorModal = lazy(() => import('@/components/ErrorModal').then((m) => ({ default: m.ErrorModal })));

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

        // Custom hooks
        const isScrolled = useScrollDetect(50);
        const isPostsRoute = pathname === '/bai-viet' || pathname.startsWith('/bai-viet/');
        const isAccountOrCheckout = pathname === '/account' || pathname === '/checkout';
        const shouldCheckAuth = isAccountOrCheckout;
        const { userName, setUserName } = useAuthState(shouldCheckAuth);
        const effectiveDisable = disableNav || (pathname !== '/' && !isPostsRoute);
        const activeSection = useActiveSection(effectiveDisable);
        const { handleLogout } = useAuthHandlers(setUserName);

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
        const [isUserPostsEnabled, setIsUserPostsEnabled] = useState(true);
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
                if (pathname === '/') {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                        router.push('/');
                        window.scrollTo(0, 0);
                }
        };

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

                                        {/* Desktop User Menu or Login Button */}
                                        {userName ? (
                                                <div className="hidden md:flex items-center">
                                                        <UserMenu
                                                                userName={userName}
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
                </header>
        );
}

