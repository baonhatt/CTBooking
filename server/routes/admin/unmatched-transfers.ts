import { and, count, desc, eq, like, or, sql } from 'drizzle-orm';
import { formatDateForDb } from '../../lib/date-utils';
import { logAuditAction } from '../../lib/audit-logger';
import { confirmBookingImpl, type ConfirmStaff } from './confirm-booking';

/**
 * "Chuyển khoản chưa khớp": money that reached the bank account but matched no order (saved by the SePay webhook).
 * Staff either assign it to an order (the order becomes paid, like a manual confirmation) or set it aside with a note.
 *
 * In this file, in order: list, count of open ones (the red alert in the admin sidebar), assign, set aside.
 */

const MAX_PAGE_SIZE = 50;
const NOTE_MIN_LENGTH = 3;
const NOTE_MAX_LENGTH = 300;

type Tables = { unmatched_transfers: any; bookings: any; auditLogs?: any } & Record<string, any>;

export async function listUnmatchedTransfersImpl(
  db: any,
  tables: Tables,
  args: { status?: string; q?: string; page?: number; pageSize?: number }
) {
  const table = tables.unmatched_transfers;
  const status = ['open', 'matched', 'ignored'].includes(String(args.status)) ? String(args.status) : 'open';
  const page = Math.max(1, Number(args.page) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(args.pageSize) || 20));
  const conditions: any[] = [eq(table.status, status)];
  const search = String(args.q || '').trim();
  if (search) {
    // Staff look for a phone number, a name or an amount the customer wrote
    const pattern = `%${search}%`;
    conditions.push(or(like(table.content, pattern), like(table.bank_ref, pattern), sql`cast(${table.amount} as text) = ${search}`));
  }
  const where = and(...conditions);
  const [totalRow] = await db.select({ total: count() }).from(table).where(where);
  const rows = await db
    .select()
    .from(table)
    .where(where)
    .orderBy(desc(table.created_at))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  return { status: 200, items: rows, total: Number(totalRow?.total || 0), page, pageSize };
}

export async function countOpenUnmatchedTransfersImpl(db: any, tables: Tables) {
  const [row] = await db
    .select({ total: count() })
    .from(tables.unmatched_transfers)
    .where(eq(tables.unmatched_transfers.status, 'open'));
  return { status: 200, open_count: Number(row?.total || 0) };
}

/**
 * Assigns the transfer to the order with the given transfer code (CS...). The order must be unpaid and the amount
 * must cover its price; then it is confirmed exactly like the manual confirmation (ticket code, ticket email,
 * voucher use, branch check). The transfer is claimed first, so two staff members cannot assign it twice.
 */
