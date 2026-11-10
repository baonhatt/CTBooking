import { count, sum, eq, inArray, and, or, gte, lte, gt, sql, isNull, isNotNull } from 'drizzle-orm';
import { formatDateForDb, getVnParts } from '../../../server/lib/date-utils';
import {
  currentVnYear,
  vnDayStart,
  vnYmd,
  vnYearRange,
  vnMonthRange,
  vnDateStringRange,
  vnDayRange,
  sqlRevenueTimeInRange,
  sqlPaidInRange,
  sqlListedInRange,
  sqlCreatedInRange,
  revenueInstant
} from '../../../server/lib/vn-time';

/**
 * The window for the "top tickets" list inside the selected year, from 00:00 Vietnam time.
 * week = the last 7 days, month = the last 30 days, anything else = the whole year.
 * For a year that is not the current one the window ends at the end of that year.
 */
export function topTicketsRange(period: string, selectedYear: number, now: Date = new Date()) {
  const yearRange = vnYearRange(selectedYear);
  const days = period === 'week' ? 7 : period === 'month' ? 30 : 0;
  if (days === 0) return yearRange;

  const anchor = selectedYear === currentVnYear(now) ? now : new Date(Date.parse(yearRange.end) - 1);
  const anchorDay = vnYmd(anchor);
  const start = vnDayStart(anchorDay.year, anchorDay.month, anchorDay.day - (days - 1)).toISOString();
  return { start: start < yearRange.start ? yearRange.start : start, end: yearRange.end };
}
import { sqlBranchIdsStaffAccessFilter } from '../../../server/lib/branch-ids';

function buildBranchBookingCondition(bookingsTable: any, restrictToBranchIds: number[] | null | undefined) {
  if (restrictToBranchIds === null || restrictToBranchIds === undefined) return undefined;
  if (restrictToBranchIds.length === 0) return sql`1 = 0`;
  return inArray(bookingsTable.branch_id, restrictToBranchIds);
}

function buildBranchMovieCondition(moviesTable: any, restrictToBranchIds: number[] | null | undefined) {
  if (restrictToBranchIds === null || restrictToBranchIds === undefined) return undefined;
  if (restrictToBranchIds.length === 0) return sql`1 = 0`;
  return sqlBranchIdsStaffAccessFilter(moviesTable.branch_ids, restrictToBranchIds);
}

