import { PaymentRequest } from '@shared/api';
import { eq, and, asc, desc, isNull, or, inArray } from 'drizzle-orm';
import { generateBookingCode, getBookingEmailTemplate } from '../../lib/booking-utils';
import { sendMail } from '../mail-service';
import { mailQueue } from '../../lib/mail-queue';
import { formatDateForDb } from '../../lib/date-utils';

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const MAX_TICKET_PER_ORDER = 10;

type BookingValidationResult = {
  user: {
    id: number | null;
    email: string;
    fullname?: string | null;
    phone?: string | null;
  };
  movies: any[];
  ticketPackage: any;
  unitPrice: number;
  totalPrice: number;
};

async function validateBookingInput(
  anyDb: any,
  body: PaymentRequest,
  tables: { users: any; accounts: any; movies: any; ticket_packages: any }
): Promise<BookingValidationResult> {
  const { email, emailBook, phone, name, combo, ticketCount, ticketPackageId } = body;

  if (!email || !phone || !emailBook || !name || !ticketCount || ticketCount <= 0) {
    throw new HttpError(400, 'Vui lòng nhập đầy đủ thông tin hợp lệ.');
  }
  if (ticketCount > MAX_TICKET_PER_ORDER) {
    throw new HttpError(400, `Mỗi lượt chỉ đặt tối đa ${MAX_TICKET_PER_ORDER} vé.`);
  }
  if (!combo || !Array.isArray(combo) || combo.length === 0) {
    throw new HttpError(400, 'Vui lòng chọn ít nhất một bộ phim trong combo.');
  }

  const usersTable = tables.users;
  const accountsTable = tables.accounts;
  const moviesTable = tables.movies;
  const ticketPackagesTable = tables.ticket_packages;

  const userResult = await anyDb
    .select({
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

  // Fetch all movies in the combo
  const movies = await anyDb.query.movies.findMany({
    where: and(
      inArray(
        moviesTable.id,
        combo.map((id) => Number(id))
      ),
      eq(moviesTable.is_active, true)
    )
  });

  if (movies.length !== combo.length) {
    throw new HttpError(404, 'Một số phim trong combo không hợp lệ hoặc đã ngừng hoạt động.');
  }

  let ticketPackage: any = null;
  if (ticketPackageId) {
    ticketPackage = await anyDb.query.ticket_packages.findFirst({
      where: eq(ticketPackagesTable.id, ticketPackageId)
    });
    if (!ticketPackage || ticketPackage.is_active === false) {
      throw new HttpError(404, 'Gói vé không hợp lệ hoặc đã tắt.');
    }
  } else {
    ticketPackage = await anyDb.query.ticket_packages.findFirst({
      where: eq(ticketPackagesTable.is_active, true),
      orderBy: [asc(ticketPackagesTable.display_order), asc(ticketPackagesTable.price)]
    });
    if (!ticketPackage) {
      throw new HttpError(400, 'Không tìm thấy gói vé khả dụng.');
    }
  }

  const unitPrice = Number(ticketPackage.price || 0);
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
    throw new HttpError(400, 'Giá vé không hợp lệ.');
  }
  const totalPrice = unitPrice * ticketCount;

  return {
    user: {
      id: user?.id ?? null,
      email: userEmail,
      fullname: user?.fullname ?? name,
      phone: user?.phone ?? phone
    },
    movies,
    ticketPackage,
    unitPrice,
    totalPrice
  };
}

export async function validateBookingImpl(
  anyDb: any,
  payload: PaymentRequest,
  tables: { users: any; accounts: any; movies: any; ticket_packages: any }
) {
  try {
    const result = await validateBookingInput(anyDb, payload, tables);
    return {
      status: 200,
      user: result.user,
      movies: result.movies.map((movie) => ({
        id: movie.id,
        title: movie.title,
        is_active: movie.is_active,
        duration_min: movie.duration_min,
        cover_image: movie.cover_image
      })),
      ticketPackage: {
        id: result.ticketPackage.id,
        name: result.ticketPackage.name,
        price: Number(result.ticketPackage.price || 0)
      },
      unitPrice: result.unitPrice,
      totalPrice: result.totalPrice
    };
  } catch (err: any) {
    const status = err?.status || 500;
    const message = err?.message || 'Lỗi máy chủ nội bộ';
    return { status, message };
  }
}

export async function createPaymentImpl(
  anyDb: any,
  payload: PaymentRequest,
  tables: {
    bookings: any;
    users: any;
    accounts: any;
    movies: any;
    ticket_packages: any;
  },
  RUNTIME_ENV?: string
) {
  try {
    const validation = await validateBookingInput(anyDb, payload, tables);
    const { user, movies, totalPrice } = validation;
    const { emailBook, phone, name, ticketCount, paymentMethod, pay_txt_code, combo } = payload;
    const userId = user?.id ? Number(user.id) : null;

    const bookingsTable = tables.bookings;

    // Format movie details as pipe-separated strings
    const movieTitles = JSON.stringify(movies.map((m) => m.title));
    const movieDurations = JSON.stringify(movies.map((m) => m.duration_min));
    const moviePosters = JSON.stringify(movies.map((m) => m.cover_image));

    // Use explicit UTC ISO timestamps for created_at/updated_at để đồng bộ giữa Postgres & D1
    const nowIso = new Date();
    let pay_txt_code_dt = '';
    if (pay_txt_code) {
      pay_txt_code_dt = pay_txt_code;
    }
    // Try to use .returning() to get the inserted row when supported (Postgres).
    // Fallback to the existing query approach for DBs that don't support returning (D1/SQLite).
    const insertedBooking = await anyDb
      .insert(bookingsTable)
      .values({
        user_id: userId,
        movie_id: null, // No single movie ID for combo
        ticket_package_id: validation.ticketPackage?.id ? Number(validation.ticketPackage.id) : null,
        ticket_count: ticketCount,
        total_price: Number(totalPrice),
        payment_method: (paymentMethod || 'cash').toLowerCase(),
        phone,
        name,
        email: emailBook,
        combo: JSON.stringify(combo || []),
        movie_title: movieTitles,
        movie_duration: movieDurations,
        movie_poster: moviePosters,
        ticket_package_name: validation.ticketPackage?.name || null,
        ticket_unit_price: validation.ticketPackage?.price ? Number(validation.ticketPackage.price) : null,
        pay_txt_code: pay_txt_code_dt,
        created_at: formatDateForDb(nowIso, RUNTIME_ENV),
        updated_at: formatDateForDb(nowIso, RUNTIME_ENV)
      })
      .returning();

    let bookingRow = Array.isArray(insertedBooking) ? insertedBooking[0] : insertedBooking;
    if (!bookingRow) {
      return { status: 500, message: 'Không thể tạo đặt vé' };
    }
    return {
      status: 201,
      message: 'Khởi tạo đặt vé thành công',
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
        created_at: bookingRow.created_at
      }
    };
  } catch (err: any) {
    const status = err?.status || 500;
    const message = err?.message || 'Lỗi máy chủ nội bộ';
    return { status, message };
  }
}

