import { PaymentRequest } from '@shared/api';
import { eq, and, isNull, or, sql } from 'drizzle-orm';
import { validateBookingInput } from './validate';
import { formatDateForDb } from '../../../lib/date-utils';

export async function createPaymentImpl(
  anyDb: any,
  payload: PaymentRequest,
  tables: {
    bookings: any;
    users: any;
    accounts: any;
    movies: any;
    ticket_packages: any;
    branches: any;
    booking_vr_items?: any;
    vouchers?: any;
    voucher_redemption_logs?: any;
  }
) {
  try {
    const validation = await validateBookingInput(anyDb, payload, tables);
    const { user, movies, totalPrice, vrItemsDetails, originalTotalPrice, voucherDiscountAmount, voucherDetails } =
      validation;
    const { emailBook, phone, name, ticketCount, paymentMethod, pay_txt_code, combo, voucher_code, branch_id } =
      payload;
    const userId = user?.id ? Number(user.id) : null;

    const bookingsTable = tables.bookings;

    // Format movie details as JSON strings
    const movieTitles =
      movies.length > 0
        ? JSON.stringify(movies.map((m) => m.title))
        : JSON.stringify([validation.ticketPackage?.name || 'Vé Phim 8K']);
    const movieDurations = movies.length > 0 ? JSON.stringify(movies.map((m) => m.duration_min)) : JSON.stringify([0]);
    const moviePosters = movies.length > 0 ? JSON.stringify(movies.map((m) => m.cover_image)) : JSON.stringify(['']);

    // Use explicit UTC ISO timestamps for created_at/updated_at để đồng bộ giữa Postgres & D1
    const nowIso = new Date();
    let pay_txt_code_dt: string | null = null;
    if (pay_txt_code && String(pay_txt_code).trim()) {
      pay_txt_code_dt = String(pay_txt_code).trim();
    }

    const hasVR = vrItemsDetails && vrItemsDetails.length > 0;
    let trueTicketCount = 0;
    if (validation.movieItemsDetails && validation.movieItemsDetails.length > 0) {
      trueTicketCount += validation.movieItemsDetails.reduce((sum, it) => sum + Number(it.quantity || 1), 0);
    } else {
      trueTicketCount += Number(ticketCount || 1);
    }

    if (hasVR) {
      trueTicketCount += vrItemsDetails!.reduce((sum, it) => sum + Number(it.quantity || 1), 0);
    }

    const bookingType = hasVR ? 'combo_vr' : 'movie';
    const branchIdToSave = validation.ticketPackage?.branch_id || branch_id || null;

    // Payment expires in 10 minutes from now
    const paymentExpiresAt = formatDateForDb(new Date(nowIso.getTime() + 10 * 60 * 1000));

    // If a voucher is used, lock the usage slot NOW (atomically) before creating the booking.
    // This prevents race conditions where two users both see 'available' and both get the discount.
    // The slot will be released by the cronjob if payment is not completed within 10 minutes,
    // or by the cancel endpoint if the user manually cancels.
    if (voucherDetails?.id && tables.vouchers) {
      const lockResult = await anyDb
        .update(tables.vouchers)
        .set({ used_count: sql`used_count + 1`, updated_at: formatDateForDb(nowIso) })
        .where(
          and(
            eq(tables.vouchers.id, voucherDetails.id),
            or(isNull(tables.vouchers.usage_limit), sql`${tables.vouchers.used_count} < ${tables.vouchers.usage_limit}`)
          )
        )
        .returning({ used_count: tables.vouchers.used_count });

      // If 0 rows updated, another user grabbed the last slot — reject this booking
      if (!lockResult || (Array.isArray(lockResult) && lockResult.length === 0)) {
        return { status: 409, message: 'Mã giảm giá vừa hết lượt sử dụng, vui lòng đặt lại không dùng mã.' };
      }
    }

    // Try to use .returning() to get the inserted row when supported (Postgres).
    // Fallback to the existing query approach for DBs that don't support returning (D1/SQLite).
    const insertedBooking = await anyDb
      .insert(bookingsTable)
      .values({
        user_id: userId,
        movie_id: null, // No single movie ID for combo
        ticket_package_id: validation.ticketPackage?.id ? Number(validation.ticketPackage.id) : null,
        ticket_count: trueTicketCount,
        total_price: Number(totalPrice),
        original_total_price: Number(originalTotalPrice || totalPrice),
        voucher_id: voucherDetails?.id || null,
        voucher_code_snapshot: voucher_code || null,
        voucher_discount_amount: Number(voucherDiscountAmount || 0),
        booking_type: bookingType,
        payment_method: (paymentMethod || 'cash').toLowerCase(),
        phone,
        name,
        email: emailBook,
        combo: JSON.stringify(combo || []),
        movie_title: movieTitles,
        movie_duration: movieDurations,
        movie_poster: moviePosters,
        ticket_package_name:
          validation.movieItemsDetails && validation.movieItemsDetails.length > 0
            ? JSON.stringify(validation.movieItemsDetails)
            : validation.ticketPackage?.name || null,
        ticket_unit_price: validation.ticketPackage?.price ? Number(validation.ticketPackage.price) : null,
        branch_id: branchIdToSave,
        pay_txt_code: pay_txt_code_dt,
        payment_expires_at: paymentExpiresAt,
        created_at: formatDateForDb(nowIso),
        updated_at: formatDateForDb(nowIso)
      })
      .returning();

    let bookingRow = Array.isArray(insertedBooking) ? insertedBooking[0] : insertedBooking;
    if (!bookingRow) {
      return { status: 500, message: 'Không thể tạo đặt vé' };
    }

    // Insert line items into booking_vr_items
    const insertedItemsArr: any[] = [];
    if (tables.booking_vr_items) {
      if (hasVR) {
        for (const item of vrItemsDetails!) {
          try {
            const r = await anyDb
              .insert(tables.booking_vr_items)
              .values({
                booking_id: bookingRow.id,
                vr_ticket_package_id: item.vr_package_id,
                quantity: item.quantity,
                unit_price: item.unit_price,
                package_name: item.package_name,
                voucher_id: voucherDetails?.id || null,
                discounted_unit_price: item.unit_price,
                line_total: item.line_total,
                voucher_discount_amount: 0,
                branch_id: item.branch_id || branchIdToSave,
                created_at: formatDateForDb(nowIso)
              })
              .returning();
            if (r) insertedItemsArr.push(Array.isArray(r) ? r[0] : r);
          } catch (err: any) {
            console.error('Error inserting VR item to booking_vr_items:', err);
          }
        }
      }
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
        original_total_price: bookingRow.original_total_price,
        voucher_discount_amount: bookingRow.voucher_discount_amount,
        booking_type: bookingRow.booking_type,
        payment_method: bookingRow.payment_method,
        phone: bookingRow.phone,
        name: bookingRow.name,
        email: bookingRow.email,
        payment_status: bookingRow.payment_status,
        created_at: bookingRow.created_at,
        vr_items: insertedItemsArr.length > 0 ? insertedItemsArr : vrItemsDetails || []
      }
    };
  } catch (err: any) {
    const status = err?.status || 500;
    const message = err?.message || 'Lỗi máy chủ nội bộ';
    return { status, message };
  }
}
