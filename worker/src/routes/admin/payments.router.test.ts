import { describe, it, expect, vi, beforeEach } from 'vitest';
import paymentsRouter from './payments.router';
import { confirmBookingImpl } from '../../../../server/routes/admin/confirm-booking';

// The guards are tested elsewhere. Here they copy the signed-in staff from test headers into the context.
vi.mock('../../middleware', () => ({
  requireStaffAuth: async (c: any, next: any) => {
    c.set('staffId', Number(c.req.header('x-test-id') || 0));
    c.set('staffEmail', 'caller@example.com');
    c.set('staffFullname', 'Caller');
    c.set('isSuperAdmin', c.req.header('x-test-super') === '1');
    c.set('staffBranchIds', (c.req.header('x-test-branches') || '').split(',').filter(Boolean).map(Number));
    await next();
  },
  requirePermission: () => async (_c: any, next: any) => next()
}));

vi.mock('../../../../server/routes/admin/confirm-booking', () => ({
  confirmBookingImpl: vi.fn(async () => ({ status: 200, message: 'ok', booking: {} }))
}));

const env = { cinema_db: {} };
// The route hands c.executionCtx on to the Impl, so the request needs one
const executionContext: any = { waitUntil: () => undefined, passThroughOnException: () => undefined };

function confirm(headers: Record<string, string>, body: unknown) {
  return paymentsRouter.request(
    '/api/admin/confirm-booking',
    { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) },
    env,
    executionContext
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/admin/confirm-booking', () => {
  it('takes the staff member and the branch scope from the session', async () => {
    await confirm({ 'x-test-super': '0', 'x-test-id': '20', 'x-test-branches': '1,2' }, { payment_id: 55, payment_status: 'paid' });

    const call = (confirmBookingImpl as any).mock.calls[0];
    expect(call[3]).toEqual({ id: 20, email: 'caller@example.com', fullname: 'Caller' });
    expect(call[4]).toEqual([1, 2]);
  });

  it('gives the Super Admin no branch limit (null)', async () => {
    await confirm({ 'x-test-super': '1', 'x-test-id': '1' }, { payment_id: 55, payment_status: 'paid' });
    expect((confirmBookingImpl as any).mock.calls[0][4]).toBeNull();
  });

  it('gives a staff member with no branch an empty list, which the Impl treats as "no access"', async () => {
    await confirm({ 'x-test-super': '0', 'x-test-id': '21' }, { payment_id: 55, payment_status: 'paid' });
    expect((confirmBookingImpl as any).mock.calls[0][4]).toEqual([]);
  });

  it('turns the Impl result into the HTTP status', async () => {
    (confirmBookingImpl as any).mockResolvedValueOnce({ status: 403, message: 'other branch' });
    (confirmBookingImpl as any).mockResolvedValueOnce({ status: 400, message: 'bad status' });

    const refused = await confirm({ 'x-test-super': '0', 'x-test-id': '20', 'x-test-branches': '1' }, {});
    const invalid = await confirm({ 'x-test-super': '1', 'x-test-id': '1' }, {});

    expect(refused.status).toBe(403);
    expect(((await refused.json()) as any).status).toBe('error');
    expect(invalid.status).toBe(400);
  });

  it('succeeds with status "success" in the body', async () => {
    const response = await confirm({ 'x-test-super': '1', 'x-test-id': '1' }, { payment_id: 55, payment_status: 'paid' });
    expect(response.status).toBe(200);
    expect(((await response.json()) as any).status).toBe('success');
  });
});
