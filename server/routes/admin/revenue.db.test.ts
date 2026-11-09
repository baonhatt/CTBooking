import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as schema from '../../../shared/schema';
import { makeSqliteDb, insertRows } from '../../test-utils/sqlite-db';
import {
  getDashboardMetricsImpl,
  getRevenueByDateImpl,
  getRevenueByMonthImpl,
  getRevenue7DaysImpl,
  topTicketsRange
} from './dashboard';
import { getRevenueImpl, listTransactionsImpl } from './payments';

// These tests run the real SQL on an in-memory SQLite database, so the WHERE clauses are really exercised.

const TABLES = ['movies', 'toys', 'users', 'accounts', 'bookings', 'ticket_packages', 'branches', 'booking_vr_items', 'voucher_redemption_logs', 'vouchers'];

const tables: any = {
  movies: (schema as any).movies,
  toys: (schema as any).toys,
  users: (schema as any).users,
  accounts: (schema as any).accounts,
  bookings: (schema as any).bookings,
  ticket_packages: (schema as any).ticket_packages,
  branches: (schema as any).branches,
  booking_vr_items: (schema as any).booking_vr_items,
  voucher_redemption_logs: (schema as any).voucher_redemption_logs,
  vouchers: (schema as any).vouchers
};

let db: any;
let raw: any;
let nextId = 1;

function booking(overrides: Record<string, unknown>) {
  return {
    id: nextId++,
    user_id: null,
    email: 'guest@example.com',
    branch_id: 1,
    booking_type: 'movie',
    payment_status: 'paid',
    payment_method: 'vietqr',
    total_price: 100000,
    ticket_count: 1,
    is_used: 0,
    created_at: '2026-06-15T03:00:00.000Z',
    paid_at: '2026-06-15T03:05:00.000Z',
    ...overrides
  };
}

beforeEach(() => {
  nextId = 1;
  ({ db, raw } = makeSqliteDb(TABLES));
});

afterEach(() => {
  vi.useRealTimers();
});

// The case from the plan: created 23:55 on 31 Dec (VN), paid 00:03 on 1 Jan (VN)
const NEW_YEAR_ORDER = {
  created_at: '2025-12-31T16:55:00.000Z',
  paid_at: '2025-12-31T17:03:00.000Z',
  total_price: 200000
};

const metrics = (year: number, restrict: number[] | null = null, canViewRevenue = true) =>
  getDashboardMetricsImpl(db, tables, 'year', year, restrict, { canViewRevenue });

