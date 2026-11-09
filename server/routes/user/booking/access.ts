import { eq } from 'drizzle-orm';
import { verifyOrderToken } from '../../../lib/order-token';
import { formatDateForDb } from '../../../lib/date-utils';

/**
 * Finds a booking only for the person who placed it. Returns null otherwise, so the reply for "not yours" is the same
 * as for "does not exist" and booking ids cannot be probed.
 *
 * Two ways to prove it is your booking:
 *  - the per-order token (guests and customers alike, it is kept in the browser that placed the order), or
 *  - a signed-in account that owns the booking. This follows the same rule as the transaction history:
 *    the account's user id matches the booking, or the account email matches the booking email.
 */
export async function findBookingForOwner(
  anyDb: any,
  tables: { bookings: any; accounts: any },
  args: { bookingId: number; orderToken?: unknown; secret: string; accountId?: number | null }
): Promise<any | null> {
  const { bookingId, orderToken, secret, accountId } = args;
  if (!Number.isInteger(bookingId) || bookingId <= 0) return null;

  const booking = await anyDb.query.bookings.findFirst({ where: eq(tables.bookings.id, bookingId) });
  if (!booking) return null;

  if (await verifyOrderToken(secret, booking.id, booking.pay_txt_code, orderToken)) {
    return booking;
  }

  if (accountId) {
    const account = await anyDb.query.accounts.findFirst({ where: eq(tables.accounts.id, accountId) });
    if (account) {
      const ownsByUser = booking.user_id != null && account.user_id != null && booking.user_id === account.user_id;
      const ownsByEmail =
        !!booking.email && !!account.email && String(booking.email).toLowerCase() === String(account.email).toLowerCase();
      if (ownsByUser || ownsByEmail) return booking;
    }
  }

  return null;
}

/**
 * The only booking data the payment page may read: the payment state and the deadline, plus the server clock so the
 * browser can count down against the server's time instead of its own.
 * It never includes a name, phone, email, ticket code or any other personal data.
 */
export function bookingStatusPayload(booking: { id: number; payment_status?: string | null; payment_expires_at?: string | null }) {
  return {
    status: 'success',
    id: booking.id,
    payment_status: String(booking.payment_status || 'pending').toLowerCase(),
    payment_expires_at: booking.payment_expires_at || null,
    server_now: formatDateForDb(new Date())
  };
}
