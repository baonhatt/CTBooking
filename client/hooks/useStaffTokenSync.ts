import { useEffect } from 'react';

/**
 * Keeps several open tabs in step with one staff session.
 * - Another tab signed out (the token was removed): this tab goes to the login screen.
 * - Another tab signed in as someone else (the token changed): this tab reloads, so it no longer shows the
 *   permissions of the previous person while sending the new person's token.
 * The `storage` event only fires in the tabs that did not make the change.
 */
export function useStaffTokenSync() {
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== 'staffToken') return;

      if (!event.newValue) {
        if (window.location.pathname !== '/login') window.location.href = '/login';
        return;
      }
      if (event.oldValue && event.oldValue !== event.newValue) {
        window.location.reload();
      }
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
}
