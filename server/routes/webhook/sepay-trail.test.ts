import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleSePayWebhookImpl } from './sepay';
import { updatePaymentImpl } from '../user/booking/update';

vi.mock('../user/booking/update', () => ({
  updatePaymentImpl: vi.fn()
}));

// Outgoing transfers, late / short / repeated payments and their audit trail

const auditLogsTable = { name: 'audit_logs' };
const bookingsTable = { name: 'bookings', id: 'id', transaction_id: 'transaction_id' };
const webhookTables: any = { bookings: bookingsTable, auditLogs: auditLogsTable };

function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

function makeWebhookDb(booking: any) {
  const inserts: Array<{ table: any; values: any }> = [];
  const updates: Array<{ table: any; values: any }> = [];
  const db: any = {
    query: { bookings: { findFirst: vi.fn().mockResolvedValue(booking) } },
    insert: (table: any) => ({
      values: async (values: any) => {
        inserts.push({ table, values });
      }
    }),
    update: (table: any) => ({
      set: (values: any) => ({
        where: async () => {
          updates.push({ table, values });
        }
      })
    })
  };
  return { db, inserts, updates };
}

/** SePay's transactionDate text (Vietnam time, "YYYY-MM-DD HH:mm:ss") for an ISO instant */
function vnText(iso: string) {
  return new Date(new Date(iso).getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
}

function pendingBooking(overrides: Record<string, any> = {}) {
  return {
    id: 55,
    pay_txt_code: 'CS123456789012',
    total_price: 100000,
    user_id: null,
    payment_status: 'pending',
    created_at: minutesAgo(2),
    ...overrides
  };
}

const transfer = (overrides: Record<string, any> = {}) => ({
  content: 'Thanh toan CS123456789012',
  transferAmount: 100000,
  transferType: 'in',
  referenceCode: 'FT26313000123',
  id: 9001,
  ...overrides
});

const auditActions = (inserts: Array<{ table: any; values: any }>) =>
  inserts.filter((entry) => entry.table === auditLogsTable).map((entry) => entry.values.action);

beforeEach(() => {
  vi.clearAllMocks();
  (updatePaymentImpl as any).mockResolvedValue({ status: 200 });
});

describe('SePay webhook: outgoing transfers', () => {
  it('ignores money going out, even when the text holds an order code', async () => {
    const { db, inserts } = makeWebhookDb(pendingBooking());

    const result: any = await handleSePayWebhookImpl(db, webhookTables, transfer({ transferType: 'out' }));

    expect(result.success).toBe(true);
    expect(db.query.bookings.findFirst).not.toHaveBeenCalled();
    expect(updatePaymentImpl).not.toHaveBeenCalled();
    expect(inserts).toHaveLength(0);
  });

  it('ignores "OUT" in any letter case', async () => {
    const { db } = makeWebhookDb(pendingBooking());
    await handleSePayWebhookImpl(db, webhookTables, transfer({ transferType: 'OUT' }));
    expect(updatePaymentImpl).not.toHaveBeenCalled();
  });

  it('still processes an incoming transfer and one with no transferType', async () => {
    const incoming = makeWebhookDb(pendingBooking());
    const untyped = makeWebhookDb(pendingBooking());

    await handleSePayWebhookImpl(incoming.db, webhookTables, transfer({ transferType: 'in' }));
    await handleSePayWebhookImpl(untyped.db, webhookTables, transfer({ transferType: undefined }));

    expect(updatePaymentImpl).toHaveBeenCalledTimes(2);
  });
});

describe('SePay webhook: payment on time', () => {
  it('marks the order paid with the bank reference, and writes no audit line', async () => {
    const { db, inserts } = makeWebhookDb(pendingBooking());

    const result: any = await handleSePayWebhookImpl(db, webhookTables, transfer());

    expect(result.message).toBe('Payment updated');
    const payload = (updatePaymentImpl as any).mock.calls[0][1];
    expect(payload).toMatchObject({ payment_id: 55, payment_status: 'paid', transaction_id: 'FT26313000123' });
    expect(auditActions(inserts)).toEqual([]);
  });

  it('accepts an amount equal to or above the price', async () => {
    for (const amount of [100000, 150000]) {
      const { db } = makeWebhookDb(pendingBooking());
      await handleSePayWebhookImpl(db, webhookTables, transfer({ transferAmount: amount }));
    }
    expect(updatePaymentImpl).toHaveBeenCalledTimes(2);
  });
});

describe('SePay webhook: late payment (never confirmed automatically)', () => {
  const paidCalls = () => (updatePaymentImpl as any).mock.calls.filter((call: any[]) => call[1].payment_status === 'paid');

  it('after the 10 minutes: the order is expired, the bank reference kept, and it goes to staff', async () => {
    const { db, inserts, updates } = makeWebhookDb(pendingBooking({ created_at: minutesAgo(11) }));

    const result: any = await handleSePayWebhookImpl(db, webhookTables, transfer({ transferAmount: 999999999 }));

    expect(result.message).toBe('Late payment - left for staff');
    expect(paidCalls()).toHaveLength(0);
    expect((updatePaymentImpl as any).mock.calls[0][1].payment_status).toBe('expired');
    expect(updates.find((entry) => entry.table === bookingsTable)?.values).toEqual({ transaction_id: 'FT26313000123' });
    expect(auditActions(inserts)).toEqual(['sepay_late_payment']);
  });

  it('the deadline is payment_expires_at when the order has one', async () => {
    const overdue = pendingBooking({ created_at: minutesAgo(2), payment_expires_at: minutesAgo(1) });
    const { db } = makeWebhookDb(overdue);

    const result: any = await handleSePayWebhookImpl(db, webhookTables, transfer());

    expect(result.message).toBe('Late payment - left for staff');
    expect(paidCalls()).toHaveLength(0);
  });

  it('an order the customer cancelled, or one that failed, is never paid, even inside the 10 minutes', async () => {
    for (const paymentStatus of ['cancelled', 'failed']) {
      vi.clearAllMocks();
      const { db, inserts } = makeWebhookDb(pendingBooking({ payment_status: paymentStatus, created_at: minutesAgo(3) }));

      const result: any = await handleSePayWebhookImpl(db, webhookTables, transfer());

      expect(result.message).toBe('Late payment - left for staff');
      expect(updatePaymentImpl).not.toHaveBeenCalled();
      expect(auditActions(inserts)).toEqual(['sepay_late_payment']);
    }
  });

  it('an order the system closed at its deadline is paid when the bank made the transfer in time (no voucher)', async () => {
    (updatePaymentImpl as any).mockResolvedValue({ status: 200 });
    const booking = pendingBooking({ payment_status: 'expired', created_at: minutesAgo(12), payment_expires_at: minutesAgo(2) });
    const { db } = makeWebhookDb(booking);

    // The bank made the transfer 9 minutes after the order (in time); SePay reports it now, 12 minutes after
    await handleSePayWebhookImpl(db, webhookTables, transfer({ transactionDate: vnText(minutesAgo(3)) }));

    const paid = paidCalls()[0][1];
    expect(paid).toMatchObject({ only_open_pending: true, allow_system_expired: true });
    expect(paid.paid_in_time_at.toISOString().slice(0, 19)).toBe(minutesAgo(3).slice(0, 19));
  });

  it('...but not when it used a voucher, nor when the bank time is after the deadline', async () => {
    for (const [overrides, bankTime] of [
      [{ voucher_id: 4 }, minutesAgo(3)],
      [{}, minutesAgo(1)]
    ] as const) {
      vi.clearAllMocks();
      const booking = pendingBooking({ payment_status: 'expired', created_at: minutesAgo(12), payment_expires_at: minutesAgo(2), ...overrides });
      const { db } = makeWebhookDb(booking);
      const result: any = await handleSePayWebhookImpl(db, webhookTables, transfer({ transactionDate: vnText(bankTime) }));
      expect(result.message).toBe('Late payment - left for staff');
      expect(paidCalls()).toHaveLength(0);
    }
  });

  it('a pending order is judged by the bank time: reported after the deadline but made in time is paid', async () => {
    (updatePaymentImpl as any).mockResolvedValue({ status: 200 });
    const { db } = makeWebhookDb(pendingBooking({ created_at: minutesAgo(11), payment_expires_at: minutesAgo(1) }));

    await handleSePayWebhookImpl(db, webhookTables, transfer({ transactionDate: vnText(minutesAgo(2)) }));

    expect(paidCalls()).toHaveLength(1);
    expect(paidCalls()[0][1].allow_system_expired).toBe(false);
  });

  it('inside the 10 minutes the payment asks the update to require an open pending order', async () => {
    (updatePaymentImpl as any).mockResolvedValue({ status: 200 });
    const { db } = makeWebhookDb(pendingBooking({ created_at: minutesAgo(2) }));

    await handleSePayWebhookImpl(db, webhookTables, transfer());

    expect(paidCalls()[0][1].only_open_pending).toBe(true);
  });

  it('losing the race with a cancel / expiry sends the money to staff', async () => {
    (updatePaymentImpl as any)
      .mockResolvedValueOnce({ status: 200, already_processed: true, booking: { payment_status: 'cancelled' } })
      .mockResolvedValue({ status: 200 });
    const { db, inserts } = makeWebhookDb(pendingBooking({ created_at: minutesAgo(2) }));

    const result: any = await handleSePayWebhookImpl(db, webhookTables, transfer());

    expect(result.message).toBe('Late payment - left for staff');
    expect(auditActions(inserts)).toEqual(['sepay_late_payment']);
  });
});

describe('SePay webhook: short and repeated payments', () => {
  it('leaves a short payment alone and writes sepay_insufficient', async () => {
    const { db, inserts, updates } = makeWebhookDb(pendingBooking());

    const result: any = await handleSePayWebhookImpl(db, webhookTables, transfer({ transferAmount: 99999 }));

    expect(result.message).toBe('Insufficient amount');
    expect(updatePaymentImpl).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
    expect(auditActions(inserts)).toEqual(['sepay_insufficient']);
    expect(JSON.parse(inserts[0].values.newValues)).toMatchObject({ amount_received: 99999, amount_needed: 100000 });
  });

  it('writes sepay_duplicate for money that arrives for an order already paid, whatever the amount', async () => {
    for (const amount of [100000, 5000]) {
      const { db, inserts } = makeWebhookDb(pendingBooking({ payment_status: 'paid' }));

      const result: any = await handleSePayWebhookImpl(db, webhookTables, transfer({ transferAmount: amount }));

      expect(result.message).toBe('Already paid');
      expect(auditActions(inserts)).toEqual(['sepay_duplicate']);
    }
    expect(updatePaymentImpl).not.toHaveBeenCalled();
  });

  it('keeps working when the audit table is missing or the audit write fails', async () => {
    const withoutTable = makeWebhookDb(pendingBooking({ payment_status: 'paid' }));
    const noAudit: any = await handleSePayWebhookImpl(withoutTable.db, { bookings: bookingsTable } as any, transfer());
    expect(noAudit.success).toBe(true);

    const failing = makeWebhookDb(pendingBooking({ payment_status: 'paid' }));
    failing.db.insert = () => ({
      values: async () => {
        throw new Error('db down');
      }
    });
    const failed: any = await handleSePayWebhookImpl(failing.db, webhookTables, transfer());
    expect(failed.success).toBe(true);
    expect(failed.message).toBe('Already paid');
  });
});
