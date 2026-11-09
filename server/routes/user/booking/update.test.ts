import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as schema from '../../../../shared/schema';
import { updatePaymentImpl } from './update';

vi.mock('../../../lib/mail-queue', () => ({ mailQueue: { add: vi.fn() } }));
vi.mock('../../../lib/booking-utils', () => ({
  generateBookingCode: vi.fn(async () => 'ABCD2345'),
  getBookingEmailTemplate: vi.fn(() => '<p>mail</p>')
}));
vi.mock('../vouchers', () => ({ redeemVoucherAfterPaymentImpl: vi.fn(async () => ({ ok: true })) }));
vi.mock('../../scheduled/booking-expiry', () => ({ releaseVoucherForCancelledBooking: vi.fn(async () => undefined) }));

const { bookings, vouchers } = schema as any;
const tables: any = {
  bookings,
  users: (schema as any).users,
  accounts: (schema as any).accounts,
  movies: (schema as any).movies,
  ticket_packages: (schema as any).ticket_packages,
  branches: (schema as any).branches,
  vouchers,
  voucher_redemption_logs: (schema as any).voucher_redemption_logs
};

function bookingRow(overrides: Record<string, any> = {}) {
  return {
    id: 55,
    user_id: null,
    payment_status: 'pending',
    voucher_id: null,
    branch_id: null,
    booking_code: null,
    email: 'guest@example.com',
    total_price: 100000,
    ...overrides
  };
}

/**
 * Fake database. The booking lookup returns `row`. A booking update returns the row merged with the new values.
 * A voucher update returns `voucherRelockRows`, which stands for "rows changed by the conditional update".
 */
function makeDb(row: any, voucherRelockRows: any[] = [{ id: 1 }]) {
  const updates: Array<{ table: any; values: any }> = [];

  const lookup: any = {
    leftJoin: () => lookup,
    where: () => lookup,
    limit: async () => [{ booking: row }]
  };

  const db: any = {
    select: () => ({ from: () => lookup }),
    query: { branches: { findFirst: async () => undefined } },
    update: (table: any) => ({
      set: (values: any) => ({
        where: () => {
          updates.push({ table, values });
          const rows = table === vouchers ? voucherRelockRows : [{ ...row, ...values }];
          return {
            returning: async () => rows,
            then: (resolve: any, reject: any) => Promise.resolve(rows).then(resolve, reject)
          };
        }
      })
    })
  };
  return { db, updates };
}

const voucherUpdates = (updates: Array<{ table: any }>) => updates.filter((entry) => entry.table === vouchers);
const bookingUpdate = (updates: Array<{ table: any; values: any }>) => updates.find((entry) => entry.table === bookings)!;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('updatePaymentImpl: who confirmed', () => {
  it('stores the confirming staff member when the booking becomes paid', async () => {
    const { db, updates } = makeDb(bookingRow());

    const result: any = await updatePaymentImpl(
      db,
      { payment_id: 55, payment_status: 'paid', confirmed_by_staff_id: 7 },
      undefined,
      undefined,
      tables
    );

    expect(result.status).toBe(200);
    expect(bookingUpdate(updates).values.confirmed_by_staff_id).toBe(7);
    expect(bookingUpdate(updates).values.payment_status).toBe('paid');
  });

  it('does not touch confirmed_by_staff_id when it is not given (webhook) or when the status is failed', async () => {
    const webhook = makeDb(bookingRow());
    await updatePaymentImpl(webhook.db, { payment_id: 55, payment_status: 'paid' }, undefined, undefined, tables);
    expect(bookingUpdate(webhook.updates).values).not.toHaveProperty('confirmed_by_staff_id');

    const failed = makeDb(bookingRow());
    await updatePaymentImpl(
      failed.db,
      { payment_id: 55, payment_status: 'failed', confirmed_by_staff_id: 7 },
      undefined,
      undefined,
      tables
    );
    expect(bookingUpdate(failed.updates).values).not.toHaveProperty('confirmed_by_staff_id');
  });
});

describe('updatePaymentImpl: voucher slot when a failed or expired booking is paid by hand', () => {
  it.each(['failed', 'expired', 'cancelled'])('takes the voucher slot again for a %s booking', async (previous) => {
    const { db, updates } = makeDb(bookingRow({ payment_status: previous, voucher_id: 1 }), [{ id: 1 }]);

    const result: any = await updatePaymentImpl(db, { payment_id: 55, payment_status: 'paid' }, undefined, undefined, tables);

    expect(voucherUpdates(updates)).toHaveLength(1);
    expect(result.voucher_slot_unavailable).toBe(false);
  });

  it('still accepts the payment but reports it when the voucher has no slot left', async () => {
    const { db, updates } = makeDb(bookingRow({ payment_status: 'expired', voucher_id: 1 }), []);

    const result: any = await updatePaymentImpl(db, { payment_id: 55, payment_status: 'paid' }, undefined, undefined, tables);

    expect(result.status).toBe(200);
    expect(result.voucher_slot_unavailable).toBe(true);
    expect(bookingUpdate(updates).values.payment_status).toBe('paid');
  });

  it('does not take a slot for a booking that is still pending (the slot was never released)', async () => {
    const { db, updates } = makeDb(bookingRow({ payment_status: 'pending', voucher_id: 1 }));

    const result: any = await updatePaymentImpl(db, { payment_id: 55, payment_status: 'paid' }, undefined, undefined, tables);

    expect(voucherUpdates(updates)).toHaveLength(0);
    expect(result.voucher_slot_unavailable).toBe(false);
  });

  it('does nothing about vouchers for a booking without one', async () => {
    const { db, updates } = makeDb(bookingRow({ payment_status: 'failed', voucher_id: null }));

    await updatePaymentImpl(db, { payment_id: 55, payment_status: 'paid' }, undefined, undefined, tables);

    expect(voucherUpdates(updates)).toHaveLength(0);
  });
});
