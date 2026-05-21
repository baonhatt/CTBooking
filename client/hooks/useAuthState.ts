import { useState, useEffect } from 'react';
import { getMeApi } from '@/lib/api';

export function useAuthState(setUserName: (name: string | null) => void, shouldCheck: boolean = false) {
        const [isAuthenticated, setIsAuthenticated] = useState(false);
        const [isLoading, setIsLoading] = useState(false);

        useEffect(() => {
                if (!shouldCheck) {
                        setIsLoading(false);
                        return;
                }

                const checkAuth = async () => {
                        try {
                                setIsLoading(true);
                                // Gọi API để check session
                                const response = await getMeApi();
                                if (response?.status === 'success' && response?.user) {
                                        const name = response.user.username || (response.user.email || '').split('@')[0];
                                        setUserName(name);
                                        setIsAuthenticated(true);
                                        // Lưu userProfile vào localStorage để hiển thị UI
                                        localStorage.setItem('userProfile', JSON.stringify({
                                                email: response.user.email,
                                                name: name,
                                                phone: response.user.phone || ''
                                        }));
                                } else {
                                        setUserName(null);
                                        setIsAuthenticated(false);
                                }
                        } catch (error) {
                                console.error('Auth check failed:', error);
                                setUserName(null);
                                setIsAuthenticated(false);
                        } finally {
                                setIsLoading(false);
                        }
                };

                checkAuth();

                const handleAuthChange = () => checkAuth();

                window.addEventListener('user-auth-changed', handleAuthChange);

                return () => {
                        window.removeEventListener('user-auth-changed', handleAuthChange);
                };
        }, [setUserName, shouldCheck]);

        return { isAuthenticated, isLoading };
}