export async function getDashboardMetricsImpl(
  anyDb: any,
  tables: { movies: any; toys?: any; users: any; bookings: any; ticket_packages: any; branches?: any; booking_vr_items?: any; voucher_redemption_logs?: any },
  topPeriod: string = 'week',
  year?: number,
  restrictToBranchIds: number[] | null = null,
  options: { canViewRevenue?: boolean } = {}
) {
  // The money fields are only returned to staff who have the view_revenue right
  const canViewRevenue = options.canViewRevenue === true;

  // Use the current year (Vietnam time) if not provided
  const selectedYear = year || currentVnYear();

  // Year boundaries in Vietnam time. yearEnd is the last millisecond of the year.
  const yearRange = vnYearRange(selectedYear);
  const yearStart = new Date(yearRange.start);
  const yearEnd = new Date(Date.parse(yearRange.end) - 1);

  // Revenue: paid orders count on the day they were PAID (created_at only for old orders without paid_at).
  // Always used next to the "paid" status condition.
  const yearCondition = sqlRevenueTimeInRange(tables.bookings, yearRange);
  // Numbers that belong to the moment of ordering (payment health, busiest booking hours) use the creation time.
  const createdYearCondition = sqlCreatedInRange(tables.bookings, yearRange);
  const branchConditionBookings = buildBranchBookingCondition(tables.bookings, restrictToBranchIds);
  const branchConditionMovies = buildBranchMovieCondition(tables.movies, restrictToBranchIds);

  // Year-filtered counts based on created_at
  const [totalMoviesRes] = await anyDb
    .select({ count: count() })
    .from(tables.movies)
    .where(
      and(
        eq(tables.movies.is_active, true),
        isNull(tables.movies.deleted_at),
        ...(branchConditionMovies ? [branchConditionMovies] : []),
        gte(tables.movies.created_at, formatDateForDb(yearStart)),
        lte(tables.movies.created_at, formatDateForDb(yearEnd))
      )
    );
  const totalMovies = totalMoviesRes?.count || 0;

  const totalToys = await (async () => {
    try {
      if (!tables.toys) return 0;
      const [r] = await anyDb
        .select({ count: count() })
        .from(tables.toys)
        .where(
          and(
            isNull(tables.toys.deleted_at),
            gte(tables.toys.created_at, formatDateForDb(yearStart)),
            lte(tables.toys.created_at, formatDateForDb(yearEnd))
          )
        );
      return r?.count || 0;
    } catch {
      return 0;
    }
  })();

  const [totalUsersRes] = await anyDb
    .select({ count: count() })
    .from(tables.users)
    .where(
      and(
        gte(tables.users.created_at, formatDateForDb(yearStart)),
        lte(tables.users.created_at, formatDateForDb(yearEnd))
      )
    );
  const totalUsers = totalUsersRes?.count || 0;

  // Year-filtered transactions and revenue
  const [totalTransactionsRes] = await anyDb
    .select({ count: count() })
    .from(tables.bookings)
    .where(and(inArray(tables.bookings.payment_status, ['paid']), yearCondition, branchConditionBookings));
  const totalTransactions = totalTransactionsRes?.count || 0;

  const [revenueYearRes] = await anyDb
    .select({ sum: sum(tables.bookings.total_price) })
    .from(tables.bookings)
    .where(and(inArray(tables.bookings.payment_status, ['paid']), yearCondition, branchConditionBookings));
  const revenueTotal = Number(revenueYearRes?.sum || 0);

  // Revenue by method (year-filtered)
  const [revenueCashYearAgg] = await anyDb
    .select({ sum: sum(tables.bookings.total_price) })
    .from(tables.bookings)
    .where(
      and(
        inArray(tables.bookings.payment_status, ['paid']),
        inArray(tables.bookings.payment_method, ['cash', 'Cash']),
        yearCondition,
        branchConditionBookings
      )
    );

  const [revenueVietqrYearAgg] = await anyDb
    .select({ sum: sum(tables.bookings.total_price) })
    .from(tables.bookings)
    .where(
      and(
        inArray(tables.bookings.payment_status, ['paid']),
        inArray(tables.bookings.payment_method, ['vietqr', 'VietQR']),
        yearCondition,
        branchConditionBookings
      )
    );

  const revenueByMethod = {
    cash: Number(revenueCashYearAgg?.sum || 0),
    vietqr: Number(revenueVietqrYearAgg?.sum || 0)
  };

  // Payment method rankings (year-filtered)
  const [cashYearAgg] = await anyDb
    .select({ sum: sum(tables.bookings.total_price), count: count() })
    .from(tables.bookings)
    .where(
      and(
        inArray(tables.bookings.payment_status, ['paid']),
        inArray(tables.bookings.payment_method, ['cash', 'Cash']),
        yearCondition,
        branchConditionBookings
      )
    );

  const [vietqrYearAgg] = await anyDb
    .select({ sum: sum(tables.bookings.total_price), count: count() })
    .from(tables.bookings)
    .where(
      and(
        inArray(tables.bookings.payment_status, ['paid']),
        inArray(tables.bookings.payment_method, ['vietqr', 'VietQR']),
        yearCondition,
        branchConditionBookings
      )
    );

  const paymentStats = [
    { method: 'CASH', revenue: Number(cashYearAgg?.sum || 0), count: Number(cashYearAgg?.count || 0) },
    { method: 'VIETQR', revenue: Number(vietqrYearAgg?.sum || 0), count: Number(vietqrYearAgg?.count || 0) }
  ].sort((a, b) => b.revenue - a.revenue);

  // Top Tickets window, inside the selected year, from 00:00 Vietnam time
  const topRange = topTicketsRange(topPeriod, selectedYear);

  const topBookings = await anyDb
    .select({
      id: tables.bookings.id,
      ticket_package_id: tables.bookings.ticket_package_id,
      ticket_package_name: tables.bookings.ticket_package_name,
      ticket_count: tables.bookings.ticket_count,
      ticket_unit_price: tables.bookings.ticket_unit_price,
      booking_type: tables.bookings.booking_type,
    })
    .from(tables.bookings)
    .where(
      and(
        inArray(tables.bookings.payment_status, ['paid']),
        branchConditionBookings,
        sqlRevenueTimeInRange(tables.bookings, topRange)
      )
    );

  const map = new Map<number, { title: string; revenue: number; count: number }>();
  
  // 1. Process standard Movie bookings (potentially containing JSON arrays)
  for (const b of topBookings) {
    if (b.booking_type === 'vr' || b.booking_type === 'combo_vr') continue; // Handled separately
    
    let items: any[] = [];
    const nameStr = typeof b.ticket_package_name === 'string' ? b.ticket_package_name.trim() : '';

    if (nameStr.startsWith('[') || nameStr.startsWith('{')) {
      try {
        const parsed = JSON.parse(nameStr);
        items = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        // Fallback to simple logic if JSON parsing fails
      }
    }
    
    if (items.length > 0) {
      // It's a multiplex booking
      for (const it of items) {
        const pkgId = Number(it.package_id);
        const title = it.name || 'Gói không tên';
        const price = Number(it.price || 0);
        const tCount = Number(it.quantity || 1);
        
        if (pkgId && !isNaN(pkgId)) {
          const prev = map.get(pkgId) || { title, revenue: 0, count: 0 };
          prev.revenue += price * tCount;
          prev.count += tCount;
          prev.title = title || prev.title;
          map.set(pkgId, prev);
        }
      }
    } else {
      // Simple booking
      const pkgId = b.ticket_package_id;
      const title = nameStr || 'Gói không tên';
      const price = Number(b.ticket_unit_price || 0); // Using unit price instead of total_price
      const tCount = Number(b.ticket_count || 0);
      
      if (pkgId) {
        const prev = map.get(pkgId) || { title, revenue: 0, count: 0 };
        prev.revenue += price * tCount;
        prev.count += tCount;
        prev.title = title || prev.title;
        map.set(pkgId, prev);
      }
    }
  }

  // 2. Fetch and merge VR items
  if (tables.booking_vr_items && topBookings.length > 0) {
    const vrBookings = topBookings.filter((b) => b.booking_type === 'vr' || b.booking_type === 'combo_vr');
    const vrBookingIds = vrBookings.map((b) => b.id);
    
    if (vrBookingIds.length > 0) {
      // Split into chunks of 100 to avoid 'too many variables' error in SQL
      const chunkSize = 100;
      for (let i = 0; i < vrBookingIds.length; i += chunkSize) {
        const chunk = vrBookingIds.slice(i, i + chunkSize);
        const vrItems = await anyDb
          .select({
            vr_ticket_package_id: tables.booking_vr_items.vr_ticket_package_id,
            package_name: tables.booking_vr_items.package_name,
            quantity: tables.booking_vr_items.quantity,
            unit_price: tables.booking_vr_items.unit_price,
            line_total: tables.booking_vr_items.line_total,
          })
          .from(tables.booking_vr_items)
          .where(inArray(tables.booking_vr_items.booking_id, chunk));

        for (const it of vrItems) {
          const pkgId = it.vr_ticket_package_id;
          const title = it.package_name || 'Gói VR';
          const price = Number(it.unit_price || 0);
          const tCount = Number(it.quantity || 1);
          const lineRev = it.line_total != null ? Number(it.line_total) : price * tCount;
          
          if (pkgId) {
            const prev = map.get(pkgId) || { title, revenue: 0, count: 0 };
            prev.revenue += lineRev;
            prev.count += tCount;
            prev.title = title || prev.title;
            map.set(pkgId, prev);
          }
        }
      }
    }
  }

  const topTicketsWeek = Array.from(map.entries())
    .map(([id, v]) => ({ id, title: v.title, revenue: v.revenue, count: v.count }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // Top VIP Users (year-filtered)
  const topUsersRaw = await anyDb
    .select({
      user_id: tables.bookings.user_id,
      email: tables.bookings.email,
      // A customer can have typed different names on different bookings, so one of them is taken
      name: sql<string>`max(${tables.bookings.name})`,
      total_spent: sum(tables.bookings.total_price),
      booking_count: count()
    })
    .from(tables.bookings)
    .where(and(inArray(tables.bookings.payment_status, ['paid']), yearCondition, branchConditionBookings))
    .groupBy(tables.bookings.user_id, tables.bookings.email)
    .orderBy(sql`sum(${tables.bookings.total_price}) DESC`)
    .limit(5);

  const topVipUsers = topUsersRaw.map((u: any) => ({
    userId: u.user_id,
    name: u.name || '',
    email: u.email || 'Khách vãng lai',
    totalSpent: Number(u.total_spent || 0),
    bookingCount: Number(u.booking_count || 0)
  }));

  let branchInfo: { id: number; name: string; code: string } | null = null;
  if (restrictToBranchIds && restrictToBranchIds.length === 1 && tables.branches) {
    try {
      const [b] = await anyDb
        .select({ id: tables.branches.id, name: tables.branches.name, code: tables.branches.code })
        .from(tables.branches)
        .where(eq(tables.branches.id, restrictToBranchIds[0]))
        .limit(1);
      if (b) branchInfo = b;
    } catch {}
  }

  const metrics = {
    branch_id: branchInfo
      ? branchInfo.id
      : restrictToBranchIds && restrictToBranchIds.length === 1
        ? restrictToBranchIds[0]
        : null,
    branch_name: branchInfo ? branchInfo.name : null,
    branch_ids: restrictToBranchIds || null,
    branch: branchInfo || null,
    totalMovies,
    totalToys,
    totalUsers,
    totalTransactions,
    revenueTotal,
    revenueByMethod,
    topTicketsWeek,
    paymentStats,
    topVipUsers,
    ticketUsage: await (async () => {
      const [used] = await anyDb
        .select({ sum: sum(tables.bookings.ticket_count) })
        .from(tables.bookings)
        .where(
          and(
            inArray(tables.bookings.payment_status, ['paid']),
            eq(tables.bookings.is_used, true),
            yearCondition,
            branchConditionBookings
          )
        );
      const [total] = await anyDb
        .select({ sum: sum(tables.bookings.ticket_count) })
        .from(tables.bookings)
        .where(and(inArray(tables.bookings.payment_status, ['paid']), yearCondition, branchConditionBookings));
      return { used: Number(used?.sum || 0), total: Number(total?.sum || 0) };
    })(),
    paymentHealth: await (async () => {
      const rows = await anyDb
        .select({
          status: tables.bookings.payment_status,
          cnt: count()
        })
        .from(tables.bookings)
        .where(
          and(
            inArray(tables.bookings.payment_status, ['paid', 'pending', 'failed', 'expired']),
            createdYearCondition,
            branchConditionBookings
          )
        )
        .groupBy(tables.bookings.payment_status);

      let paid = 0, pending = 0, failed = 0;
      for (const r of rows) {
        if (r.status === 'paid') paid += Number(r.cnt || 0);
        else if (r.status === 'pending') pending += Number(r.cnt || 0);
        else failed += Number(r.cnt || 0);
      }
      return { paid, pending, failed };
    })(),
    bookingHours: await (async () => {
      // For cross-platform safety (Postgres vs SQLite/D1), we fetch hours of paid bookings and aggregate in JS
      // This is efficient enough for dashboard use cases
      const results = await anyDb
        .select({ createdAt: tables.bookings.created_at })
        .from(tables.bookings)
        .where(and(inArray(tables.bookings.payment_status, ['paid']), createdYearCondition, branchConditionBookings));
      const hours = Array(24).fill(0);
      results.forEach((r: any) => {
        const parts = getVnParts(r.createdAt);
        if (parts && parts.hour >= 0 && parts.hour < 24) hours[parts.hour]++;
      });
      return hours;
    })(),
    revenueBreakdown: await (async () => {
      const paidBookings = await anyDb
        .select({
          id: tables.bookings.id,
          total_price: tables.bookings.total_price,
          booking_type: tables.bookings.booking_type
        })
        .from(tables.bookings)
        .where(and(inArray(tables.bookings.payment_status, ['paid']), yearCondition, branchConditionBookings));

      // VR lines of these orders, in chunks of 100 ids (the limit of bound values in one query)
      const vrRevenueByBooking = new Map<number, number>();
      const bookingsWithVrLines = new Set<number>();
      const vrBookingIds = paidBookings
        .filter((b: any) => b.booking_type === 'vr' || b.booking_type === 'combo_vr')
        .map((b: any) => b.id);
      if (tables.booking_vr_items) {
        for (let from = 0; from < vrBookingIds.length; from += 100) {
          const lines = await anyDb
            .select({
              booking_id: tables.booking_vr_items.booking_id,
              unit_price: tables.booking_vr_items.unit_price,
              quantity: tables.booking_vr_items.quantity,
              line_total: tables.booking_vr_items.line_total
            })
            .from(tables.booking_vr_items)
            .where(inArray(tables.booking_vr_items.booking_id, vrBookingIds.slice(from, from + 100)));
          for (const line of lines) {
            // line_total is what was charged for the line, after the voucher
            const charged =
              line.line_total !== null && line.line_total !== undefined
                ? Number(line.line_total)
                : Number(line.unit_price || 0) * Number(line.quantity || 1);
            vrRevenueByBooking.set(line.booking_id, (vrRevenueByBooking.get(line.booking_id) || 0) + charged);
            bookingsWithVrLines.add(line.booking_id);
          }
        }
      }

      let movie = 0;
      let vr = 0;
      for (const b of paidBookings) {
        const total = Number(b.total_price || 0);
        let vrPart = vrRevenueByBooking.get(b.id) || 0;
        // A VR order with no saved lines is all VR
        if (b.booking_type === 'vr' && !bookingsWithVrLines.has(b.id)) vrPart = total;
        vrPart = Math.min(Math.max(vrPart, 0), total);
        vr += vrPart;
        movie += total - vrPart;
      }
      // The two parts add up to the revenue total
      return { movie, vr };
    })(),
    checkinTraffic: await (async () => {
      const arr = Array(7).fill(0); // Sun(0) to Sat(6)
      const res = await anyDb.select({ checked_in_at: tables.bookings.checked_in_at }).from(tables.bookings).where(and(inArray(tables.bookings.payment_status, ['paid']), eq(tables.bookings.is_used, true), isNotNull(tables.bookings.checked_in_at), yearCondition, branchConditionBookings));
      res.forEach((r: any) => {
         const parts = getVnParts(r.checked_in_at);
         if (parts && parts.dayOfWeek >= 0 && parts.dayOfWeek <= 6) arr[parts.dayOfWeek]++;
      });
      return arr;
    })(),
    voucherImpact: await (async () => {
      if (!tables.voucher_redemption_logs) return 0;

      // Join the logs to their orders so the year and the branch of the ORDER decide what is counted
      const conditions = [inArray(tables.bookings.payment_status, ['paid']), branchConditionBookings];
      if (year !== undefined) conditions.push(yearCondition);
      const [res] = await anyDb
        .select({ total: sum(tables.voucher_redemption_logs.discount_amount_applied) })
        .from(tables.voucher_redemption_logs)
        .innerJoin(tables.bookings, eq(tables.voucher_redemption_logs.booking_id, tables.bookings.id))
        .where(and(...conditions));
      return Number(res?.total || 0);
    })(),
    ticketBurnRate: await (async () => {
      let totalHoldMs = 0;
      let count = 0;
      const res = await anyDb.select({ paid_at: tables.bookings.paid_at, checked_in_at: tables.bookings.checked_in_at }).from(tables.bookings).where(and(inArray(tables.bookings.payment_status, ['paid']), eq(tables.bookings.is_used, true), isNotNull(tables.bookings.checked_in_at), isNotNull(tables.bookings.paid_at), yearCondition, branchConditionBookings));
      res.forEach((r: any) => {
         const diff = new Date(r.checked_in_at).getTime() - new Date(r.paid_at).getTime();
         if (diff >= 0) { totalHoldMs += diff; count++; }
      });
      const avgHours = count > 0 ? (totalHoldMs / count / 3600000) : 0;
      return avgHours;
    })(),
    customerRetention: await (async () => {
       const usersInPeriod = await anyDb.select({ user_id: tables.bookings.user_id }).from(tables.bookings).where(and(inArray(tables.bookings.payment_status, ['paid']), isNotNull(tables.bookings.user_id), yearCondition, branchConditionBookings));
       const distinctIds = Array.from(new Set(usersInPeriod.map((u: any) => u.user_id)));
       if (distinctIds.length === 0) return { newUsers: 0, returningUsers: 0 };
       
       let newUsers = 0;
       let returningUsers = 0;
       const chunk = 100;
       for(let i = 0; i<distinctIds.length; i+=chunk) {
          const slice = distinctIds.slice(i, i+chunk);
          const usrs = await anyDb.select({ id: tables.users.id, created_at: tables.users.created_at }).from(tables.users).where(inArray(tables.users.id, slice));
          usrs.forEach((u: any) => {
             const cAt = new Date(u.created_at);
             if (year) {
               if (cAt.getFullYear() === year) newUsers++;
               else returningUsers++;
             } else {
               returningUsers++; // fallback when selecting 'all time'
             }
          });
       }
       return { newUsers, returningUsers };
    })()
  };

  if (!canViewRevenue) {
    const { revenueTotal, revenueByMethod, revenueBreakdown, voucherImpact, topVipUsers, ...withoutMoney } = metrics as any;
    return {
      ...withoutMoney,
      revenue_hidden: true,
      topTicketsWeek: (metrics.topTicketsWeek || []).map((item: any) => ({ id: item.id, title: item.title, count: item.count })),
      paymentStats: (metrics.paymentStats || []).map((item: any) => ({ method: item.method, count: item.count }))
    };
  }
  return metrics;
}

/** Adds a paid order to the cash / VietQR totals. */
function addToMethodTotals(totals: { cash: number; vietqr: number }, paymentMethod: unknown, price: number) {
  const method = String(paymentMethod || '').toLowerCase();
  if (method === 'cash') totals.cash += price;
  else if (method === 'vietqr') totals.vietqr += price;
}

/**
 * Revenue of one Vietnam day ("YYYY-MM-DD"), or of a whole year when no date is given.
 * status "paid" (default) counts paid orders on the day they were paid. status "all" lists orders of every status:
 * paid ones by the day paid, the others by the day created.
 */
export async function getRevenueByDateImpl(
  anyDb: any,
  tables: { bookings: any },
  args: { date?: string; status?: string; year?: number; branchIds?: number[] }
) {
  const dateStr = String(args.date || '');
  const status = String(args.status || 'paid').toLowerCase();
  const selectedYear = args.year || currentVnYear();
  const emptyResult = { date: dateStr || 'all', total: 0, count: 0, revenueByMethod: { cash: 0, vietqr: 0 } };

  const wantsOneDay = Boolean(dateStr) && dateStr !== 'all';
  const dayRange = wantsOneDay ? vnDateStringRange(dateStr) : null;
  if (wantsOneDay && !dayRange) return emptyResult;
  const range = dayRange || vnYearRange(selectedYear);

  const timeCondition = status === 'all' ? sqlListedInRange(tables.bookings, range) : sqlPaidInRange(tables.bookings, range);
  const branchCondition = buildBranchBookingCondition(tables.bookings, args.branchIds);

  const bookings = await anyDb
    .select({ total_price: tables.bookings.total_price, payment_method: tables.bookings.payment_method })
    .from(tables.bookings)
    .where(and(timeCondition, branchCondition));

  const methods = { cash: 0, vietqr: 0 };
  let total = 0;
  for (const b of bookings) {
    const price = Number(b.total_price || 0);
    total += price;
    addToMethodTotals(methods, b.payment_method, price);
  }

  return { date: dateStr || 'all', total, count: bookings.length, revenueByMethod: methods };
}

/** Revenue of the last 7 Vietnam days, today last. */
export async function getRevenue7DaysImpl(anyDb: any, tables: { bookings: any }, year?: number, branchIds?: number[]) {
  const branchCondition = buildBranchBookingCondition(tables.bookings, branchIds);
  const today = vnYmd(new Date());

  // The 7 days, oldest first, as "YYYY-MM-DD" keys
  const daysMap = new Map<string, number>();
  for (let back = 6; back >= 0; back--) {
    const day = vnYmd(vnDayStart(today.year, today.month, today.day - back));
    daysMap.set(vnKey(day), 0);
  }
  const range = {
    start: vnDayStart(today.year, today.month, today.day - 6).toISOString(),
    end: vnDayStart(today.year, today.month, today.day + 1).toISOString()
  };

  const bookings = await anyDb
    .select({
      total_price: tables.bookings.total_price,
      paid_at: tables.bookings.paid_at,
      created_at: tables.bookings.created_at
    })
    .from(tables.bookings)
    .where(and(sqlPaidInRange(tables.bookings, range), branchCondition));

  for (const b of bookings) {
    const instant = revenueInstant(b);
    if (!instant) continue; // one row with a broken date does not stop the report
    const key = vnKey(vnYmd(instant));
    if (daysMap.has(key)) daysMap.set(key, daysMap.get(key)! + Number(b.total_price || 0));
  }

  const days: { day: string; revenue: number }[] = [];
  for (const [key, revenue] of daysMap.entries()) {
    // key is YYYY-MM-DD; the screen shows MM-DD
    days.push({ day: key.substring(5, 7) + '-' + key.substring(8, 10), revenue });
  }
  return { data: days };
}

function vnKey(day: { year: number; month: number; day: number }) {
  return day.year + '-' + String(day.month).padStart(2, '0') + '-' + String(day.day).padStart(2, '0');
}

/** Revenue of one Vietnam month, or of every month of a year. Same counting rule as the other revenue numbers. */
export async function getRevenueByMonthImpl(
  anyDb: any,
  tables: { bookings: any },
  args: { year?: string; month?: string; status?: string; branchIds?: number[] }
) {
  const yearStr = String(args.year || '');
  const monthStr = String(args.month || '');
  const status = String(args.status || 'paid').toLowerCase();
  const branchCondition = buildBranchBookingCondition(tables.bookings, args.branchIds);

  let targetYear = currentVnYear();
  if (yearStr) {
    targetYear = Number(yearStr) > 0 ? Number(yearStr) : targetYear;
  }

  const oneMonth = Boolean(monthStr && yearStr);
  const targetMonth = Number(monthStr);
  if (oneMonth && !(Number.isInteger(targetMonth) && targetMonth >= 1 && targetMonth <= 12)) {
    return { total: 0, count: 0, revenueByMethod: { cash: 0, vietqr: 0 } };
  }

  const range = oneMonth ? vnMonthRange(targetYear, targetMonth) : vnYearRange(targetYear);
  const timeCondition = status === 'all' ? sqlListedInRange(tables.bookings, range) : sqlPaidInRange(tables.bookings, range);

  const bookings = await anyDb
    .select({
      total_price: tables.bookings.total_price,
      paid_at: tables.bookings.paid_at,
      created_at: tables.bookings.created_at,
      payment_method: tables.bookings.payment_method,
      payment_status: tables.bookings.payment_status
    })
    .from(tables.bookings)
    .where(and(timeCondition, branchCondition));

  if (oneMonth) {
    const methods = { cash: 0, vietqr: 0 };
    let total = 0;
    for (const b of bookings) {
      const price = Number(b.total_price || 0);
      total += price;
      addToMethodTotals(methods, b.payment_method, price);
    }
    return { total, count: bookings.length, revenueByMethod: methods };
  }

  // Array length 12. A paid order counts in the month it was paid, any other order in the month it was created.
  const months = Array(12)
    .fill(0)
    .map((_, i) => ({ month: i + 1, revenue: 0 }));
  for (const b of bookings) {
    const isPaid = String(b.payment_status || '').toLowerCase() === 'paid';
    const instant = revenueInstant(isPaid ? b : { created_at: b.created_at });
    if (!instant) continue; // one row with a broken date does not stop the report
    const parts = vnYmd(instant);
    if (parts.year === targetYear) months[parts.month - 1].revenue += Number(b.total_price || 0);
  }

  return { year: targetYear, data: months };
}
