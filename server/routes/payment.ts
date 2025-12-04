import { RequestHandler } from "express";
import { PaymentRequest } from "@shared/api";
import { prisma } from "../lib/prisma";

export const createPayment: RequestHandler = async (req, res) => {
  try {
    const { email, emailBook, phone, name, showtimeId, ticketCount, paymentMethod, totalPrice } =
      req.body as PaymentRequest

    // ====== VALIDATION ======
    if (!email || !phone || !emailBook || !name || !showtimeId || !ticketCount || ticketCount <= 0) {
      return res.status(400).json({
        message: "Vui lòng nhập đầy đủ thông tin hợp lệ.",
      });
    }

    // ====== LẤY USER ======
    const user = await prisma.users.findFirst({
      where: { accounts: { some: { email } } },
    });

    if (!user) {
      return res.status(404).json({ message: "Người dùng không tồn tại." });
    }

    // ====== LẤY SUẤT CHIẾU ======
    const showtime = await prisma.showtimes.findUnique({
      where: { id: showtimeId },
      include: { movie: true },
    });

    if (!showtime) {
      return res
        .status(404)
        .json({ message: "Không thể tìm thấy suất chiếu." });
    }

    // ====== TÍNH TOTAL PRICE (SERVER TỰ TÍNH) ======
    // const totalPrice = Number(showtime.price) * ticketCount;
    // total price lấy từ formdata create booking

    // ====== TẠO BOOKING ======
    const booking = await prisma.bookings.create({
      data: {
        user_id: user.id,
        showtime_id: showtimeId,
        ticket_count: ticketCount,
        total_price: totalPrice,
        payment_method: paymentMethod,
        phone,
        name,
        email: emailBook,
      },
    });

    return res.status(201).json({
      message: "Khởi tạo đặt vé thành công",
      booking,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Lỗi máy chủ nội bộ",
      error: (error as Error).message,
    });
  }
};

export const updatePayment: RequestHandler = async (req, res) => {
  try {
    const { user_id, payment_id, payment_status, transaction_id, paid_at } =
      req.body;

    // ===== Validation cơ bản =====
    if (!user_id || !payment_id || !payment_status) {
      return res
        .status(400)
        .json({ message: "Vui lòng nhập đầy đủ thông tin hợp lệ." });
    }

    // Tìm booking tương ứng
    const booking = await prisma.bookings.findFirst({
      where: {
        id: Number(payment_id),
        user_id: Number(user_id),
      },
    });

    if (!booking) {
      return res.status(404).json({ message: "Không tìm thấy đặt vé." });
    }

    // Cập nhật booking
    const updatedBooking = await prisma.bookings.update({
      where: { id: booking.id },
      data: {
        payment_status,
        transaction_id: transaction_id ?? undefined,
        paid_at: paid_at ? new Date(paid_at) : undefined,
      },
    });

    return res.status(200).json({
      message: "Thanh toán thành công",
      booking: updatedBooking,
    });
  } catch (error) {
    return res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};

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
        : { payment_status: { in: ["success", "SUCCESS", "paid", "PAID"] } };
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

    // Get total count
    const total = await prisma.bookings.count({ where });

    // Get transactions with pagination
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
        showtime: {
          include: {
            movie: {
              select: { title: true },
            },
          },
        },
      },
      orderBy: { created_at: "desc" },
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
      movieTitle: tx.showtime?.movie?.title || "",
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
        showtime: {
          include: {
            movie: {
              select: {
                id: true,
                title: true,
                cover_image: true,
                genres: true,
                rating: true,
                duration_min: true,
              },
            },
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
      showtime: {
        id: booking.showtime.id,
        start_time: booking.showtime.start_time,
        end_time: booking.showtime.end_time,
        price: Number(booking.showtime.price),
        movie: booking.showtime.movie,
      },
      booking_details: {
        ticket_count: booking.ticket_count,
        total_price: Number(booking.total_price),
        price_per_ticket: Number(booking.total_price) / booking.ticket_count,
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
