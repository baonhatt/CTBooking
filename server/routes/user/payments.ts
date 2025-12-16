import { RequestHandler } from "express";
import { PaymentRequest } from "@shared/api";
import { prisma } from "../../lib/prisma";
import { generateBookingCode, getBookingEmailTemplate } from "../../lib/booking-utils";
import { sendMail } from "../mail-service";

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const MAX_TICKET_PER_ORDER = 10;

type BookingValidationResult = {
  user: { id: number; email: string; fullname?: string | null; phone?: string | null };
  movie?: any;
  ticketPackage: any;
  unitPrice: number;
  totalPrice: number;
};

async function validateBookingInput(body: PaymentRequest): Promise<BookingValidationResult> {
  const { email, emailBook, phone, name, movieId, ticketCount, ticketPackageId } = body;

  if (!email || !phone || !emailBook || !name || !ticketCount || ticketCount <= 0) {
    throw new HttpError(400, "Vui lòng nhập đầy đủ thông tin hợp lệ.");
  }
  if (ticketCount > MAX_TICKET_PER_ORDER) {
    throw new HttpError(400, `Mỗi lượt chỉ đặt tối đa ${MAX_TICKET_PER_ORDER} vé.`);
  }

  const user = await prisma.users.findFirst({
    where: { accounts: { some: { email } } },
    select: { id: true, fullname: true, phone: true, accounts: { select: { email: true }, take: 1 } },
  });
  const userEmail = user?.accounts?.[0]?.email || email;

  let movie: any = null;
  if (movieId) {
    movie = await (prisma as any).movies.findUnique({ where: { id: Number(movieId) } });
    if (!movie || movie.is_active === false) {
      throw new HttpError(404, "Phim không hợp lệ hoặc đã ngừng hoạt động.");
    }
  }

  let ticketPackage: any = null;
  if (ticketPackageId) {
    ticketPackage = await (prisma as any).ticket_packages.findUnique({ where: { id: ticketPackageId } });
    if (!ticketPackage || ticketPackage.is_active === false) {
      throw new HttpError(404, "Gói vé không hợp lệ hoặc đã tắt.");
    }
  } else {
    ticketPackage = await (prisma as any).ticket_packages.findFirst({
      where: { is_active: true },
      orderBy: [{ display_order: "asc" }, { price: "asc" }],
    });
    if (!ticketPackage) {
      throw new HttpError(400, "Không tìm thấy gói vé khả dụng.");
    }
  }

  const unitPrice = Number(ticketPackage.price || 0);
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
    throw new HttpError(400, "Giá vé không hợp lệ.");
  }
  const totalPrice = unitPrice * ticketCount;

  return {
    user: { id: user?.id ?? 0, email: userEmail, fullname: user?.fullname ?? name, phone: user?.phone ?? phone },
    movie,
    ticketPackage,
    unitPrice,
    totalPrice,
  };
}

export const validateBooking: RequestHandler = async (req, res) => {
  try {
    const result = await validateBookingInput(req.body as PaymentRequest);
    return res.status(200).json({
      ok: true,
      user: result.user,
      movie: result.movie ? {
        id: result.movie.id,
        title: result.movie.title,
        is_active: result.movie.is_active,
        duration_min: result.movie.duration_min,
      } : undefined,
      ticketPackage: {
        id: result.ticketPackage.id,
        name: result.ticketPackage.name,
        price: Number(result.ticketPackage.price || 0),
      },
      unitPrice: result.unitPrice,
      totalPrice: result.totalPrice,
    });
  } catch (error: any) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof HttpError ? error.message : "Lỗi máy chủ nội bộ";
    return res.status(status).json({ ok: false, message });
  }
};