describe('revenue by year: one definition everywhere', () => {
  beforeEach(() => {
    insertRows(raw, 'bookings', [
      booking({ ...NEW_YEAR_ORDER }),
      booking({ total_price: 100000 }), // paid 15 Jun 2026
      booking({ total_price: 50000, payment_method: 'cash', paid_at: '2026-12-31T16:59:00.000Z', created_at: '2026-12-31T16:00:00.000Z' }), // 23:59 VN on 31 Dec 2026
      booking({ total_price: 70000, paid_at: null, created_at: '2026-02-01T03:00:00.000Z' }), // old order without paid_at
      booking({ total_price: 900000, payment_status: 'pending', paid_at: null }), // never counts
      booking({ total_price: 800000, payment_status: 'failed', paid_at: null }) // never counts
    ]);
  });

  it('the order paid just after midnight is in the new year only', async () => {
    const y2026 = await metrics(2026);
    const y2025 = await metrics(2025);

    expect(y2026.revenueTotal).toBe(200000 + 100000 + 50000 + 70000);
    expect(y2025.revenueTotal).toBe(0);
  });

  it('the year card, the sum of the 12 months, the by-date total and /revenue all agree', async () => {
    const card = (await metrics(2026)).revenueTotal;
    const months: any = await getRevenueByMonthImpl(db, tables, { year: '2026' });
    const monthsTotal = months.data.reduce((sum: number, row: any) => sum + row.revenue, 0);
    const byDate: any = await getRevenueByDateImpl(db, tables, { year: 2026 });
    const revenue: any = await getRevenueImpl(db, tables, { from: '2026-01-01', to: '2026-12-31' });

    expect(card).toBe(420000);
    expect(monthsTotal).toBe(card);
    expect(byDate.total).toBe(card);
    expect(revenue.total).toBe(card);
  });

  it('puts the new-year order in January 2026, the old order by its creation day, and the last-minute order in December', async () => {
    const months: any = await getRevenueByMonthImpl(db, tables, { year: '2026' });
    expect(months.data[0].revenue).toBe(200000); // January: paid 00:03 on 1 Jan
    expect(months.data[1].revenue).toBe(70000); // February: no paid_at, created 1 Feb
    expect(months.data[5].revenue).toBe(100000); // June
    expect(months.data[11].revenue).toBe(50000); // December: paid 23:59 on 31 Dec
  });

  it('one month and one day use the same rule', async () => {
    const january: any = await getRevenueByMonthImpl(db, tables, { year: '2026', month: '1' });
    expect(january.total).toBe(200000);
    expect(january.count).toBe(1);

    const newYearsDay: any = await getRevenueByDateImpl(db, tables, { date: '2026-01-01' });
    const newYearsEve: any = await getRevenueByDateImpl(db, tables, { date: '2025-12-31' });
    expect(newYearsDay.total).toBe(200000);
    expect(newYearsEve.total).toBe(0);
  });

  it('splits cash and VietQR', async () => {
    const result: any = await getRevenueByDateImpl(db, tables, { year: 2026 });
    expect(result.revenueByMethod).toEqual({ cash: 50000, vietqr: 370000 });
  });

  it('status "all" lists unpaid orders too, by the day they were created', async () => {
    const result: any = await getRevenueByDateImpl(db, tables, { year: 2026, status: 'all' });
    expect(result.total).toBe(420000 + 900000 + 800000);
  });

  it('an invalid date gives zero, not the whole year', async () => {
    const result: any = await getRevenueByDateImpl(db, tables, { date: '2026-02-30' });
    expect(result.total).toBe(0);
  });

  it('counts orders by branch', async () => {
    insertRows(raw, 'bookings', [booking({ branch_id: 2, total_price: 5000 })]);
    expect((await metrics(2026, [2])).revenueTotal).toBe(5000);
    expect((await metrics(2026, [])).revenueTotal).toBe(0);
    expect((await metrics(2026, null)).revenueTotal).toBe(425000);
  });
});

describe('payment health and booking hours stay on the moment of ordering', () => {
  it('counts the new-year order in 2025 for payment health (created 23:55 on 31 Dec) and 23h for booking hours', async () => {
    insertRows(raw, 'bookings', [booking({ ...NEW_YEAR_ORDER }), booking({ payment_status: 'pending', paid_at: null, created_at: '2025-12-31T16:00:00.000Z' })]);

    const y2025 = await metrics(2025);
    const y2026 = await metrics(2026);

    expect(y2025.paymentHealth).toEqual({ paid: 1, pending: 1, failed: 0 });
    expect(y2026.paymentHealth).toEqual({ paid: 0, pending: 0, failed: 0 });
    expect(y2025.bookingHours[23]).toBe(1);
  });
});

