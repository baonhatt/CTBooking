import { count, sum, eq, inArray, and, or, gte, lte, gt, sql, isNull, isNotNull } from 'drizzle-orm';
import { formatDateForDb, getVnParts } from '../../../server/lib/date-utils';
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
          })
          .from(tables.booking_vr_items)
          .where(inArray(tables.booking_vr_items.booking_id, chunk));

        for (const it of vrItems) {
          const pkgId = it.vr_ticket_package_id;
          const title = it.package_name || 'Gói VR';
          const price = Number(it.unit_price || 0);
          const tCount = Number(it.quantity || 1);
          
          if (pkgId) {
            const prev = map.get(pkgId) || { title, revenue: 0, count: 0 };
            prev.revenue += price * tCount;
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
            yearCondition,
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
        .where(and(inArray(tables.bookings.payment_status, ['paid']), yearCondition, branchConditionBookings));
      const hours = Array(24).fill(0);
      results.forEach((r: any) => {
        const parts = getVnParts(r.createdAt);
        if (parts && parts.hour >= 0 && parts.hour < 24) hours[parts.hour]++;
      });
      return hours;
    })(),
    revenueBreakdown: await (async () => {
      let movie = 0, vr = 0, combo = 0;
      const allBookings = await anyDb
        .select({
           id: tables.bookings.id,
           total_price: tables.bookings.total_price,
           booking_type: tables.bookings.booking_type,
           ticket_unit_price: tables.bookings.ticket_unit_price,
           ticket_count: tables.bookings.ticket_count,
           ticket_package_name: tables.bookings.ticket_package_name
        })
        .from(tables.bookings)
        .where(and(inArray(tables.bookings.payment_status, ['paid']), yearCondition, branchConditionBookings));

      // Fetch all VR items for these
      let vrItemsData: any[] = [];
      const vrBookingIds = allBookings.filter((b: any) => b.booking_type === 'vr' || b.booking_type === 'combo_vr').map((b: any) => b.id);
      
      if (tables.booking_vr_items && vrBookingIds.length > 0) {
        const chunk = 100;
        for (let i = 0; i < vrBookingIds.length; i += chunk) {
          const slice = vrBookingIds.slice(i, i + chunk);
          const chunkItems = await anyDb.select({
             booking_id: tables.booking_vr_items.booking_id,
             unit_price: tables.booking_vr_items.unit_price,
             quantity: tables.booking_vr_items.quantity
          }).from(tables.booking_vr_items).where(inArray(tables.booking_vr_items.booking_id, slice));
          vrItemsData.push(...chunkItems);
        }
      }

      for (const b of allBookings) {
         let currentTicketRev = 0;
         if (b.booking_type !== 'vr' && b.booking_type !== 'combo_vr') {
            const nameStr = typeof b.ticket_package_name === 'string' ? b.ticket_package_name.trim() : '';
            if (nameStr.startsWith('[') || nameStr.startsWith('{')) {
              try {
                const parsed = JSON.parse(nameStr);
                const items = Array.isArray(parsed) ? parsed : [parsed];
                for (const it of items) currentTicketRev += Number(it.price || 0) * Number(it.quantity || 1);
              } catch {}
            } else {
               currentTicketRev += Number(b.ticket_unit_price || 0) * Number(b.ticket_count || 0);
            }
            movie += currentTicketRev;
         }
         
         const bVrItems = vrItemsData.filter(v => v.booking_id === b.id);
         let curVrRev = 0;
         for (const v of bVrItems) curVrRev += Number(v.unit_price || 0) * Number(v.quantity || 1);
         vr += curVrRev;

         const currentComboRev = Number(b.total_price || 0) - (currentTicketRev + curVrRev);
         if (currentComboRev > 0) combo += currentComboRev;
      }
      return { movie, vr, combo };
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
       
       let yearConditionRedeemed = undefined as any;
       if (year !== undefined) {
         const yearStart = new Date(year, 0, 1, 0, 0, 0, 0);
         const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);
         yearConditionRedeemed = and(
           gte(tables.voucher_redemption_logs.redeemed_at, formatDateForDb(yearStart)),
           lte(tables.voucher_redemption_logs.redeemed_at, formatDateForDb(yearEnd))
         );
       }
       
       const [res] = await anyDb.select({ total: sum(tables.voucher_redemption_logs.discount_amount_applied) }).from(tables.voucher_redemption_logs).where(yearConditionRedeemed);
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
}