export async function updatePaymentImpl(
  anyDb: any,
  payload: {
    user_id?: number;
    payment_id?: number;
    payment_status?: string;
    transaction_id?: string;
    paid_at?: string | Date;
  },
  sendMailFn?: (to: string, subject: string, html: string) => Promise<any>,
  getBookingEmailHtml?: (data: any) => string,
  tables?: {
    bookings: any;
    users: any;
    accounts: any;
    movies: any;
    ticket_packages: any;
    email_logs?: any;
  },
  RUNTIME_ENV?: string,
  context?: { waitUntil: (promise: Promise<any>) => void }
) {
  try {
    const { user_id, payment_id, payment_status, transaction_id, paid_at } = payload;
    if (!payment_id || !payment_status) {
      return { status: 400, message: 'Vui lòng nhập đầy đủ thông tin hợp lệ.' };
    }

    const { bookings: bookingsTable, movies: moviesTable, ticket_packages: pkgsTable } = tables || {};
    if (!bookingsTable || !moviesTable || !pkgsTable) return { status: 500, message: 'Missing tables definition' };

    // 1. Tối ưu Query đầu tiên: Sử dụng Join thay vì 'with' để lấy data gửi mail sau này
    const whereClause =
      user_id && Number(user_id) !== 0
        ? and(eq(bookingsTable.id, Number(payment_id)), eq(bookingsTable.user_id, Number(user_id)))
        : eq(bookingsTable.id, Number(payment_id));

    const rows = await anyDb
      .select({
        booking: bookingsTable,
        duration_min: moviesTable.duration_min,
        package_name: pkgsTable.name,
        movie_title: bookingsTable.movie_title,
        movie_duration: bookingsTable.movie_duration
      })
      .from(bookingsTable)
      .leftJoin(moviesTable, eq(bookingsTable.movie_id, moviesTable.id))
      .leftJoin(pkgsTable, eq(bookingsTable.ticket_package_id, pkgsTable.id))
      .where(whereClause)
      .limit(1);

    const result = rows[0];
    if (!result) return { status: 404, message: 'Không tìm thấy đặt vé.' };

    const { booking } = result;
    let bookingCode = booking.booking_code;
    const isPaid = String(payment_status).toLowerCase() === 'paid';
    const isAlreadyPaid = String(booking.payment_status).toLowerCase() === 'paid';

    // 2. Logic tạo mã vé
    if (isPaid && !bookingCode) {
      bookingCode = await generateBookingCode(anyDb);
    }

    // Bảo vệ: Nếu đơn đã thanh toán (isAlreadyPaid) mà request gửi lên là failed
    // => Chặn update, trả về thông báo để Client xử lý (Alert "Đã thanh toán" thay vì "Đã hủy")
    if (isAlreadyPaid && payment_status === 'failed') {
      return {
        status: 409, // Conflict
        message: 'Giao dịch đã được thanh toán thành công',
        booking: booking
      };
    }

    // 3. Chuẩn bị payload update
    const now = new Date();
    const updatePayload: any = {
      payment_status,
      updated_at: formatDateForDb(now, RUNTIME_ENV),
      transaction_id: transaction_id ?? booking.transaction_id
    };

    if (isPaid) {
      const paidAtDate = paid_at ? new Date(paid_at) : new Date();
      const validPaidAt = isNaN(paidAtDate.getTime()) ? new Date() : paidAtDate;

      updatePayload.paid_at = formatDateForDb(validPaidAt, RUNTIME_ENV);
      updatePayload.expiry_date = formatDateForDb(
        new Date(validPaidAt.getTime() + 10 * 24 * 60 * 60 * 1000),
        RUNTIME_ENV
      );
      updatePayload.booking_code = bookingCode;
    }

    // 4. Update và lấy kết quả mới nhất
    const updatedRes = await anyDb
      .update(bookingsTable)
      .set(updatePayload)
      .where(eq(bookingsTable.id, booking.id))
      .returning();

    const updatedBooking = Array.isArray(updatedRes) ? updatedRes[0] : updatedRes;

    // 5. Gửi mail (Chỉ khi thanh toán thành công)
    if (isPaid) {
      // Sử dụng mailQueue để gửi mail ngầm, không chặn response
      mailQueue.add(
        async () => {
          try {
            const templateData = {
              bookingCode: bookingCode || '',
              customerName: booking.name || 'Khách hàng',
              movieTitle: booking.movie_title || '',
              ticketCount: booking.ticket_count,
              totalPrice: Number(booking.total_price).toLocaleString('vi-VN'),
              durationMin: booking.movie_duration,
              ticketPackageName: result.package_name,
              expiryDate: updatedBooking?.expiry_date
            };

            const emailTemplate = getBookingEmailHtml
              ? getBookingEmailHtml(templateData)
              : getBookingEmailTemplate(templateData);
            const mailer = sendMailFn || sendMail;

            await mailer(booking.email, `🎬 Xác nhận đặt vé - CINESPHERE`, emailTemplate);
            console.log(`[MailQueue] Đã gửi mail xác nhận cho booking ${booking.id}`);
          } catch (err) {
            console.error(`[MailQueue] Lỗi gửi mail cho booking ${booking.id}:`, err);
            throw err;
          }
        },
        {
          db: anyDb,
          recipient: booking.email,
          subject: '🎬 Xác nhận đặt vé - CINESPHERE',
          emailType: 'booking_confirmation',
          userId: booking.user_id || undefined,
          bookingId: booking.id,
          emailLogsTable: tables?.email_logs,
          runtimeEnv: RUNTIME_ENV
        },
        context
      );
    }

    return {
      status: 200,
      message:
        payment_status === 'failed'
          ? 'Giao dịch đã được hủy thành công'
          : 'Giao dịch đã xử lý xong (Mail đã được gửi tới khách hàng)',
      booking: updatedBooking
    };
  } catch (err: any) {
    return {
      status: err?.status || 500,
      message: err?.message || 'Lỗi máy chủ nội bộ'
    };
  }
}

