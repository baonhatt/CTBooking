import { count, sum, eq, inArray, and, or, gte, lte, gt, sql, isNull } from 'drizzle-orm';
import { formatDateForDb } from '../../../server/lib/date-utils';
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
  tables: { movies: any; toys?: any; users: any; bookings: any; ticket_packages: any; branches?: any },
  topPeriod: string = 'week',
  year?: number,
  restrictToBranchIds: number[] | null = null
) {
  // Use current year if not provided
  const selectedYear = year || new Date().getFullYear();

  // Year boundaries
  const yearStart = new Date(selectedYear, 0, 1, 0, 0, 0, 0);
  const yearEnd = new Date(selectedYear, 11, 31, 23, 59, 59, 999);

  const yearCondition = or(
    and(
      gte(tables.bookings.created_at, formatDateForDb(yearStart)),
      lte(tables.bookings.created_at, formatDateForDb(yearEnd))
    ),
    and(
      gte(tables.bookings.paid_at, formatDateForDb(yearStart)),
      lte(tables.bookings.paid_at, formatDateForDb(yearEnd))
    )
  );
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
  const [revenueMomoYearAgg] = await anyDb
    .select({ sum: sum(tables.bookings.total_price) })
    .from(tables.bookings)
    .where(
      and(
        inArray(tables.bookings.payment_status, ['paid']),
        inArray(tables.bookings.payment_method, ['momo', 'MoMo']),
        yearCondition,
        branchConditionBookings
      )
    );
  const [revenueVnpayYearAgg] = await anyDb
    .select({ sum: sum(tables.bookings.total_price) })
    .from(tables.bookings)
    .where(
      and(
        inArray(tables.bookings.payment_status, ['paid']),
        inArray(tables.bookings.payment_method, ['vnpay', 'VNPay']),
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
    momo: Number(revenueMomoYearAgg?.sum || 0),
    vnpay: Number(revenueVnpayYearAgg?.sum || 0),
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
  const [momoYearAgg] = await anyDb
    .select({ sum: sum(tables.bookings.total_price), count: count() })
    .from(tables.bookings)
    .where(
      and(
        inArray(tables.bookings.payment_status, ['paid']),
        inArray(tables.bookings.payment_method, ['momo', 'MoMo']),
        yearCondition,
        branchConditionBookings
      )
    );
  const [vnpayYearAgg] = await anyDb
    .select({ sum: sum(tables.bookings.total_price), count: count() })
    .from(tables.bookings)
    .where(
      and(
        inArray(tables.bookings.payment_status, ['paid']),
        inArray(tables.bookings.payment_method, ['vnpay', 'VNPay']),
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
    { method: 'MOMO', revenue: Number(momoYearAgg?.sum || 0), count: Number(momoYearAgg?.count || 0) },
    { method: 'VNPAY', revenue: Number(vnpayYearAgg?.sum || 0), count: Number(vnpayYearAgg?.count || 0) },
    { method: 'VIETQR', revenue: Number(vietqrYearAgg?.sum || 0), count: Number(vietqrYearAgg?.count || 0) }
  ].sort((a, b) => b.revenue - a.revenue);

  // Top Tickets Filter (within selected year)
  let topStartDate = new Date(yearStart);
  const topEndDate = new Date(yearEnd);

  if (topPeriod === 'week') {
    // Last 7 days within the year
    const now = new Date();
    topStartDate = new Date(now);
    topStartDate.setDate(topStartDate.getDate() - 6);
    // Ensure within year bounds
    if (topStartDate < yearStart) topStartDate = new Date(yearStart);
  } else if (topPeriod === 'month') {
    // Last 30 days within the year
    const now = new Date();
    topStartDate = new Date(now);
    topStartDate.setDate(topStartDate.getDate() - 29);
    if (topStartDate < yearStart) topStartDate = new Date(yearStart);
  } else if (topPeriod === 'year') {
    // Entire selected year
    topStartDate = new Date(yearStart);
  }

  const topBookings = await anyDb
    .select({
      ticket_package_id: tables.bookings.ticket_package_id,
      total_price: tables.bookings.total_price,
      ticket_package_name: tables.bookings.ticket_package_name,
      ticket_count: tables.bookings.ticket_count
    })
    .from(tables.bookings)
    .where(
      and(
        inArray(tables.bookings.payment_status, ['paid']),
        branchConditionBookings,
        or(
          and(
            gte(tables.bookings.created_at, formatDateForDb(topStartDate)),
            lte(tables.bookings.created_at, formatDateForDb(topEndDate))
          ),
          and(
            gte(tables.bookings.paid_at, formatDateForDb(topStartDate)),
            lte(tables.bookings.paid_at, formatDateForDb(topEndDate))
          )
        )
      )
    );

  const map = new Map<number, { title: string; revenue: number; count: number }>();
  for (const b of topBookings) {
    const pkgId = b.ticket_package_id;
    const title = b.ticket_package_name || 'Gói không tên';
    const price = Number(b.total_price || 0);
    const tCount = Number(b.ticket_count || 0);
    if (pkgId) {
      const prev = map.get(pkgId) || { title, revenue: 0, count: 0 };
      prev.revenue += price;
      prev.count += tCount;
      prev.title = title || prev.title;
      map.set(pkgId, prev);
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

  return {
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
        .select({ count: count() })
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
        .select({ count: count() })
        .from(tables.bookings)
        .where(and(inArray(tables.bookings.payment_status, ['paid']), yearCondition, branchConditionBookings));
      return { used: used?.count || 0, total: total?.count || 0 };
    })(),
    paymentHealth: await (async () => {
      const [paid] = await anyDb
        .select({ count: count() })
        .from(tables.bookings)
        .where(and(inArray(tables.bookings.payment_status, ['paid']), yearCondition, branchConditionBookings));
      const [pending] = await anyDb
        .select({ count: count() })
        .from(tables.bookings)
        .where(and(inArray(tables.bookings.payment_status, ['pending']), yearCondition, branchConditionBookings));
      const [failed] = await anyDb
        .select({ count: count() })
        .from(tables.bookings)
        .where(
          and(inArray(tables.bookings.payment_status, ['failed', 'expired']), yearCondition, branchConditionBookings)
        );
      return { paid: paid?.count || 0, pending: pending?.count || 0, failed: failed?.count || 0 };
    })(),
    bookingHours: await (async () => {
      // For cross-platform safety (Postgres vs SQLite/D1), we fetch hours of paid bookings and aggregate in JS
      // This is efficient enough for dashboard use cases
      const results = await anyDb
        .select({ createdAt: tables.bookings.created_at })
        .from(tables.bookings)
        .where(and(inArray(tables.bookings.payment_status, ['paid']), yearCondition, branchConditionBookings));
      const hours = Array(24).fill(0);
      results.forEach((r: any) => {
        const date = new Date(r.createdAt);
        const hour = date.getHours();
        if (hour >= 0 && hour < 24) hours[hour]++;
      });
      return hours;
    })()
  };
}

export async function getRevenueByDateImpl(
  anyDb: any,
  tables: { bookings: any },
  args: { date?: string; status?: string; year?: number; branchIds?: number[] }
) {
  const dateStr = String(args.date || '');
  const status = String(args.status || 'paid').toLowerCase();
  const selectedYear = args.year || new Date().getFullYear();

  let dateCondition = undefined as any;
  if (dateStr && dateStr !== 'all') {
    const date = new Date(dateStr);
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    dateCondition = or(
      and(
        gte(tables.bookings.created_at, formatDateForDb(dayStart)),
        lte(tables.bookings.created_at, formatDateForDb(dayEnd))
      ),
      and(
        gte(tables.bookings.paid_at, formatDateForDb(dayStart)),
        lte(tables.bookings.paid_at, formatDateForDb(dayEnd))
      )
    );
  } else {
    // If no specific date, use entire year
    const yearStart = new Date(selectedYear, 0, 1, 0, 0, 0, 0);
    const yearEnd = new Date(selectedYear, 11, 31, 23, 59, 59, 999);
    dateCondition = or(
      and(
        gte(tables.bookings.created_at, formatDateForDb(yearStart)),
        lte(tables.bookings.created_at, formatDateForDb(yearEnd))
      ),
      and(
        gte(tables.bookings.paid_at, formatDateForDb(yearStart)),
        lte(tables.bookings.paid_at, formatDateForDb(yearEnd))
      )
    );
  }
  const statusCondition = status !== 'all' ? inArray(tables.bookings.payment_status, ['paid']) : undefined;
  const branchCondition = buildBranchBookingCondition(tables.bookings, args.branchIds);
  const whereCondition = and(dateCondition, statusCondition, branchCondition);
  const [totalRes] = await anyDb
    .select({ sum: sum(tables.bookings.total_price) })
    .from(tables.bookings)
    .where(whereCondition);
  const [countRes] = await anyDb.select({ count: count() }).from(tables.bookings).where(whereCondition);
  const countVal = countRes?.count || 0;
  const [revenueCashAgg] = await anyDb
    .select({ sum: sum(tables.bookings.total_price) })
    .from(tables.bookings)
    .where(and(whereCondition, inArray(tables.bookings.payment_method, ['cash', 'Cash'])));
  const [revenueMomoAgg] = await anyDb
    .select({ sum: sum(tables.bookings.total_price) })
    .from(tables.bookings)
    .where(and(whereCondition, inArray(tables.bookings.payment_method, ['momo', 'MoMo'])));
  const [revenueVnpayAgg] = await anyDb
    .select({ sum: sum(tables.bookings.total_price) })
    .from(tables.bookings)
    .where(and(whereCondition, inArray(tables.bookings.payment_method, ['vnpay', 'VNPay'])));
  const [revenueVietqrAgg] = await anyDb
    .select({ sum: sum(tables.bookings.total_price) })
    .from(tables.bookings)
    .where(and(whereCondition, inArray(tables.bookings.payment_method, ['vietqr', 'VietQR'])));

  return {
    date: dateStr || 'all',
    total: Number(totalRes?.sum || 0),
    count: countVal,
    revenueByMethod: {
      cash: Number(revenueCashAgg?.sum || 0),
      momo: Number(revenueMomoAgg?.sum || 0),
      vnpay: Number(revenueVnpayAgg?.sum || 0),
      vietqr: Number(revenueVietqrAgg?.sum || 0)
    }
  };
}

export async function getRevenue7DaysImpl(anyDb: any, tables: { bookings: any }, year?: number, branchIds?: number[]) {
  const selectedYear = year || new Date().getFullYear();
  const yearStart = new Date(selectedYear, 0, 1);
  const yearEnd = new Date(selectedYear, 11, 31, 23, 59, 59, 999);
  const branchCondition = buildBranchBookingCondition(tables.bookings, branchIds);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Ensure we don't go beyond year boundaries
  let startDay = new Date(today);
  startDay.setDate(startDay.getDate() - 6);
  if (startDay < yearStart) startDay = new Date(yearStart);

  const days: { day: string; revenue: number }[] = [];
  let currentDay = new Date(startDay);

  while (currentDay <= today && currentDay <= yearEnd) {
    const dayStart = new Date(currentDay);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(currentDay);
    dayEnd.setHours(23, 59, 59, 999);

    const [revenue] = await anyDb
      .select({ sum: sum(tables.bookings.total_price) })
      .from(tables.bookings)
      .where(
        and(
          inArray(tables.bookings.payment_status, ['paid']),
          branchCondition,
          or(
            and(
              gte(tables.bookings.created_at, formatDateForDb(dayStart)),
              lte(tables.bookings.created_at, formatDateForDb(dayEnd))
            ),
            and(
              gte(tables.bookings.paid_at, formatDateForDb(dayStart)),
              lte(tables.bookings.paid_at, formatDateForDb(dayEnd))
            )
          )
        )
      );

    const monthStr = String(currentDay.getMonth() + 1).padStart(2, '0');
    const dateStr = String(currentDay.getDate()).padStart(2, '0');
    days.push({ day: `${monthStr}-${dateStr}`, revenue: Number(revenue?.sum || 0) });

    currentDay.setDate(currentDay.getDate() + 1);
  }

  return { data: days };
}

export async function getRevenueByMonthImpl(
  anyDb: any,
  tables: { bookings: any },
  args: { year?: string; month?: string; status?: string; branchIds?: number[] }
) {
  const yearStr = String(args.year || '');
  const monthStr = String(args.month || '');
  const status = String(args.status || 'paid').toLowerCase();
  const branchCondition = buildBranchBookingCondition(tables.bookings, args.branchIds);
  if (monthStr && yearStr) {
    const year = Number(yearStr);
    const month = Number(monthStr);
    const monthStart = new Date(year, month - 1, 1);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date(year, month, 0);
    monthEnd.setHours(23, 59, 59, 999);
    const dateCondition = or(
      and(
        gte(tables.bookings.created_at, formatDateForDb(monthStart)),
        lte(tables.bookings.created_at, formatDateForDb(monthEnd))
      ),
      and(
        gte(tables.bookings.paid_at, formatDateForDb(monthStart)),
        lte(tables.bookings.paid_at, formatDateForDb(monthEnd))
      )
    );
    const statusCondition = status !== 'all' ? inArray(tables.bookings.payment_status, ['paid']) : undefined;
    const whereMonth = and(dateCondition, statusCondition, branchCondition);
    const [revenue] = await anyDb
      .select({ sum: sum(tables.bookings.total_price) })
      .from(tables.bookings)
      .where(whereMonth);
    const [countRes] = await anyDb.select({ count: count() }).from(tables.bookings).where(whereMonth);
    const [revenueCashAgg] = await anyDb
      .select({ sum: sum(tables.bookings.total_price) })
      .from(tables.bookings)
      .where(and(whereMonth, inArray(tables.bookings.payment_method, ['cash', 'Cash'])));
    const [revenueMomoAgg] = await anyDb
      .select({ sum: sum(tables.bookings.total_price) })
      .from(tables.bookings)
      .where(and(whereMonth, inArray(tables.bookings.payment_method, ['momo', 'MoMo'])));
    const [revenueVnpayAgg] = await anyDb
      .select({ sum: sum(tables.bookings.total_price) })
      .from(tables.bookings)
      .where(and(whereMonth, inArray(tables.bookings.payment_method, ['vnpay', 'VNPay'])));
    const [revenueVietqrAgg] = await anyDb
      .select({ sum: sum(tables.bookings.total_price) })
      .from(tables.bookings)
      .where(and(whereMonth, inArray(tables.bookings.payment_method, ['vietqr', 'VietQR'])));

    return {
      total: Number(revenue?.sum || 0),
      count: countRes?.count || 0,
      revenueByMethod: {
        cash: Number(revenueCashAgg?.sum || 0),
        momo: Number(revenueMomoAgg?.sum || 0),
        vnpay: Number(revenueVnpayAgg?.sum || 0),
        vietqr: Number(revenueVietqrAgg?.sum || 0)
      }
    };
  }
  let targetYear = new Date().getFullYear();
  if (yearStr) {
    const y = Number(yearStr);
    if (y > 0) targetYear = y;
  }
  const months: { month: number; revenue: number }[] = [];
  for (let m = 0; m < 12; m++) {
    const monthStart = new Date(targetYear, m, 1);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date(targetYear, m + 1, 0);
    monthEnd.setHours(23, 59, 59, 999);
    const dateCondition = or(
      and(
        gte(tables.bookings.created_at, formatDateForDb(monthStart)),
        lte(tables.bookings.created_at, formatDateForDb(monthEnd))
      ),
      and(
        gte(tables.bookings.paid_at, formatDateForDb(monthStart)),
        lte(tables.bookings.paid_at, formatDateForDb(monthEnd))
      )
    );
    const statusCondition = status !== 'all' ? inArray(tables.bookings.payment_status, ['paid']) : undefined;
    const whereMonth = and(dateCondition, statusCondition, branchCondition);
    const [revenue] = await anyDb
      .select({ sum: sum(tables.bookings.total_price) })
      .from(tables.bookings)
      .where(whereMonth);
    months.push({ month: m + 1, revenue: Number(revenue?.sum || 0) });
  }
  return { year: targetYear, data: months };
}