export const createPayment: RequestHandler = async (req, res) => {
  try {
    const validation = await validateBookingInput(req.body as PaymentRequest);
    const { user, totalPrice } = validation;
    const { emailBook, phone, name, ticketCount, paymentMethod } = req.body as PaymentRequest;

    let userId = Number(user?.id ?? 0);
    if (!userId || userId <= 0) {
      let guest = await (prisma as any).users.findFirst({ where: { phone } });
      if (!guest) {
        guest = await (prisma as any).users.create({
          data: {
            fullname: name || "Khách vãng lai",
            phone,
          },
        });
      }
      userId = Number(guest.id);
    }

    // ====== TẠO BOOKING ======
    const booking = await (prisma as any).bookings.create({
      data: {
        user_id: userId,
        movie_id: validation.movie?.id ? Number(validation.movie.id) : null,
        ticket_package_id: validation.ticketPackage?.id ? Number(validation.ticketPackage.id) : null,
        ticket_count: ticketCount,
        total_price: totalPrice,
        payment_method: (paymentMethod || "cash").toLowerCase(),
        phone,
        name,
        email: emailBook,
      },
    });

    return res.status(201).json({
      message: "Khởi tạo đặt vé thành công",
      booking: {
        id: booking.id,
        user_id: booking.user_id,
        movie_id: booking.movie_id,
        ticket_package_id: booking.ticket_package_id,
        ticket_count: booking.ticket_count,
        total_price: booking.total_price,
        payment_method: booking.payment_method,
        phone: booking.phone,
        name: booking.name,
        email: booking.email,
        payment_status: booking.payment_status,
        created_at: booking.created_at,
      },
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
    const booking = await (prisma as any).bookings.findFirst({
      where: {
        id: Number(payment_id),
        user_id: Number(user_id),
      },
      include: {
        movies: true,
        ticket_packages: true,
      },
    });

    if (!booking) {
      return res.status(404).json({ message: "Không tìm thấy đặt vé." });
    }

    // Nếu thanh toán thành công và chưa có booking_code
    let bookingCode = booking.booking_code;
    if (
      payment_status &&
      payment_status.toLowerCase() === "paid" &&
      !bookingCode
    ) {
      // Generate unique booking code (checks for duplicates)
      bookingCode = await generateBookingCode();
    }

    // Cập nhật booking
    const updatedBooking = await prisma.bookings.update({
      where: { id: booking.id },
      data: {
        payment_status,
        transaction_id: transaction_id ?? undefined,
        paid_at: paid_at ? new Date(paid_at) : undefined,
        expiry_date: paid_at
          ? new Date(new Date(paid_at).getTime() + 10 * 24 * 60 * 60 * 1000)
          : undefined,
        booking_code: bookingCode ?? undefined,
      },
    });

    // Nếu thanh toán thành công, gửi email xác nhận
    if (
      payment_status &&
      payment_status.toLowerCase() === "paid"
    ) {
      console.log(`[Payment Success] Booking ID: ${booking.id}, Status: ${payment_status}`);

      // Gửi email xác nhận
      try {
        const totalPrice = Number(booking.total_price).toLocaleString("vi-VN");

        const movieTitle = booking.movies?.title || "";
        const emailTemplate = getBookingEmailTemplate({
          bookingCode: bookingCode || "",
          customerName: booking.name || "Khách hàng",
          movieTitle: movieTitle,
          ticketCount: booking.ticket_count,
          totalPrice,
          movieImage: booking.movies?.cover_image || undefined,
          durationMin: booking.movies?.duration_min || undefined,
          ticketPackageName: booking.ticket_packages?.name || undefined,
          expiryDate: (updatedBooking as any)?.expiry_date || undefined,
        });

        console.log(`[Email] Sending to: ${booking.email}`);

        await sendMail(
          booking.email,
          `🎬 Xác nhận đặt vé - Mã: ${bookingCode}`,
          emailTemplate
        );

        console.log(`[Email] Sent successfully to: ${booking.email}`);
      } catch (emailError) {
        console.error("Lỗi gửi email:", emailError);
        // Không fail request nếu lỗi gửi email
      }
    }

    const updatedBookingAny = updatedBooking as any;
    return res.status(200).json({
      message: "Thanh toán thành công",
      booking: {
        id: updatedBooking.id,
        user_id: updatedBooking.user_id,
        movie_id: updatedBookingAny.movie_id,
        ticket_package_id: updatedBookingAny.ticket_package_id,
        ticket_count: updatedBooking.ticket_count,
        total_price: updatedBooking.total_price,
        payment_method: updatedBooking.payment_method,
        payment_status: updatedBooking.payment_status,
        transaction_id: updatedBooking.transaction_id,
        created_at: updatedBooking.created_at,
        paid_at: updatedBooking.paid_at,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};

export const getBooking: RequestHandler = async (req, res) => {
  try {
    const bookingId = Number(req.params.id);

    const booking = await (prisma as any).bookings.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        payment_status: true,
        total_price: true,
        ticket_count: true,
        created_at: true,
        name: true,
        email: true,
        phone: true,
        user_id: true,
        movie_id: true,
        ticket_package_id: true,
      },
    });

    if (!booking) {
      return res.status(404).json({ message: "Không tìm thấy đặt vé" });
    }

    res.status(200).json({
      id: booking.id,
      payment_status: booking.payment_status,
      total_price: booking.total_price,
      ticket_count: booking.ticket_count,
      created_at: booking.created_at,
      movie_id: booking.movie_id,
      ticket_package_id: booking.ticket_package_id,
    });
  } catch (err: any) {
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};

// ===== GET BOOKING BY ID (cho checkout page) =====
export const getBookingById: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await (prisma as any).bookings.findUnique({
      where: { id: Number(id) },
    });

    if (!booking) {
      return res.status(404).json({ message: "Không tìm thấy đặt vé" });
    }

    res.status(200).json({
      id: booking.id,
      payment_status: booking.payment_status,
      user_id: booking.user_id,
      name: booking.name,
      phone: booking.phone,
      email: booking.email,
      ticket_count: booking.ticket_count,
      total_price: booking.total_price,
      movie_id: booking.movie_id,
      ticket_package_id: booking.ticket_package_id,
    });
  } catch (err: any) {
    console.error("Error getting booking:", err);
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};

// ===== GET BOOKING BY CODE (cho ticket check) =====
export const getBookingByCode: RequestHandler = async (req, res) => {
  try {
    const { code } = req.params;

    if (!code || code.trim() === "") {
      return res.status(400).json({ message: "Vui lòng nhập mã vé" });
    }

    // Normalize code: uppercase and trim
    const normalizedCode = code.trim().toUpperCase();

    const booking = await (prisma as any).bookings.findUnique({
      where: { booking_code: normalizedCode },
      include: {
        user: {
          select: { fullname: true },
        },
      },
    });

    if (!booking) {
      const remaining = typeof (res.locals as any).rateLimitRemaining === "number"
        ? (res.locals as any).rateLimitRemaining
        : undefined;
      const windowMs = typeof (res.locals as any).rateLimitWindowMs === "number"
        ? (res.locals as any).rateLimitWindowMs
        : undefined;
      const suffix = remaining !== undefined && windowMs !== undefined
        ? ` Bạn còn ${remaining} lần thử trong ${Math.ceil(windowMs / 1000)}s`
        : "";
      return res.status(404).json({ message: `Không tìm thấy vé với mã này.${suffix}` });
    }

    const now = new Date();
    const paidAt = booking.paid_at ? new Date(booking.paid_at) : null;
    const expiryAt = booking.expiry_date ? new Date(booking.expiry_date as any) : null;
    const isPaid = (booking.payment_status || '').toLowerCase() === 'paid';
    const expired = Boolean(expiryAt && now.getTime() > expiryAt.getTime());
    const valid = Boolean(isPaid && paidAt && expiryAt && !expired && !booking.is_used);
    const can_use = Boolean(valid);
    const daysLeft = expiryAt ? Math.ceil((expiryAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;

    res.status(200).json({
      id: booking.id,
      booking_code: booking.booking_code,
      payment_status: booking.payment_status,
      user_id: booking.user_id,
      name: booking.name,
      phone: booking.phone,
      email: booking.email,
      ticket_count: booking.ticket_count,
      total_price: booking.total_price,
      movie_id: booking.movie_id,
      ticket_package_id: booking.ticket_package_id,
      created_at: booking.created_at,
      paid_at: booking.paid_at,
      expiry_date: booking.expiry_date,
      payment_method: booking.payment_method,
      userName: booking.user?.fullname || 'N/A',
      is_used: Boolean(booking.is_used),
      valid,
      can_use,
      validity_days: daysLeft,
      expired,
    });
  } catch (err: any) {
    console.error("Error getting booking by code:", err);
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};

// ===== CONFIRM TICKET USE BY CODE =====
export const confirmUseTicket: RequestHandler = async (req, res) => {
  try {
    const { code } = req.body as { code?: string };
    if (!code || !code.trim()) {
      return res.status(400).json({ message: 'Vui lòng nhập mã vé' });
    }
    const normalizedCode = code.trim().toUpperCase();
    const booking = await prisma.bookings.findUnique({ where: { booking_code: normalizedCode } });
    if (!booking) return res.status(404).json({ message: 'Không tìm thấy vé' });
    const isPaid = (booking.payment_status || '').toLowerCase() === 'paid';
    const paidAt = booking.paid_at ? new Date(booking.paid_at) : null;
    const expiryAt = booking.expiry_date ? new Date(booking.expiry_date as any) : null;
    const expired = Boolean(expiryAt && Date.now() > expiryAt.getTime());
    const valid = Boolean(isPaid && paidAt && expiryAt && !expired && !booking.is_used);
    if (!valid) {
      return res.status(400).json({ message: 'Vé không còn hiệu lực hoặc đã sử dụng' });
    }
    const updated = await prisma.bookings.update({ where: { id: booking.id }, data: { is_used: true } });
    return res.status(200).json({ ok: true, message: 'Xác nhận sử dụng vé thành công', booking: { id: updated.id, is_used: updated.is_used } });
  } catch (err: any) {
    return res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
};

