import { describe, it, expect, vi, beforeEach } from 'vitest';
import { assignUnmatchedTransferImpl, ignoreUnmatchedTransferImpl } from './unmatched-transfers';
import { confirmBookingImpl } from './confirm-booking';
import { handleSePayWebhookImpl } from '../webhook/sepay';

vi.mock('./confirm-booking', () => ({ confirmBookingImpl: vi.fn(async () => ({ status: 200 })) }));

const tables: any = {
  unmatched_transfers: { id: 'id', status: 'status' },
  bookings: { id: 'id', pay_txt_code: 'pay_txt_code' }
};
const staff = { id: 4, email: 'staff@example.com', fullname: 'Staff' };

function makeDb(options: { transfer?: any; booking?: any; claimSucceeds?: boolean }) {
  const updates: any[] = [];
  const db: any = {
    query: {
      unmatched_transfers: { findFirst: vi.fn().mockResolvedValue(options.transfer) },
      bookings: { findFirst: vi.fn().mockResolvedValue(options.booking) }
    },
    update: () => ({
      set: (values: any) => ({
        where: () => {
          updates.push(values);
          const done: any = Promise.resolve(undefined);
          done.returning = async () => (options.claimSucceeds === false ? [] : [{ id: 1 }]);
          return done;
        }
      })
    })
  };
  return { db, updates };
}

const openTransfer = { id: 1, status: 'open', amount: 200000, bank_ref: 'FT1', sepay_id: '9', content: 'chuyen tien ve' };
const unpaidBooking = { id: 55, payment_status: 'expired', total_price: 200000 };

beforeEach(() => vi.clearAllMocks());

describe('assign an unmatched transfer to an order', () => {
  it('claims the transfer, then confirms the order as paid with the bank reference', async () => {
    const { db, updates } = makeDb({ transfer: openTransfer, booking: unpaidBooking });

    const result: any = await assignUnmatchedTransferImpl(db, tables, { id: 1, pay_code: 'cs176382012345' }, staff, null);

    expect(result.status).toBe(200);
    expect(updates[0]).toMatchObject({ status: 'matched', booking_id: 55 });
    expect(vi.mocked(confirmBookingImpl).mock.calls[0][2]).toEqual({
      payment_id: 55,
      payment_status: 'paid',
      transaction_id: 'FT1'
    });
  });

  it('refuses an amount below the order price, and a paid order', async () => {
    const short = makeDb({ transfer: { ...openTransfer, amount: 100000 }, booking: unpaidBooking });
    expect(((await assignUnmatchedTransferImpl(short.db, tables, { id: 1, pay_code: 'CS176382012345' }, staff, null)) as any).status).toBe(400);

    const paid = makeDb({ transfer: openTransfer, booking: { ...unpaidBooking, payment_status: 'paid' } });
    expect(((await assignUnmatchedTransferImpl(paid.db, tables, { id: 1, pay_code: 'CS176382012345' }, staff, null)) as any).status).toBe(409);
    expect(confirmBookingImpl).not.toHaveBeenCalled();
  });

  it('gives the transfer back (open) when the order cannot be confirmed, e.g. another branch', async () => {
    vi.mocked(confirmBookingImpl).mockResolvedValueOnce({ status: 403, message: 'Chi nhánh khác' } as any);
    const { db, updates } = makeDb({ transfer: openTransfer, booking: unpaidBooking });

    const result: any = await assignUnmatchedTransferImpl(db, tables, { id: 1, pay_code: 'CS176382012345' }, staff, [2]);

    expect(result.status).toBe(403);
    expect(updates[1]).toMatchObject({ status: 'open', booking_id: null });
  });

  it('cannot be assigned twice at the same moment', async () => {
    const { db } = makeDb({ transfer: openTransfer, booking: unpaidBooking, claimSucceeds: false });
    expect(((await assignUnmatchedTransferImpl(db, tables, { id: 1, pay_code: 'CS176382012345' }, staff, null)) as any).status).toBe(409);
    expect(confirmBookingImpl).not.toHaveBeenCalled();
  });
});

describe('set an unmatched transfer aside', () => {
  it('needs a reason', async () => {
    const { db } = makeDb({});
    expect(((await ignoreUnmatchedTransferImpl(db, tables, { id: 1, note: ' ' }, staff)) as any).status).toBe(400);
  });

  it('saves the reason and who did it', async () => {
    const { db, updates } = makeDb({});
    const result: any = await ignoreUnmatchedTransferImpl(db, tables, { id: 1, note: 'Không phải tiền vé' }, staff);
    expect(result.status).toBe(200);
    expect(updates[0]).toMatchObject({ status: 'ignored', note: 'Không phải tiền vé', resolved_by_staff_id: 4 });
  });
});

describe('SePay webhook keeps money that matches no order', () => {
  function webhookDb(booking: any) {
    const inserts: any[] = [];
    const db: any = {
      query: { bookings: { findFirst: vi.fn().mockResolvedValue(booking) } },
      insert: (table: any) => ({
        values: (values: any) => {
          inserts.push({ table, values });
          return { onConflictDoNothing: async () => undefined };
        }
      })
    };
    return { db, inserts };
  }
  const webhookTables: any = { bookings: {}, unmatched_transfers: { name: 'unmatched_transfers' } };

  it('saves a transfer whose text has no order code', async () => {
    const { db, inserts } = webhookDb(undefined);
    await handleSePayWebhookImpl(db, webhookTables, { id: 77, content: 'chuyen tien ve 0901234567', transferAmount: 200000, referenceCode: 'FT9' });
    expect(inserts).toHaveLength(1);
    expect(inserts[0].values).toMatchObject({ sepay_id: '77', amount: 200000, bank_ref: 'FT9', status: 'open' });
  });

  it('saves a transfer whose order code matches no order', async () => {
    const { db, inserts } = webhookDb(undefined);
    await handleSePayWebhookImpl(db, webhookTables, { id: 78, content: 'CS999999999999', transferAmount: 200000 });
    expect(inserts[0].values.content).toBe('CS999999999999');
  });

  it('does not save money going out', async () => {
    const { db, inserts } = webhookDb(undefined);
    await handleSePayWebhookImpl(db, webhookTables, { id: 79, content: 'abc', transferAmount: 5, transferType: 'out' });
    expect(inserts).toHaveLength(0);
  });
});
