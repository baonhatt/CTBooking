import Header from '@/components/user/Header';
import Footer from '@/components/user/Footer';
<<<<<<< HEAD
import { cn } from '@/lib/utils';

interface UserLayoutProps {
  children: React.ReactNode;
  className?: string;
  hideFooter?: boolean;
=======
import FloatingActions from '@/components/user/FloatingActions';
import CartDrawer from '@/components/user/CartDrawer';
import { cn } from '@/lib/utils';

interface UserLayoutProps {
        children: React.ReactNode;
        className?: string;
        hideFooter?: boolean;
>>>>>>> preview
}

// Server Component – Header/Footer are "use client", but this wrapper can stay server
export default function UserLayout({ children, className, hideFooter = false }: UserLayoutProps) {
<<<<<<< HEAD
  return (
    <div className={cn('min-h-screen bg-gradient-dark', className)}>
      <Header />
      <div>{children}</div>
      {!hideFooter && <Footer />}
    </div>
  );
}
=======
        return (
                <div className={cn('min-h-screen bg-gradient-dark', className)}>
                        <Header />
                        <main className="relative">{children}</main>
                        <FloatingActions />
                        <CartDrawer />
                        {!hideFooter && <Footer />}
                </div>
        );
}

>>>>>>> preview
