'use client';
import { useEffect } from 'react';

interface HeaderEventHandlers {
  // "open-movie-schedule": some button on the page asks for the day's schedule panel
  onOpenSchedule: () => void;
  // "open-login-dialog": the session ended (a 401) or a page needs the customer to sign in; may carry a message
  onOpenLogin: (message?: string) => void;
}

/**
 * The page-wide events the header listens to: the schedule panel, the login dialog, and the "access denied" toast
 * (a 403 answer from the server).
 */
export function useHeaderEvents({ onOpenSchedule, onOpenLogin }: HeaderEventHandlers) {
  useEffect(() => {
    const handleOpenSchedule = () => onOpenSchedule();
    window.addEventListener('open-movie-schedule', handleOpenSchedule);
    return () => window.removeEventListener('open-movie-schedule', handleOpenSchedule);
  }, [onOpenSchedule]);

  useEffect(() => {
    const handleOpenLogin = (event: Event) => {
      onOpenLogin((event as CustomEvent).detail?.message);
    };
    window.addEventListener('open-login-dialog', handleOpenLogin);
    return () => window.removeEventListener('open-login-dialog', handleOpenLogin);
  }, [onOpenLogin]);

  useEffect(() => {
    const handleShowErrorToast = (event: Event) => {
      const message = (event as CustomEvent).detail?.message;
      if (!message) return;
      import('sonner').then(({ toast }) => {
        toast.error(message, { id: 'access-denied-toast' });
      });
    };
    window.addEventListener('show-error-toast', handleShowErrorToast);
    return () => window.removeEventListener('show-error-toast', handleShowErrorToast);
  }, []);
}
