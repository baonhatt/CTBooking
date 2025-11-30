import { RequestHandler } from "express";
import { PaymentRequest } from "@shared/api";
import { prisma } from '../lib/prisma'

export const createPayment: RequestHandler = async (req, res) => {
  try {
    const {
      email,
      showtimeId,
      ticketCount,
      paymentMethod,
    } = req.body as PaymentRequest;

    // ====== VALIDATION ======
    if (!email || !showtimeId || !ticketCount || ticketCount <= 0) {
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
      return res.status(404).json({ message: "Không thể tìm thấy suất chiếu." });
    }

    // ====== TÍNH TOTAL PRICE (SERVER TỰ TÍNH) ======
    const totalPrice = Number(showtime.price) * ticketCount;

    // ====== TẠO BOOKING ======
    const booking = await prisma.bookings.create({
      data: {
        user_id: user.id,
        showtime_id: showtimeId,
        ticket_count: ticketCount,
        total_price: totalPrice,
        payment_method: paymentMethod,
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
    const { user_id, payment_id, payment_status, transaction_id, paid_at } = req.body;

    // ===== Validation cơ bản =====
    if (!user_id || !payment_id || !payment_status) {
      return res.status(400).json({ message: "Vui lòng nhập đầy đủ thông tin hợp lệ." });
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
    const fromStr = String(req.query.from || "")
    const toStr = String(req.query.to || "")
    const from = fromStr ? new Date(fromStr) : undefined
    const to = toStr ? new Date(toStr) : undefined
    const where: any = {
      payment_status: { in: ["success", "SUCCESS", "paid", "PAID"] },
    }
    if (from && to) {
      where.paid_at = { gte: from, lte: to }
    } else if (from) {
      where.paid_at = { gte: from }
    } else if (to) {
      where.paid_at = { lte: to }
    }
    const agg = await (prisma as any).bookings.aggregate({ _sum: { total_price: true }, _count: { _all: true }, where })
    const total = Number(agg?._sum?.total_price || 0)
    const count = Number(agg?._count?._all || 0)
    res.status(200).json({ total, count })
  } catch (error) {
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" })
  }
}
