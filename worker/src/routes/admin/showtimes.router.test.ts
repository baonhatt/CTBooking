import { describe, it, expect, vi, beforeEach } from 'vitest';
import showtimesRouter from './showtimes.router';
import { copyShowtimesImpl } from '../../../../server/routes/admin/showtimes';

// Permissions come from a test header like "showtimes:create,showtimes:delete". requirePermission really checks them.
vi.mock('../../middleware', () => ({
  requireStaffAuth: async (c: any, next: any) => {
    c.set('staffId', 1);
    c.set('isSuperAdmin', false);
    c.set('staffBranchIds', [1, 2]);
    c.set('granted', (c.req.header('x-test-permissions') || '').split(',').filter(Boolean));
    await next();
  },
  requirePermission: (module: string, action: string) => async (c: any, next: any) => {
    if (!(c.get('granted') as string[]).includes(module + ':' + action)) {
      return c.json({ message: 'Forbidden' }, 403);
    }
    await next();
  }
}));

vi.mock('../../../../server/routes/admin/showtimes', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  copyShowtimesImpl: vi.fn(async () => ({ status: 'success', copied: 1 }))
}));

const env = { cinema_db: {} };
const executionContext: any = { waitUntil: () => undefined, passThroughOnException: () => undefined };

function copy(permissions: string) {
  return showtimesRouter.request(
    '/api/admin/showtimes/copy',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-permissions': permissions },
      body: JSON.stringify({ from_branch_id: 1, to_branch_id: 2 })
    },
    env,
    executionContext
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/admin/showtimes/copy needs both showtimes.create and showtimes.delete', () => {
  it('staff with only create get 403 and nothing is copied', async () => {
    expect((await copy('showtimes:create')).status).toBe(403);
    expect(copyShowtimesImpl).not.toHaveBeenCalled();
  });

  it('staff with only delete get 403', async () => {
    expect((await copy('showtimes:delete')).status).toBe(403);
    expect(copyShowtimesImpl).not.toHaveBeenCalled();
  });

  it('staff with no showtime rights get 403', async () => {
    expect((await copy('')).status).toBe(403);
  });

  it('staff with both can copy, within their branch scope, and the movies table is given', async () => {
    const response = await copy('showtimes:create,showtimes:delete');

    expect(response.status).toBe(200);
    const call = (copyShowtimesImpl as any).mock.calls[0];
    expect(call[1]).toHaveProperty('movies');
    expect(call[3]).toEqual([1, 2]);
  });
});
