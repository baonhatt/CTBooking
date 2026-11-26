import { eq, and, or, isNull, inArray } from 'drizzle-orm';
import { updatePaymentImpl } from '../user/booking/update';
import { logAuditAction } from '../../lib/audit-logger';
import { formatDateForDb } from '../../lib/date-utils';

// Rule: an order is paid automatically ONLY while it is still 'pending' and inside its 10 minutes.
// Money for an order the customer cancelled, or that arrives after the 10 minutes, is never confirmed automatically:
// the bank reference is kept and the order goes to "Đơn cần xử lý" for staff to check and confirm by hand.

// The audit entries are made by the system, not by a staff member.
const AUDIT_ACTOR_EMAIL = 'system';
const AUDIT_ACTOR_NAME = 'SePay webhook';

type WebhookTables = {
  bookings: any;
  unmatched_transfers?: any;
  users: any;
  accounts: any;
  movies: any;
  ticket_packages: any;
  branches: any;
  auditLogs?: any;
};

/** One audit line for a bank transfer that did not make an order paid. Never stops the webhook. */
async function recordTransferAudit(db: any, tables: WebhookTables, action: string, booking: any, details: string, extra: any) {
  if (!tables.auditLogs) return;
  try {
    await logAuditAction(
      db,
      tables.auditLogs,
      action,
      'booking',
      booking.id,
      details,
      null,
      AUDIT_ACTOR_EMAIL,
      AUDIT_ACTOR_NAME,
      undefined,
      JSON.stringify({ pay_txt_code: booking.pay_txt_code, ...extra })
    );
  } catch (error) {
    console.error('[SePay] Audit log error:', error);
  }
}

/**
 * Money came in but matches no order (no "CS..." code, or a code of no order). Keep it for staff, who assign it to an
 * order or set it aside on the admin page "Chuyển khoản chưa khớp". The SePay id is unique, so a retried webhook
 * is stored once. Never stops the webhook.
 */
async function recordUnmatchedTransfer(db: any, tables: WebhookTables, body: any) {
  if (!tables.unmatched_transfers) return;
  try {
    const amount = Number(body?.transferAmount);
    const sepayId = body?.id !== undefined && body?.id !== null && String(body.id) !== '' ? String(body.id) : null;
    await db
      .insert(tables.unmatched_transfers)
      .values({
        sepay_id: sepayId,
        amount: Number.isFinite(amount) ? Math.round(amount) : 0,
        content: String(body?.content || body?.description || '').slice(0, 500),
        bank_ref: body?.referenceCode ? String(body.referenceCode).slice(0, 100) : null,
        transfer_at: body?.transactionDate ? String(body.transactionDate) : null,
        status: 'open',
        created_at: formatDateForDb(new Date())
      })
      .onConflictDoNothing();
  } catch (error) {
    console.error('[SePay] Save unmatched transfer error:', error);
  }
}

/** Keep the bank's transaction reference on the order so staff can find it. The first reference stays if one is there. */
async function saveBankTransactionRef(db: any, tables: WebhookTables, booking: any, bankRef: string) {
  if (!bankRef) return;
  try {
    const column = tables.bookings.transaction_id;
    await db
      .update(tables.bookings)
      .set({ transaction_id: bankRef })
      .where(and(eq(tables.bookings.id, booking.id), or(isNull(column), eq(column, ''))));
  } catch (error) {
    console.error('[SePay] Save transaction reference error:', error);
  }
}

export function timingSafeEqualStr(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  
  let mismatch = a.length === b.length ? 0 : 1;
  const maxLen = Math.max(a.length, b.length);
  
  let result = 0;
  for (let i = 0; i < maxLen; i++) {
    const charA = i < a.length ? a.charCodeAt(i) : 0;
    const charB = i < b.length ? b.charCodeAt(i) : 0;
    result |= (charA ^ charB);
  }
  
  return result === 0 && mismatch === 0;
}

/**
 * Every complete payment code in a transfer text, upper-cased: "CS" + exactly 12 digits, wherever it sits
 * ("MBVCB.123.CS482913057741.CT tu ...", "cs482913057741 thanh toan"). When the bank glues more digits on, the
 * first 12 are the code.
 */
export function findPayCodes(content: string): string[] {
  const found = String(content || '').toUpperCase().match(/CS\d{12}/g) || [];
  return [...new Set(found)];
}

/**
 * When the bank made the transfer, from SePay's transactionDate ("2026-11-26 14:02:37", Vietnam time). Falls back to
 * the time the webhook arrived when the field is missing, unreadable, in the future, or before the order existed.
 */
