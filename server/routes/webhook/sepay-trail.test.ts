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

describe('SePay webhook: late payment', () => {
  it('fails the order, keeps the bank reference and writes sepay_late_payment', async () => {
    const { db, inserts, updates } = makeWebhookDb(pendingBooking({ created_at: minutesAgo(30) }));

    const result: any = await handleSePayWebhookImpl(db, webhookTables, transfer());

    expect(result.success).toBe(true);
    expect((updatePaymentImpl as any).mock.calls[0][1].payment_status).toBe('failed');
    expect(updates.find((entry) => entry.table === bookingsTable)?.values).toEqual({ transaction_id: 'FT26313000123' });
    expect(auditActions(inserts)).toEqual(['sepay_late_payment']);
    const line = inserts.find((entry) => entry.table === auditLogsTable)!.values;
    expect(line.staffEmail).toBe('system');
    expect(line.entityId).toBe('55');
    expect(line.newValues).toContain('FT26313000123');
  });

  it('is never paid by the webhook, whatever the amount', async () => {
    const { db } = makeWebhookDb(pendingBooking({ created_at: minutesAgo(11) }));

    await handleSePayWebhookImpl(db, webhookTables, transfer({ transferAmount: 999999999 }));

    const statuses = (updatePaymentImpl as any).mock.calls.map((call: any[]) => call[1].payment_status);
    expect(statuses).not.toContain('paid');
  });

  it('keeps the reference of an order that was already cancelled when the money came', async () => {
    (updatePaymentImpl as any).mockResolvedValue({ status: 200, already_processed: true });
    const { db, updates, inserts } = makeWebhookDb(pendingBooking({ payment_status: 'failed', created_at: minutesAgo(40) }));

    await handleSePayWebhookImpl(db, webhookTables, transfer());

    expect(updates.some((entry) => entry.values.transaction_id === 'FT26313000123')).toBe(true);
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
