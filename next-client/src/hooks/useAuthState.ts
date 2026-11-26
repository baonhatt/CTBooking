'use client';
import { useState, useEffect } from 'react';
import { readStoredProfile } from '@/lib/customer-session';

/** The name shown in the header. The session is the HttpOnly cookie; the saved profile says who signed in. */
function readProfileName(): string | null {
  const userProfile = readStoredProfile();
  if (!userProfile) return null;
  try {
    return JSON.parse(userProfile).name || null;
  } catch (error) {
    console.error('Failed to parse userProfile:', error);
    return null;
  }
}

export function useAuthState(shouldCheck: boolean = false) {
  const [userName, setUserName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setUserName(readProfileName());

    // Login, logout, or an expired session found by a request (each clears or saves the profile first)
    const handleAuthChange = () => setUserName(readProfileName());

    window.addEventListener('user-auth-changed', handleAuthChange);
    return () => window.removeEventListener('user-auth-changed', handleAuthChange);
  }, []);

  return { userName, setUserName, isLoading };
}
