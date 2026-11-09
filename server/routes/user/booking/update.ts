import { eq, and, isNull, or, sql } from 'drizzle-orm';
import { generateBookingCode } from '../../../lib/booking-utils';
import { queueBookingConfirmationEmail } from './confirmation-email';
import { formatDateForDb } from '../../../lib/date-utils';
import { redeemVoucherAfterPaymentImpl } from '../vouchers';
import { releaseVoucherForCancelledBooking } from '../../scheduled/booking-expiry';

/** The answer for a status change that someone else already made. It is a success: nothing is left to do. */
function alreadyProcessedResult(booking: any) {
  return {
    status: 200,
    message: 'Giao dịch đã được xử lý trước đó',
    booking,
    already_processed: true,
    voucher_slot_unavailable: false
  };
}

export async function updatePaymentImpl(
  anyDb: any,
  payload: {
    user_id?: number;
    payment_id?: number;
    payment_status?: string;
    transaction_id?: string;
    paid_at?: string | Date;
    /** Staff member who confirmed the payment by hand. Stored on the booking when it becomes paid. */
    confirmed_by_staff_id?: number;
  },
  sendMailFn?: (to: string, subject: string, html: string) => Promise<any>,
  getBookingEmailHtml?: (data: any) => string,
  tables?: {
    bookings: any;
    users: any;
    accounts: any;
    movies: any;
    ticket_packages: any;
    branches: any;
    email_logs?: any;
    vouchers?: any;
    voucher_redemption_logs?: any;
    booking_vr_items?: any;
  },
  context?: { waitUntil: (promise: Promise<any>) => void }
) {
  try {
    const { user_id, payment_id, payment_status, transaction_id, paid_at, confirmed_by_staff_id } = payload;
    if (!payment_id || !payment_status) {
      return { status: 400, message: 'Vui lòng nhập đầy đủ thông tin hợp lệ.' };
    }

    const {
      bookings: bookingsTable,
      movies: moviesTable,
      ticket_packages: pkgsTable,
      branches: branchesTable,
      vouchers: vouchersTable,
      voucher_redemption_logs: logsTable,
      booking_vr_items: vrItemsTable
    } = tables || ({} as any);
    if (!bookingsTable || !moviesTable || !pkgsTable || !branchesTable)
      return { status: 500, message: 'Missing tables definition' };

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
        movie_duration: bookingsTable.movie_duration,
        // Branch fields for email
        branch_name: branchesTable.name,
        branch_address: branchesTable.address,
        branch_phone: branchesTable.phone,
        branch_settings: branchesTable.settings
      })
      .from(bookingsTable)
      .leftJoin(moviesTable, eq(bookingsTable.movie_id, moviesTable.id))
      .leftJoin(pkgsTable, eq(bookingsTable.ticket_package_id, pkgsTable.id))
      .leftJoin(branchesTable, eq(bookingsTable.branch_id, branchesTable.id))
      .where(whereClause)
      .limit(1);

    const result = rows[0];
    if (!result) return { status: 404, message: 'Không tìm thấy đặt vé.' };

    const { booking } = result;
    let bookingCode = booking.booking_code;
    const isPaid = String(payment_status).toLowerCase() === 'paid';
    const isAlreadyPaid = String(booking.payment_status).toLowerCase() === 'paid';

    // Bảo vệ: Nếu đơn đã thanh toán (isAlreadyPaid) mà request gửi lên là failed
    // => Chặn update, trả về thông báo để Client xử lý (Alert "Đã thanh toán" thay vì "Đã hủy")
    if (isAlreadyPaid && payment_status === 'failed') {
      return {
        status: 409, // Conflict
        message: 'Giao dịch đã được thanh toán thành công',
        booking: booking
      };
    }

    // An order that is already paid is not paid again: no second ticket code, voucher log or email.
    if (isPaid && isAlreadyPaid) return alreadyProcessedResult(booking);

    // 2. Logic tạo mã vé. The code is made first but only saved by the request that wins the status change below.
    if (isPaid && !bookingCode) {
      bookingCode = await generateBookingCode(anyDb);
    }

    // 3. Chuẩn bị payload update
    const now = new Date();
    const updatePayload: any = {
      payment_status,
      updated_at: formatDateForDb(now),
      transaction_id: transaction_id ?? booking.transaction_id
    };

    if (isPaid) {
      const paidAtDate = paid_at ? new Date(paid_at) : new Date();
      const validPaidAt = isNaN(paidAtDate.getTime()) ? new Date() : paidAtDate;

      // Fetch branch settings for ticket expiry days
      let branchSettings: any = {};
      if (booking.branch_id) {
        const branch = await anyDb.query.branches.findFirst({
          where: and(eq(branchesTable.id, booking.branch_id), isNull(branchesTable.deleted_at))
        });
        if (branch) {
          try {
            branchSettings = branch.settings ? JSON.parse(branch.settings) : {};
          } catch (e) {
            branchSettings = {};
          }
        }
      }

      // Use branch ticket_expiry_days setting, default to 10 days if not set
      const expiryDays = branchSettings.ticket_expiry_days || 10;
      updatePayload.paid_at = formatDateForDb(validPaidAt);
      updatePayload.expiry_date = formatDateForDb(new Date(validPaidAt.getTime() + expiryDays * 24 * 60 * 60 * 1000));
      updatePayload.booking_code = bookingCode;
      // Clear the payment deadline — booking is now confirmed paid
      updatePayload.payment_expires_at = null;
      if (confirmed_by_staff_id) updatePayload.confirmed_by_staff_id = Number(confirmed_by_staff_id);
    }

    // 4. Update và lấy kết quả mới nhất.
    // The status change is one conditional UPDATE, so two requests at the same moment cannot both win:
    //  - to 'paid': only while the order is not paid yet;
    //  - to failed / cancelled / expired: only while the order is still pending or expired.
    const currentStatusSql = sql`coalesce(lower(${bookingsTable.payment_status}), '')`;
    const transitionGuard = isPaid ? sql`${currentStatusSql} <> 'paid'` : sql`${currentStatusSql} in ('pending', 'expired')`;

    const updatedRes = await anyDb
      .update(bookingsTable)
      .set(updatePayload)
      .where(and(eq(bookingsTable.id, booking.id), transitionGuard))
      .returning();

    const updatedBooking = Array.isArray(updatedRes) ? updatedRes[0] : updatedRes;

    // Nothing changed: another request got there first. Say so and do none of the follow-up work below.
    if (!updatedBooking) {
      const latest = await anyDb.query.bookings.findFirst({ where: eq(bookingsTable.id, booking.id) });
      const latestStatus = String(latest?.payment_status || '').toLowerCase();
      if (!isPaid && latestStatus === 'paid') {
        return { status: 409, message: 'Giao dịch đã được thanh toán thành công', booking: latest };
      }
      return alreadyProcessedResult(latest || booking);
    }

    // 5b. Redeem Voucher + VR booking logic (only if paid)
    let voucherSlotUnavailable = false;
    if (isPaid && !isAlreadyPaid) {
      // A booking that was failed or expired had its voucher usage released. Take the slot again now that it is paid.
      // If the voucher has no slot left the payment is still accepted (the money was received); the caller is told.
      const previousStatus = String(booking.payment_status || '').toLowerCase();
      if (['failed', 'expired', 'cancelled'].includes(previousStatus) && booking.voucher_id && vouchersTable) {
        try {
          const relocked = await anyDb
            .update(vouchersTable)
            .set({ used_count: sql`${vouchersTable.used_count} + 1`, updated_at: formatDateForDb(now) })
            .where(
              and(
                eq(vouchersTable.id, Number(booking.voucher_id)),
                or(isNull(vouchersTable.usage_limit), sql`${vouchersTable.used_count} < ${vouchersTable.usage_limit}`)
              )
            )
            .returning({ id: vouchersTable.id });
          voucherSlotUnavailable = !Array.isArray(relocked) || relocked.length === 0;
        } catch (e) {
          console.error('[updatePayment] Re-lock voucher error:', e);
        }
      }

      // Redeem voucher (if used)
      if (booking.voucher_id && vouchersTable && logsTable) {
        try {
          const originalTotal = Number(booking.original_total_price || booking.total_price || 0);
          const finalTotal = Number(booking.total_price || 0);
          const discAmt = Number(booking.voucher_discount_amount || 0);
          await redeemVoucherAfterPaymentImpl(
            anyDb,
            { vouchers: vouchersTable, voucher_redemption_logs: logsTable, bookings: bookingsTable },
            {
              voucher_id: Number(booking.voucher_id),
              booking_id: booking.id,
              user_id: booking.user_id ? Number(booking.user_id) : undefined,
              discount_amount_applied: discAmt > 0 ? discAmt : Math.max(0, originalTotal - finalTotal),
              order_total_before_discount: originalTotal > 0 ? originalTotal : finalTotal + discAmt,
              order_total_after_discount: finalTotal
            }
          );
        } catch (e) {
          console.error('[updatePayment] Redeem voucher lỗi (không rollback, booking đã paid)', e);
        }
      }
    } else if (payment_status === 'failed' || payment_status === 'cancelled' || payment_status === 'expired') {
      // If payment failed/cancelled and booking had locked a voucher while pending, release it
      if (booking.voucher_id && vouchersTable) {
        try {
          await releaseVoucherForCancelledBooking(
            anyDb,
            { vouchers: vouchersTable },
            {
              voucher_id: Number(booking.voucher_id),
              previous_payment_status: String(booking.payment_status || 'pending').toLowerCase()
            }
          );
        } catch (e) {
          console.error('[updatePayment] Release voucher error:', e);
        }
      }
    }

    // 5. Gửi mail (Chỉ khi thanh toán thành công)
    if (isPaid) {
      queueBookingConfirmationEmail({
        anyDb,
        tables,
        source: result,
        updatedBooking,
        bookingCode,
        sendMailFn,
        getBookingEmailHtml,
        context
      });
    }

    return {
      status: 200,
      message:
        payment_status === 'failed'
          ? 'Giao dịch đã được hủy thành công'
          : 'Giao dịch đã xử lý xong (Mail đã được gửi tới khách hàng)',
      booking: updatedBooking,
      voucher_slot_unavailable: voucherSlotUnavailable
    };
  } catch (err: any) {
    return {
      status: err?.status || 500,
      message: err?.message || 'Lỗi máy chủ nội bộ'
    };
  }
}
