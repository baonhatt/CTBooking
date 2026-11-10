import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const requestMock = vi.fn();
vi.mock('@/lib/api/http', () => ({ request: (...args: any[]) => requestMock(...args) }));

import { clearSessionStorage, handleAutoLogout, performLogout } from './auth-utils';

const STAFF_KEYS = [
  'userToken',
  'userProfile',
  'staffToken',
  'staff-storage',
  'adminToken',
  'adminEmail',
  'admin_transactions_filters',
  'dashboard_selected_branch_id',
  'dashboard_selected_year'
];

function installBrowser(pathname: string) {
  const store = new Map<string, string>();
  for (const key of STAFF_KEYS) store.set(key, 'value');
  store.set('unrelated-setting', 'keep');
  store.set('admin_vouchers_filters', '{}');
  store.set('admin_movies_filters', '{}');
  store.set('admin_sidebar_collapsed', 'true');

  const location = { href: '', pathname };
  const dispatchEvent = vi.fn();
  vi.stubGlobal('window', { location, dispatchEvent });
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => (store.has(key) ? store.get(key) : null),
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    get length() {
      return store.size;
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null
  });
  return { store, location, dispatchEvent };
}

beforeEach(() => {
  requestMock.mockReset();
  requestMock.mockResolvedValue({ status: 'success' });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('clearSessionStorage', () => {
  it('removes the staff session and the saved per-person filters, and nothing else', () => {
    const { store } = installBrowser('/dashboard');

    clearSessionStorage();

    for (const key of STAFF_KEYS) expect(store.has(key)).toBe(false);
    expect(store.get('unrelated-setting')).toBe('keep');
  });

  it('also removes every saved admin list filter, but keeps layout preferences', () => {
    const { store } = installBrowser('/dashboard');

    clearSessionStorage();

    expect(store.has('admin_vouchers_filters')).toBe(false);
    expect(store.has('admin_movies_filters')).toBe(false);
    expect(store.get('admin_sidebar_collapsed')).toBe('true');
  });

  it('does not throw when storage is blocked', () => {
    installBrowser('/dashboard');
    vi.stubGlobal('localStorage', {
      removeItem: () => {
        throw new Error('blocked');
      }
    });
    expect(() => clearSessionStorage()).not.toThrow();
  });
});

describe('performLogout', () => {
  it('asks the server to revoke the token, clears the browser and goes to the login screen', async () => {
    const { store, location } = installBrowser('/ticket-check');

    await performLogout();

    expect(requestMock).toHaveBeenCalledWith('/api/admin/auth/logout', { method: 'POST' });
    expect(store.has('staffToken')).toBe(false);
    expect(store.has('staff-storage')).toBe(false);
    expect(location.href).toBe('/login');
  });

  it('still signs out locally when the server cannot be reached', async () => {
    const { store, location } = installBrowser('/ticket-check');
    requestMock.mockRejectedValue(new Error('offline'));

    await performLogout();

    expect(store.has('staffToken')).toBe(false);
    expect(location.href).toBe('/login');
  });

  it('calls the server before clearing, so the request still carries the token', async () => {
    const { store } = installBrowser('/ticket-check');
    let tokenSeenByRequest: string | undefined | null;
    requestMock.mockImplementation(async () => {
      tokenSeenByRequest = store.get('staffToken');
      return {};
    });

    await performLogout();

    expect(tokenSeenByRequest).toBe('value');
    expect(store.has('staffToken')).toBe(false);
  });
});

describe('handleAutoLogout', () => {
  it('clears the session and goes to login with the expiry reason', () => {
    const { store, location } = installBrowser('/dashboard');

    handleAutoLogout();

    expect(store.has('staffToken')).toBe(false);
    expect(location.href).toBe('/login?reason=session_expired');
  });

  it('does nothing when already on the login page (avoids a redirect loop)', () => {
    const { store, location } = installBrowser('/login');

    handleAutoLogout();

    expect(store.has('staffToken')).toBe(true);
    expect(location.href).toBe('');
  });
});
