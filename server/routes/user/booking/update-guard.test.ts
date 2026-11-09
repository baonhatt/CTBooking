import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SQLiteSyncDialect } from 'drizzle-orm/sqlite-core';
import * as schema from '../../../../shared/schema';
import { updatePaymentImpl } from './update';

vi.mock('../../../lib/mail-queue', () => ({ mailQueue: { add: vi.fn() } }));
vi.mock('../../../lib/booking-utils', () => ({
  generateBookingCode: vi.fn(async () => 'ABCD2345'),
  getBookingEmailTemplate: vi.fn(() => '<p>mail</p>')
}));
vi.mock('../vouchers', () => ({ redeemVoucherAfterPaymentImpl: vi.fn(async () => ({ ok: true })) }));
vi.mock('../../scheduled/booking-expiry', () => ({ releaseVoucherForCancelledBooking: vi.fn(async () => undefined) }));

// The fake database in update.test.ts ignores WHERE. This test reads the real SQL condition of the status change,
// because that condition is what makes two simultaneous requests safe.

const { bookings } = schema as any;
const tables: any = {
  bookings,
  users: (schema as any).users,
  accounts: (schema as any).accounts,
  movies: (schema as any).movies,
  ticket_packages: (schema as any).ticket_packages,
  branches: (schema as any).branches
};
const dialect = new SQLiteSyncDialect();

function captureStatusChangeSql(currentStatus: string, requested: string) {
  const row = { id: 55, user_id: null, payment_status: currentStatus, voucher_id: null, branch_id: null, booking_code: null };
  const lookup: any = { leftJoin: () => lookup, where: () => lookup, limit: async () => [{ booking: row }] };
  const captured: string[] = [];

  const db: any = {
    select: () => ({ from: () => lookup }),
    query: {
      branches: { findFirst: async () => undefined },
      bookings: { findFirst: async () => row }
    },
    update: (table: any) => ({
      set: (values: any) => ({
        where: (condition: any) => {
          if (table === bookings) captured.push(dialect.sqlToQuery(condition).sql);
          const rows = [{ ...row, ...values }];
          return { returning: async () => rows, then: (resolve: any) => Promise.resolve(rows).then(resolve) };
        }
      })
    })
  };
  return { db, captured, run: () => updatePaymentImpl(db, { payment_id: 55, payment_status: requested }, undefined, undefined, tables) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('updatePaymentImpl: the SQL of the status change', () => {
  it('to paid: only changes a row that is not already paid, and says so in the SQL', async () => {
    const { captured, run } = captureStatusChangeSql('pending', 'paid');
    await run();

    expect(captured).toHaveLength(1);
    expect(captured[0]).toMatch(/"bookings"\."id" = \?/);
    expect(captured[0]).toMatch(/coalesce\(lower\("bookings"\."payment_status"\), ''\) <> 'paid'/);
  });

  it('to failed: only changes a row that is pending or expired', async () => {
    const { captured, run } = captureStatusChangeSql('pending', 'failed');
    await run();

    expect(captured[0]).toMatch(/coalesce\(lower\("bookings"\."payment_status"\), ''\) in \('pending', 'expired'\)/);
  });
});
