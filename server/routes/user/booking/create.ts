import { PaymentRequest } from '@shared/api';
import { eq, and, isNull, or, sql } from 'drizzle-orm';
import { validateBookingInput } from './validate';
import { formatDateForDb } from '../../../lib/date-utils';
import { generatePayTxtCode, isPayCodeCollision } from '../../../lib/pay-code';
import { releaseVoucherForCancelledBooking } from '../../scheduled/booking-expiry';
import { allocateVoucherDiscountToVrItems, parseApplicableIds } from '@shared/booking-invoice';

/** How many fresh random pay_txt_code values are tried if one happens to collide with an existing order. */
const PAY_CODE_MAX_ATTEMPTS = 5;

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
  // Set once the voucher slot is taken. If anything later fails, the slot is given back.
  let lockedVoucherId: number | null = null;

  async function giveBackVoucherSlot() {
    // Clear first, so a second call cannot give the slot back twice
    const voucherId = lockedVoucherId;
    lockedVoucherId = null;
    if (voucherId && tables.vouchers) {
      try {
        await releaseVoucherForCancelledBooking(
          anyDb,
          { vouchers: tables.vouchers },
          { voucher_id: voucherId, previous_payment_status: 'pending' }
        );
      } catch (releaseError) {
        console.error('[createPayment] Could not give back the voucher slot:', releaseError);
      }
    }
  }

  try {
    const validation = await validateBookingInput(anyDb, payload, tables);
    const { user, movies, totalPrice, vrItemsDetails, originalTotalPrice, voucherDiscountAmount, voucherDetails } =
      validation;
    // The payment reference is generated here. Any pay_txt_code sent by the browser is ignored.
    const { emailBook, phone, name, ticketCount, paymentMethod, combo, voucher_code } = payload;
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
    // Every order belongs to a branch: the one asked for, or the default branch (never empty)
    const branchIdToSave = validation.branchId;

    // Payment expires in 10 minutes from now
    const paymentExpiresAt = formatDateForDb(new Date(nowIso.getTime() + 10 * 60 * 1000));

    // If a voucher is used, lock the usage slot NOW (atomically) before creating the booking.
    // This prevents race conditions where two users both see 'available' and both get the discount.
    // The slot will be released by the cronjob if payment is not completed within 10 minutes,
    // by the cancel endpoint if the user manually cancels, or right below if saving the order fails.
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
      lockedVoucherId = Number(voucherDetails.id);
    }

    // Insert the booking. The random pay_txt_code is the only value that can collide, so only that is retried.
    let bookingRow: any = null;
    for (let attempt = 1; attempt <= PAY_CODE_MAX_ATTEMPTS && !bookingRow; attempt++) {
      try {
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
            pay_txt_code: generatePayTxtCode(),
            payment_expires_at: paymentExpiresAt,
            created_at: formatDateForDb(nowIso),
            updated_at: formatDateForDb(nowIso)
          })
          .returning();
        bookingRow = Array.isArray(insertedBooking) ? insertedBooking[0] : insertedBooking;
      } catch (insertError) {
        if (!isPayCodeCollision(insertError) || attempt === PAY_CODE_MAX_ATTEMPTS) {
          await giveBackVoucherSlot();
          throw insertError;
        }
      }
    }

    if (!bookingRow) {
      await giveBackVoucherSlot();
      return { status: 500, message: 'Không thể tạo đặt vé' };
    }

    // Insert line items into booking_vr_items with pro-rata discount allocation
    const insertedItemsArr: any[] = [];
    if (tables.booking_vr_items && hasVR && vrItemsDetails && vrItemsDetails.length > 0) {
      const applicableIds = parseApplicableIds(voucherDetails?.applicable_ticket_package_ids);
      const allocatedVrItems = allocateVoucherDiscountToVrItems({
        vrItems: vrItemsDetails,
        movieItems: validation.movieItemsDetails || [],
        voucherScope: voucherDetails?.scope,
        applicablePackageIds: applicableIds,
        voucherDiscountAmount: Number(voucherDiscountAmount || 0)
      });

      try {
        for (const item of allocatedVrItems) {
          const r = await anyDb
            .insert(tables.booking_vr_items)
            .values({
              booking_id: bookingRow.id,
              vr_ticket_package_id: item.vr_ticket_package_id,
              quantity: item.quantity,
              unit_price: item.unit_price,
              package_name: item.package_name,
              voucher_id: voucherDetails?.id || null,
              discounted_unit_price: item.discounted_unit_price,
              line_total: item.line_total,
              voucher_discount_amount: item.voucher_discount_amount,
              branch_id: item.branch_id || branchIdToSave,
              created_at: formatDateForDb(nowIso)
            })
            .returning();
          if (r) insertedItemsArr.push(Array.isArray(r) ? r[0] : r);
        }
      } catch (itemError) {
        // An order that pays for VR packages but has no VR lines is wrong. Cancel it instead of returning "created".
        console.error('Error inserting VR item to booking_vr_items:', itemError);
        try {
          await anyDb
            .update(bookingsTable)
            .set({ payment_status: 'failed', updated_at: formatDateForDb(new Date()) })
            .where(eq(bookingsTable.id, bookingRow.id));
        } catch (cancelError) {
          console.error('[createPayment] Could not cancel the half-created booking:', cancelError);
        }
        await giveBackVoucherSlot();
        return { status: 500, message: 'Không thể lưu chi tiết đặt vé. Vui lòng thử lại.' };
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
        // The reference the customer types into the bank transfer, and the payment deadline (both set by the server)
        pay_txt_code: bookingRow.pay_txt_code,
        payment_expires_at: bookingRow.payment_expires_at,
        vr_items: insertedItemsArr.length > 0 ? insertedItemsArr : vrItemsDetails || []
      }
    };
  } catch (err: any) {
    // A deliberate error (validation, voucher, branch) carries a status and a message meant for the customer.
    // Anything else is an internal failure whose text (for example a database error) must not reach the customer.
    if (typeof err?.status === 'number') {
      return { status: err.status, message: err.message || 'Lỗi máy chủ nội bộ' };
    }
    console.error('[createPayment] Unexpected error:', err);
    return { status: 500, message: 'Lỗi máy chủ nội bộ' };
  }
}
