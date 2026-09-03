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
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Calendar, ChevronDown, Gamepad2, MapPin, ShoppingCart } from 'lucide-react';
import { useCart } from '@/store/cartStore';
const LoginDialog = dynamic(() => import('@/components/LoginDialog'), { ssr: false });
const RegisterDialog = dynamic(() => import('@/components/RegisterDialog'), { ssr: false });
const ForgetPasswordDialog = dynamic(() => import('@/components/ForgetPasswordDialog'), { ssr: false });
const ErrorModal = dynamic(() => import('@/components/ErrorModal'), { ssr: false });
const MovieSchedulePanel = dynamic(() => import('@/components/MovieSchedulePanel'), { ssr: false });

export default function Header({
  onBookClick = () => {},
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
  const isVrRoute = pathname === '/vr' || pathname.startsWith('/vr');
  const isBookingFlow = ['/booking', '/checkout', '/qr-payment', '/success-payment', '/vr-booking'].some((route) =>
    pathname.startsWith(route)
  );
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
    if (id === 'schedule') {
      setIsScheduleOpen(true);
      return;
    }

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

    const sensitiveRoutes = ['/booking', '/checkout', '/qr-payment', '/vr-booking'];
    const isSensitive = sensitiveRoutes.some((route) => pathname.startsWith(route));

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
      const isSensitive = sensitiveRoutes.some((route) => pathname.startsWith(route));

      if (isSensitive) {
        router.push(`/?branch_id=${pendingBranch.id}`);
      }

      setPendingBranch(null);
    }
    setShowBranchConfirm(false);
  };

  const navItems = NAV_ITEMS;

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        forceDark
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
            alt="Cinesphere logo"
          />
        </div>

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
            <div
              className={cn('relative hidden sm:flex items-center', isBookingFlow && 'opacity-60 cursor-not-allowed')}
            >
              <MapPin className="w-3.5 h-3.5 text-cyan-400 absolute left-3 pointer-events-none" />
              <select
                value={selectedBranch.id}
                onChange={(e) => handleBranchChange(Number(e.target.value))}
                disabled={isBookingFlow}
                aria-label="Chọn chi nhánh"
                className={cn(
                  'appearance-none bg-white/[0.07] hover:bg-white/[0.12] border border-white/15 rounded-full pl-8 pr-7 py-1.5 text-xs font-semibold text-slate-200 hover:text-white transition-all backdrop-blur-md',
                  isBookingFlow ? 'cursor-not-allowed' : 'cursor-pointer'
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
          </button>

          {/* Desktop User Menu or Login Button */}
          {isLoggedIn ? (
            <div className="hidden sm:flex items-center">
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
              className="hidden sm:inline-flex h-8 sm:h-9 items-center text-xs font-bold text-white hover:text-white px-4 rounded-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 transition-all duration-300 shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:shadow-[0_0_20px_rgba(6,182,212,0.5)] active:scale-95 border border-cyan-400/30"
              onClick={openLogin}
            >
              Đăng nhập
            </button>
          )}

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

      {isLoginOpen && (
        <LoginDialog
          isOpen={isLoginOpen}
          onOpenChange={setIsLoginOpen}
          onRegister={openRegister}
          onForgetPassword={openForgetPass}
          auth={auth}
          setUserName={setUserName}
          setErrorModal={setErrorModal}
        />
      )}

      {isRegisterOpen && (
        <RegisterDialog
          isOpen={isRegisterOpen}
          onOpenChange={setIsRegisterOpen}
          onLogin={openLogin}
          auth={auth}
          setUserName={setUserName}
          setErrorModal={setErrorModal}
        />
      )}

      {isForgetPassOpen && (
        <ForgetPasswordDialog
          isOpen={isForgetPassOpen}
          onOpenChange={setIsForgetPassOpen}
          onBackToLogin={() => {
            setIsForgetPassOpen(false);
            setIsLoginOpen(true);
          }}
          auth={auth}
        />
      )}

      {errorModal.open && (
        <ErrorModal
          open={errorModal.open}
          title={errorModal.title}
          message={errorModal.message}
          onOpenChange={(open) => setErrorModal((prev) => ({ ...prev, open }))}
        />
      )}

      {isScheduleOpen && (
        <MovieSchedulePanel
          isOpen={isScheduleOpen}
          onClose={() => setIsScheduleOpen(false)}
          branchId={selectedBranch?.id}
          branchName={selectedBranch?.name}
        />
      )}

      <AlertDialog open={showBranchConfirm} onOpenChange={setShowBranchConfirm}>
        <AlertDialogContent className="bg-slate-900 border-slate-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold">Xác nhận chuyển chi nhánh?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Bạn đang trong quá trình đặt vé. Nếu chuyển sang chi nhánh khác, tiến trình đặt vé hiện tại sẽ bị hủy bỏ.
              Bạn có chắc chắn muốn tiếp tục?
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
