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
  showtime: any;
  movie: any;
  ticketPackage: any;
  unitPrice: number;
  totalPrice: number;
};

async function validateBookingInput(body: PaymentRequest): Promise<BookingValidationResult> {
  const { email, emailBook, phone, name, showtimeId, ticketCount, ticketPackageId } = body;

  if (!email || !phone || !emailBook || !name || !showtimeId || !ticketCount || ticketCount <= 0) {
    throw new HttpError(400, "Vui lòng nhập đầy đủ thông tin hợp lệ.");
  }
  if (ticketCount > MAX_TICKET_PER_ORDER) {
    throw new HttpError(400, `Mỗi lượt chỉ đặt tối đa ${MAX_TICKET_PER_ORDER} vé.`);
  }

  const user = await prisma.users.findFirst({
    where: { accounts: { some: { email } } },
    select: { id: true, fullname: true, phone: true, accounts: { select: { email: true }, take: 1 } },
  });
  if (!user) {
    throw new HttpError(404, "Người dùng không tồn tại.");
  }
  const userEmail = user.accounts?.[0]?.email;
  if (!userEmail || userEmail.toLowerCase() !== email.toLowerCase()) {
    throw new HttpError(400, "Email người dùng không trùng khớp.");
  }

  const showtime = await prisma.showtimes.findUnique({
    where: { id: showtimeId },
    include: { movie: true },
  });
  if (!showtime || showtime.is_active === false) {
    throw new HttpError(404, "Không thể tìm thấy suất chiếu.");
  }
  if (!showtime.movie || showtime.movie.is_active === false) {
    throw new HttpError(400, "Phim không hợp lệ hoặc đã ngừng hoạt động.");
  }
  const now = Date.now();
  if (new Date(showtime.start_time).getTime() < now) {
    throw new HttpError(400, "Suất chiếu đã bắt đầu hoặc đã kết thúc.");
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
    user: { id: user.id, email: userEmail, fullname: user.fullname, phone: user.phone },
    showtime,
    movie: showtime.movie,
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
      showtime: {
        id: result.showtime.id,
        start_time: result.showtime.start_time,
        end_time: result.showtime.end_time,
        is_active: result.showtime.is_active,
      },
      movie: {
        id: result.movie.id,
        title: result.movie.title,
        is_active: result.movie.is_active,
        duration_min: result.movie.duration_min,
      },
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
    const { user, showtime, totalPrice } = validation;
    const { emailBook, phone, name, ticketCount, paymentMethod } = req.body as PaymentRequest;

    // ====== TẠO BOOKING ======
    const booking = await prisma.bookings.create({
      data: {
        user_id: user.id,
        showtime_id: showtime.id,
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
        showtime_id: booking.showtime_id,
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
    const booking = await prisma.bookings.findFirst({
      where: {
        id: Number(payment_id),
        user_id: Number(user_id),
      },
      include: {
        showtime: {
          include: {
            movie: true,
          },
        },
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
        booking_code: bookingCode ?? undefined,
      },
    });

    // Nếu thanh toán thành công, update total_sold và gửi email
    if (
      payment_status &&
      payment_status.toLowerCase() === "paid"
    ) {
      console.log(`[Payment Success] Booking ID: ${booking.id}, Status: ${payment_status}`);

      // Update total_sold
      await prisma.showtimes.update({
        where: { id: booking.showtime_id },
        data: {
          total_sold: {
            increment: booking.ticket_count,
          },
        },
      });

      // Gửi email xác nhận
      try {
        const showtimeDate = new Date(booking.showtime.start_time).toLocaleDateString("vi-VN");
        const showtimeTime = new Date(booking.showtime.start_time).toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        });
        const totalPrice = Number(booking.total_price).toLocaleString("vi-VN");

        const emailTemplate = getBookingEmailTemplate({
          bookingCode: bookingCode || "",
          customerName: booking.name || "Khách hàng",
          movieTitle: booking.showtime.movie.title,
          showtimeDate,
          showtimeTime,
          ticketCount: booking.ticket_count,
          totalPrice,
          movieImage: booking.showtime.movie.cover_image || undefined,
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

    return res.status(200).json({
      message: "Thanh toán thành công",
      booking: {
        id: updatedBooking.id,
        user_id: updatedBooking.user_id,
        showtime_id: updatedBooking.showtime_id,
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

    const booking = await prisma.bookings.findUnique({
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
        showtime_id: true,
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
    });
  } catch (err: any) {
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};

// ===== GET BOOKING BY ID (cho checkout page) =====
export const getBookingById: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await prisma.bookings.findUnique({
      where: { id: Number(id) },
      include: {
        showtime: {
          include: {
            movie: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
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
      showtime_id: booking.showtime_id,
      showtime: booking.showtime ? {
        id: booking.showtime.id,
        start_time: booking.showtime.start_time,
        movie: booking.showtime.movie,
      } : null,
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

    const booking = await prisma.bookings.findUnique({
      where: { booking_code: normalizedCode },
      include: {
        showtime: {
          include: {
            movie: {
              select: {
                id: true,
                title: true,
                genres: true,
                duration_min: true,
                cover_image: true,
              },
            },
          },
        },
        user: {
          select: {
            fullname: true,
          },
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
      showtime_id: booking.showtime_id,
      created_at: booking.created_at,
      paid_at: booking.paid_at,
      payment_method: booking.payment_method,
      showtime: booking.showtime ? {
        id: booking.showtime.id,
        start_time: booking.showtime.start_time,
        end_time: booking.showtime.end_time,
        movie: {
          id: booking.showtime.movie.id,
          title: booking.showtime.movie.title,
          genres: booking.showtime.movie.genres,
          duration_min: booking.showtime.movie.duration_min,
          cover_image: booking.showtime.movie.cover_image,
        },
      } : null,
      userName: booking.user?.fullname || "N/A",
    });
  } catch (err: any) {
    console.error("Error getting booking by code:", err);
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};

