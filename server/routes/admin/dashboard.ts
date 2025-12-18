import { db } from "../../db";
import { movies, toys, users, bookings } from "../../db/schema";
import { count, sum, eq, inArray, and, or, gte, lte, gt, sql } from "drizzle-orm";

export async function getDashboardMetricsImpl(anyDb: any, tables: { movies: any; toys?: any; users: any; bookings: any }) {
  const [totalMoviesRes] = await anyDb.select({ count: count() }).from(tables.movies).where(eq(tables.movies.is_active, true));
  const totalMovies = totalMoviesRes?.count || 0;
  const totalToys = await (async () => {
    try {
      if (!tables.toys) return 0;
      const [r] = await anyDb.select({ count: count() }).from(tables.toys);
      return r?.count || 0;
    } catch { return 0; }
  })();
  const [totalUsersRes] = await anyDb.select({ count: count() }).from(tables.users);
  const totalUsers = totalUsersRes?.count || 0;
  const [totalTransactionsRes] = await anyDb.select({ count: count() }).from(tables.bookings).where(inArray(tables.bookings.payment_status, ["paid"]));
  const totalTransactions = totalTransactionsRes?.count || 0;
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  
  const todayStartStr = todayStart.toISOString();
  const todayEndStr = todayEnd.toISOString();
  
  const dateCondition = or(and(gte(tables.bookings.created_at, todayStartStr), lte(tables.bookings.created_at, todayEndStr)), and(gte(tables.bookings.paid_at, todayStartStr), lte(tables.bookings.paid_at, todayEndStr)));
  const [revenueData] = await anyDb.select({ sum: sum(tables.bookings.total_price) }).from(tables.bookings).where(and(inArray(tables.bookings.payment_status, ["paid"]), dateCondition));
  const revenueTotal = Number(revenueData?.sum || 0);
  const [revenueCashTodayAgg] = await anyDb.select({ sum: sum(tables.bookings.total_price) }).from(tables.bookings).where(and(inArray(tables.bookings.payment_status, ["paid"]), inArray(tables.bookings.payment_method, ["cash", "Cash"]), dateCondition));
  const [revenueMomoTodayAgg] = await anyDb.select({ sum: sum(tables.bookings.total_price) }).from(tables.bookings).where(and(inArray(tables.bookings.payment_status, ["paid"]), inArray(tables.bookings.payment_method, ["momo", "MoMo"]), dateCondition));
  const [revenueVnpayTodayAgg] = await anyDb.select({ sum: sum(tables.bookings.total_price) }).from(tables.bookings).where(and(inArray(tables.bookings.payment_status, ["paid"]), inArray(tables.bookings.payment_method, ["vnpay", "VNPay"]), dateCondition));
  const revenueByMethod = { cash: Number(revenueCashTodayAgg?.sum || 0), momo: Number(revenueMomoTodayAgg?.sum || 0), vnpay: Number(revenueVnpayTodayAgg?.sum || 0) };
  const [bookingsTodayRes] = await anyDb.select({ count: count() }).from(tables.bookings).where(and(inArray(tables.bookings.payment_status, ["paid"]), dateCondition));
  const bookingsToday = bookingsTodayRes?.count || 0;
  const [bookingsFutureRes] = await anyDb.select({ count: count() }).from(tables.bookings).where(and(inArray(tables.bookings.payment_status, ["paid"]), gt(tables.bookings.created_at, todayEnd.toISOString())));
  const bookingsFuture = bookingsFutureRes?.count || 0;
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 6);
  const weekStartStr = weekStart.toISOString();
  const weekBookings = await anyDb
    .select({ movie_id: tables.bookings.movie_id, total_price: tables.bookings.total_price, movie_title: tables.movies.title })
    .from(tables.bookings)
    .leftJoin(tables.movies, eq(tables.bookings.movie_id, tables.movies.id))
    .where(and(inArray(tables.bookings.payment_status, ["paid"]), or(and(gte(tables.bookings.created_at, weekStartStr), lte(tables.bookings.created_at, todayEndStr)), and(gte(tables.bookings.paid_at, weekStartStr), lte(tables.bookings.paid_at, todayEndStr)))));
  const map = new Map<number, { title: string; revenue: number }>();
  for (const b of weekBookings) {
    const movieId = b.movie_id;
    const title = b.movie_title || "";
    const price = Number(b.total_price || 0);
    if (movieId) {
      const prev = map.get(movieId) || { title, revenue: 0 };
      prev.revenue += price;
      prev.title = title || prev.title;
      map.set(movieId, prev);
    }
  }
  const topMoviesWeek = Array.from(map.entries()).map(([id, v]) => ({ id, title: v.title, revenue: v.revenue })).sort((a, b) => b.revenue - a.revenue).slice(0, 3);
  return { totalMovies, totalToys, totalUsers, totalTransactions, revenueTotal, revenueByMethod, totalBookingsToday: bookingsToday, totalBookingsFuture: bookingsFuture, topMoviesWeek };
}

