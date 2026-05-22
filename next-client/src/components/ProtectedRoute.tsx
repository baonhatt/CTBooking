'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface Props {
        children: React.ReactNode;
}

/**
 * Client-side route guard - Check localStorage for userToken
 * Sử dụng cho các trang client cần login (ví dụ: /account)
 * Chỉ check localStorage, không gọi API (nhanh)
 */
export default function ProtectedRoute({ children }: Props) {
        const router = useRouter();
        const [isCheckingAuth, setIsCheckingAuth] = useState(true);

        useEffect(() => {
                // Check auth via userToken (client-side route guard)
                const token = localStorage.getItem('userToken');
                if (!token) {
                        toast.error('Vui lòng đăng nhập trước!', { duration: 3000 });
                        window.dispatchEvent(new Event('open-login'));
                        router.replace('/');
                } else {
                        setIsCheckingAuth(false);
                }
        }, [router]);

        // Show loading while checking auth
        if (isCheckingAuth) {
                return (
                        <div className="min-h-screen flex items-center justify-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                        </div>
                );
        }

        return <>{children}</>;
}
