import { describe, it, expect } from 'vitest';
import { SQLiteSyncDialect } from 'drizzle-orm/sqlite-core';
import * as schema from '../../shared/schema';
import {
  vnDayRange,
  vnMonthRange,
  vnYearRange,
  vnDateStringRange,
  vnRangeFromInputs,
  vnYmd,
  currentVnYear,
  revenueInstant,
  sqlPaidInRange,
  sqlListedInRange
} from './vn-time';

const dialect = new SQLiteSyncDialect();

describe('Vietnam day, month and year ranges', () => {
  it('a day runs from 17:00 UTC the day before to 17:00 UTC', () => {
    expect(vnDayRange(2026, 11, 1)).toEqual({ start: '2026-10-31T17:00:00.000Z', end: '2026-11-01T17:00:00.000Z' });
  });

  it('the range is half-open: 00:00 VN belongs to the new day, 23:59:59.999 VN to the old one', () => {
    const day = vnDayRange(2026, 11, 1);
    expect('2026-10-31T17:00:00.000Z' >= day.start).toBe(true); // 00:00 VN on 1 Nov
    expect('2026-11-01T16:59:59.999Z' < day.end).toBe(true); // 23:59:59.999 VN on 1 Nov
    expect('2026-11-01T17:00:00.000Z' < day.end).toBe(false); // 00:00 VN on 2 Nov
  });

  it('a month, including the turn of the year and February of a leap year', () => {
    expect(vnMonthRange(2026, 12)).toEqual({ start: '2026-11-30T17:00:00.000Z', end: '2026-12-31T17:00:00.000Z' });
    expect(vnMonthRange(2026, 11).end).toBe(vnMonthRange(2026, 12).start);
    expect(vnMonthRange(2028, 2).end).toBe('2028-02-29T17:00:00.000Z');
  });

  it('a year starts at 00:00 on 1 January in Vietnam, which is 17:00 UTC on 31 December', () => {
    expect(vnYearRange(2026)).toEqual({ start: '2025-12-31T17:00:00.000Z', end: '2026-12-31T17:00:00.000Z' });
    expect(vnYearRange(2026).end).toBe(vnYearRange(2027).start);
  });

  it('00:00 to 07:00 VN is the same Vietnam day even though UTC is still the day before', () => {
    for (const utcTime of ['2026-11-01T17:00:00.000Z', '2026-11-01T20:30:00.000Z', '2026-11-01T23:59:59.999Z']) {
      expect(vnYmd(new Date(utcTime))).toEqual({ year: 2026, month: 11, day: 2 });
    }
    expect(vnYmd(new Date('2026-11-01T16:59:59.999Z'))).toEqual({ year: 2026, month: 11, day: 1 });
  });
});

describe('the year an order belongs to', () => {
  const year2026 = vnYearRange(2026);
  const inYear = (iso: string) => iso >= year2026.start && iso < year2026.end;

  it('an order created 23:55 on 31 Dec and paid 00:03 on 1 Jan is in the NEW year only (by paid time)', () => {
    const paidAt = '2025-12-31T17:03:00.000Z'; // 00:03 VN, 1 Jan 2026
    expect(inYear(paidAt)).toBe(true);
    expect(vnYmd(new Date(paidAt)).year).toBe(2026);
    // the creation time is 23:55 VN on 31 Dec 2025, which is the old year
    expect(inYear('2025-12-31T16:55:00.000Z')).toBe(false);
    expect(revenueInstant({ paid_at: paidAt, created_at: '2025-12-31T16:55:00.000Z' })?.toISOString()).toBe(paidAt);
  });

  it('currentVnYear follows Vietnam, not the server', () => {
    expect(currentVnYear(new Date('2026-12-31T17:30:00.000Z'))).toBe(2027);
    expect(currentVnYear(new Date('2026-12-31T16:30:00.000Z'))).toBe(2026);
  });
});

describe('vnDateStringRange', () => {
  it('reads a real date', () => {
    expect(vnDateStringRange('2026-11-01')).toEqual(vnDayRange(2026, 11, 1));
  });

  it.each(['', 'abc', '2026-13-01', '2026-02-30', '2026-11-1', '01/11/2026', null, undefined])('refuses %p', (value) => {
    expect(vnDateStringRange(value as any)).toBeNull();
  });
});

describe('vnRangeFromInputs (the filter on a screen)', () => {
  it('a single day is not empty: from and to on the same date cover the whole day', () => {
    const range = vnRangeFromInputs('2026-11-05', '2026-11-05');
    expect(range).toEqual({ start: '2026-11-04T17:00:00.000Z', end: '2026-11-05T17:00:00.000Z' });
  });

  it('1 to 30 November includes both border days completely', () => {
    const range = vnRangeFromInputs('2026-11-01', '2026-11-30');
    expect(range.start).toBe('2026-10-31T17:00:00.000Z');
    expect(range.end).toBe('2026-11-30T17:00:00.000Z');
    expect('2026-11-30T16:59:59.999Z' < range.end!).toBe(true); // 23:59:59.999 VN on 30 Nov
    expect('2026-10-31T17:00:00.000Z' >= range.start!).toBe(true); // 00:00 VN on 1 Nov
  });

  it('a full date and time is that instant, the end included', () => {
    const range = vnRangeFromInputs('2026-11-01T00:00:00.000Z', '2026-11-02T00:00:00.000Z');
    expect(range.start).toBe('2026-11-01T00:00:00.000Z');
    expect(range.end).toBe('2026-11-02T00:00:00.001Z');
  });

  it('works with only one end, and ignores a value that is not a date', () => {
    expect(vnRangeFromInputs('2026-11-01')).toEqual({ start: '2026-10-31T17:00:00.000Z' });
    expect(vnRangeFromInputs(undefined, '2026-11-01')).toEqual({ end: '2026-11-01T17:00:00.000Z' });
    expect(vnRangeFromInputs('nonsense', 'also nonsense')).toEqual({});
  });
});

describe('revenueInstant', () => {
  it('uses paid_at, falls back to created_at, and gives null for a broken date', () => {
    expect(revenueInstant({ paid_at: '2026-11-01T01:00:00Z', created_at: '2026-10-01T00:00:00Z' })?.toISOString()).toBe('2026-11-01T01:00:00.000Z');
    expect(revenueInstant({ paid_at: null, created_at: '2026-10-01T00:00:00Z' })?.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(revenueInstant({ paid_at: 'garbage', created_at: '2026-10-01T00:00:00Z' })).toBeNull();
    expect(revenueInstant({})).toBeNull();
  });
});

describe('the SQL of the revenue conditions', () => {
  const bookings = (schema as any).bookings;
  const render = (condition: any) => dialect.sqlToQuery(condition);

  it('paid in range: paid status, revenue time from the start (included) to the end (excluded)', () => {
    const { sql, params } = render(sqlPaidInRange(bookings, { start: 'S', end: 'E' }));
    expect(sql).toContain('"bookings"."payment_status" in (?)');
    expect(sql).toContain('coalesce("bookings"."paid_at", "bookings"."created_at") >= ?');
    expect(sql).toContain('coalesce("bookings"."paid_at", "bookings"."created_at") < ?');
    expect(params).toEqual(['paid', 'S', 'E']);
  });

  it('listed in range: paid by the day paid, the others by the day created', () => {
    const { sql } = render(sqlListedInRange(bookings, { start: 'S', end: 'E' }));
    expect(sql).toContain('coalesce("bookings"."paid_at", "bookings"."created_at")');
    expect(sql).toContain('"bookings"."payment_status" <> \'paid\'');
    expect(sql).toContain('"bookings"."created_at" >= ?');
  });
});
