import { RequestHandler } from "express";
import { prisma } from "../../lib/prisma";

export const getRevenue: RequestHandler = async (req, res) => {
  try {
    const fromStr = String(req.query.from || "");
    const toStr = String(req.query.to || "");
    const from = fromStr ? new Date(fromStr) : undefined;
    const to = toStr ? new Date(toStr) : undefined;
    const status = String(req.query.status || "paid").toLowerCase();
    const whereBase: any =
      status === "all"
        ? {}
        : { payment_status: { in: ["success"] } };
    let where: any = whereBase;
    if (from && to) {
      where = {
        ...whereBase,
        OR: [
          { paid_at: { gte: from, lte: to } },
          { created_at: { gte: from, lte: to } },
        ],
      };
    } else if (from) {
      where = {
        ...whereBase,
        OR: [
          { paid_at: { gte: from } },
          { created_at: { gte: from } },
        ],
      };
    } else if (to) {
      where = {
        ...whereBase,
        OR: [
          { paid_at: { lte: to } },
          { created_at: { lte: to } },
        ],
      };
    }
    const agg = await (prisma as any).bookings.aggregate({
      _sum: { total_price: true },
      _count: { _all: true },
      where,
    });
    const total = Number(agg?._sum?.total_price || 0);
    const count = Number(agg?._count?._all || 0);
    res.status(200).json({ total, count });
  } catch (error) {
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};

export const listTransactions: RequestHandler = async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const pageSize = Number(req.query.pageSize || 10);
    const email = String(req.query.email || "");
    const status = String(req.query.status || "");
    const sortKey = String(req.query.sort || "created_at");
    const dir = String(req.query.dir || "desc").toLowerCase() === "asc" ? "asc" : "desc";
    const paymentMethod = String(req.query.payment_method || "");
    const fromStr = String(req.query.from || "");
    const toStr = String(req.query.to || "");
    const skip = (page - 1) * pageSize;

    // Build where clause
    const where: any = {};
    if (email) {
      where.user = {
        accounts: {
          some: {
            email: {
              contains: email,
              mode: "insensitive",
            },
          },
        },
      };
    }

    // Filter by payment status
    if (status && status !== "all") {
      where.payment_status = status;
    }
    if (paymentMethod) {
      where.payment_method = paymentMethod;
    }
    if (fromStr || toStr) {
      const from = fromStr ? new Date(fromStr) : undefined;
      const to = toStr ? new Date(toStr) : undefined;
      if (from && to) {
        where.OR = [
          { created_at: { gte: from, lte: to } },
          { paid_at: { gte: from, lte: to } },
        ];
      } else if (from) {
        where.OR = [
          { created_at: { gte: from } },
          { paid_at: { gte: from } },
        ];
      } else if (to) {
        where.OR = [
          { created_at: { lte: to } },
          { paid_at: { lte: to } },
        ];
      }
    }

    // Get total count
    const total = await prisma.bookings.count({ where });

    // Get transactions with pagination
    const orderBy: any = sortKey === "paid_at" ? { paid_at: dir } : { created_at: dir };
    const transactions = await (prisma as any).bookings.findMany({
      where,
      include: {
        user: {
          include: {
            accounts: {
              select: { email: true },
            },
          },
        },
        movies: {
          select: { title: true },
        },
        ticket_packages: {
          select: { name: true },
        },
      },
      orderBy,
      skip,
      take: pageSize,
    });

    const items = transactions.map((tx) => ({
      id: tx.id,
      bookingId: tx.id,
      email: tx.email || tx.user.accounts[0]?.email || "",
      phone: tx.phone || "",
      name: tx.name || tx.user.fullname || "",
      userName: tx.user.fullname || "",
      movieTitle: tx.movies?.title || "",
      ticketPackageName: tx.ticket_packages?.name || "",
      ticketCount: tx.ticket_count,
      totalPrice: Number(tx.total_price),
      paymentMethod: tx.payment_method,
      paymentStatus: tx.payment_status,
      transactionId: tx.transaction_id,
      createdAt: tx.created_at,
      paidAt: tx.paid_at,
    }));

    res.status(200).json({
      items,
      page,
      pageSize,
      total,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Lỗi máy chủ nội bộ", error: (error as Error).message });
  }
};

export const getTransactionById: RequestHandler = async (req, res) => {
  try {
    const bookingId = Number(req.params.id);

    const booking = await (prisma as any).bookings.findUnique({
      where: { id: bookingId },
      include: {
        user: {
          include: {
            accounts: {
              select: { email: true, is_active: true, created_at: true },
            },
          },
        },
        movies: {
          select: {
            id: true,
            title: true,
            cover_image: true,
            genres: true,
            rating: true,
            duration_min: true,
          },
        },
        ticket_packages: {
          select: {
            id: true,
            name: true,
            price: true,
          },
        },
      },
    });

    if (!booking) {
      return res.status(404).json({ message: "Không tìm thấy giao dịch" });
    }

    const mapped = {
      id: booking.id,
      user: {
        id: booking.user.id,
        fullname: booking.user.fullname,
        email: booking.email || booking.user.accounts[0]?.email || "N/A",
        phone: booking.phone || booking.user.phone || "N/A",
        name: booking.name || booking.user.fullname || "N/A",
        is_active: booking.user.accounts[0]?.is_active ?? true,
        account_created_at: booking.user.accounts[0]?.created_at,
      },
      movie: booking.movies || null,
      ticket_package: booking.ticket_packages || null,
      booking_details: {
        ticket_count: booking.ticket_count,
        total_price: Number(booking.total_price),
        price_per_ticket: booking.ticket_count > 0 ? Number(booking.total_price) / booking.ticket_count : 0,
      },
      payment_info: {
        payment_method: booking.payment_method || "N/A",
        payment_status: booking.payment_status || "pending",
        transaction_id: booking.transaction_id || "N/A",
        created_at: booking.created_at,
        paid_at: booking.paid_at,
      },
    };

    res.status(200).json(mapped);
  } catch (err: any) {
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};

