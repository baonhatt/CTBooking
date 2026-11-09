import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as schema from '../../../../shared/schema';
import { updatePaymentImpl } from './update';
import { mailQueue } from '../../../lib/mail-queue';
import { generateBookingCode } from '../../../lib/booking-utils';
import { redeemVoucherAfterPaymentImpl } from '../vouchers';
import { releaseVoucherForCancelledBooking } from '../../scheduled/booking-expiry';

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

// ---------------------------------------------------------------------------
// One winner per status change (two requests at the same moment)
// ---------------------------------------------------------------------------

/** Same fake database, but the conditional booking UPDATE finds nothing to change, as when another request won. */
function makeLosingDb(row: any, latestRow: any) {
  const { db, updates } = makeDb(row);
  const winnerDb: any = {
    ...db,
    query: { ...db.query, bookings: { findFirst: async () => latestRow } },
    update: (table: any) => ({
      set: (values: any) => ({
        where: () => {
          updates.push({ table, values });
          return { returning: async () => [], then: (resolve: any) => Promise.resolve([]).then(resolve) };
        }
      })
    })
  };
  return { db: winnerDb, updates };
}

describe('updatePaymentImpl: paid twice', () => {
  it('does nothing at all for an order that is already paid (no update, code, voucher log or email)', async () => {
    const { db, updates } = makeDb(bookingRow({ payment_status: 'paid', voucher_id: 1, booking_code: 'ABCD2345' }));

    const result: any = await updatePaymentImpl(db, { payment_id: 55, payment_status: 'paid' }, undefined, undefined, tables);

    expect(result.status).toBe(200);
    expect(result.already_processed).toBe(true);
    expect(updates).toHaveLength(0);
    expect(generateBookingCode).not.toHaveBeenCalled();
    expect(redeemVoucherAfterPaymentImpl).not.toHaveBeenCalled();
    expect(mailQueue.add).not.toHaveBeenCalled();
  });

  it('treats the status in any letter case as paid', async () => {
    const { db, updates } = makeDb(bookingRow({ payment_status: 'PAID' }));

    const result: any = await updatePaymentImpl(db, { payment_id: 55, payment_status: 'paid' }, undefined, undefined, tables);

    expect(result.already_processed).toBe(true);
    expect(updates).toHaveLength(0);
  });

  it('the request that loses the race does no follow-up work and still answers 200', async () => {
    // Both requests read "pending"; the other one already made the order paid
    const { db } = makeLosingDb(
      bookingRow({ voucher_id: 1 }),
      bookingRow({ voucher_id: 1, payment_status: 'paid', booking_code: 'WINNER99' })
    );

    const result: any = await updatePaymentImpl(db, { payment_id: 55, payment_status: 'paid' }, undefined, undefined, tables);

    expect(result.status).toBe(200);
    expect(result.already_processed).toBe(true);
    expect(result.booking.booking_code).toBe('WINNER99');
    expect(redeemVoucherAfterPaymentImpl).not.toHaveBeenCalled();
    expect(mailQueue.add).not.toHaveBeenCalled();
  });

  it('the winner does the follow-up work once: one voucher log and one email', async () => {
    const { db } = makeDb(bookingRow({ voucher_id: 1 }));

    await updatePaymentImpl(db, { payment_id: 55, payment_status: 'paid' }, undefined, undefined, tables);

    expect(redeemVoucherAfterPaymentImpl).toHaveBeenCalledTimes(1);
    expect(mailQueue.add).toHaveBeenCalledTimes(1);
  });

  it('two calls at once for one order give one winner (simulated with a shared status)', async () => {
    let status = 'pending';
    const row = bookingRow();
    const { db: baseDb } = makeDb(row);
    const sharedDb: any = {
      ...baseDb,
      select: () => ({
        from: () => {
          const lookup: any = {
            leftJoin: () => lookup,
            where: () => lookup,
            limit: async () => [{ booking: { ...row, payment_status: status } }]
          };
          return lookup;
        }
      }),
      query: { ...baseDb.query, bookings: { findFirst: async () => ({ ...row, payment_status: status }) } }
    };
    // The conditional update changes the row only if it is not paid yet
    sharedDb.update = () => ({
      set: (values: any) => ({
        where: () => {
          const won = status !== 'paid';
          if (won) status = 'paid';
          const rows = won ? [{ ...row, ...values }] : [];
          return { returning: async () => rows, then: (resolve: any) => Promise.resolve(rows).then(resolve) };
        }
      })
    });

    const results: any[] = await Promise.all([
      updatePaymentImpl(sharedDb, { payment_id: 55, payment_status: 'paid' }, undefined, undefined, tables),
      updatePaymentImpl(sharedDb, { payment_id: 55, payment_status: 'paid' }, undefined, undefined, tables)
    ]);

    expect(results.filter((result) => !result.already_processed)).toHaveLength(1);
    expect(mailQueue.add).toHaveBeenCalledTimes(1);
  });
});

describe('updatePaymentImpl: failed', () => {
  it('still answers 409 for an order that is already paid', async () => {
    const { db, updates } = makeDb(bookingRow({ payment_status: 'paid' }));

    const result: any = await updatePaymentImpl(db, { payment_id: 55, payment_status: 'failed' }, undefined, undefined, tables);

    expect(result.status).toBe(409);
    expect(updates).toHaveLength(0);
  });

  it('answers 409 when the order became paid between the read and the update', async () => {
    const { db } = makeLosingDb(bookingRow(), bookingRow({ payment_status: 'paid' }));

    const result: any = await updatePaymentImpl(db, { payment_id: 55, payment_status: 'failed' }, undefined, undefined, tables);

    expect(result.status).toBe(409);
  });

  it('gives the voucher slot back when it wins, and not when it loses', async () => {
    const winner = makeDb(bookingRow({ voucher_id: 1 }));
    await updatePaymentImpl(winner.db, { payment_id: 55, payment_status: 'failed' }, undefined, undefined, tables);
    expect(releaseVoucherForCancelledBooking).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();
    const loser = makeLosingDb(bookingRow({ voucher_id: 1 }), bookingRow({ voucher_id: 1, payment_status: 'failed' }));
    const result: any = await updatePaymentImpl(loser.db, { payment_id: 55, payment_status: 'failed' }, undefined, undefined, tables);
    expect(result.status).toBe(200);
    expect(result.already_processed).toBe(true);
    expect(releaseVoucherForCancelledBooking).not.toHaveBeenCalled();
  });
});
