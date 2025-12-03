import { RequestHandler } from "express";
import { prisma } from "../lib/prisma";

export const getUsers: RequestHandler = async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const pageSize = Number(req.query.pageSize || 10);
    const q = String(req.query.q || "");

    const skip = (page - 1) * pageSize;
    let where: any = {};

    // Search by fullname or email
    if (q) {
      where = {
        OR: [
          { fullname: { contains: q, mode: "insensitive" } },
          { accounts: { some: { email: { contains: q, mode: "insensitive" } } } },
          { phone: { contains: q, mode: "insensitive" } },
        ],
      };
    }

    const total = await (prisma as any).users.count({ where });
    const items = await (prisma as any).users.findMany({
      where,
      include: {
        accounts: {
          select: { email: true, is_active: true, created_at: true },
        },
        bookings: {
          select: { id: true },
        },
      },
      skip,
      take: pageSize,
      orderBy: { created_at: "desc" },
    });

    const mapped = items.map((u: any) => ({
      id: u.id,
      fullname: u.fullname || "N/A",
      phone: u.phone || "N/A",
      email: u.accounts[0]?.email || "N/A",
      is_active: u.accounts[0]?.is_active ?? true,
      total_bookings: u.bookings.length,
      created_at: u.created_at,
      updated_at: u.updated_at,
    }));

    res.status(200).json({
      items: mapped,
      page,
      pageSize,
      total,
    });
  } catch (err: any) {
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};

export const getUserById: RequestHandler = async (req, res) => {
  try {
    const userId = Number(req.params.id);

    const user = await (prisma as any).users.findUnique({
      where: { id: userId },
      include: {
        accounts: {
          select: {
            id: true,
            email: true,
            is_active: true,
            login_type: true,
            created_at: true,
          },
        },
        bookings: {
          include: {
            showtime: {
              include: {
                movie: {
                  select: { id: true, title: true },
                },
              },
            },
          },
          orderBy: { created_at: "desc" },
          take: 10,
        },
      },
    });

    if (!user) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    const mapped = {
      id: user.id,
      fullname: user.fullname || "N/A",
      phone: user.phone || "N/A",
      avatar: user.avatar || null,
      email: user.accounts[0]?.email || "N/A",
      is_active: user.accounts[0]?.is_active ?? true,
      login_type: user.accounts[0]?.login_type || "email",
      account_created_at: user.accounts[0]?.created_at,
      user_created_at: user.created_at,
      user_updated_at: user.updated_at,
      recent_bookings: user.bookings.map((b: any) => ({
        id: b.id,
        movie_title: b.showtime?.movie?.title || "N/A",
        ticket_count: b.ticket_count,
        total_price: Number(b.total_price),
        payment_method: b.payment_method,
        payment_status: b.payment_status,
        created_at: b.created_at,
      })),
      total_bookings: user.bookings.length,
    };

    res.status(200).json(mapped);
  } catch (err: any) {
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};
