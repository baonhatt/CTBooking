import { describe, it, expect } from 'vitest';
import * as schema from '../../../shared/schema';
import { listUserTransactionsImpl } from './users';

/**
 * A fake drizzle db: every select() chain, when awaited, gives the next queued result. The columns asked for by each
 * select() are recorded.
 */
function fakeDb(results: any[][]) {
  const selected: Array<Record<string, any> | undefined> = [];
  const db: any = {
    query: {
      accounts: { findFirst: async () => ({ id: 1, user_id: 3, email: 'me@example.com' }) }
    },
    select: (columns?: Record<string, any>) => {
      selected.push(columns);
      const chain: any = {};
      for (const method of ['from', 'where', 'orderBy', 'offset', 'limit', 'leftJoin', 'innerJoin']) {
        chain[method] = () => chain;
      }
      chain.then = (resolve: any, reject: any) => Promise.resolve(results.shift() ?? []).then(resolve, reject);
      return chain;
    }
  };
  return { db, selected };
}

const BOOKING = {
  id: 55,
  booking_code: 'TK123456',
  pay_txt_code: 'CS482913057741',
  payment_expires_at: null,
  branch_id: 2,
  booking_type: 'combo_vr',
  movie_title: '["Phim A"]',
  ticket_package_name: 'Vé 1 người',
  ticket_count: 2,
  total_price: 90000,
  original_total_price: 100000,
  voucher_discount_amount: 10000,
  voucher_code_snapshot: 'SALE10',
  voucher_id: 7,
  payment_method: 'vietqr',
  payment_status: 'paid',
  transaction_id: 'TX1',
  created_at: '2026-11-20T10:00:00.000Z',
  updated_at: '2026-11-20T10:05:00.000Z',
  paid_at: '2026-11-20T10:02:00.000Z',
  expiry_date: '2026-12-20T10:02:00.000Z',
  is_used: false,
  combo: '[1,2]'
};

const tables = {
  accounts: schema.accounts,
  bookings: schema.bookings,
  booking_vr_items: schema.booking_vr_items,
  vouchers: schema.vouchers,
  branches: schema.branches
};

const args = { accountId: 1, status: 'all', page: 1, pageSize: 10, sort: 'created_at', dir: 'desc' as const, payment_method: '' };

describe('listUserTransactionsImpl', () => {
  it('returns the fields the account page reads, without contact details, user id or the voucher description', async () => {
    const { db, selected } = fakeDb([
      [{ count: 1 }],
      [{ booking: BOOKING }],
      [{ booking_id: 55, vr_ticket_package_id: 9, package_name: 'VR', quantity: 1, unit_price: 50000, line_total: 45000 }],
      [{ id: 2, name: 'Chi nhánh B', address: '1 Đường A' }],
      [{ id: 7, scope: 'all', all_packages: 0 }],
      // The voucher's packages (voucher_packages)
      [{ voucher_id: 7, package_id: 9 }]
    ]);

    const result: any = await listUserTransactionsImpl(db, tables, args);
    const item = result.items[0];

    expect(Object.keys(item).sort()).toEqual(
      [
        'amount',
        'booking_code',
        'booking_id',
        'booking_type',
        'branch_address',
        'branch_id',
        'branch_name',
        'combo',
        'created_at',
        'discount_amount',
        'expiry_date',
        'is_used',
        'method',
        'movie',
        'order_token',
        'original_amount',
        'paid_at',
        'pay_txt_code',
        'payment_expires_at',
        'payment_received_late',
        'payment_status',
        'quantity',
        'ticket_package',
        'updated_at',
        'voucher_code',
        'voucher_details',
        'vr_items'
      ].sort()
    );
    expect(item.voucher_details).toEqual({ scope: 'all', applicable_ids: [9] });
    expect(item.vr_items).toEqual([
      { vr_ticket_package_id: 9, package_name: 'VR', quantity: 1, unit_price: 50000, line_total: 45000 }
    ]);
    expect(item.branch_name).toBe('Chi nhánh B');

    // The booking query names its columns (no join of movies or packages), and the voucher query skips the description
    const bookingColumns = Object.keys(selected[1]?.booking || {});
    expect(bookingColumns).not.toContain('name');
    expect(bookingColumns).not.toContain('email');
    expect(bookingColumns).not.toContain('phone');
    expect(Object.keys(selected[1] || {})).toEqual(['booking']);
    expect(Object.keys(selected[4] || {}).sort()).toEqual(['all_packages', 'id', 'scope']);
  });

  it('gives an empty list without an account', async () => {
    const { db } = fakeDb([]);
    expect((await listUserTransactionsImpl(db, tables, { ...args, accountId: undefined })).items).toEqual([]);
  });
});
