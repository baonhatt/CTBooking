import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

// Only the validation of PATCH /api/admin/users/:id/active is tested here: guards are pass-through, the impl is a spy.
const setUserActiveImpl = vi.fn();

vi.mock('drizzle-orm/d1', () => ({ drizzle: () => ({}) }));
vi.mock('../../middleware', () => ({
  requireStaffAuth: async (_c: any, next: any) => next(),
  requirePermission: () => async (_c: any, next: any) => next()
}));
vi.mock('../../../../server/routes/admin/users', () => ({
  getUsersImpl: vi.fn(),
  getUserByIdImpl: vi.fn(),
  setUserActiveImpl: (...args: any[]) => setUserActiveImpl(...args)
}));

import logsRouter from './logs.router';

const app = new Hono<any>();
app.route('/', logsRouter);
const patch = (id: string, body?: unknown) =>
  app.request(
    `/api/admin/users/${id}/active`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? 'not json' : JSON.stringify(body)
    },
    { cinema_db: {} }
  );

beforeEach(() => {
  setUserActiveImpl.mockReset();
});

describe('PATCH /api/admin/users/:id/active', () => {
  it('400 for an invalid id', async () => {
    expect((await patch('abc', { is_active: false })).status).toBe(400);
    expect((await patch('0', { is_active: false })).status).toBe(400);
    expect(setUserActiveImpl).not.toHaveBeenCalled();
  });

  it('400 when is_active is not a boolean or the body is not JSON', async () => {
    expect((await patch('3', { is_active: 'false' })).status).toBe(400);
    expect((await patch('3', {})).status).toBe(400);
    expect((await patch('3')).status).toBe(400);
    expect(setUserActiveImpl).not.toHaveBeenCalled();
  });

  it('passes id, flag and reason to the impl', async () => {
    setUserActiveImpl.mockResolvedValue({ status: 'success', is_active: false });
    const response = await patch('3', { is_active: false, reason: 'abuse' });
    expect(response.status).toBe(200);
    expect(setUserActiveImpl.mock.calls[0].slice(2, 5)).toEqual([3, false, 'abuse']);
  });

  it('maps the impl statusCode (404 when the customer has no account)', async () => {
    setUserActiveImpl.mockRejectedValue(Object.assign(new Error('not found'), { statusCode: 404 }));
    expect((await patch('3', { is_active: true })).status).toBe(404);
  });
});
