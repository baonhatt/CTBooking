import { describe, it, expect, vi } from 'vitest';
import { redeemVoucherAfterPaymentImpl } from './vouchers';

const tables: any = {
  vouchers: { id: 'vouchers.id' },
  voucher_redemption_logs: { booking_id: 'logs.booking_id' },
  bookings: {}
};

const args = {
  voucher_id: 11,
  booking_id: 55,
  user_id: 3,
  discount_amount_applied: 10000,
  order_total_before_discount: 100000,
  order_total_after_discount: 90000
};

function makeDb(existingLog: any) {
  const inserts: any[] = [];
  const db: any = {
    query: {
      vouchers: { findFirst: vi.fn(async () => ({ id: 11, description: '' })) },
      voucher_redemption_logs: { findFirst: vi.fn(async () => existingLog) }
    },
    insert: () => ({
      values: async (values: any) => {
        inserts.push(values);
      }
    })
  };
  return { db, inserts };
}

describe('redeemVoucherAfterPaymentImpl: one log per booking', () => {
  it('writes the log the first time', async () => {
    const { db, inserts } = makeDb(undefined);

    const result: any = await redeemVoucherAfterPaymentImpl(db, tables, args);

    expect(result.ok).toBe(true);
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({ voucher_id: 11, booking_id: 55, discount_amount_applied: '10000' });
  });

  it('writes nothing when the booking already has a log', async () => {
    const { db, inserts } = makeDb({ id: 1, booking_id: 55 });

    const result: any = await redeemVoucherAfterPaymentImpl(db, tables, args);

    expect(result.ok).toBe(true);
    expect(result.already_logged).toBe(true);
    expect(inserts).toHaveLength(0);
  });

  it('still refuses a call with no voucher or booking', async () => {
    const { db, inserts } = makeDb(undefined);

    const result: any = await redeemVoucherAfterPaymentImpl(db, tables, { ...args, booking_id: 0 });

    expect(result.ok).toBe(false);
    expect(inserts).toHaveLength(0);
  });
});
