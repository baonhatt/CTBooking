import { eq } from 'drizzle-orm';
import { logAuditAction } from '../../lib/audit-logger';
import { queueBookingConfirmationEmail } from '../user/booking/confirmation-email';

export interface ResendStaff {
  id?: number;
  email?: string;
  fullname?: string;
}

/**
 * Staff send the "booking confirmed" email of a paid order again (for example when it failed or went to spam).
 *
 *  1. Only a paid order has a confirmation to send.
 *  2. The order must belong to one of the staff member's branches. restrictToBranchIds is null for the Super Admin
 *     (no limit). An order with no branch can only be handled by the Super Admin.
 *  3. The email goes to the address on the order. Nothing in the request can change the recipient.
 *  4. The send is written to the audit log and, like every email, to the email log.
 */
export async function resendBookingEmailImpl(
  db: any,
  tables: any,
  body: { booking_id?: unknown },
  staff: ResendStaff,
  restrictToBranchIds: number[] | null,
  sendMailFn?: (to: string, subject: string, html: string) => Promise<any>,
  getBookingEmailHtml?: (data: any) => string,
  context?: { waitUntil: (promise: Promise<any>) => void }
) {
  const bookingId = Number(body.booking_id);
  if (!Number.isInteger(bookingId) || bookingId <= 0) {
    return { status: 400, message: 'Thiếu mã đơn cần gửi lại email.' };
  }

  const bookingsTable = tables.bookings;
  const booking = await db.query.bookings.findFirst({ where: eq(bookingsTable.id, bookingId) });
  if (!booking) return { status: 404, message: 'Không tìm thấy đặt vé.' };

  if (restrictToBranchIds !== null) {
    if (booking.branch_id === null || booking.branch_id === undefined) {
      return { status: 403, message: 'Đơn này chưa có chi nhánh, chỉ Super Admin được gửi lại email.' };
    }
    if (!restrictToBranchIds.includes(Number(booking.branch_id))) {
      return { status: 403, message: 'Bạn không có quyền gửi lại email cho đơn thuộc chi nhánh khác.' };
    }
  }

  if (String(booking.payment_status || '').toLowerCase() !== 'paid') {
    return { status: 409, message: 'Chỉ gửi lại email cho đơn đã thanh toán.' };
  }
  if (!booking.email) {
    return { status: 409, message: 'Đơn này không có địa chỉ email.' };
  }

  // The same joined row that updatePaymentImpl reads, so the email looks the same as the first one
  const rows = await db
    .select({
      booking: bookingsTable,
      package_name: tables.ticket_packages.name,
      branch_name: tables.branches.name,
      branch_address: tables.branches.address,
      branch_phone: tables.branches.phone,
      branch_settings: tables.branches.settings
    })
    .from(bookingsTable)
    .leftJoin(tables.ticket_packages, eq(bookingsTable.ticket_package_id, tables.ticket_packages.id))
    .leftJoin(tables.branches, eq(bookingsTable.branch_id, tables.branches.id))
    .where(eq(bookingsTable.id, bookingId))
    .limit(1);
  const source = rows[0] || { booking };

  queueBookingConfirmationEmail({
    anyDb: db,
    tables,
    source,
    updatedBooking: booking,
    bookingCode: booking.booking_code,
    sendMailFn,
    getBookingEmailHtml,
    context
  });

  if (tables.auditLogs) {
    await logAuditAction(
      db,
      tables.auditLogs,
      'resend_booking_email',
      'booking',
      bookingId,
      'Nhân viên gửi lại email xác nhận của đơn #' + bookingId + '.',
      staff.id || null,
      staff.email,
      staff.fullname
    );
  }

  return { status: 200, message: 'Đã đưa email xác nhận vào hàng đợi gửi.' };
}
