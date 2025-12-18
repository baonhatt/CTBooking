import { PaymentRequest } from "@shared/api";
import { eq, and, asc, desc } from "drizzle-orm";
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
  user: { id: number | null; email: string; fullname?: string | null; phone?: string | null };
  movie?: any;
  ticketPackage: any;
  unitPrice: number;
  totalPrice: number;
};

async function validateBookingInput(
  anyDb: any,
  body: PaymentRequest,
  tables: { users: any; accounts: any; movies: any; ticket_packages: any }
): Promise<BookingValidationResult> {
  const { email, emailBook, phone, name, movieId, ticketCount, ticketPackageId } = body;

  if (!email || !phone || !emailBook || !name || !ticketCount || ticketCount <= 0) {
    throw new HttpError(400, "Vui lòng nhập đầy đủ thông tin hợp lệ.");
  }
  if (ticketCount > MAX_TICKET_PER_ORDER) {
    throw new HttpError(400, `Mỗi lượt chỉ đặt tối đa ${MAX_TICKET_PER_ORDER} vé.`);
  }

  const usersTable = tables.users;
  const accountsTable = tables.accounts;
  const moviesTable = tables.movies;
  const ticketPackagesTable = tables.ticket_packages;

  const userResult = await anyDb.select({
    id: usersTable.id,
    fullname: usersTable.fullname,
    phone: usersTable.phone,
    email: accountsTable.email
  })
    .from(usersTable)
    .innerJoin(accountsTable, eq(usersTable.id, accountsTable.user_id))
    .where(eq(accountsTable.email, email))
    .limit(1);

  const user = userResult[0];
  const userEmail = user?.email || email;

  let movie: any = null;
  if (movieId) {
    movie = await anyDb.query.movies.findFirst({ where: eq(moviesTable.id, Number(movieId)) });
    if (!movie || movie.is_active === false) {
      throw new HttpError(404, "Phim không hợp lệ hoặc đã ngừng hoạt động.");
    }
  }

  let ticketPackage: any = null;
  if (ticketPackageId) {
    ticketPackage = await anyDb.query.ticket_packages.findFirst({ where: eq(ticketPackagesTable.id, ticketPackageId) });
    if (!ticketPackage || ticketPackage.is_active === false) {
      throw new HttpError(404, "Gói vé không hợp lệ hoặc đã tắt.");
    }
  } else {
    ticketPackage = await anyDb.query.ticket_packages.findFirst({
      where: eq(ticketPackagesTable.is_active, true),
      orderBy: [asc(ticketPackagesTable.display_order), asc(ticketPackagesTable.price)],
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
    user: { id: user?.id ?? null, email: userEmail, fullname: user?.fullname ?? name, phone: user?.phone ?? phone },
    movie,
    ticketPackage,
    unitPrice,
    totalPrice,
  };
}

export async function validateBookingImpl(anyDb: any, payload: PaymentRequest, tables: { users: any; accounts: any; movies: any; ticket_packages: any }) {
  const result = await validateBookingInput(anyDb, payload, tables);
  return {
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
  };
}

export async function createPaymentImpl(
  anyDb: any,
  payload: PaymentRequest,
  tables: { bookings: any; users: any; accounts: any; movies: any; ticket_packages: any }
) {
  const validation = await validateBookingInput(anyDb, payload, tables);
  const { user, totalPrice } = validation;
  const { emailBook, phone, name, ticketCount, paymentMethod } = payload;
  const userId = user?.id ? Number(user.id) : null;

  const bookingsTable = tables.bookings;

  // Use explicit UTC ISO timestamps for created_at/updated_at để đồng bộ giữa Postgres & D1
  const nowIso = new Date().toISOString();

  await anyDb.insert(bookingsTable).values({
    user_id: userId,
    movie_id: validation.movie?.id ? Number(validation.movie.id) : null,
    ticket_package_id: validation.ticketPackage?.id ? Number(validation.ticketPackage.id) : null,
    ticket_count: ticketCount,
    // Use a numeric value for total_price so it works for both:
    // - Postgres DECIMAL
    // - SQLite/D1 REAL
    // String is fine for Postgres DECIMAL but can cause issues on D1,
    // so we normalize to number here.
    total_price: Number(totalPrice),
    payment_method: (paymentMethod || "cash").toLowerCase(),
    phone,
    name,
    email: emailBook,
    created_at: nowIso,
    updated_at: nowIso,
  });
  const bookingRow = await anyDb.query.bookings.findFirst({
    where: and(
      eq(bookingsTable.phone, phone),
      eq(bookingsTable.email, emailBook),
      eq(bookingsTable.ticket_count, ticketCount),
    ),
    orderBy: [desc(bookingsTable.id)],
  });
  if (!bookingRow) {
    throw new Error("Không thể tạo đặt vé");
  }
  return {
    message: "Khởi tạo đặt vé thành công",
    booking: {
      id: bookingRow.id,
      user_id: bookingRow.user_id,
      movie_id: bookingRow.movie_id,
      ticket_package_id: bookingRow.ticket_package_id,
      ticket_count: bookingRow.ticket_count,
      total_price: bookingRow.total_price,
      payment_method: bookingRow.payment_method,
      phone: bookingRow.phone,
      name: bookingRow.name,
      email: bookingRow.email,
      payment_status: bookingRow.payment_status,
      created_at: bookingRow.created_at,
    },
  };
}

export async function updatePaymentImpl(
  anyDb: any,
  payload: { user_id?: number; payment_id?: number; payment_status?: string; transaction_id?: string; paid_at?: string | Date },
  sendMailFn?: (to: string, subject: string, html: string) => Promise<any>,
  getBookingEmailHtml?: (data: any) => string,
  tables?: { bookings: any; users: any; accounts: any; movies: any; ticket_packages: any }
) {
  const { user_id, payment_id, payment_status, transaction_id, paid_at } = payload as any;
  if (!user_id || !payment_id || !payment_status) {
    return { status: "error", message: "Vui lòng nhập đầy đủ thông tin hợp lệ." };
  }
  const bookingsTable = tables?.bookings;
  if (!bookingsTable) throw new Error("Missing bookings table");
  const booking = await anyDb.query.bookings.findFirst({
    where: and(eq(bookingsTable.id, Number(payment_id)), eq(bookingsTable.user_id, Number(user_id))),
    with: { movie: true, ticket_package: true },
  });
  if (!booking) return { status: "error", message: "Không tìm thấy đặt vé." };
  let bookingCode = booking.booking_code;
  if (payment_status && String(payment_status).toLowerCase() === "paid" && !bookingCode) {
    bookingCode = await generateBookingCode(anyDb);
  }
  // Update booking (tương thích với D1/SQLite không hỗ trợ .returning())
  // Build update payload - only include fields that should be updated
  const updatePayload: any = {
    payment_status,
    updated_at: new Date().toISOString(), // Explicitly set updated_at
  };

  // Only set transaction_id if provided
  if (transaction_id !== undefined && transaction_id !== null) {
    updatePayload.transaction_id = transaction_id;
  }

  // Set paid_at and expiry_date when payment_status is "paid"
  if (payment_status && String(payment_status).toLowerCase() === "paid") {
    let paidAtDate: Date;
    if (paid_at) {
      paidAtDate = new Date(paid_at);
      if (isNaN(paidAtDate.getTime())) {
        // Invalid date, use current time
        paidAtDate = new Date();
      }
    } else {
      // If payment_status is "paid" but no paid_at provided, use current time
      paidAtDate = new Date();
    }
    updatePayload.paid_at = paidAtDate.toISOString();
    // Set expiry_date to 10 days after paid_at
    updatePayload.expiry_date = new Date(paidAtDate.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString();
  }

  // Only set booking_code if it exists
  if (bookingCode) {
    updatePayload.booking_code = bookingCode;
  }

  await anyDb.update(bookingsTable)
    .set(updatePayload)
    .where(eq(bookingsTable.id, booking.id));

  // Query lại booking vừa update
  const updatedBooking = await anyDb.query.bookings.findFirst({
    where: eq(bookingsTable.id, booking.id),
    with: { movie: true, ticket_package: true },
  });
  if (payment_status && String(payment_status).toLowerCase() === "paid") {
    try {
      const totalPrice = Number(booking.total_price).toLocaleString("vi-VN");
      const movieTitle = booking.movie?.title || "";

      const templateData = {
        bookingCode: bookingCode || "",
        customerName: booking.name || "Khách hàng",
        movieTitle: movieTitle,
        ticketCount: booking.ticket_count,
        totalPrice,
        movieImage: booking.movie?.cover_image || undefined,
        durationMin: booking.movie?.duration_min || undefined,
        ticketPackageName: booking.ticket_package?.name || undefined,
        expiryDate: (updatedBooking as any)?.expiry_date || undefined,
      };

      let emailTemplate = "";
      if (getBookingEmailHtml) {
        emailTemplate = getBookingEmailHtml(templateData);
      } else {
        emailTemplate = getBookingEmailTemplate(templateData);
      }

      const mailer = sendMailFn || sendMail;
      await mailer(booking.email, `🎬 Xác nhận đặt vé - CINESPHERE`, emailTemplate);
    } catch (err) {
      console.error(`[${new Date().toISOString()}] ERROR in updatePaymentImpl email sending:`, err);
    }
  }
  const updatedBookingAny = updatedBooking as any;
  return {
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
  };
}

export async function getBookingImpl(anyDb: any, id: number, tables: { bookings: any }) {
  const bookingsTable = tables.bookings;
  const booking = await anyDb.query.bookings.findFirst({
    where: eq(bookingsTable.id, id),
    columns: { id: true, payment_status: true, total_price: true, ticket_count: true, created_at: true, name: true, email: true, phone: true, user_id: true, movie_id: true, ticket_package_id: true },
  });
  if (!booking) return null;
  return {
    id: booking.id,
    payment_status: booking.payment_status,
    total_price: booking.total_price,
    ticket_count: booking.ticket_count,
    created_at: booking.created_at,
    movie_id: booking.movie_id,
    ticket_package_id: booking.ticket_package_id,
  };
}

export async function getBookingByIdImpl(anyDb: any, id: number, tables: { bookings: any }) {
  const bookingsTable = tables.bookings;
  const booking = await anyDb.query.bookings.findFirst({
    where: eq(bookingsTable.id, Number(id)),
    with: { movie: true, ticket_package: true },
  });
  if (!booking) return null;
  return {
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
    movie_title: booking.movie?.title || "",
    movie_image: booking.movie?.cover_image || null,
    duration_min: booking.movie?.duration_min || 0,
    ticket_package_name: booking.ticket_package?.name || "",
    expiry_date: booking.expiry_date || null,
    created_at: booking.created_at,
    paid_at: booking.paid_at,
    payment_method: booking.payment_method,
  };
}

export async function getBookingByCodeImpl(anyDb: any, codeRaw: string, tables: { bookings: any }) {
  const code = String(codeRaw || "");
  if (!code || code.trim() === "") return null;
  const normalizedCode = code.trim().toUpperCase();
  const bookingsTable = tables.bookings;
  const booking = await anyDb.query.bookings.findFirst({
    where: eq(bookingsTable.booking_code, normalizedCode),
    with: { user: { columns: { fullname: true } } },
  });
  if (!booking) return null;
  const now = new Date();
  const paidAt = booking.paid_at ? new Date(booking.paid_at) : null;
  const expiryAt = booking.expiry_date ? new Date(booking.expiry_date as any) : null;
  const isPaid = (booking.payment_status || '').toLowerCase() === 'paid';
  const expired = Boolean(expiryAt && now.getTime() > expiryAt.getTime());
  const valid = Boolean(isPaid && paidAt && expiryAt && !expired && !booking.is_used);
  const can_use = Boolean(valid);
  const daysLeft = expiryAt ? Math.ceil((expiryAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
  return {
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
    userName: booking.user?.fullname || '',
    is_used: Boolean(booking.is_used),
    valid,
    can_use,
    validity_days: daysLeft,
    expired,
  };
}

export async function confirmUseTicketImpl(anyDb: any, codeRaw: string, tables: { bookings: any }) {
  const code = String(codeRaw || "");
  if (!code || !code.trim()) return { status: "error", message: "Vui lòng nhập mã vé" };
  const normalizedCode = code.trim().toUpperCase();
  const bookingsTable = tables.bookings;
  const booking = await anyDb.query.bookings.findFirst({ where: eq(bookingsTable.booking_code, normalizedCode) });
  if (!booking) return { status: "error", message: "Không tìm thấy vé" };
  const isPaid = (booking.payment_status || '').toLowerCase() === 'paid';
  const paidAt = booking.paid_at ? new Date(booking.paid_at) : null;
  const expiryAt = booking.expiry_date ? new Date(booking.expiry_date as any) : null;
  const expired = Boolean(expiryAt && Date.now() > expiryAt.getTime());
  const valid = Boolean(isPaid && paidAt && expiryAt && !expired && !booking.is_used);
  if (!valid) return { status: "error", message: "Vé không còn hiệu lực hoặc đã sử dụng" };
  // Update booking (tương thích với D1/SQLite không hỗ trợ .returning())
  await anyDb.update(bookingsTable).set({ is_used: true, updated_at: new Date().toISOString() }).where(eq(bookingsTable.id, booking.id));

  // Query lại booking vừa update
  const updated = await anyDb.query.bookings.findFirst({
    where: eq(bookingsTable.id, booking.id),
  });

  if (!updated) throw new Error("Không thể cập nhật trạng thái vé");
  return { ok: true, message: "Xác nhận sử dụng vé thành công", booking: { id: updated.id, is_used: updated.is_used } };
}

