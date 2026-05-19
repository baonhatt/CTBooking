'use client';
import { useState, useEffect } from 'react';

export function useAuthState() {
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    const readAuth = () => {
      const raw = localStorage.getItem('authUser');
      if (!raw) {
        setUserName(null);
        return;
      }
      try {
        const parsed = JSON.parse(raw);
        const name =
          parsed?.user?.username || parsed?.username || (parsed?.user?.email || parsed?.email || '').split('@')[0];
        if (name) setUserName(name);
      } catch {
        setUserName(null);
      }
    };

    readAuth();

    const onAuthChanged = () => readAuth();
    const onOpenLogin = () => {}; // Handle in parent

    window.addEventListener('user-auth-changed', onAuthChanged as any);
    window.addEventListener('storage', onAuthChanged as any);

    return () => {
      window.removeEventListener('user-auth-changed', onAuthChanged as any);
      window.removeEventListener('storage', onAuthChanged as any);
    };
  }, []);

  return { userName, setUserName };
}


