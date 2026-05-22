'use client';
import { useState, useEffect } from 'react';
import { getMeApi } from '@/lib/api/auth';

export function useAuthState(shouldCheck: boolean = false) {
        const [userName, setUserName] = useState<string | null>(null);
        const [isLoading, setIsLoading] = useState(false);

        useEffect(() => {
                // Load from localStorage first
                const userProfile = localStorage.getItem('userProfile');
                if (userProfile) {
                        try {
                                const parsed = JSON.parse(userProfile);
                                setUserName(parsed.name || null);
                        } catch (e) {
                                console.error('Failed to parse userProfile:', e);
                        }
                }

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
                                        // Lưu userProfile vào localStorage để hiển thị UI
                                        localStorage.setItem('userProfile', JSON.stringify({
                                                email: response.user.email,
                                                name: name,
                                                phone: response.user.phone || ''
                                        }));
                                } else {
                                        setUserName(null);
                                        localStorage.removeItem('userProfile');
                                }
                        } catch (error) {
                                console.error('Auth check failed:', error);
                                setUserName(null);
                                localStorage.removeItem('userProfile');
                        } finally {
                                setIsLoading(false);
                        }
                };

                checkAuth();

                const onAuthChanged = () => checkAuth();

                window.addEventListener('user-auth-changed', onAuthChanged as any);

                return () => {
                        window.removeEventListener('user-auth-changed', onAuthChanged as any);
                };
        }, [shouldCheck]);

        return { userName, setUserName, isLoading };
}
