import { eq, and, isNull, or, inArray, desc } from 'drizzle-orm';
import { formatDateForDb } from '../../../lib/date-utils';
import { logAuditAction } from '../../../lib/audit-logger';
import { readVoucherScope } from '../../../lib/catalog-scope';
import { voucherInvoicePackageIds } from '../vouchers';

export async function getBookingImpl(anyDb: any, id: number, tables: { bookings: any }) {
  const bookingsTable = tables.bookings;
  const booking = await anyDb.query.bookings.findFirst({
    where: eq(bookingsTable.id, id),
    columns: {
      id: true,
      payment_status: true,
      total_price: true,
      ticket_count: true,
      created_at: true,
      name: true,
      email: true,
      phone: true,
      user_id: true,
      movie_id: true,
      ticket_package_id: true
    }
  });
  if (!booking) return { status: 404, message: 'Không tìm thấy' };
  return {
    status: 200,
    id: booking.id,
    payment_status: booking.payment_status,
    total_price: booking.total_price,
    ticket_count: booking.ticket_count,
    created_at: booking.created_at,
    movie_id: booking.movie_id,
    ticket_package_id: booking.ticket_package_id
  };
}

// The public booking lookup by id was removed: it returned names, phones, emails and the ticket code to anyone.
// The payment page now reads a minimal status through bookingStatusPayload (see access.ts).

/**
 * The codes staff may type or scan at the ticket check, each compared EXACTLY (never "contains"):
 *  - the ticket code (booking_code, 8 letters/digits),
 *  - the payment code (pay_txt_code, CS + 12 digits), also found inside longer scanned text, or given as the 12 digits,
 *  - BK<order id> (older printed tickets).
 * A partial code finds nothing, so a typo can never open somebody else's ticket.
 */
export function ticketCodeCandidates(codeRaw: string): { codes: string[]; bookingId: number | null } {
  const compact = String(codeRaw || '').toUpperCase().replace(/\s+/g, '');
  const codes = new Set<string>();
  if (compact) codes.add(compact);
  const payCode = compact.match(/CS\d{12}/);
  if (payCode) codes.add(payCode[0]);
  if (/^\d{12}$/.test(compact)) codes.add(`CS${compact}`);
  const bookingIdText = compact.match(/^BK(\d+)$/)?.[1];
  const bookingId = bookingIdText ? Number(bookingIdText) : null;
  return { codes: [...codes], bookingId: bookingId && Number.isSafeInteger(bookingId) ? bookingId : null };
}

function buildCodeSearchConditions(codeRaw: string, bookingsTable: any) {
  const { codes, bookingId } = ticketCodeCandidates(codeRaw);
  const conditions = [inArray(bookingsTable.booking_code, codes), inArray(bookingsTable.pay_txt_code, codes)];
  if (bookingId) conditions.push(eq(bookingsTable.id, bookingId));
  return or(...conditions);
}

/** Staff only see tickets of their branches (null = Super Admin, every branch). */
function withinBranches(condition: any, bookingsTable: any, restrictToBranchIds: number[] | null) {
  return restrictToBranchIds ? and(condition, inArray(bookingsTable.branch_id, restrictToBranchIds)) : condition;
}

/**
 * Finds the one order a code points to. Two different orders matching the same text (should never happen with exact
 * codes) is refused rather than guessed.
 */
async function findOrderByCode(
  anyDb: any,
  codeRaw: string,
  bookingsTable: any,
  restrictToBranchIds: number[] | null,
  columns?: Record<string, true>
) {
  const found = await anyDb.query.bookings.findMany({
    where: withinBranches(buildCodeSearchConditions(codeRaw, bookingsTable), bookingsTable, restrictToBranchIds),
    ...(columns ? { columns } : {}),
    limit: 2
  });
  if (!Array.isArray(found) || found.length === 0) return { booking: null, ambiguous: false };
  if (found.length > 1) return { booking: null, ambiguous: true };
  return { booking: found[0], ambiguous: false };
}

const AMBIGUOUS_CODE_MESSAGE = 'Mã khớp với nhiều đơn, vui lòng nhập đầy đủ mã vé hoặc mã thanh toán';

/** The order columns the ticket check screen reads (plus voucher_id, used to load the voucher rules). */
const TICKET_CHECK_COLUMNS: Record<string, true> = {
  id: true,
  booking_code: true,
  pay_txt_code: true,
  payment_status: true,
  payment_method: true,
  transaction_id: true,
  user_id: true,
  branch_id: true,
  name: true,
  phone: true,
  email: true,
  ticket_count: true,
  total_price: true,
  original_total_price: true,
  voucher_id: true,
  voucher_discount_amount: true,
  voucher_code_snapshot: true,
  booking_type: true,
  ticket_package_name: true,
  created_at: true,
  paid_at: true,
  expiry_date: true,
  is_used: true,
  checked_in_at: true
};