describe('revenue breakdown', () => {
  it('movie and VR add up to the revenue total; a VR order without lines is all VR', async () => {
    insertRows(raw, 'bookings', [
      booking({ id: 101, booking_type: 'movie', total_price: 100000 }),
      booking({ id: 102, booking_type: 'combo_vr', total_price: 150000 }),
      booking({ id: 103, booking_type: 'vr', total_price: 60000 }),
      booking({ id: 104, booking_type: 'vr', total_price: 40000 }) // no saved lines
    ]);
    insertRows(raw, 'booking_vr_items', [
      { booking_id: 102, unit_price: 50000, quantity: 2, line_total: 90000 }, // 100000 minus a voucher
      { booking_id: 103, unit_price: 30000, quantity: 2, line_total: 60000 }
    ]);

    const result: any = await metrics(2026);

    expect(result.revenueBreakdown.vr).toBe(90000 + 60000 + 40000);
    expect(result.revenueBreakdown.movie).toBe(100000 + (150000 - 90000));
    expect(result.revenueBreakdown.movie + result.revenueBreakdown.vr).toBe(result.revenueTotal);
    expect(result.revenueBreakdown).not.toHaveProperty('combo');
  });

  it('never lets the VR part go above the order total', async () => {
    insertRows(raw, 'bookings', [booking({ id: 201, booking_type: 'vr', total_price: 10000 })]);
    insertRows(raw, 'booking_vr_items', [{ booking_id: 201, unit_price: 50000, quantity: 1, line_total: 50000 }]);

    const result: any = await metrics(2026);

    expect(result.revenueBreakdown).toEqual({ movie: 0, vr: 10000 });
  });
});

describe('voucher impact', () => {
  it('counts only discounts of orders paid in the year, in the branches the staff member sees', async () => {
    insertRows(raw, 'bookings', [
      booking({ id: 301 }),
      booking({ id: 302, ...NEW_YEAR_ORDER }), // 2026 by paid time
      booking({ id: 303, branch_id: 2 }),
      booking({ id: 304, created_at: '2025-06-01T03:00:00.000Z', paid_at: '2025-06-01T03:05:00.000Z' }),
      booking({ id: 305, payment_status: 'failed', paid_at: null })
    ]);
    insertRows(raw, 'voucher_redemption_logs', [
      { voucher_id: 1, booking_id: 301, discount_amount_applied: 10000, redeemed_at: '2026-06-15T03:05:00.000Z', order_total_before_discount: 0, order_total_after_discount: 0 },
      { voucher_id: 1, booking_id: 302, discount_amount_applied: 20000, redeemed_at: '2025-12-31T17:03:00.000Z', order_total_before_discount: 0, order_total_after_discount: 0 },
      { voucher_id: 1, booking_id: 303, discount_amount_applied: 30000, redeemed_at: '2026-06-15T03:05:00.000Z', order_total_before_discount: 0, order_total_after_discount: 0 },
      { voucher_id: 1, booking_id: 304, discount_amount_applied: 40000, redeemed_at: '2025-06-01T03:05:00.000Z', order_total_before_discount: 0, order_total_after_discount: 0 },
      { voucher_id: 1, booking_id: 305, discount_amount_applied: 50000, redeemed_at: '2026-06-15T03:05:00.000Z', order_total_before_discount: 0, order_total_after_discount: 0 }
    ]);

    expect((await metrics(2026)).voucherImpact).toBe(10000 + 20000 + 30000);
    expect((await metrics(2026, [1])).voucherImpact).toBe(10000 + 20000);
    expect((await metrics(2025)).voucherImpact).toBe(40000);
  });
});

describe('money is hidden without the view_revenue right', () => {
  beforeEach(() => {
    insertRows(raw, 'bookings', [booking({ email: 'vip@example.com', user_id: 9 })]);
  });

  it('removes every money field and the VIP emails, and keeps the counts', async () => {
    const result: any = await metrics(2026, null, false);

    for (const field of ['revenueTotal', 'revenueByMethod', 'revenueBreakdown', 'voucherImpact', 'topVipUsers']) {
      expect(result).not.toHaveProperty(field);
    }
    expect(result.revenue_hidden).toBe(true);
    expect(result.totalTransactions).toBe(1);
    expect(JSON.stringify(result)).not.toContain('vip@example.com');
    for (const item of result.topTicketsWeek) expect(item).not.toHaveProperty('revenue');
    for (const item of result.paymentStats) expect(item).not.toHaveProperty('revenue');
  });

  it('is hidden by default when the caller does not say', async () => {
    const result: any = await getDashboardMetricsImpl(db, tables, 'year', 2026, null);
    expect(result.revenue_hidden).toBe(true);
    expect(result).not.toHaveProperty('revenueTotal');
  });

  it('returns the money to staff who may see it', async () => {
    const result: any = await metrics(2026, null, true);
    expect(result.revenueTotal).toBe(100000);
    expect(result.topVipUsers[0].email).toBe('vip@example.com');
    expect(result).not.toHaveProperty('revenue_hidden');
  });
});

