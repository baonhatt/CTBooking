import { eq } from 'drizzle-orm';
import { updatePaymentImpl } from './update';
import { logAuditAction } from '../../../lib/audit-logger';

/**
 * A 0đ order (only possible with a 100% test voucher, see lib/free-voucher.ts) has nothing to transfer: it is paid
 * right after it is created, the same way a SePay payment pays it (ticket code, ticket email, voucher redemption log).
 *
 * Returns the updated order fields to send back, or null when the order is not free (normal QR payment).
 */
export async function payFreeOrderNow(
  anyDb: any,
  tables: any,
  bookingId: number,
  sendMailFn?: (to: string, subject: string, html: string) => Promise<any>,
  getBookingEmailHtml?: (data: any) => string,
  context?: { waitUntil: (promise: Promise<any>) => void }
): Promise<{ payment_status: 'paid'; booking_code: string | null } | null> {
  // Read from the database: the price and the voucher are the server's, never the browser's
  const booking = bookingId ? await anyDb.query.bookings.findFirst({ where: eq(tables.bookings.id, bookingId) }) : null;
  if (!booking || Number(booking.total_price) !== 0 || !booking.voucher_id) return null;

  const result: any = await updatePaymentImpl(
    anyDb,
    {
      payment_id: booking.id,
      payment_status: 'paid',
      paid_at: new Date(),
      user_id: booking.user_id ?? undefined,
      only_open_pending: true
    },
    sendMailFn,
    getBookingEmailHtml,
    tables,
    context
  );
  const paidBooking = result?.booking;
  if (String(paidBooking?.payment_status || '').toLowerCase() !== 'paid') return null;

  if (tables?.auditLogs) {
    try {
      await logAuditAction(
        anyDb,
        tables.auditLogs,
        'free_order_paid',
        'booking',
        booking.id,
        `Đơn #${booking.id} 0đ (voucher 100%) được xác nhận ngay, không cần chuyển khoản.`,
        null,
        'system',
        'Hệ thống'
      );
    } catch (error) {
      console.error('[free-order] audit log failed:', error);
    }
  }
  return { payment_status: 'paid', booking_code: paidBooking.booking_code || null };
}
