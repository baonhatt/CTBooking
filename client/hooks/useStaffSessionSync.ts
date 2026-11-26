import { useEffect } from 'react';

/** Who is signed in, as the persisted staff store ("staff-storage") holds it */
function readSignedInStaffId(storedValue: string | null): number | null {
  if (!storedValue) return null;
  try {
    const parsed = JSON.parse(storedValue);
    if (!parsed?.state?.isAuthenticated) return null;
    const staffId = Number(parsed.state.staff?.id);
    return Number.isFinite(staffId) && staffId > 0 ? staffId : null;
  } catch {
    return null;
  }
}

/**
 * Keeps several open tabs in step with one staff session.
 * The session itself is the HttpOnly cookie (shared by every tab); the persisted staff store says who is signed in.
 * - Another tab signed out: this tab goes to the login screen.
 * - Another tab signed in as someone else: this tab reloads, so it no longer shows the previous person's permissions
 *   while the browser already sends the new person's cookie.
 * The `storage` event only fires in the tabs that did not make the change.
 */
export function useStaffSessionSync() {
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== 'staff-storage' && event.key !== null) return;

      const previousStaffId = readSignedInStaffId(event.oldValue);
      const currentStaffId = readSignedInStaffId(event.key === null ? null : event.newValue);

      if (!currentStaffId) {
        if (previousStaffId && window.location.pathname !== '/login') window.location.href = '/login';
        return;
      }
      if (previousStaffId && previousStaffId !== currentStaffId) {
        window.location.reload();
      }
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
}
