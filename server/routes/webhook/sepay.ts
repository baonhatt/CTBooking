<<<<<<< HEAD
import { eq } from 'drizzle-orm';
import { updatePaymentImpl } from '../user/payments';

export async function handleSePayWebhookImpl(
  db: any,
  tables: { bookings: any; users: any; accounts: any; movies: any; ticket_packages: any },
  body: any,
  sendMailFn?: (to: string, subject: string, html: string) => Promise<any>,
  getBookingEmailHtml?: (data: any) => string,
  context?: { waitUntil: (promise: Promise<any>) => void }
) {
  try {
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
    console.log('[SePay] Webhook received:', JSON.stringify(body));

    if (!finalContent) {
      return { success: false, message: 'No content' };
    }

    // Extract Order ID (e.g. CP1735140000000)
    const match = finalContent.match(/CP\d{13}/);
    if (!match) {
      console.log('[SePay] No Order ID found in content:', finalContent);
      return { success: true, message: 'No order id found, ignored' };
    }

    const orderId = match[0];
    console.log('[SePay] Processing Order ID:', orderId);

    // Find booking
    const bookingsTable = tables.bookings;

    // Support both Drizzle query builder and raw select if needed, but assuming 'db.query.bookings' is available
    // OR generic usage. Since we passed 'db' which is a Drizzle instance:
    const booking = await db.query.bookings.findFirst({
      where: eq(bookingsTable.pay_txt_code, orderId)
    });
    console.log('Booking:', booking);

    if (!booking) {
      console.log('[SePay] Booking not found for order:', orderId);
      return { success: true, message: 'Booking not found' };
    }

    // Check amount
    if (Number(finalAmount) < Number(booking.total_price)) {
      console.log('[SePay] Insufficient amount:', finalAmount, 'expected:', booking.total_price);
      return { success: true, message: 'Insufficient amount' };
    }

    // Check if already paid
    if (booking.payment_status === 'paid') {
      return { success: true, message: 'Already paid' };
    }

    // Check if booking payment window has expired (10 minutes from creation)
    const PAYMENT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
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
        tables
      );

      console.log(
        `[SePay] Booking ${booking.id} marked as 'failed' due to expired payment window. Result:`,
        failedResult
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
        transaction_id: referenceCode || description,
        paid_at: new Date(),
        user_id: booking.user_id
      },
      sendMailFn,
      getBookingEmailHtml,
      tables,
      context
    );

    console.log('[SePay] Update result:', result);

    return { success: true, message: 'Payment updated', bookingId: booking.id };
  } catch (error) {
    console.error('[SePay] Webhook Error:', error);
    return { success: false, message: 'Internal Error' };
  }
=======
import { eq, sql } from 'drizzle-orm';
import { updatePaymentImpl } from '../user/payments';

export async function handleSePayWebhookImpl(
        db: any,
        tables: { bookings: any; users: any; accounts: any; movies: any; ticket_packages: any; branches: any },
        body: any,
        sendMailFn?: (to: string, subject: string, html: string) => Promise<any>,
        getBookingEmailHtml?: (data: any) => string,
        context?: { waitUntil: (promise: Promise<any>) => void }
) {
        try {
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
                console.log('[SePay] Webhook received:', JSON.stringify(body));

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

                // Check amount
                if (Number(finalAmount) < Number(booking.total_price)) {
                        console.log('[SePay] Insufficient amount:', finalAmount, 'expected:', booking.total_price);
                        return { success: true, message: 'Insufficient amount' };
                }

                // Check if already paid
                if (booking.payment_status === 'paid') {
                        return { success: true, message: 'Already paid' };
                }

                // Check if booking payment window has expired (10 minutes from creation)
                const PAYMENT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
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
                                tables
                        );

                        console.log(
                                `[SePay] Booking ${booking.id} marked as 'failed' due to expired payment window. Result:`,
                                failedResult
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
                                transaction_id: referenceCode || description,
                                paid_at: new Date(),
                                user_id: booking.user_id
                        },
                        sendMailFn,
                        getBookingEmailHtml,
                        tables,
                        context
                );

                console.log('[SePay] Update result:', result);

                return { success: true, message: 'Payment updated', bookingId: booking.id };
        } catch (error) {
                console.error('[SePay] Webhook Error:', error);
                return { success: false, message: 'Internal Error' };
        }
>>>>>>> preview
}