describe('last 7 days', () => {
  it('counts an order on the Vietnam day it was paid, and leaves out older ones', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-09T10:00:00.000Z')); // 17:00 VN on 9 Nov
    insertRows(raw, 'bookings', [
      booking({ total_price: 100000, paid_at: '2026-11-08T17:30:00.000Z', created_at: '2026-11-01T00:00:00.000Z' }), // 00:30 VN on 9 Nov
      booking({ total_price: 50000, paid_at: '2026-11-09T08:00:00.000Z' }),
      booking({ total_price: 70000, paid_at: '2026-11-02T16:59:00.000Z' }), // 23:59 VN on 2 Nov: outside the 7 days
      booking({ total_price: 30000, paid_at: '2026-11-02T17:00:00.000Z' }) // 00:00 VN on 3 Nov: the first day
    ]);

    const { data } = await getRevenue7DaysImpl(db, tables);

    expect(data.map((d) => d.day)).toEqual(['11-03', '11-04', '11-05', '11-06', '11-07', '11-08', '11-09']);
    expect(data[0].revenue).toBe(30000);
    expect(data[6].revenue).toBe(150000);
    expect(data.reduce((sum, d) => sum + d.revenue, 0)).toBe(180000);
  });

  it('a row with a broken date does not stop the report', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-09T10:00:00.000Z'));
    insertRows(raw, 'bookings', [booking({ total_price: 50000, paid_at: '2026-11-09T08:00:00.000Z' })]);
    raw.exec("UPDATE bookings SET paid_at = 'not a date' WHERE id = 1");
    insertRows(raw, 'bookings', [booking({ total_price: 20000, paid_at: '2026-11-09T08:00:00.000Z' })]);

    const { data } = await getRevenue7DaysImpl(db, tables);

    // the broken row is not found by the range at all (its text is outside it), the good one is counted
    expect(data[6].revenue).toBe(20000);
  });
});

describe('top tickets window', () => {
  const now = new Date('2026-11-09T10:00:00.000Z');

  it('week: the last 7 Vietnam days from 00:00, inside the year', () => {
    expect(topTicketsRange('week', 2026, now)).toEqual({ start: '2026-11-02T17:00:00.000Z', end: '2026-12-31T17:00:00.000Z' });
  });

  it('month: the last 30 days; year: the whole year', () => {
    expect(topTicketsRange('month', 2026, now).start).toBe('2026-10-10T17:00:00.000Z');
    expect(topTicketsRange('year', 2026, now)).toEqual({ start: '2025-12-31T17:00:00.000Z', end: '2026-12-31T17:00:00.000Z' });
  });

  it('never starts before the year', () => {
    expect(topTicketsRange('week', 2026, new Date('2026-01-03T10:00:00.000Z')).start).toBe('2025-12-31T17:00:00.000Z');
  });

  it('a past year ends at the end of that year, with both ends inside it', () => {
    const range = topTicketsRange('week', 2024, now);
    expect(range.end).toBe('2024-12-31T17:00:00.000Z');
    expect(range.start).toBe('2024-12-24T17:00:00.000Z');
  });
});

