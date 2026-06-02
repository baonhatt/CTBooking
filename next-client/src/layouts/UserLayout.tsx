import Header from '@/components/user/Header';
import Footer from '@/components/user/Footer';
import FloatingActions from '@/components/user/FloatingActions';
import { cn } from '@/lib/utils';

interface UserLayoutProps {
        children: React.ReactNode;
        className?: string;
        hideFooter?: boolean;
}

// Server Component – Header/Footer are "use client", but this wrapper can stay server
export default function UserLayout({ children, className, hideFooter = false }: UserLayoutProps) {
        return (
                <div className={cn('min-h-screen bg-gradient-dark', className)}>
                        <Header />
                        <div className="relative">{children}</div>
                        <FloatingActions />
                        {!hideFooter && <Footer />}
                </div>
        );
}