export async function getBookingImpl(anyDb: any, id: number, tables: { bookings: any }) {
  const bookingsTable = tables.bookings;
  const booking = await anyDb.query.bookings.findFirst({
    where: eq(bookingsTable.id, id),
    columns: {
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
      ticket_package_id: true
    }
  });
  if (!booking) return { status: 404, message: 'Không tìm thấy' };
  return {
    status: 200,
    id: booking.id,
    payment_status: booking.payment_status,
    total_price: booking.total_price,
    ticket_count: booking.ticket_count,
    created_at: booking.created_at,
    movie_id: booking.movie_id,
    ticket_package_id: booking.ticket_package_id
  };
}

export async function getBookingByIdImpl(
  anyDb: any,
  id: number,
  tables: { bookings: any; movies: any; ticket_packages: any }
) {
  const { bookings, movies, ticket_packages } = tables;

  // Sử dụng Join để lấy tất cả dữ liệu trong 1 Query duy nhất
  const rows = await anyDb
    .select({
      // Booking fields
      id: bookings.id,
      booking_code: bookings.booking_code,
      payment_status: bookings.payment_status,
      user_id: bookings.user_id,
      name: bookings.name,
      phone: bookings.phone,
      email: bookings.email,
      ticket_count: bookings.ticket_count,
      total_price: bookings.total_price,
      movie_id: bookings.movie_id,
      ticket_package_id: bookings.ticket_package_id,
      expiry_date: bookings.expiry_date,
      checked_in_at: bookings.checked_in_at,
      created_at: bookings.created_at,
      paid_at: bookings.paid_at,
      payment_method: bookings.payment_method,
      // Movie fields
      movie_title: bookings.movie_title,
      movie_image: bookings.movie_poster,
      duration_min: bookings.movie_duration,
      // Package fields
      ticket_package_name: bookings.ticket_package_name
    })
    .from(bookings)
    .where(eq(bookings.id, id))
    .limit(1);

  const booking = rows[0];
  if (!booking) {
    return { status: 404, message: 'Không tìm thấy thông tin đặt vé' };
  }

  return {
    status: 200,
    ...booking
  };
}