export async function getBookingByCodeImpl(
  anyDb: any,
  codeRaw: string,
  tables: { bookings: any; auditLogs?: any },
  restrictToBranchIds: number[] | null = null
) {
  const code = String(codeRaw || '');
  if (!code || code.trim() === '') return { status: 400, message: 'Thiếu mã vé' };
  const bookingsTable = tables.bookings;

  const { booking, ambiguous } = await findOrderByCode(anyDb, code, bookingsTable, restrictToBranchIds, TICKET_CHECK_COLUMNS);
  if (ambiguous) return { status: 409, message: AMBIGUOUS_CODE_MESSAGE };
  if (!booking) return { status: 404, message: 'Không tìm thấy vé' };
  const now = new Date();
  const paidAt = booking.paid_at ? new Date(booking.paid_at) : null;
  const expiryAt = booking.expiry_date ? new Date(booking.expiry_date as any) : null;
  const isPaid = (booking.payment_status || '').toLowerCase() === 'paid';
  const expired = Boolean(expiryAt && now.getTime() > expiryAt.getTime());
  const valid = Boolean(isPaid && paidAt && expiryAt && !expired && !booking.is_used);
  const can_use = Boolean(valid);
  let vr_items: any[] = [];
  if ((tables as any).booking_vr_items) {
    try {
      const vrItems = (tables as any).booking_vr_items;
      // Only the columns the screen reads for a VR line
      vr_items = await anyDb
        .select({
          id: vrItems.id,
          vr_ticket_package_id: vrItems.vr_ticket_package_id,
          package_name: vrItems.package_name,
          quantity: vrItems.quantity,
          unit_price: vrItems.unit_price,
          discounted_unit_price: vrItems.discounted_unit_price,
          line_total: vrItems.line_total
        })
        .from(vrItems)
        .where(eq(vrItems.booking_id, booking.id));
    } catch {}
  }

  let branch_name = null;
  if (booking.branch_id && (tables as any).branches) {
    try {
      const br = await anyDb.query.branches.findFirst({
        where: eq((tables as any).branches.id, booking.branch_id),
        columns: { name: true }
      });
      branch_name = br?.name || null;
    } catch {}
  }

  // The latest "booking confirmed" email for this order: sent, failed, still pending, or never tried
  let email_status: { state: 'sent' | 'failed' | 'pending' | 'none'; at: string | null } = { state: 'none', at: null };
  if ((tables as any).email_logs) {
    try {
      const emailLogs = (tables as any).email_logs;
      const latest = await anyDb
        .select({ status: emailLogs.status, sent_at: emailLogs.sent_at, created_at: emailLogs.created_at })
        .from(emailLogs)
        .where(and(eq(emailLogs.booking_id, booking.id), eq(emailLogs.email_type, 'booking_confirmation')))
        .orderBy(desc(emailLogs.id))
        .limit(1);
      if (latest && latest[0]) {
        const state = String(latest[0].status || '').toLowerCase();
        email_status = {
          state: state === 'sent' || state === 'failed' ? state : 'pending',
          at: latest[0].sent_at || latest[0].created_at || null
        };
      }
    } catch {}
  }

  let voucher_details: { scope: string; applicable_ids: any } | null = null;
  if (booking.voucher_id && (tables as any).vouchers) {
    try {
      const v = await anyDb.query.vouchers.findFirst({
        where: eq((tables as any).vouchers.id, booking.voucher_id),
        columns: { scope: true }
      });
      if (v) {
        voucher_details = {
          scope: v.scope || 'all',
          // Packages the discount covers (empty = every package of the voucher's type)
          applicable_ids: voucherInvoicePackageIds(await readVoucherScope(anyDb, booking.voucher_id))
        };
      }
    } catch {}
  }

  // Who checked the ticket in: the bookings table has no column for it, so it is read from the audit log
  let checkedInByStaffName: string | null = null;
  if (booking.is_used && tables.auditLogs) {
    try {
      const [checkInLog] = await anyDb
        .select({ staffFullname: tables.auditLogs.staffFullname })
        .from(tables.auditLogs)
        .where(
          and(
            eq(tables.auditLogs.entityType, 'booking'),
            eq(tables.auditLogs.entityId, String(booking.id)),
            inArray(tables.auditLogs.action, ['check_in', 'force_checkin'])
          )
        )
        .orderBy(desc(tables.auditLogs.createdAt))
        .limit(1);
      checkedInByStaffName = checkInLog?.staffFullname || null;
    } catch (err) {
      console.error('Could not read who checked the ticket in:', err);
    }
  }

  return {
    status: 200,
    id: booking.id,
    booking_code: booking.booking_code,
    payment_status: booking.payment_status,
    user_id: booking.user_id,
    branch_id: booking.branch_id || null,
    branch_name: branch_name || (booking.branch_id ? `Chi nhánh #${booking.branch_id}` : null),
    name: booking.name,
    phone: booking.phone,
    email: booking.email,
    ticket_count: Number(booking.ticket_count),
    total_price: Number(booking.total_price),
    original_total_price: booking.original_total_price,
    voucher_discount_amount: booking.voucher_discount_amount,
    voucher_code_snapshot: booking.voucher_code_snapshot,
    booking_type: booking.booking_type,
    created_at: booking.created_at,
    paid_at: booking.paid_at,
    expiry_date: booking.expiry_date,
    payment_method: booking.payment_method,
    is_used: Boolean(booking.is_used),
    ticket_package_name: booking.ticket_package_name || '',
    valid,
    can_use,
    pay_txt_code: booking.pay_txt_code,
    // The bank's reference for the transfer, when one was recorded (shown to staff on the ticket check screen)
    transaction_id: booking.transaction_id || null,
    expired,
    checked_in_at: booking.checked_in_at,
    checked_in_by_staff_name: checkedInByStaffName,
    vr_items,
    voucher_details,
    email_status
  };
}

