import { useState, useEffect } from 'react';

export function useAuthState(setUserName: (name: string | null) => void, shouldCheck: boolean = false) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Load from localStorage
    const userProfile = localStorage.getItem('userProfile');
    if (userProfile) {
      try {
        const parsed = JSON.parse(userProfile);
        setUserName(parsed.name || null);
        setIsAuthenticated(true);
      } catch (e) {
        console.error('Failed to parse userProfile:', e);
      }
    }

    // Listen for auth changes (login/logout)
    const handleAuthChange = () => {
      const userProfile = localStorage.getItem('userProfile');
      if (userProfile) {
        try {
          const parsed = JSON.parse(userProfile);
          setUserName(parsed.name || null);
          setIsAuthenticated(true);
        } catch (e) {
          console.error('Failed to parse userProfile:', e);
        }
      } else {
        setUserName(null);
        setIsAuthenticated(false);
      }
    };

    window.addEventListener('user-auth-changed', handleAuthChange);
    return () => window.removeEventListener('user-auth-changed', handleAuthChange);
  }, [setUserName]);

  return { isAuthenticated, isLoading };
}