export async function getBookingByCodeImpl(anyDb: any, codeRaw: string, tables: { bookings: any }) {
  const code = String(codeRaw || '');
  if (!code || code.trim() === '') return { status: 400, message: 'Thiếu mã vé' };
  const normalizedCode = code.trim().toUpperCase();
  const bookingsTable = tables.bookings;
  const booking = await anyDb.query.bookings.findFirst({
    where: or(
      // Điều kiện 1: booking_code khớp
      eq(bookingsTable.booking_code, normalizedCode),

      // Điều kiện 2: pay_txt_code khớp VÀ method là vietqr
      and(eq(bookingsTable.pay_txt_code, normalizedCode), eq(bookingsTable.payment_method, 'vietqr'))
    ),
    with: {
      user: {
        columns: {
          fullname: true
        }
      }
    }
  });
  if (!booking) return { status: 404, message: 'Không tìm thấy vé' };
  const now = new Date();
  const paidAt = booking.paid_at ? new Date(booking.paid_at) : null;
  const expiryAt = booking.expiry_date ? new Date(booking.expiry_date as any) : null;
  const isPaid = (booking.payment_status || '').toLowerCase() === 'paid';
  const expired = Boolean(expiryAt && now.getTime() > expiryAt.getTime());
  const valid = Boolean(isPaid && paidAt && expiryAt && !expired && !booking.is_used);
  const can_use = Boolean(valid);
  const daysLeft = expiryAt ? Math.ceil((expiryAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
  return {
    status: 200,
    id: booking.id,
    booking_code: booking.booking_code,
    payment_status: booking.payment_status,
    user_id: booking.user_id,
    name: booking.name,
    phone: booking.phone,
    email: booking.email,
    ticket_count: Number(booking.ticket_count),
    total_price: Number(booking.total_price),
    movie_id: booking.movie_id,
    ticket_package_id: booking.ticket_package_id,
    created_at: booking.created_at,
    paid_at: booking.paid_at,
    expiry_date: booking.expiry_date,
    payment_method: booking.payment_method,
    userName: booking.user?.fullname || '',
    is_used: Boolean(booking.is_used),
    movie_title: booking.movie_title || '',
    movie_duration: booking.movie_duration || '',
    movie_poster: booking.movie_poster || '',
    ticket_package_name: booking.ticket_package_name || '',
    ticket_unit_price: Number(booking.ticket_unit_price) || 0,
    valid,
    can_use,
    pay_txt_code: booking.pay_txt_code,
    validity_days: daysLeft,
    expired,
    checked_in_at: booking.checked_in_at
  };
}

export async function confirmUseTicketImpl(
  anyDb: any,
  codeRaw: string,
  tables: { bookings: any },
  RUNTIME_ENV?: string
) {
  try {
    const code = String(codeRaw || '');
    if (!code || !code.trim()) return { status: 400, message: 'Vui lòng nhập mã vé' };
    const normalizedCode = code.trim().toUpperCase();
    const bookingsTable = tables.bookings;
    const booking = await anyDb.query.bookings.findFirst({
      where: eq(bookingsTable.booking_code, normalizedCode)
    });
    if (!booking) return { status: 404, message: 'Không tìm thấy vé' };
    const isPaid = (booking.payment_status || '').toLowerCase() === 'paid';
    const paidAt = booking.paid_at ? new Date(booking.paid_at) : null;
    const expiryAt = booking.expiry_date ? new Date(booking.expiry_date as any) : null;
    const expired = Boolean(expiryAt && Date.now() > expiryAt.getTime());
    const valid = Boolean(isPaid && paidAt && expiryAt && !expired && !booking.is_used);
    if (!valid) return { status: 400, message: 'Vé không còn hiệu lực hoặc đã sử dụng' };
    // Update booking (tương thích với D1/SQLite không hỗ trợ .returning())
    const updatedRes = await anyDb
      .update(bookingsTable)
      .set({
        is_used: true,
        updated_at: formatDateForDb(new Date(), RUNTIME_ENV),
        checked_in_at: formatDateForDb(new Date(), RUNTIME_ENV)
      })
      .where(eq(bookingsTable.id, booking.id))
      .returning();

    const updated = Array.isArray(updatedRes) ? updatedRes[0] : updatedRes;

    if (!updated) return { status: 500, message: 'Không thể cập nhật trạng thái vé' };
    return {
      status: 200,
      message: 'Xác nhận sử dụng vé thành công',
      booking: { id: updated.id, is_used: updated.is_used }
    };
  } catch (err: any) {
    const status = err?.status || 500;
    const message = err?.message || 'Lỗi máy chủ nội bộ';
    return { status, message };
  }
}
