import { RequestHandler } from "express";
import { prisma } from "../lib/prisma";

export const getDashboardMetrics: RequestHandler = async (req, res) => {
  try {
    const totalMovies = await (prisma as any).movies.count();
    const totalShowtimes = await (prisma as any).showtimes.count();
    const totalToys = await (prisma as any).toys.count();
    const totalUsers = await (prisma as any).users.count();
    const totalTransactions = await (prisma as any).bookings.count();

    // Revenue total - only count PAID/SUCCESS transactions
    const revenueData = await (prisma as any).bookings.aggregate({
      where: {
        payment_status: { in: ["paid", "PAID", "success", "SUCCESS"] },
      },
      _sum: { total_price: true },
    });
    const revenueTotal = Number(revenueData._sum?.total_price || 0);

    res.status(200).json({
      totalMovies,
      totalShowtimes,
      totalToys,
      totalUsers,
      totalTransactions,
      revenueTotal,
    });
  } catch (err: any) {
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};

export const getRevenueByDate: RequestHandler = async (req, res) => {
  try {
    const dateStr = String(req.query.date || "");
    const status = String(req.query.status || "paid").toLowerCase();
    let where: any = {};

    if (dateStr && dateStr !== "all") {
      const date = new Date(dateStr);
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);
      where = {
        OR: [
          { created_at: { gte: dayStart, lte: dayEnd } },
          { paid_at: { gte: dayStart, lte: dayEnd } },
        ],
      };
    }

    if (status !== "all") {
      where.payment_status = { in: ["paid", "PAID", "success", "SUCCESS"] };
    }

    const total = await (prisma as any).bookings.aggregate({
      where,
      _sum: { total_price: true },
    });

    const count = await (prisma as any).bookings.count({ where });

    res.status(200).json({
      date: dateStr || "all",
      total: Number(total._sum?.total_price || 0),
      count,
    });
  } catch (err: any) {
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};

export const getRevenue7Days: RequestHandler = async (req, res) => {
  try {
    // Get last 7 days from today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const days: {
      day: string;
      revenue: number;
    }[] = [];

    // Get data for last 7 days
    for (let i = 6; i >= 0; i--) {
      const dayDate = new Date(today);
      dayDate.setDate(dayDate.getDate() - i);

      const dayStart = new Date(dayDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayDate);
      dayEnd.setHours(23, 59, 59, 999);

      const revenue = await (prisma as any).bookings.aggregate({
        where: {
          OR: [
            { created_at: { gte: dayStart, lte: dayEnd } },
            { paid_at: { gte: dayStart, lte: dayEnd } },
          ],
          payment_status: { in: ["paid", "PAID", "success", "SUCCESS"] },
        },
        _sum: { total_price: true },
      });

      const monthStr = String(dayDate.getMonth() + 1).padStart(2, "0");
      const dateStr = String(dayDate.getDate()).padStart(2, "0");

      days.push({
        day: `${monthStr}-${dateStr}`,
        revenue: Number(revenue._sum?.total_price || 0),
      });
    }

    res.status(200).json({
      data: days,
    });
  } catch (err: any) {
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};

export const getRevenueByMonth: RequestHandler = async (req, res) => {
  try {
    const yearStr = String(req.query.year || "");
    const monthStr = String(req.query.month || "");
    const status = String(req.query.status || "paid").toLowerCase();

    // If month is provided, return revenue for that specific month
    if (monthStr && yearStr) {
      const year = Number(yearStr);
      const month = Number(monthStr);

      const monthStart = new Date(year, month - 1, 1);
      monthStart.setHours(0, 0, 0, 0);
      const monthEnd = new Date(year, month, 0);
      monthEnd.setHours(23, 59, 59, 999);

      const whereMonth: any = {
        OR: [
          { created_at: { gte: monthStart, lte: monthEnd } },
          { paid_at: { gte: monthStart, lte: monthEnd } },
        ],
      };
      if (status !== "all") {
        whereMonth.payment_status = { in: ["paid", "PAID", "success", "SUCCESS"] };
      }
      const revenue = await (prisma as any).bookings.aggregate({
        where: whereMonth,
        _sum: { total_price: true },
      });

      const count = await (prisma as any).bookings.count({ where: whereMonth });

      return res.status(200).json({
        total: Number(revenue._sum?.total_price || 0),
        count,
      });
    }

    // Otherwise return data for all 12 months of the year
    let targetYear = new Date().getFullYear();
    if (yearStr) {
      const y = Number(yearStr);
      if (y > 0) targetYear = y;
    }

    const months: {
      month: number;
      revenue: number;
    }[] = [];

    for (let m = 0; m < 12; m++) {
      const monthStart = new Date(targetYear, m, 1);
      monthStart.setHours(0, 0, 0, 0);
      const monthEnd = new Date(targetYear, m + 1, 0);
      monthEnd.setHours(23, 59, 59, 999);

      const whereMonth: any = {
        OR: [
          { created_at: { gte: monthStart, lte: monthEnd } },
          { paid_at: { gte: monthStart, lte: monthEnd } },
        ],
      };
      if (status !== "all") {
        whereMonth.payment_status = { in: ["paid", "PAID", "success", "SUCCESS"] };
      }
      const revenue = await (prisma as any).bookings.aggregate({
        where: whereMonth,
        _sum: { total_price: true },
      });

      months.push({
        month: m + 1,
        revenue: Number(revenue._sum?.total_price || 0),
      });
    }

    res.status(200).json({
      year: targetYear,
      data: months,
    });
  } catch (err: any) {
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};
