import { describe, it, expect, vi, beforeEach } from 'vitest';
import paymentsRouter from './payments.router';
import { resendBookingEmailImpl } from '../../../../server/routes/admin/resend-booking-email';

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

vi.mock('../../../../server/routes/admin/resend-booking-email', () => ({
  resendBookingEmailImpl: vi.fn(async () => ({ status: 200, message: 'ok' }))
}));

const env = { cinema_db: {} };
const executionContext: any = { waitUntil: () => undefined, passThroughOnException: () => undefined };

function resend(headers: Record<string, string>, body: unknown) {
  return paymentsRouter.request(
    '/api/admin/bookings-resend-email',
    { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) },
    env,
    executionContext
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/admin/bookings-resend-email', () => {
  it('takes the staff member and branch scope from the session', async () => {
    await resend({ 'x-test-super': '0', 'x-test-id': '20', 'x-test-branches': '1,2' }, { booking_id: 55 });

    const call = (resendBookingEmailImpl as any).mock.calls[0];
    expect(call[2]).toEqual({ booking_id: 55 });
    expect(call[3]).toEqual({ id: 20, email: 'caller@example.com', fullname: 'Caller' });
    expect(call[4]).toEqual([1, 2]);
  });

  it('gives the Super Admin no branch limit (null)', async () => {
    await resend({ 'x-test-super': '1', 'x-test-id': '1' }, { booking_id: 55 });
    expect((resendBookingEmailImpl as any).mock.calls[0][4]).toBeNull();
  });

  it('turns the Impl result into the HTTP status', async () => {
    (resendBookingEmailImpl as any).mockResolvedValueOnce({ status: 403, message: 'other branch' });

    const response = await resend({ 'x-test-super': '0', 'x-test-id': '20', 'x-test-branches': '1' }, { booking_id: 55 });

    expect(response.status).toBe(403);
    expect(((await response.json()) as any).status).toBe('error');
  });

  it('gives a plain error when the Impl throws', async () => {
    (resendBookingEmailImpl as any).mockRejectedValueOnce(new Error('D1_ERROR: boom'));

    const response = await resend({ 'x-test-super': '1', 'x-test-id': '1' }, { booking_id: 55 });
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(text).not.toContain('D1_ERROR');
  });
});