export async function confirmUseTicketImpl(
  anyDb: any,
  codeRaw: string,
  tables: { bookings: any; auditLogs?: any },
  restrictToBranchIds: number[] | null = null,
  allowExpired: boolean = false,
  staffInfo?: { id: number; email: string; fullname: string } | null
) {
  try {
    const code = String(codeRaw || '');
    if (!code || !code.trim()) return { status: 400, message: 'Vui lòng nhập mã vé' };
    const bookingsTable = tables.bookings;

    const { booking, ambiguous } = await findOrderByCode(anyDb, code, bookingsTable, restrictToBranchIds);
    if (ambiguous) return { status: 409, message: AMBIGUOUS_CODE_MESSAGE };
    if (!booking) return { status: 404, message: 'Không tìm thấy vé' };

    // Kiểm tra chi nhánh (RBAC)
    if (restrictToBranchIds) {
      if (!booking.branch_id || !restrictToBranchIds.includes(booking.branch_id)) {
        return { status: 403, message: 'Bạn không có quyền xác nhận vé thuộc chi nhánh khác' };
      }
    }
    const isPaid = (booking.payment_status || '').toLowerCase() === 'paid';
    if (!isPaid) return { status: 400, message: 'Vé chưa được thanh toán thành công' };
    if (booking.is_used) return { status: 400, message: 'Vé này đã được sử dụng trước đó' };

    const paidAt = booking.paid_at ? new Date(booking.paid_at) : null;
    const expiryAt = booking.expiry_date ? new Date(booking.expiry_date as any) : null;
    const expired = Boolean(expiryAt && Date.now() > expiryAt.getTime());

    if (expired && !allowExpired) {
      return { status: 400, message: 'Vé đã hết hạn sử dụng. Vui lòng bấm "Duyệt quá hạn" nếu muốn cho khách vào.' };
    }

    // Update booking (tương thích với D1/SQLite không hỗ trợ .returning())
    const updatedRes = await anyDb
      .update(bookingsTable)
      .set({
        is_used: true,
        updated_at: formatDateForDb(new Date()),
        checked_in_at: formatDateForDb(new Date())
      })
      .where(and(eq(bookingsTable.id, booking.id), eq(bookingsTable.is_used, false)))
      .returning();

    const updated = Array.isArray(updatedRes) ? updatedRes[0] : updatedRes;

    if (!updated) {
      const recheck = await anyDb.query.bookings.findFirst({ where: eq(bookingsTable.id, booking.id) });
      if (recheck?.is_used) {
        return { status: 400, message: 'Vé này vừa được quét sử dụng cách đây ít giây!' };
      }
      return { status: 500, message: 'Không thể cập nhật trạng thái vé' };
    }

    // Every check-in is written to the audit log (this is how the screen shows who checked a ticket in);
    // a check-in forced for an expired ticket gets its own action
    if (staffInfo && tables.auditLogs) {
      const isForced = expired && allowExpired;
      try {
        await logAuditAction(
          anyDb,
          tables.auditLogs,
          isForced ? 'force_checkin' : 'check_in',
          'booking',
          booking.id,
          isForced
            ? `Duyệt du di cho vé quá hạn vào cổng (Mã: ${booking.booking_code})`
            : `Xác nhận cho khách vào cổng (Mã: ${booking.booking_code})`,
          staffInfo.id,
          staffInfo.email,
          staffInfo.fullname,
          JSON.stringify({ is_used: false, expired }),
          JSON.stringify(isForced ? { is_used: true, forced_by: staffInfo.email } : { is_used: true })
        );
      } catch (err) {
        console.error('Audit log error on check-in:', err);
      }
    }

    return {
      status: 200,
      message: expired && allowExpired ? 'Đã duyệt du di cho vé quá hạn vào cổng' : 'Xác nhận sử dụng vé thành công',
      booking: {
        id: updated.id,
        is_used: updated.is_used,
        // The server's own check-in time and the staff member, so the screen does not use the browser clock
        checked_in_at: updated.checked_in_at,
        checked_in_by_staff_name: staffInfo?.fullname || null
      }
    };
  } catch (err: any) {
    const status = err?.status || 500;
    const message = err?.message || 'Lỗi máy chủ nội bộ';
    return { status, message };
  }
}
