import { eq } from 'drizzle-orm';
import { updatePaymentImpl } from '../user/booking/update';
import { logAuditAction } from '../../lib/audit-logger';

/** The only statuses a staff member can set through the confirm-booking screen. */
export const CONFIRMABLE_STATUSES = ['paid', 'failed'];

/** Longest bank transaction reference accepted from the screen. */
const TRANSACTION_ID_MAX_LENGTH = 100;

export interface ConfirmStaff {
  id?: number;
  email?: string;
  fullname?: string;
}

/**
 * Staff confirm a payment by hand (for example when SePay did not report it).
 *
 * The screen works as before. The server now also checks:
 *  1. the status is `paid` or `failed` (any other value is refused);
 *  2. the booking belongs to one of the staff member's branches. `restrictToBranchIds` is null for the Super Admin
 *     (no limit). A booking with no branch can only be confirmed by the Super Admin;
 *  3. who confirmed it is stored on the booking and in the audit log;
 *  4. the payment time is the server's clock. Any `paid_at` or `user_id` sent by the browser is ignored.
 */
export async function confirmBookingImpl(
  db: any,
  tables: any,
  body: { payment_id?: unknown; payment_status?: unknown; transaction_id?: unknown },
  staff: ConfirmStaff,
  restrictToBranchIds: number[] | null,
  sendMailFn?: (to: string, subject: string, html: string) => Promise<any>,
  getBookingEmailHtml?: (data: any) => string,
  context?: { waitUntil: (promise: Promise<any>) => void }
) {
  const paymentId = Number(body.payment_id);
  if (!Number.isInteger(paymentId) || paymentId <= 0) {
    return { status: 400, message: 'Thiếu mã đơn cần xác nhận.' };
  }

  const requestedStatus = String(body.payment_status ?? '')
    .trim()
    .toLowerCase();
  if (!CONFIRMABLE_STATUSES.includes(requestedStatus)) {
    return { status: 400, message: 'Trạng thái không hợp lệ. Chỉ nhận paid hoặc failed.' };
  }

  const booking = await db.query.bookings.findFirst({ where: eq(tables.bookings.id, paymentId) });
  if (!booking) {
    return { status: 404, message: 'Không tìm thấy đặt vé.' };
  }

  if (restrictToBranchIds !== null) {
    if (booking.branch_id === null || booking.branch_id === undefined) {
      return { status: 403, message: 'Đơn này chưa có chi nhánh, chỉ Super Admin được xác nhận.' };
    }
    if (!restrictToBranchIds.includes(Number(booking.branch_id))) {
      return { status: 403, message: 'Bạn không có quyền xác nhận đơn thuộc chi nhánh khác.' };
    }
  }

  const previousStatus = String(booking.payment_status || '').toLowerCase();
  if (requestedStatus === 'paid' && previousStatus === 'paid') {
    return { status: 409, message: 'Đơn này đã được thanh toán.' };
  }

  const rawTransactionId = typeof body.transaction_id === 'string' ? body.transaction_id.trim() : '';
  const transactionId =
    rawTransactionId && rawTransactionId.length <= TRANSACTION_ID_MAX_LENGTH ? rawTransactionId : undefined;

  const result: any = await updatePaymentImpl(
    db,
    {
      payment_id: paymentId,
      payment_status: requestedStatus,
      transaction_id: transactionId,
      confirmed_by_staff_id: staff.id
    },
    sendMailFn,
    getBookingEmailHtml,
    tables,
    context
  );

  if (result.status === 200 && tables.auditLogs) {
    const warnings = result.voucher_slot_unavailable
      ? ' Voucher đã hết lượt nên không giữ lại được lượt dùng.'
      : '';
    await logAuditAction(
      db,
      tables.auditLogs,
      requestedStatus === 'paid' ? 'confirm_payment' : 'cancel_payment',
      'booking',
      paymentId,
      `Nhân viên ${requestedStatus === 'paid' ? 'xác nhận thanh toán' : 'huỷ thanh toán'} đơn #${paymentId} (trạng thái trước: ${previousStatus || 'rỗng'}).${warnings}`,
      staff.id || null,
      staff.email,
      staff.fullname,
      JSON.stringify({ payment_status: previousStatus }),
      JSON.stringify({ payment_status: requestedStatus, confirmed_by_staff_id: staff.id || null })
    );
  }

  return result;
}