export function bankTransactionTime(transactionDate: unknown, orderCreatedAt: unknown, now: Date = new Date()): Date {
  const match = String(transactionDate || '').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!match) return now;
  const [, year, month, day, hour, minute, second] = match.map(Number);
  const bankTime = new Date(Date.UTC(year, month - 1, day, hour - 7, minute, second));
  const createdAt = new Date(String(orderCreatedAt || ''));
  const tooEarly = !isNaN(createdAt.getTime()) && bankTime.getTime() < createdAt.getTime() - 60 * 1000;
  const inFuture = bankTime.getTime() > now.getTime() + 60 * 1000;
  return isNaN(bankTime.getTime()) || tooEarly || inFuture ? now : bankTime;
}

/** The order's payment deadline: payment_expires_at, or created_at + 10 minutes for old rows. NaN when unknown. */
function paymentDeadlineMs(booking: { payment_expires_at?: string | null; created_at?: string | null }): number {
  if (booking.payment_expires_at) return new Date(booking.payment_expires_at).getTime();
  if (booking.created_at) return new Date(booking.created_at).getTime() + 10 * 60 * 1000;
  return NaN;
}

export async function handleSePayWebhookImpl(
  db: any,
  tables: WebhookTables,
  body: any,
  sendMailFn?: (to: string, subject: string, html: string) => Promise<any>,
  getBookingEmailHtml?: (data: any) => string,
  context?: { waitUntil: (promise: Promise<any>) => void },
  authHeader?: string,
  expectedKey?: string,
  logSystemError?: (context: string, error: any, payload?: any) => void
) {
  try {
    // Auth is already verified in webhookRouter.ts before calling this implementation (fail-fast)
    const {
      gateway,
      transactionDate,
      accountNumber,
      subAccount,
      transferType,
      transferAmount,
      referenceCode,
      description,
      content, // SePay sends 'content' field (e.g., "QR CINESPHERE...")
      id
    } = body;

    // Use content directly (SePay's actual field name)
    const finalContent = content;
    const finalAmount = transferAmount;

    // Log for debugging
    console.log('[SePay] Webhook received:', JSON.stringify({ id, transferType, transferAmount: finalAmount, referenceCode }));

    // Money going OUT of the account is never a customer payment.
    if (String(transferType || '').toLowerCase() === 'out') {
      console.log('[SePay] Outgoing transfer ignored:', id);
      return { success: true, message: 'Outgoing transfer ignored' };
    }

    if (!finalContent) {
      await recordUnmatchedTransfer(db, tables, body);
      return { success: false, message: 'No content' };
    }

    // Banks often add their own text around the code. The payment code (CS + 12 digits) may sit anywhere in it;
    // one COMPLETE code is enough, a shorter one matches nothing.
    const payCodes = findPayCodes(finalContent);
    if (payCodes.length === 0) {
      console.log('[SePay] No Order ID found in content:', finalContent);
      await recordUnmatchedTransfer(db, tables, body);
      return { success: true, message: 'No order id found, saved for staff' };
    }

    // Find booking: exact match on the payment code
    const bookingsTable = tables.bookings;
    let booking = await db.query.bookings.findFirst({
      where: payCodes.length === 1 ? eq(bookingsTable.pay_txt_code, payCodes[0]) : inArray(bookingsTable.pay_txt_code, payCodes)
    });
    // Two different orders named in one transfer: never guess which one was paid, staff decide
    if (booking && payCodes.length > 1) {
      const matched = await db.query.bookings.findMany({ where: inArray(bookingsTable.pay_txt_code, payCodes), limit: 2 });
      if (Array.isArray(matched) && matched.length > 1) booking = undefined;
    }

    if (!booking) {
      console.log('[SePay] Booking not found for codes:', payCodes);
      await recordUnmatchedTransfer(db, tables, body);
      return { success: true, message: 'Booking not found, saved for staff' };
    }

    // The bank's reference for this transfer, as before: referenceCode, else the description
    const bankRef = String(referenceCode || description || id || '');
    const amountReceived = Number(finalAmount);
    const amountNeeded = Number(booking.total_price);

    // Already paid: money that arrives again is left alone, but leaves a trace for staff
    if (String(booking.payment_status || '').toLowerCase() === 'paid') {
      await recordTransferAudit(
        db,
        tables,
        'sepay_duplicate',
        booking,
        `Đơn #${booking.id} đã thanh toán, nhưng ngân hàng ghi nhận thêm ${amountReceived} (mã giao dịch ${bankRef || 'không có'}).`,
        { amount_received: amountReceived, bank_ref: bankRef }
      );
      return { success: true, message: 'Already paid' };
    }

    // Check amount: the order is paid only when the amount is a real number and at least the price.
    // A missing or non-numeric amount (NaN) counts as insufficient; before, NaN < price was false and let it through.
    if (!Number.isFinite(amountReceived) || amountReceived < amountNeeded) {
      console.log('[SePay] Insufficient amount:', finalAmount, 'expected:', booking.total_price);
      await recordTransferAudit(
        db,
        tables,
        'sepay_insufficient',
        booking,
        `Đơn #${booking.id} nhận ${amountReceived}, cần ${amountNeeded} (mã giao dịch ${bankRef || 'không có'}). Đơn giữ nguyên trạng thái.`,
        { amount_received: amountReceived, amount_needed: amountNeeded, bank_ref: bankRef }
      );
      return { success: true, message: 'Insufficient amount' };
    }

    // Late or closed: never paid automatically. Close it if still pending, keep the bank reference, and leave it for
    // staff ("Đơn cần xử lý" -> "Đơn chưa xác nhận").
    // "In time" is judged by WHEN THE BANK MADE THE TRANSFER (transactionDate), not when SePay told us: a transfer made
    // inside the 10 minutes but reported late still counts.
    const currentStatus = String(booking.payment_status || '').toLowerCase();
    const paidAt = bankTransactionTime(transactionDate, booking.created_at);
    const deadlineMs = paymentDeadlineMs(booking);
    const paidInTime = !Number.isFinite(deadlineMs) || paidAt.getTime() <= deadlineMs;
    // The system closed it at the deadline (not the customer): it may still be paid in time, when no voucher is
    // involved (its use was given back when the order closed, so that case stays with staff)
    const systemExpiredButPaidInTime = currentStatus === 'expired' && paidInTime && !booking.voucher_id;
    const isClosed = currentStatus !== 'pending' && !systemExpiredButPaidInTime;
    const leaveForStaff = async (reason: string) => {
      console.log(`[SePay] Payment for order ${booking.pay_txt_code} left for staff: ${reason}`);
      if (String(booking.payment_status || '').toLowerCase() === 'pending') {
        await updatePaymentImpl(
          db,
          { payment_id: booking.id, payment_status: 'expired', user_id: booking.user_id },
          undefined, // no email for a closed order
          undefined,
          tables as any
        );
      }
      await saveBankTransactionRef(db, tables, booking, bankRef);
      await recordTransferAudit(
        db,
        tables,
        'sepay_late_payment',
        booking,
        `Đơn #${booking.id} nhận ${amountReceived} nhưng ${reason} (mã giao dịch ${bankRef || 'không có'}). Cần nhân viên đối chiếu và xác nhận.`,
        { amount_received: amountReceived, amount_needed: amountNeeded, bank_ref: bankRef, reason }
      );
      return { success: true, message: 'Late payment - left for staff' };
    };

    if (isClosed) {
      return leaveForStaff(
        currentStatus === 'cancelled'
          ? 'đơn đã bị hủy'
          : currentStatus === 'expired' && paidInTime
            ? 'đơn đã hết hạn và có dùng voucher'
            : 'đơn đã hết hạn thanh toán'
      );
    }
    if (!paidInTime) {
      return leaveForStaff('ngân hàng ghi nhận chuyển khoản sau 10 phút thanh toán');
    }

    // Inside the 10 minutes: pay. The UPDATE itself also requires 'pending' and an unexpired deadline, so an order
    // that is cancelled or expires at this very moment (cron, customer, status check) is not paid.
    const result: any = await updatePaymentImpl(
      db,
      {
        payment_id: booking.id,
        payment_status: 'paid',
        transaction_id: bankRef || undefined,
        paid_at: new Date(),
        user_id: booking.user_id,
        only_open_pending: true,
        paid_in_time_at: paidAt,
        allow_system_expired: systemExpiredButPaidInTime
      },
      sendMailFn,
      getBookingEmailHtml,
      tables as any,
      context
    );

    console.log('[SePay] Update result:', result);

    if (result?.already_processed && String(result?.booking?.payment_status || '').toLowerCase() !== 'paid') {
      // Lost the race with a cancel / expiry: treat it like any other late payment
      return leaveForStaff('đơn vừa hết hạn hoặc bị hủy đúng lúc tiền về');
    }
    if (result?.already_processed) {
      // Another transfer paid this order a moment earlier: this money is extra
      await recordTransferAudit(
        db,
        tables,
        'sepay_duplicate',
        booking,
        `Đơn #${booking.id} đã thanh toán, nhưng ngân hàng ghi nhận thêm ${amountReceived} (mã giao dịch ${bankRef || 'không có'}).`,
        { amount_received: amountReceived, bank_ref: bankRef }
      );
      return { success: true, message: 'Already paid' };
    }

    return { success: true, message: 'Payment updated', bookingId: booking.id };
  } catch (error) {
    console.error('[SePay] Webhook Error:', error);
    return { success: false, message: 'Internal Error' };
  }
}