export async function getRevenueByDateImpl(
  anyDb: any,
  tables: { bookings: any },
  args: { date?: string; status?: string; year?: number; branchIds?: number[] }
) {
  const dateStr = String(args.date || '');
  const status = String(args.status || 'paid').toLowerCase();
  const selectedYear = args.year || new Date().getFullYear();

  const statusCondition = status !== 'all' ? inArray(tables.bookings.payment_status, ['paid']) : undefined;
  const branchCondition = buildBranchBookingCondition(tables.bookings, args.branchIds);

  // Default wide fetch bounds 
  let fetchStart = new Date(Date.UTC(selectedYear, 0, 1) - 24 * 3600 * 1000); 
  let fetchEnd = new Date(Date.UTC(selectedYear, 11, 31, 23, 59, 59, 999) + 24 * 3600 * 1000);

  if (dateStr && dateStr !== 'all') {
    const d = new Date(dateStr); 
    fetchStart = new Date(d.getTime() - 48 * 3600 * 1000);
    fetchEnd = new Date(d.getTime() + 48 * 3600 * 1000);
  }
  
  const wideCondition = or(
    and(
      gte(tables.bookings.created_at, formatDateForDb(fetchStart)),
      lte(tables.bookings.created_at, formatDateForDb(fetchEnd))
    ),
    and(
      gte(tables.bookings.paid_at, formatDateForDb(fetchStart)),
      lte(tables.bookings.paid_at, formatDateForDb(fetchEnd))
    )
  );

  const bookings = await anyDb
    .select({
      total_price: tables.bookings.total_price,
      created_at: tables.bookings.created_at,
      payment_method: tables.bookings.payment_method
    })
    .from(tables.bookings)
    .where(and(wideCondition, statusCondition, branchCondition));

  let total = 0;
  let count = 0;
  let cash = 0;
  let vietqr = 0;

  for (const b of bookings) {
    const vnParts = getVnParts(b.created_at);
    if (!vnParts) continue;

    let isMatch = false;
    if (dateStr && dateStr !== 'all') {
      isMatch = vnParts.dateString === dateStr;
    } else {
      isMatch = vnParts.year === selectedYear;
    }

    if (isMatch) {
      const price = Number(b.total_price || 0);
      total += price;
      count++;
      const method = String(b.payment_method || '').toLowerCase();
      if (method === 'cash') cash += price;
      else if (method === 'vietqr') vietqr += price;
    }
  }

  return {
    date: dateStr || 'all',
    total,
    count,
    revenueByMethod: { cash, vietqr }
  };
}

export async function getRevenue7DaysImpl(anyDb: any, tables: { bookings: any }, year?: number, branchIds?: number[]) {
  const branchCondition = buildBranchBookingCondition(tables.bookings, branchIds);
  const now = new Date(); // local node time

  // Generate the last 7 days VN date strings
  const daysMap = new Map<string, number>();
  const vnNowParts = getVnParts(now);
  
  if (vnNowParts) {
    // Generate previous 6 days backwards to maintain standard order
    for (let i = 6; i >= 0; i--) {
      // Subtract days in milliseconds from current time
      const d = new Date(now.getTime() - i * 24 * 3600 * 1000);
      const p = getVnParts(d);
      if (p) daysMap.set(p.dateString, 0);
    }
  }

  // fetch from 8 days ago to safely overlap any timezone bounds
  const fetchBoundary = new Date(now.getTime() - 8 * 24 * 3600 * 1000);
  const bookings = await anyDb
    .select({
      total_price: tables.bookings.total_price,
      created_at: tables.bookings.created_at
    })
    .from(tables.bookings)
    .where(
      and(
        inArray(tables.bookings.payment_status, ['paid']),
        branchCondition,
        gte(tables.bookings.created_at, formatDateForDb(fetchBoundary))
      )
    );

  for (const b of bookings) {
    const vnParts = getVnParts(b.created_at);
    if (!vnParts) continue;
    
    if (daysMap.has(vnParts.dateString)) {
      daysMap.set(vnParts.dateString, daysMap.get(vnParts.dateString)! + Number(b.total_price || 0));
    }
  }

  const days: { day: string; revenue: number }[] = [];
  for (const [dateStr, rev] of daysMap.entries()) {
    // dateStr format: YYYY-MM-DD
    const m = dateStr.substring(5, 7);
    const d = dateStr.substring(8, 10);
    days.push({ day: `${m}-${d}`, revenue: rev });
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
  const statusCondition = status !== 'all' ? inArray(tables.bookings.payment_status, ['paid']) : undefined;

  let targetYear = new Date().getFullYear();
  if (yearStr) {
    targetYear = Number(yearStr) > 0 ? Number(yearStr) : targetYear;
  }

  // Fetch wide boundaries for the whole year +- 2 days to be extremely safe about timezones
  const fetchStart = new Date(Date.UTC(targetYear, 0, 1) - 48 * 3600 * 1000);
  const fetchEnd = new Date(Date.UTC(targetYear, 11, 31, 23, 59, 59, 999) + 48 * 3600 * 1000);

  const bookings = await anyDb
    .select({
      total_price: tables.bookings.total_price,
      created_at: tables.bookings.created_at,
      payment_method: tables.bookings.payment_method
    })
    .from(tables.bookings)
    .where(
      and(
        statusCondition,
        branchCondition,
        gte(tables.bookings.created_at, formatDateForDb(fetchStart)),
        lte(tables.bookings.created_at, formatDateForDb(fetchEnd))
      )
    );

  if (monthStr && yearStr) {
    const targetMonth = Number(monthStr);
    let total = 0;
    let count = 0;
    let cash = 0;
    let vietqr = 0;

    for (const b of bookings) {
      const parts = getVnParts(b.created_at);
      if (parts && parts.year === targetYear && parts.month === targetMonth) {
        const price = Number(b.total_price || 0);
        total += price;
        count++;
        const method = String(b.payment_method || '').toLowerCase();
        if (method === 'cash') cash += price;
        else if (method === 'vietqr') vietqr += price;
      }
    }

    return {
      total,
      count,
      revenueByMethod: { cash, vietqr }
    };
  }

  // Array length 12
  const months = Array(12).fill(0).map((_, i) => ({ month: i + 1, revenue: 0 }));
  for (const b of bookings) {
    const parts = getVnParts(b.created_at);
    if (parts && parts.year === targetYear) {
      months[parts.month - 1].revenue += Number(b.total_price || 0);
    }
  }

  return { year: targetYear, data: months };
}
