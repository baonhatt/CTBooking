import { and, eq, isNotNull, isNull, lt, or, sql } from 'drizzle-orm';
import { formatDateForDb } from '../../lib/date-utils';

/**
 * Auto-expire pending bookings that have passed their payment_expires_at deadline.
 * For each expired booking that used a voucher, atomically decrement used_count back.
 *
 * Called by the Cloudflare Cron Trigger every 5 minutes.
 */
export async function expireStaleBookingsImpl(
  anyDb: any,
  tables: {
    bookings: any;
    vouchers: any;
  }
): Promise<{ expired_count: number; voucher_releases: number }> {
  const now = new Date();
  const nowIso = formatDateForDb(now);
  const tenMinAgoIso = formatDateForDb(new Date(now.getTime() - 10 * 60 * 1000));

  // 1. Batch expire all pending bookings past their deadline in a single UPDATE
  //    Handles both:
  //    - New bookings: payment_expires_at < nowIso
  //    - Legacy bookings (NULL payment_expires_at): created_at < 10 minutes ago
  const expiredRows = await anyDb
    .update(tables.bookings)
    .set({
      payment_status: 'expired',
      updated_at: nowIso
    })
    .where(
      and(
        eq(tables.bookings.payment_status, 'pending'),
        or(
          and(
            isNotNull(tables.bookings.payment_expires_at),
            lt(tables.bookings.payment_expires_at, nowIso)
          ),
          and(
            isNull(tables.bookings.payment_expires_at),
            lt(tables.bookings.created_at, tenMinAgoIso)
          )
        )
      )
    )
    .returning({ id: tables.bookings.id, voucher_id: tables.bookings.voucher_id });

  const expiredArr = Array.isArray(expiredRows) ? expiredRows : [];
  const expired_count = expiredArr.length;

  if (expired_count === 0) {
    return { expired_count: 0, voucher_releases: 0 };
  }

  console.log(`[Cron] Expired ${expired_count} pending bookings.`);

  // 2. Collect unique voucher IDs from expired bookings
  const voucherIds: number[] = [
    ...new Set(
      expiredArr
        .map((r: any) => r.voucher_id)
        .filter((id: any): id is number => typeof id === 'number' && id > 0)
    )
  ];

  let voucher_releases = 0;

  if (voucherIds.length > 0) {
    // Count how many expired bookings used each voucher (to release the right amount)
    const voucherCountMap = new Map<number, number>();
    for (const row of expiredArr) {
      if (row.voucher_id) {
        voucherCountMap.set(row.voucher_id, (voucherCountMap.get(row.voucher_id) || 0) + 1);
      }
    }

    // 3. Atomically decrement used_count for each affected voucher
    //    Never go below 0 (safety guard: used_count - n but min 0)
    for (const [voucherId, releaseCount] of voucherCountMap.entries()) {
      await anyDb
        .update(tables.vouchers)
        .set({
          used_count: sql`MAX(0, used_count - ${releaseCount})`,
          updated_at: nowIso
        })
        .where(eq(tables.vouchers.id, voucherId));
      voucher_releases += releaseCount;
      console.log(`[Cron] Released ${releaseCount} usage(s) for voucher #${voucherId}.`);
    }
  }

  return { expired_count, voucher_releases };
}

/**
 * Release voucher used_count when a pending booking is manually cancelled.
 * Only decrements if the booking was still pending (not paid/already expired).
 *
 * @param previousStatus - the payment_status before cancellation
 */
export async function releaseVoucherForCancelledBooking(
  anyDb: any,
  tables: { vouchers: any },
  args: {
    voucher_id: number | null | undefined;
    previous_payment_status: string;
  }
): Promise<void> {
  const { voucher_id, previous_payment_status } = args;

  // Only release if booking was pending (=voucher usage was locked but not yet confirmed)
  if (!voucher_id || previous_payment_status !== 'pending') return;

  const nowIso = formatDateForDb(new Date());
  await anyDb
    .update(tables.vouchers)
    .set({
      used_count: sql`MAX(0, used_count - 1)`,
      updated_at: nowIso
    })
    .where(eq(tables.vouchers.id, voucher_id));

  console.log(`[Voucher] Released 1 usage for voucher #${voucher_id} due to booking cancellation.`);
}
