'use client';
import { useState, useEffect } from 'react';
import { getCookie } from '@/lib/cookies';

export function useAuthState(shouldCheck: boolean = false) {
  const [userName, setUserName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Load from cookie first, localStorage as fallback
    const userProfile = getCookie('userProfile') || localStorage.getItem('userProfile');
    if (userProfile) {
      try {
        const parsed = JSON.parse(userProfile);
        setUserName(parsed.name || null);
      } catch (e) {
        console.error('Failed to parse userProfile:', e);
      }
    }

    // Listen for auth changes (login/logout)
    const handleAuthChange = () => {
      const userProfile = getCookie('userProfile') || localStorage.getItem('userProfile');
      if (userProfile) {
        try {
          const parsed = JSON.parse(userProfile);
          setUserName(parsed.name || null);
        } catch (e) {
          console.error('Failed to parse userProfile:', e);
        }
      } else {
        setUserName(null);
      }
    };

    window.addEventListener('user-auth-changed', handleAuthChange);
    return () => window.removeEventListener('user-auth-changed', handleAuthChange);
  }, []);

  return { userName, setUserName, isLoading };
}
