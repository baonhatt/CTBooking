import { describe, it, expect, vi, beforeEach } from 'vitest';
import { confirmBookingImpl } from './confirm-booking';
import { updatePaymentImpl } from '../user/booking/update';
import { logAuditAction } from '../../lib/audit-logger';

vi.mock('../user/booking/update', () => ({
  updatePaymentImpl: vi.fn(async () => ({ status: 200, message: 'ok', booking: {} }))
}));

vi.mock('../../lib/audit-logger', () => ({
  logAuditAction: vi.fn(async () => undefined)
}));

const tables = { bookings: { id: 'bookings.id' } as any, auditLogs: {} as any };
const STAFF = { id: 7, email: 'staff@example.com', fullname: 'Staff' };

function makeDb(booking: any) {
  return { query: { bookings: { findFirst: vi.fn(async () => booking) } } };
}

function pendingBooking(overrides: Record<string, any> = {}) {
  return { id: 55, payment_status: 'pending', branch_id: 1, ...overrides };
}

function confirm(booking: any, body: any, restrictToBranchIds: number[] | null = null) {
  return confirmBookingImpl(makeDb(booking), tables, body, STAFF, restrictToBranchIds) as Promise<any>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('confirmBookingImpl: status check', () => {
  it('refuses a missing or invalid booking id', async () => {
    for (const badId of [undefined, null, 0, -3, 'abc', 1.5]) {
      const result = await confirm(pendingBooking(), { payment_id: badId, payment_status: 'paid' });
      expect(result.status).toBe(400);
    }
    expect(updatePaymentImpl).not.toHaveBeenCalled();
  });

  it('refuses any status except paid or failed', async () => {
    for (const badStatus of ['cancelled', 'pending', 'expired', 'refunded', '', undefined, null, 'paid; DROP']) {
      const result = await confirm(pendingBooking(), { payment_id: 55, payment_status: badStatus });
      expect(result.status).toBe(400);
    }
    expect(updatePaymentImpl).not.toHaveBeenCalled();
  });

  it('treats PAID and " Paid " as paid, so the stored status is always lower case', async () => {
    await confirm(pendingBooking(), { payment_id: 55, payment_status: ' PAID ' });
    expect((updatePaymentImpl as any).mock.calls[0][1].payment_status).toBe('paid');
  });

  it('answers 404 when the booking does not exist', async () => {
    const result = await confirm(undefined, { payment_id: 55, payment_status: 'paid' });
    expect(result.status).toBe(404);
    expect(updatePaymentImpl).not.toHaveBeenCalled();
  });

  it('refuses to pay a booking that is already paid', async () => {
    const result = await confirm(pendingBooking({ payment_status: 'paid' }), { payment_id: 55, payment_status: 'paid' });
    expect(result.status).toBe(409);
    expect(updatePaymentImpl).not.toHaveBeenCalled();
  });

  it.each(['pending', 'failed', 'expired'])('still allows confirming a %s booking by hand', async (previous) => {
    const result = await confirm(pendingBooking({ payment_status: previous }), { payment_id: 55, payment_status: 'paid' });
    expect(result.status).toBe(200);
    expect(updatePaymentImpl).toHaveBeenCalledTimes(1);
  });
});

describe('confirmBookingImpl: branch scope', () => {
  it('lets a staff member confirm a booking at their own branch', async () => {
    const result = await confirm(pendingBooking({ branch_id: 1 }), { payment_id: 55, payment_status: 'paid' }, [1, 2]);
    expect(result.status).toBe(200);
  });

  it('refuses a booking at another branch', async () => {
    const result = await confirm(pendingBooking({ branch_id: 3 }), { payment_id: 55, payment_status: 'paid' }, [1, 2]);
    expect(result.status).toBe(403);
    expect(updatePaymentImpl).not.toHaveBeenCalled();
  });

  it('refuses everything for a staff member who has no branch', async () => {
    const result = await confirm(pendingBooking({ branch_id: 1 }), { payment_id: 55, payment_status: 'paid' }, []);
    expect(result.status).toBe(403);
    expect(updatePaymentImpl).not.toHaveBeenCalled();
  });

  it('refuses a booking with no branch unless the caller is the Super Admin', async () => {
    const byStaff = await confirm(pendingBooking({ branch_id: null }), { payment_id: 55, payment_status: 'paid' }, [1]);
    expect(byStaff.status).toBe(403);
    expect(updatePaymentImpl).not.toHaveBeenCalled();

    const bySuperAdmin = await confirm(pendingBooking({ branch_id: null }), { payment_id: 55, payment_status: 'paid' }, null);
    expect(bySuperAdmin.status).toBe(200);
  });

  it('does not limit the Super Admin (null)', async () => {
    const result = await confirm(pendingBooking({ branch_id: 99 }), { payment_id: 55, payment_status: 'paid' }, null);
    expect(result.status).toBe(200);
  });
});

describe('confirmBookingImpl: what the server decides', () => {
  it('ignores paid_at and user_id sent by the browser and records who confirmed', async () => {
    await confirm(
      pendingBooking(),
      { payment_id: 55, payment_status: 'paid', paid_at: '2020-01-01T00:00:00.000Z', user_id: 999 },
      null
    );

    const payload = (updatePaymentImpl as any).mock.calls[0][1];
    expect(payload).not.toHaveProperty('paid_at');
    expect(payload).not.toHaveProperty('user_id');
    expect(payload.confirmed_by_staff_id).toBe(STAFF.id);
    expect(payload.payment_id).toBe(55);
  });

  it('keeps a sensible bank reference and drops a silly one', async () => {
    await confirm(pendingBooking(), { payment_id: 55, payment_status: 'paid', transaction_id: '  FT26123  ' });
    expect((updatePaymentImpl as any).mock.calls[0][1].transaction_id).toBe('FT26123');

    await confirm(pendingBooking(), { payment_id: 55, payment_status: 'paid', transaction_id: 'x'.repeat(101) });
    expect((updatePaymentImpl as any).mock.calls[1][1].transaction_id).toBeUndefined();

    await confirm(pendingBooking(), { payment_id: 55, payment_status: 'paid', transaction_id: { a: 1 } });
    expect((updatePaymentImpl as any).mock.calls[2][1].transaction_id).toBeUndefined();
  });
});

describe('confirmBookingImpl: audit', () => {
  it('writes an audit entry naming the staff member, with the old and new status', async () => {
    await confirm(pendingBooking({ payment_status: 'failed' }), { payment_id: 55, payment_status: 'paid' });

    expect(logAuditAction).toHaveBeenCalledTimes(1);
    const call = (logAuditAction as any).mock.calls[0];
    expect(call[2]).toBe('confirm_payment');
    expect(call[3]).toBe('booking');
    expect(call[4]).toBe(55);
    expect(call[6]).toBe(STAFF.id);
    expect(JSON.parse(call[9])).toEqual({ payment_status: 'failed' });
    expect(JSON.parse(call[10])).toEqual({ payment_status: 'paid', confirmed_by_staff_id: STAFF.id });
  });

  it('mentions in the audit entry when the voucher had no slot left', async () => {
    (updatePaymentImpl as any).mockResolvedValueOnce({ status: 200, message: 'ok', voucher_slot_unavailable: true });
    await confirm(pendingBooking({ payment_status: 'expired' }), { payment_id: 55, payment_status: 'paid' });
    expect((logAuditAction as any).mock.calls[0][5]).toMatch(/Voucher/);
  });

  it('writes nothing when the update fails', async () => {
    (updatePaymentImpl as any).mockResolvedValueOnce({ status: 409, message: 'conflict' });
    const result = await confirm(pendingBooking(), { payment_id: 55, payment_status: 'failed' });
    expect(result.status).toBe(409);
    expect(logAuditAction).not.toHaveBeenCalled();
  });

  it('writes nothing when the request is refused', async () => {
    await confirm(pendingBooking({ branch_id: 3 }), { payment_id: 55, payment_status: 'paid' }, [1]);
    expect(logAuditAction).not.toHaveBeenCalled();
  });
});
