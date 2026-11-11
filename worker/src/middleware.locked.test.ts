import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

const validateSessionTokenImpl = vi.fn();

vi.mock('drizzle-orm/d1', () => ({ drizzle: () => ({}) }));
vi.mock('../../server/lib/staff-auth', () => ({ loadStaffPermissions: vi.fn() }));
vi.mock('../../server/routes/user/auth', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  validateSessionTokenImpl: (...args: any[]) => validateSessionTokenImpl(...args)
}));

import { requireAuth } from './middleware';
import { ACCOUNT_LOCKED_MESSAGE } from '../../server/routes/user/auth';

const app = new Hono<any>();
app.get('/api/me', requireAuth, (c) => c.json({ userId: (c as any).get('userId') }));
const call = () => app.request('/api/me', { headers: { Authorization: 'Bearer tok' } }, { cinema_db: {} });

beforeEach(() => validateSessionTokenImpl.mockReset());

describe('requireAuth', () => {
  it('401 with the lock message when the account is locked', async () => {
    validateSessionTokenImpl.mockResolvedValue({ valid: false, locked: true });
    const response = await call();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ status: 'error', message: ACCOUNT_LOCKED_MESSAGE });
  });

  it('401 Unauthorized for an unknown or expired token', async () => {
    validateSessionTokenImpl.mockResolvedValue({ valid: false });
    const response = await call();
    expect(response.status).toBe(401);
    expect(((await response.json()) as any).message).toBe('Unauthorized');
  });

  it('lets a valid session through', async () => {
    validateSessionTokenImpl.mockResolvedValue({ valid: true, accountId: 9, userId: 3 });
    const response = await call();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ userId: 3 });
  });
});
