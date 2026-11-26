import { describe, it, expect, vi, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { bookings } from '../../../shared/schema';
import { getRevenue7DaysImpl, getRevenueByMonthImpl, getRevenueByDateImpl } from './dashboard';
import { getVnParts } from '../../lib/date-utils';

// The revenue numbers are summed by the database now, so they are tested on a real SQLite database in memory
function makeRevenueDb(rows: Array<{ total_price: number; paid_at?: string | null; created_at: string; payment_status?: string; payment_method?: string }>) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`CREATE TABLE bookings (id INTEGER PRIMARY KEY AUTOINCREMENT, total_price REAL, paid_at TEXT, created_at TEXT,
    payment_status TEXT, payment_method TEXT, branch_id INTEGER)`);
  const insert = sqlite.prepare('insert into bookings (total_price, paid_at, created_at, payment_status, payment_method, branch_id) values (?, ?, ?, ?, ?, 1)');
  for (const row of rows) {
    insert.run(row.total_price, row.paid_at ?? null, row.created_at, row.payment_status || 'paid', row.payment_method || 'vietqr');
  }
  return drizzle(async (query, params, method) => {
    const statement: any = sqlite.prepare(query);
    statement.setReturnArrays(true); // like D1: rows as arrays
    const rows = statement.all(...(params as any[]));
    return { rows: method === 'get' ? rows[0] : rows };
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe('getRevenue7DaysImpl', () => {
  it('groups revenue by VN day: 18:00 UTC on May 15 is already May 16 in Vietnam', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2024-05-16T12:00:00Z'));
    const db = makeRevenueDb([
      { total_price: 150000, created_at: '2024-05-15T18:00:00.000Z' }, // 01:00 May 16 in Vietnam
      { total_price: 50000, created_at: '2024-05-16T00:00:00.000Z' }, // 07:00 May 16 in Vietnam
      { total_price: 30000, created_at: '2024-05-15T16:59:59.000Z' }, // 23:59 May 15 in Vietnam
      { total_price: 99000, created_at: '2024-05-16T01:00:00.000Z', payment_status: 'pending' } // not paid: not counted
    ]);

    const result = await getRevenue7DaysImpl(db, { bookings });

    expect(result.data.map((day) => day.day)).toEqual(['05-10', '05-11', '05-12', '05-13', '05-14', '05-15', '05-16']);
    expect(result.data.find((day) => day.day === '05-16')?.revenue).toBe(200000);
    expect(result.data.find((day) => day.day === '05-15')?.revenue).toBe(30000);
  });

  it('a paid order counts on the day it was PAID, not the day it was ordered', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2024-05-16T12:00:00Z'));
    const db = makeRevenueDb([{ total_price: 70000, created_at: '2024-05-12T03:00:00.000Z', paid_at: '2024-05-14T03:00:00.000Z' }]);

    const result = await getRevenue7DaysImpl(db, { bookings });

    expect(result.data.find((day) => day.day === '05-14')?.revenue).toBe(70000);
    expect(result.data.find((day) => day.day === '05-12')?.revenue).toBe(0);
  });
});

describe('revenue by month and by day (summed in SQL)', () => {
  const rows = [
    { total_price: 100000, created_at: '2026-05-31T16:59:59.000Z', payment_method: 'Cash' }, // May 31, 23:59 VN
    { total_price: 40000, created_at: '2026-05-31T17:00:00.000Z', payment_method: 'vietqr' }, // June 1, 00:00 VN
    { total_price: 60000, created_at: '2026-06-10T02:00:00.000Z', payment_method: 'VietQR' },
    { total_price: 5000, created_at: '2026-06-11T02:00:00.000Z', payment_status: 'expired' }
  ];

  it('every month of the year: the Vietnam month decides', async () => {
    const result: any = await getRevenueByMonthImpl(makeRevenueDb(rows), { bookings }, { year: '2026' });
    expect(result.data[4]).toEqual({ month: 5, revenue: 100000 });
    expect(result.data[5]).toEqual({ month: 6, revenue: 100000 });
  });

  it('one month: total, number of orders and the cash / VietQR split (any letter case)', async () => {
    const result: any = await getRevenueByMonthImpl(makeRevenueDb(rows), { bookings }, { year: '2026', month: '6' });
    expect(result).toEqual({ total: 100000, count: 2, revenueByMethod: { cash: 0, vietqr: 100000 } });
  });

  it('one day', async () => {
    const result: any = await getRevenueByDateImpl(makeRevenueDb(rows), { bookings }, { date: '2026-05-31' });
    expect(result).toEqual({ date: '2026-05-31', total: 100000, count: 1, revenueByMethod: { cash: 100000, vietqr: 0 } });
  });
});

describe('getVnParts', () => {
  it('correctly maps 01:00 VN time (18:00 UTC previous day) to the correct VN day without drifting backwards', () => {
    // 2026-09-21 18:00:00 UTC -> 2026-09-22 01:00:00 VN Time
    const parts = getVnParts(new Date('2026-09-21T18:00:00.000Z'));
    expect(parts?.year).toBe(2026);
    expect(parts?.month).toBe(9);
    expect(parts?.day).toBe(22);
    expect(parts?.hour).toBe(1);
    expect(parts?.dateString).toBe('2026-09-22');
  });

  it('correctly shifts to next day string when given the exact 00:00:00 VN time crossing (17:00:00 UTC)', () => {
    // 2026-09-21 17:00:00 UTC -> 2026-09-22 00:00:00 VN Time
    const partsPreviousMinute = getVnParts(new Date('2026-09-21T16:59:59.999Z'));
    expect(partsPreviousMinute?.dateString).toBe('2026-09-21');
    expect(partsPreviousMinute?.hour).toBe(23);

    const partsCrossing = getVnParts(new Date('2026-09-21T17:00:00.000Z'));
    expect(partsCrossing?.dateString).toBe('2026-09-22');
    expect(partsCrossing?.hour).toBe(0);
  });

  it('correctly maps weekday to Sunday (0) when VN time is Sunday early morning, even though UTC date is still Saturday', () => {
    // 2026-09-20 is Sunday VN Time (and UTC). Let's pick 01:00 VN Time on Sunday 2026-09-20
    // UTC time will be 2026-09-19T18:00:00.000Z (Saturday)
    const dateSaturdayUTC = new Date('2026-09-19T18:00:00.000Z');
    
    // Default UTC behavior returns 6 for Saturday (Saturday 18:00 UTC is still Saturday)
    expect(dateSaturdayUTC.getUTCDay()).toBe(6);

    const parts = getVnParts(dateSaturdayUTC);
    
    // In VN Time, it has passed midnight onto Sunday (dayOfWeek 0)
    expect(parts?.dayOfWeek).toBe(0);
    expect(parts?.hour).toBe(1);
    // Explicitly confirm it is Sun from the weekday name map logic internally
    expect(parts?.dateString).toBe('2026-09-20');
  });
});

