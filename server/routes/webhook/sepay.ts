import { eq, and, or, isNull } from 'drizzle-orm';
import { updatePaymentImpl } from '../user/booking/update';
import { logAuditAction } from '../../lib/audit-logger';

// The customer has this long to pay, counted from the moment the order was created.
const PAYMENT_WINDOW_MS = 10 * 60 * 1000;

// The audit entries are made by the system, not by a staff member.
const AUDIT_ACTOR_EMAIL = 'system';
const AUDIT_ACTOR_NAME = 'SePay webhook';

type WebhookTables = {
  bookings: any;
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
      return { success: false, message: 'No content' };
    }

    // Extract Order ID (e.g. CS123456789012)
    const match = finalContent.match(/CS\d+/);
    if (!match) {
      console.log('[SePay] No Order ID found in content:', finalContent);
      return { success: true, message: 'No order id found, ignored' };
    }

    const orderId = match[0];
    console.log('[SePay] Processing Order ID:', orderId);

    // Extract exact CS + timestamp pattern (handle cases where bank adds extra text)
    // Pattern: CS followed by 10 digits (timestamp in seconds) + 2 digits (random) = 12 digits total
    const codeMatch = orderId.match(/CS\d{12}/);
    const exactOrderId = codeMatch ? codeMatch[0] : orderId;
    console.log('[SePay] Extracted Order ID:', exactOrderId);

    // Find booking
    const bookingsTable = tables.bookings;

    // Support both Drizzle query builder and raw select if needed, but assuming 'db.query.bookings' is available
    // OR generic usage. Since we passed 'db' which is a Drizzle instance:
    const booking = await db.query.bookings.findFirst({
      where: eq(bookingsTable.pay_txt_code, exactOrderId)
    });
    console.log('Booking:', booking);

    if (!booking) {
      console.log('[SePay] Booking not found for order:', orderId);
      return { success: true, message: 'Booking not found' };
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

    // Check amount: the rule is unchanged, the order is paid only when the amount is at least the price
    if (amountReceived < amountNeeded) {
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

    // Check if booking payment window has expired (10 minutes from creation)
    const createdAt = booking.created_at ? new Date(booking.created_at) : null;
    const now = new Date();

    if (createdAt && now.getTime() - createdAt.getTime() > PAYMENT_WINDOW_MS) {
      console.log(
        `[SePay] Payment window expired for order: ${orderId}. Created at: ${createdAt.toISOString()}, Current time: ${now.toISOString()}`
      );

      // Update booking status to 'failed' using updatePaymentImpl for consistency
      const failedResult = await updatePaymentImpl(
        db,
        {
          payment_id: booking.id,
          payment_status: 'failed',
          user_id: booking.user_id
        },
        undefined, // No email for failed payments
        undefined,
        tables as any
      );

      console.log(
        `[SePay] Booking ${booking.id} marked as 'failed' due to expired payment window. Result:`,
        failedResult
      );

      // The money did arrive. Keep the bank reference and a trace so staff can find it and confirm by hand.
      await saveBankTransactionRef(db, tables, booking, bankRef);
      await recordTransferAudit(
        db,
        tables,
        'sepay_late_payment',
        booking,
        `Đơn #${booking.id} nhận ${amountReceived} sau hạn thanh toán (mã giao dịch ${bankRef || 'không có'}). Cần nhân viên đối chiếu và xác nhận.`,
        { amount_received: amountReceived, amount_needed: amountNeeded, bank_ref: bankRef }
      );

      return {
        success: true,
        message: 'Payment window expired - booking marked as failed'
      };
    }

    // Update Payment
    const result = await updatePaymentImpl(
      db,
      {
        payment_id: booking.id,
        payment_status: 'paid',
        transaction_id: bankRef || undefined,
        paid_at: new Date(),
        user_id: booking.user_id
      },
      sendMailFn,
      getBookingEmailHtml,
      tables as any,
      context
    );

    console.log('[SePay] Update result:', result);

    return { success: true, message: 'Payment updated', bookingId: booking.id };
  } catch (error) {
    console.error('[SePay] Webhook Error:', error);
    return { success: false, message: 'Internal Error' };
  }
}
