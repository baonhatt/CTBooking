import { and, or, gte, lt, sql, inArray } from 'drizzle-orm';

// Vietnam time (UTC+7, no daylight saving) for reports.
//
// One rule for revenue everywhere: an order counts when it is PAID, on the day it was paid (Vietnam time).
// Orders from before paid_at was kept fall back to created_at. Times are stored as ISO text in UTC, so a range is a
// half-open pair of ISO strings [start, end) and is compared as text.

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** A half-open range of UTC instants as ISO text: start is included, end is not. */
export interface IsoRange {
  start: string;
  end: string;
}

/** The instant (as a Date) when the given Vietnam calendar day starts. Month is 1 to 12. */
export function vnDayStart(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day) - VN_OFFSET_MS);
}

export function vnDayRange(year: number, month: number, day: number): IsoRange {
  const start = vnDayStart(year, month, day);
  return { start: start.toISOString(), end: new Date(start.getTime() + DAY_MS).toISOString() };
}

export function vnMonthRange(year: number, month: number): IsoRange {
  return {
    start: vnDayStart(year, month, 1).toISOString(),
    end: (month === 12 ? vnDayStart(year + 1, 1, 1) : vnDayStart(year, month + 1, 1)).toISOString()
  };
}

export function vnYearRange(year: number): IsoRange {
  return { start: vnDayStart(year, 1, 1).toISOString(), end: vnDayStart(year + 1, 1, 1).toISOString() };
}

/** The range of one Vietnam day given as "YYYY-MM-DD", or null when it is not a real date. */
export function vnDateStringRange(dateString: string): IsoRange | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateString || '').trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return vnDayRange(year, month, day);
}

/** The year and the Vietnam calendar date of an instant. */
export function vnYmd(instant: Date): { year: number; month: number; day: number } {
  const shifted = new Date(instant.getTime() + VN_OFFSET_MS);
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() };
}

/** The current year in Vietnam (not the server's). */
export function currentVnYear(now: Date = new Date()): number {
  return vnYmd(now).year;
}

/** The range from a "from" and a "to" date typed on a screen as YYYY-MM-DD: from 00:00 of the first day to the end of the last. */
export function vnInclusiveDayRange(from?: string, to?: string): { start?: string; end?: string } {
  const result: { start?: string; end?: string } = {};
  if (from) {
    const range = vnDateStringRange(from);
    if (range) result.start = range.start;
  }
  if (to) {
    const range = vnDateStringRange(to);
    if (range) result.end = range.end;
  }
  return result;
}

// ---------------------------------------------------------------------------
// SQL conditions
// ---------------------------------------------------------------------------

const PAID = ['paid'];

/** The moment a paid order counts as revenue: paid_at, or created_at for old orders that have none. */
export function sqlRevenueTime(bookingsTable: any) {
  return sql`coalesce(${bookingsTable.paid_at}, ${bookingsTable.created_at})`;
}

/** Only the time part: the revenue time is inside the range. Use it next to a status condition. */
export function sqlRevenueTimeInRange(bookingsTable: any, range: { start?: string; end?: string }) {
  const parts: any[] = [sql`1 = 1`];
  const time = sqlRevenueTime(bookingsTable);
  if (range.start) parts.push(sql`${time} >= ${range.start}`);
  if (range.end) parts.push(sql`${time} < ${range.end}`);
  return and(...parts)!;
}

/** Paid orders whose revenue time is inside the range. */
export function sqlPaidInRange(bookingsTable: any, range: { start?: string; end?: string }) {
  const parts: any[] = [inArray(bookingsTable.payment_status, PAID)];
  const time = sqlRevenueTime(bookingsTable);
  if (range.start) parts.push(sql`${time} >= ${range.start}`);
  if (range.end) parts.push(sql`${time} < ${range.end}`);
  return and(...parts)!;
}

/** Orders of any status for a list screen: paid ones by the day paid, the others by the day created. */
export function sqlListedInRange(bookingsTable: any, range: { start?: string; end?: string }) {
  const paid = sqlPaidInRange(bookingsTable, range);
  const parts: any[] = [sql`${bookingsTable.payment_status} <> 'paid'`];
  if (range.start) parts.push(sql`${bookingsTable.created_at} >= ${range.start}`);
  if (range.end) parts.push(sql`${bookingsTable.created_at} < ${range.end}`);
  return or(paid, and(...parts))!;
}

/** Orders (any status) created inside the range: for numbers that belong to the moment of ordering. */
export function sqlCreatedInRange(bookingsTable: any, range: { start?: string; end?: string }) {
  const parts: any[] = [];
  if (range.start) parts.push(gte(bookingsTable.created_at, range.start));
  if (range.end) parts.push(lt(bookingsTable.created_at, range.end));
  return and(...parts)!;
}

/** The instant an order counts at, for grouping rows in JavaScript. Null when the stored text is not a date. */
export function revenueInstant(row: { paid_at?: unknown; created_at?: unknown }): Date | null {
  const raw = row.paid_at || row.created_at;
  if (!raw) return null;
  const instant = new Date(String(raw));
  return Number.isNaN(instant.getTime()) ? null : instant;
}

/**
 * The range typed on a filter screen. A date alone ("2026-11-01") means the whole Vietnam day: "from" starts at 00:00
 * and "to" runs to the end of its day. A full date and time is taken as that exact instant, "to" included.
 */
export function vnRangeFromInputs(from?: string, to?: string): { start?: string; end?: string } {
  const range: { start?: string; end?: string } = {};
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/;

  if (from) {
    if (dateOnly.test(from.trim())) {
      const day = vnDateStringRange(from);
      if (day) range.start = day.start;
    } else {
      const instant = new Date(from);
      if (!Number.isNaN(instant.getTime())) range.start = instant.toISOString();
    }
  }
  if (to) {
    if (dateOnly.test(to.trim())) {
      const day = vnDateStringRange(to);
      if (day) range.end = day.end;
    } else {
      const instant = new Date(to);
      if (!Number.isNaN(instant.getTime())) range.end = new Date(instant.getTime() + 1).toISOString();
    }
  }
  return range;
}