export async function getRevenueByDateImpl(anyDb: any, tables: { bookings: any }, args: { date?: string; status?: string }) {
  const dateStr = String(args.date || "");
  const status = String(args.status || "paid").toLowerCase();
  let dateCondition = undefined as any;
  if (dateStr && dateStr !== "all") {
    const date = new Date(dateStr);
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    const dayStartStr = dayStart.toISOString();
    const dayEndStr = dayEnd.toISOString();
    dateCondition = or(and(gte(tables.bookings.created_at, dayStartStr), lte(tables.bookings.created_at, dayEndStr)), and(gte(tables.bookings.paid_at, dayStartStr), lte(tables.bookings.paid_at, dayEndStr)));
  }
  const statusCondition = status !== "all" ? inArray(tables.bookings.payment_status, ["paid"]) : undefined;
  const whereCondition = and(dateCondition, statusCondition);
  const [totalRes] = await anyDb.select({ sum: sum(tables.bookings.total_price) }).from(tables.bookings).where(whereCondition);
  const [countRes] = await anyDb.select({ count: count() }).from(tables.bookings).where(whereCondition);
  const countVal = countRes?.count || 0;
  const [revenueCashAgg] = await anyDb.select({ sum: sum(tables.bookings.total_price) }).from(tables.bookings).where(and(whereCondition, inArray(tables.bookings.payment_method, ["cash", "Cash"])));
  const [revenueMomoAgg] = await anyDb.select({ sum: sum(tables.bookings.total_price) }).from(tables.bookings).where(and(whereCondition, inArray(tables.bookings.payment_method, ["momo", "MoMo"])));
  const [revenueVnpayAgg] = await anyDb.select({ sum: sum(tables.bookings.total_price) }).from(tables.bookings).where(and(whereCondition, inArray(tables.bookings.payment_method, ["vnpay", "VNPay"])));
  return { date: dateStr || "all", total: Number(totalRes?.sum || 0), count: countVal, revenueByMethod: { cash: Number(revenueCashAgg?.sum || 0), momo: Number(revenueMomoAgg?.sum || 0), vnpay: Number(revenueVnpayAgg?.sum || 0) } };
}

export async function getRevenue7DaysImpl(anyDb: any, tables: { bookings: any }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days: { day: string; revenue: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const dayDate = new Date(today);
    dayDate.setDate(dayDate.getDate() - i);
    const dayStart = new Date(dayDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayDate);
    dayEnd.setHours(23, 59, 59, 999);
    const dayStartStr = dayStart.toISOString();
    const dayEndStr = dayEnd.toISOString();
    const [revenue] = await anyDb
      .select({ sum: sum(tables.bookings.total_price) })
      .from(tables.bookings)
      .where(and(inArray(tables.bookings.payment_status, ["paid"]), or(and(gte(tables.bookings.created_at, dayStartStr), lte(tables.bookings.created_at, dayEndStr)), and(gte(tables.bookings.paid_at, dayStartStr), lte(tables.bookings.paid_at, dayEndStr)))));
    const monthStr = String(dayDate.getMonth() + 1).padStart(2, "0");
    const dateStr = String(dayDate.getDate()).padStart(2, "0");
    days.push({ day: `${monthStr}-${dateStr}`, revenue: Number(revenue?.sum || 0) });
  }
  return { data: days };
}

export async function getRevenueByMonthImpl(anyDb: any, tables: { bookings: any }, args: { year?: string; month?: string; status?: string }) {
  const yearStr = String(args.year || "");
  const monthStr = String(args.month || "");
  const status = String(args.status || "paid").toLowerCase();
  if (monthStr && yearStr) {
    const year = Number(yearStr);
    const month = Number(monthStr);
    const monthStart = new Date(year, month - 1, 1);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date(year, month, 0);
    monthEnd.setHours(23, 59, 59, 999);
    const monthStartStr = monthStart.toISOString();
    const monthEndStr = monthEnd.toISOString();
    const dateCondition = or(and(gte(tables.bookings.created_at, monthStartStr), lte(tables.bookings.created_at, monthEndStr)), and(gte(tables.bookings.paid_at, monthStartStr), lte(tables.bookings.paid_at, monthEndStr)));
    const statusCondition = status !== "all" ? inArray(tables.bookings.payment_status, ["paid"]) : undefined;
    const whereMonth = and(dateCondition, statusCondition);
    const [revenue] = await anyDb.select({ sum: sum(tables.bookings.total_price) }).from(tables.bookings).where(whereMonth);
    const [countRes] = await anyDb.select({ count: count() }).from(tables.bookings).where(whereMonth);
    const [revenueCashAgg] = await anyDb.select({ sum: sum(tables.bookings.total_price) }).from(tables.bookings).where(and(whereMonth, inArray(tables.bookings.payment_method, ["cash", "Cash"])));
    const [revenueMomoAgg] = await anyDb.select({ sum: sum(tables.bookings.total_price) }).from(tables.bookings).where(and(whereMonth, inArray(tables.bookings.payment_method, ["momo", "MoMo"])));
    const [revenueVnpayAgg] = await anyDb.select({ sum: sum(tables.bookings.total_price) }).from(tables.bookings).where(and(whereMonth, inArray(tables.bookings.payment_method, ["vnpay", "VNPay"])));
    return { total: Number(revenue?.sum || 0), count: countRes?.count || 0, revenueByMethod: { cash: Number(revenueCashAgg?.sum || 0), momo: Number(revenueMomoAgg?.sum || 0), vnpay: Number(revenueVnpayAgg?.sum || 0) } };
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
    const monthStartStr = monthStart.toISOString();
    const monthEndStr = monthEnd.toISOString();
    const dateCondition = or(and(gte(tables.bookings.created_at, monthStartStr), lte(tables.bookings.created_at, monthEndStr)), and(gte(tables.bookings.paid_at, monthStartStr), lte(tables.bookings.paid_at, monthEndStr)));
    const statusCondition = status !== "all" ? inArray(tables.bookings.payment_status, ["paid"]) : undefined;
    const whereMonth = and(dateCondition, statusCondition);
    const [revenue] = await anyDb.select({ sum: sum(tables.bookings.total_price) }).from(tables.bookings).where(whereMonth);
    months.push({ month: m + 1, revenue: Number(revenue?.sum || 0) });
  }
  return { year: targetYear, data: months };
}