describe('transaction list filters (Vietnam days)', () => {
  const baseArgs: any = { page: 1, pageSize: 100, searchText: '', status: 'all', sort: 'created_at', dir: 'asc', payment_method: '' };

  beforeEach(() => {
    insertRows(raw, 'bookings', [
      booking({ id: 401, created_at: '2026-10-31T17:00:00.000Z', paid_at: '2026-10-31T17:05:00.000Z' }), // 00:00 VN on 1 Nov
      booking({ id: 402, created_at: '2026-11-30T16:59:00.000Z', paid_at: '2026-11-30T16:59:30.000Z' }), // 23:59 VN on 30 Nov
      booking({ id: 403, created_at: '2026-10-31T16:59:00.000Z', paid_at: '2026-10-31T16:59:30.000Z' }), // 23:59 VN on 31 Oct: outside
      booking({ id: 404, created_at: '2026-11-30T17:00:00.000Z', paid_at: '2026-11-30T17:01:00.000Z' }), // 00:00 VN on 1 Dec: outside
      booking({ id: 405, payment_status: 'pending', paid_at: null, created_at: '2026-11-15T03:00:00.000Z' }),
      booking({ id: 406, created_at: '2026-10-31T10:00:00.000Z', paid_at: '2026-11-10T03:00:00.000Z' }) // created in Oct, paid in Nov
    ]);
  });

  const ids = async (extra: Record<string, unknown>) => {
    const result: any = await listTransactionsImpl(db, tables, { ...baseArgs, ...extra });
    return result.items.map((item: any) => item.id).sort((a: number, b: number) => a - b);
  };

  it('1 to 30 November shows the orders of both border days, and not the days next to them', async () => {
    expect(await ids({ from: '2026-11-01', to: '2026-11-30' })).toEqual([401, 402, 405, 406]);
  });

  it('a single day is not empty', async () => {
    expect(await ids({ from: '2026-11-01', to: '2026-11-01' })).toEqual([401]);
    expect(await ids({ from: '2026-11-30', to: '2026-11-30' })).toEqual([402]);
  });

  it('paid orders are found by the day paid, the others by the day created', async () => {
    expect(await ids({ status: 'paid', from: '2026-11-10', to: '2026-11-10' })).toEqual([406]);
    expect(await ids({ status: 'pending', from: '2026-11-15', to: '2026-11-15' })).toEqual([405]);
    expect(await ids({ status: 'pending', from: '2026-11-10', to: '2026-11-10' })).toEqual([]);
  });

  it('works with one end only', async () => {
    expect(await ids({ from: '2026-11-30' })).toEqual([402, 404]);
    expect(await ids({ to: '2026-10-31' })).toEqual([403]);
  });
});

describe('ticket count in the list', () => {
  it('shows the tickets of the order: 3 VR tickets are 3, not 6', async () => {
    insertRows(raw, 'bookings', [booking({ id: 501, booking_type: 'vr', ticket_count: 3 }), booking({ id: 502, booking_type: 'combo_vr', ticket_count: 4 })]);
    insertRows(raw, 'booking_vr_items', [
      { booking_id: 501, package_name: 'VR 30', quantity: 3 },
      { booking_id: 502, package_name: 'VR 30', quantity: 2 }
    ]);

    const result: any = await listTransactionsImpl(db, tables, {
      page: 1,
      pageSize: 100,
      searchText: '',
      status: 'all',
      sort: 'created_at',
      dir: 'asc',
      payment_method: ''
    });

    const counts = Object.fromEntries(result.items.map((item: any) => [item.id, item.ticketCount]));
    expect(counts[501]).toBe(3);
    expect(counts[502]).toBe(4);
  });

  it('reads the VR lines of more than 100 orders without a database error', async () => {
    const orders = Array.from({ length: 150 }, (_, i) => booking({ id: 1000 + i, booking_type: 'vr', ticket_count: 1 }));
    insertRows(raw, 'bookings', orders);
    insertRows(raw, 'booking_vr_items', orders.map((order) => ({ booking_id: order.id, package_name: 'VR', quantity: 1 })));

    const result: any = await listTransactionsImpl(db, tables, {
      page: 1,
      pageSize: 150,
      searchText: '',
      status: 'all',
      sort: 'created_at',
      dir: 'asc',
      payment_method: ''
    });

    expect(result.items).toHaveLength(150);
    expect(result.items.every((item: any) => item.vr_items.length === 1)).toBe(true);
  });
});