export async function assignUnmatchedTransferImpl(
  db: any,
  tables: Tables,
  args: { id: number; pay_code?: unknown },
  staff: ConfirmStaff,
  restrictToBranchIds: number[] | null,
  sendMailFn?: (to: string, subject: string, html: string) => Promise<any>,
  getBookingEmailHtml?: (data: any) => string,
  context?: { waitUntil: (promise: Promise<any>) => void }
) {
  const table = tables.unmatched_transfers;
  const payCode = String(args.pay_code || '').trim().toUpperCase();
  if (!/^CS\d{6,20}$/.test(payCode)) {
    return { status: 400, message: 'Vui lòng nhập mã đơn dạng CS… (nội dung chuyển khoản của đơn).' };
  }

  const transfer = await db.query.unmatched_transfers.findFirst({ where: eq(table.id, args.id) });
  if (!transfer) return { status: 404, message: 'Không tìm thấy giao dịch.' };
  if (transfer.status !== 'open') return { status: 409, message: 'Giao dịch này đã được xử lý.' };

  const booking = await db.query.bookings.findFirst({ where: eq(tables.bookings.pay_txt_code, payCode) });
  if (!booking) return { status: 404, message: `Không tìm thấy đơn có mã ${payCode}.` };
  if (String(booking.payment_status || '').toLowerCase() === 'paid') {
    return { status: 409, message: `Đơn ${payCode} đã thanh toán rồi.` };
  }
  const needed = Number(booking.total_price || 0);
  if (Number(transfer.amount) < needed) {
    return {
      status: 400,
      message: `Số tiền chuyển (${Number(transfer.amount).toLocaleString('vi-VN')} ₫) thấp hơn giá đơn (${needed.toLocaleString('vi-VN')} ₫).`
    };
  }

  // Claim the transfer (only while still open)
  const now = formatDateForDb(new Date());
  const claimed = await db
    .update(table)
    .set({
      status: 'matched',
      booking_id: booking.id,
      resolved_by_staff_id: staff.id ?? null,
      resolved_by_name: staff.fullname || staff.email || null,
      resolved_at: now
    })
    .where(and(eq(table.id, transfer.id), eq(table.status, 'open')))
    .returning({ id: table.id });
  if (!Array.isArray(claimed) || claimed.length === 0) {
    return { status: 409, message: 'Giao dịch này vừa được người khác xử lý.' };
  }

  const confirmed: any = await confirmBookingImpl(
    db,
    tables,
    { payment_id: booking.id, payment_status: 'paid', transaction_id: transfer.bank_ref || transfer.sepay_id || undefined },
    staff,
    restrictToBranchIds,
    sendMailFn,
    getBookingEmailHtml,
    context
  );
  if (confirmed?.status !== 200) {
    // The order could not be confirmed (another branch, already paid meanwhile...): the transfer stays open
    await db
      .update(table)
      .set({ status: 'open', booking_id: null, resolved_by_staff_id: null, resolved_by_name: null, resolved_at: null })
      .where(eq(table.id, transfer.id));
    return { status: confirmed?.status || 500, message: confirmed?.message || 'Không xác nhận được đơn.' };
  }

  await writeAudit(
    db,
    tables,
    'unmatched_transfer_matched',
    transfer.id,
    `Gán chuyển khoản ${Number(transfer.amount).toLocaleString('vi-VN')} ₫ (mã GD ${transfer.bank_ref || transfer.sepay_id || 'không có'}) vào đơn ${payCode}.`,
    staff,
    { booking_id: booking.id, pay_txt_code: payCode, amount: transfer.amount, content: transfer.content }
  );
  return {
    status: 200,
    message: `Đã gán vào đơn ${payCode} và xác nhận thanh toán.`,
    booking_id: booking.id,
    voucher_slot_unavailable: confirmed?.voucher_slot_unavailable === true
  };
}

/** Sets the transfer aside (not ticket money, or refunded outside the system). A note is required. */
export async function ignoreUnmatchedTransferImpl(
  db: any,
  tables: Tables,
  args: { id: number; note?: unknown },
  staff: ConfirmStaff
) {
  const table = tables.unmatched_transfers;
  const note = String(args.note || '').trim();
  if (note.length < NOTE_MIN_LENGTH) return { status: 400, message: 'Vui lòng ghi lý do (ít nhất 3 ký tự).' };
  if (note.length > NOTE_MAX_LENGTH) return { status: 400, message: 'Lý do tối đa 300 ký tự.' };

  const changed = await db
    .update(table)
    .set({
      status: 'ignored',
      note,
      resolved_by_staff_id: staff.id ?? null,
      resolved_by_name: staff.fullname || staff.email || null,
      resolved_at: formatDateForDb(new Date())
    })
    .where(and(eq(table.id, args.id), eq(table.status, 'open')))
    .returning({ id: table.id, amount: table.amount, bank_ref: table.bank_ref });
  if (!Array.isArray(changed) || changed.length === 0) {
    return { status: 409, message: 'Giao dịch không còn ở trạng thái chưa xử lý.' };
  }
  await writeAudit(db, tables, 'unmatched_transfer_ignored', args.id, `Bỏ qua chuyển khoản #${args.id}: ${note}`, staff, {
    note
  });
  return { status: 200, message: 'Đã bỏ qua giao dịch.' };
}

async function writeAudit(
  db: any,
  tables: Tables,
  action: string,
  transferId: number,
  details: string,
  staff: ConfirmStaff,
  extra: Record<string, unknown>
) {
  if (!tables.auditLogs) return;
  try {
    await logAuditAction(
      db,
      tables.auditLogs,
      action,
      'unmatched_transfer',
      transferId,
      details,
      staff.id as number,
      staff.email || '',
      staff.fullname || '',
      undefined,
      JSON.stringify(extra)
    );
  } catch (error) {
    console.error('[UnmatchedTransfer] Audit log error:', error);
  }
}
