import { and, desc, eq, gte, inArray } from 'drizzle-orm';
import { logAuditAction } from '../../lib/audit-logger';
import { confirmBookingImpl, type ConfirmStaff } from './confirm-booking';
import { resendBookingEmailImpl } from './resend-booking-email';
import { countOpenUnmatchedTransfersImpl } from './unmatched-transfers';
import { chunk, clampPage, IN_QUERY_CHUNK } from '../../lib/paging';

/**
 * "Đơn cần xử lý": what staff must handle by hand, on one admin page with one red alert.
 *  - Unmatched transfers: their own table (unmatched-transfers.ts).
 *  - Orders not confirmed automatically: read from the audit lines the SePay webhook already writes
 *    (sepay_late_payment = after the 10 minutes, or the order was cancelled / expired, sepay_insufficient = short payment, sepay_duplicate = paid twice).
 *  - Emails that failed: the email_logs rows with status 'failed'.
 * No new table: an item counts as handled when an audit line 'action_item_resolved' points at it, or, for an order
 * that was too late or short, when the order has since become paid (for example confirmed on the invoices page).
 *
 * In this file, in order: constants, reading the items, the count for the sidebar, the actions.
 */

/** Items older than this are not listed (the audit and mail logs grow forever). */
const LOOKBACK_DAYS = 60;
/** Most rows read from a log at once; far above what a cinema produces in LOOKBACK_DAYS. */
const MAX_SCAN_ROWS = 1000;
const MAX_PAGE_SIZE = 50;
const NOTE_MIN_LENGTH = 3;
const NOTE_MAX_LENGTH = 300;

/** Audit actions that mean "money arrived but the order was not confirmed automatically" */
export const ORDER_ISSUE_ACTIONS = ['sepay_late_payment', 'sepay_insufficient', 'sepay_duplicate'] as const;
const RESOLVED_ACTION = 'action_item_resolved';
const ORDER_ENTITY = 'audit_log';
const EMAIL_ENTITY = 'email_log';

/** The one customer email that can be sent again: the ticket (the codes in OTP / reset emails have expired). */
const RESENDABLE_EMAIL_TYPE = 'booking_confirmation';

type Tables = {
  auditLogs: any;
  bookings: any;
  email_logs: any;
  unmatched_transfers?: any;
  branches?: any;
} & Record<string, any>;

const sinceIso = () => new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

/**
 * Ids per "IN (...)" when the query binds a few other values too (D1 allows only a limited number of bound values).
 * The resolution lookup binds each id twice (number and text), so it takes half of this.
 */
const IN_CHUNK_WITH_FILTERS = IN_QUERY_CHUNK - 10;

function parseJson(text: unknown): any {
  try {
    return typeof text === 'string' && text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

type Resolution = { by: string; at: string; note: string; how: string };

/** Runs one select per piece of `ids` and joins the rows. */
async function selectInChunks<T>(ids: T[], size: number, readPiece: (piece: T[]) => Promise<any[]>) {
  const rows: any[] = [];
  for (const piece of chunk(ids, size)) rows.push(...(await readPiece(piece)));
  return rows;
}

/** The "marked handled" audit lines of the given items, with the given columns */
function readResolutionLines(db: any, tables: Tables, entityType: string, ids: number[], columns: Record<string, any>) {
  return selectInChunks(ids, Math.floor(IN_CHUNK_WITH_FILTERS / 2), (piece) =>
    db
      .select(columns)
      .from(tables.auditLogs)
      .where(
        and(
          eq(tables.auditLogs.action, RESOLVED_ACTION),
          eq(tables.auditLogs.entityType, entityType),
          // logAuditAction stores the id as text ('356'); match both forms so it works whatever the column holds
          inArray(tables.auditLogs.entityId, [...piece, ...piece.map(String)] as any)
        )
      )
  );
}

/** Which items of one kind were marked handled, with who / when / note */
async function readResolutions(db: any, tables: Tables, entityType: string, ids: number[]) {
  const resolved = new Map<number, Resolution>();
  if (ids.length === 0) return resolved;
  const rows = await readResolutionLines(db, tables, entityType, ids, {
    entityId: tables.auditLogs.entityId,
    staffFullname: tables.auditLogs.staffFullname,
    staffEmail: tables.auditLogs.staffEmail,
    createdAt: tables.auditLogs.createdAt,
    newValues: tables.auditLogs.newValues
  });
  for (const row of rows) {
    const extra = parseJson(row.newValues);
    resolved.set(Number(row.entityId), {
      by: row.staffFullname || row.staffEmail || '',
      at: row.createdAt,
      note: String(extra.note || ''),
      how: String(extra.how || 'handled')
    });
  }
  return resolved;
}

/** Only the ids that were marked handled (the sidebar count needs no names or notes) */
async function readResolvedIds(db: any, tables: Tables, entityType: string, ids: number[]) {
  if (ids.length === 0) return new Set<number>();
  const rows = await readResolutionLines(db, tables, entityType, ids, { entityId: tables.auditLogs.entityId });
  return new Set<number>(rows.map((row: any) => Number(row.entityId)));
}

const bookingIdsOf = (rows: any[], key: string) =>
  [...new Set(rows.map((row: any) => Number(row[key])).filter((id: number) => id > 0))] as number[];

/** The orders with the given ids, keyed by id, with the given columns */
async function readBookingsById(db: any, tables: Tables, ids: number[], columns: Record<string, any>) {
  const rows = await selectInChunks(ids, IN_QUERY_CHUNK, (piece) =>
    db.select(columns).from(tables.bookings).where(inArray(tables.bookings.id, piece))
  );
  return new Map<number, any>(rows.map((booking: any) => [Number(booking.id), booking]));
}

const isOutsideBranches = (branchId: unknown, restrictToBranchIds: number[] | null) =>
  restrictToBranchIds !== null && !restrictToBranchIds.includes(Number(branchId));

// ============================================================
// ORDERS NOT CONFIRMED AUTOMATICALLY
// ============================================================

/** One order issue as the server uses it. The list sends only the fields the screen reads (see toOrderRow). */
export interface OrderIssue {
  id: number; // the audit line id
  reason: string; // one of ORDER_ISSUE_ACTIONS
  reason_label: string;
  details: string;
  created_at: string;
  booking_id: number;
  pay_txt_code: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  payment_status: string;
  amount_received: number | null;
  amount_needed: number | null;
  bank_ref: string;
  resolved: Resolution | null;
}

const REASON_LABELS: Record<string, string> = {
  sepay_late_payment: 'Tiền về sau hạn',
  sepay_insufficient: 'Chuyển thiếu tiền',
  sepay_duplicate: 'Chuyển trùng (đơn đã thanh toán)'
};

/** The audit lines of orders not confirmed automatically, newest first. The details are read only when asked. */
function readOrderLines(db: any, tables: Tables, withDetails: boolean): Promise<any[]> {
  const columns: Record<string, any> = {
    id: tables.auditLogs.id,
    action: tables.auditLogs.action,
    entityId: tables.auditLogs.entityId,
    createdAt: tables.auditLogs.createdAt
  };
  if (withDetails) {
    columns.oldValues = tables.auditLogs.oldValues;
    columns.newValues = tables.auditLogs.newValues;
  }
  return db
    .select(columns)
    .from(tables.auditLogs)
    .where(and(inArray(tables.auditLogs.action, [...ORDER_ISSUE_ACTIONS]), gte(tables.auditLogs.createdAt, sinceIso())))
    .orderBy(desc(tables.auditLogs.createdAt))
    .limit(MAX_SCAN_ROWS);
}

/** An order that became paid settles a late or short payment (not a duplicate one) */
const isPaidSince = (booking: any, action: string) =>
  String(booking.payment_status || '').toLowerCase() === 'paid' && action !== 'sepay_duplicate';

async function readOrderIssues(db: any, tables: Tables, restrictToBranchIds: number[] | null): Promise<OrderIssue[]> {
  const lines = await readOrderLines(db, tables, true);
  if (lines.length === 0) return [];

  const bookingById = await readBookingsById(db, tables, bookingIdsOf(lines, 'entityId'), {
    id: tables.bookings.id,
    branch_id: tables.bookings.branch_id,
    payment_status: tables.bookings.payment_status,
    paid_at: tables.bookings.paid_at,
    pay_txt_code: tables.bookings.pay_txt_code,
    name: tables.bookings.name,
    email: tables.bookings.email,
    phone: tables.bookings.phone,
    total_price: tables.bookings.total_price
  });
  const resolutions = await readResolutions(db, tables, ORDER_ENTITY, lines.map((line: any) => Number(line.id)));

  const issues: OrderIssue[] = [];
  for (const line of lines) {
    const booking = bookingById.get(Number(line.entityId));
    if (!booking) continue;
    if (isOutsideBranches(booking.branch_id, restrictToBranchIds)) continue;
    const extra = parseJson(line.newValues);
    const resolution =
      resolutions.get(Number(line.id)) ||
      (isPaidSince(booking, line.action) ? { by: '', at: booking.paid_at || '', note: 'Đơn đã được xác nhận thanh toán', how: 'paid' } : null);
    issues.push({
      id: Number(line.id),
      reason: line.action,
      reason_label: REASON_LABELS[line.action] || line.action,
      details: line.oldValues || '',
      created_at: line.createdAt,
      booking_id: Number(booking.id),
      pay_txt_code: booking.pay_txt_code || '',
      customer_name: booking.name || '',
      customer_email: booking.email || '',
      customer_phone: booking.phone || '',
      payment_status: String(booking.payment_status || ''),
      amount_received: Number.isFinite(Number(extra.amount_received)) ? Number(extra.amount_received) : null,
      amount_needed: Number.isFinite(Number(extra.amount_needed)) ? Number(extra.amount_needed) : Number(booking.total_price || 0),
      bank_ref: String(extra.bank_ref || ''),
      resolved: resolution
    });
  }
  return issues;
}

/** How many order issues are still open: reads ids, branches and payment states only */
async function countOpenOrderIssues(db: any, tables: Tables, restrictToBranchIds: number[] | null) {
  const lines = await readOrderLines(db, tables, false);
  if (lines.length === 0) return 0;
  const bookingById = await readBookingsById(db, tables, bookingIdsOf(lines, 'entityId'), {
    id: tables.bookings.id,
    branch_id: tables.bookings.branch_id,
    payment_status: tables.bookings.payment_status
  });
  const stillOpen = lines.filter((line: any) => {
    const booking = bookingById.get(Number(line.entityId));
    return !!booking && !isOutsideBranches(booking.branch_id, restrictToBranchIds) && !isPaidSince(booking, line.action);
  });
  const resolvedIds = await readResolvedIds(db, tables, ORDER_ENTITY, stillOpen.map((line: any) => Number(line.id)));
  return stillOpen.filter((line: any) => !resolvedIds.has(Number(line.id))).length;
}

/** The fields of an order issue the "Đơn cần xử lý" screen reads */
const toOrderRow = (issue: OrderIssue) => ({
  id: issue.id,
  reason: issue.reason,
  reason_label: issue.reason_label,
  details: issue.details,
  created_at: issue.created_at,
  pay_txt_code: issue.pay_txt_code,
  customer_name: issue.customer_name,
  customer_email: issue.customer_email,
  customer_phone: issue.customer_phone,
  payment_status: issue.payment_status,
  amount_received: issue.amount_received,
  amount_needed: issue.amount_needed,
  bank_ref: issue.bank_ref,
  resolved: issue.resolved
});

// ============================================================
// EMAILS THAT FAILED
// ============================================================

/** One failed email as the server uses it. The list sends only the fields the screen reads (see toEmailRow). */
export interface EmailIssue {
  id: number;
  recipient: string;
  email_type: string;
  error_message: string;
  booking_id: number | null;
  created_at: string;
  can_resend: boolean;
  resolved: Resolution | null;
}

/** The failed emails of the lookback window, newest first. The error text is read only when asked. */
function readFailedEmails(db: any, tables: Tables, withDetails: boolean): Promise<any[]> {
  const columns: Record<string, any> = {
    id: tables.email_logs.id,
    recipient: tables.email_logs.recipient,
    email_type: tables.email_logs.email_type,
    booking_id: tables.email_logs.booking_id,
    created_at: tables.email_logs.created_at
  };
  if (withDetails) columns.error_message = tables.email_logs.error_message;
  return db
    .select(columns)
    .from(tables.email_logs)
    .where(and(eq(tables.email_logs.status, 'failed'), gte(tables.email_logs.created_at, sinceIso())))
    .orderBy(desc(tables.email_logs.created_at))
    .limit(MAX_SCAN_ROWS);
}

/**
 * The failed emails a staff member may see, each with the later successful send that settles it (if any).
 * Branch limits: a mail tied to an order follows that order's branch. A mail tied to no order (staff credentials, OTP,
 * password reset) is seen only by the Super Admin.
 */
async function readVisibleFailedEmails(db: any, tables: Tables, restrictToBranchIds: number[] | null, withDetails: boolean) {
  const failed = await readFailedEmails(db, tables, withDetails);
  if (failed.length === 0) return [];

  let visible = failed;
  if (restrictToBranchIds !== null) {
    const bookingById = await readBookingsById(db, tables, bookingIdsOf(failed, 'booking_id'), {
      id: tables.bookings.id,
      branch_id: tables.bookings.branch_id
    });
    visible = failed.filter((row: any) => {
      const booking = bookingById.get(Number(row.booking_id));
      return !!booking && !isOutsideBranches(booking.branch_id, restrictToBranchIds);
    });
  }
  if (visible.length === 0) return [];

  // A later email of the same kind to the same person that went out settles the failure
  const recipients = [...new Set(visible.map((row: any) => row.recipient))] as string[];
  const sentLater = await selectInChunks(recipients, IN_CHUNK_WITH_FILTERS, (piece) =>
    db
      .select({ recipient: tables.email_logs.recipient, email_type: tables.email_logs.email_type, created_at: tables.email_logs.created_at })
      .from(tables.email_logs)
      .where(and(eq(tables.email_logs.status, 'sent'), inArray(tables.email_logs.recipient, piece), gte(tables.email_logs.created_at, sinceIso())))
  );
  return visible.map((row: any) => ({
    row,
    laterSuccess: sentLater.find(
      (sent: any) => sent.recipient === row.recipient && sent.email_type === row.email_type && sent.created_at > row.created_at
    )
  }));
}

async function readEmailIssues(db: any, tables: Tables, restrictToBranchIds: number[] | null): Promise<EmailIssue[]> {
  const visible = await readVisibleFailedEmails(db, tables, restrictToBranchIds, true);
  const resolutions = await readResolutions(db, tables, EMAIL_ENTITY, visible.map(({ row }) => Number(row.id)));
  return visible.map(({ row, laterSuccess }) => {
    const bookingId = Number(row.booking_id) || null;
    return {
      id: Number(row.id),
      recipient: row.recipient,
      email_type: row.email_type,
      error_message: row.error_message || '',
      booking_id: bookingId,
      created_at: row.created_at,
      can_resend: row.email_type === RESENDABLE_EMAIL_TYPE && !!bookingId,
      resolved:
        resolutions.get(Number(row.id)) ||
        (laterSuccess ? { by: '', at: laterSuccess.created_at, note: 'Đã gửi lại thành công', how: 'sent_later' } : null)
    };
  });
}

/** How many failed emails are still open */
async function countOpenEmailIssues(db: any, tables: Tables, restrictToBranchIds: number[] | null) {
  const visible = await readVisibleFailedEmails(db, tables, restrictToBranchIds, false);
  const unsettled = visible.filter(({ laterSuccess }) => !laterSuccess).map(({ row }) => Number(row.id));
  const resolvedIds = await readResolvedIds(db, tables, EMAIL_ENTITY, unsettled);
  return unsettled.filter((id) => !resolvedIds.has(id)).length;
}

/** The fields of a failed email the "Đơn cần xử lý" screen reads */
const toEmailRow = (issue: EmailIssue) => ({
  id: issue.id,
  recipient: issue.recipient,
  email_type: issue.email_type,
  error_message: issue.error_message,
  created_at: issue.created_at,
  can_resend: issue.can_resend,
  resolved: issue.resolved
});

// ============================================================
// LISTS AND COUNT
// ============================================================

function page<T>(items: T[], args: { page?: number; pageSize?: number }) {
  const { page: pageNo, pageSize } = clampPage(args.page, args.pageSize, { maxPageSize: MAX_PAGE_SIZE });
  return { items: items.slice((pageNo - 1) * pageSize, pageNo * pageSize), total: items.length, page: pageNo, pageSize };
}

export async function listOrderIssuesImpl(
  db: any,
  tables: Tables,
  args: { status?: string; page?: number; pageSize?: number },
  restrictToBranchIds: number[] | null
) {
  const wantDone = args.status === 'done';
  const issues = (await readOrderIssues(db, tables, restrictToBranchIds)).filter((issue) => !!issue.resolved === wantDone);
  const result = page(issues, args);
  return { status: 200, ...result, items: result.items.map(toOrderRow) };
}

export async function listEmailIssuesImpl(
  db: any,
  tables: Tables,
  args: { status?: string; page?: number; pageSize?: number },
  restrictToBranchIds: number[] | null
) {
  const wantDone = args.status === 'done';
  const issues = (await readEmailIssues(db, tables, restrictToBranchIds)).filter((issue) => !!issue.resolved === wantDone);
  const result = page(issues, args);
  return { status: 200, ...result, items: result.items.map(toEmailRow) };
}

/**
 * The numbers behind the red alert in the admin sidebar (asked every minute). Reads only ids, states and branches,
 * never the notes, the error texts or whole rows.
 */
export async function countActionItemsImpl(db: any, tables: Tables, restrictToBranchIds: number[] | null) {
  const unmatched = tables.unmatched_transfers ? (await countOpenUnmatchedTransfersImpl(db, tables as any)).open_count : 0;
  const orders = await countOpenOrderIssues(db, tables, restrictToBranchIds);
  const emails = await countOpenEmailIssues(db, tables, restrictToBranchIds);
  return { status: 200, unmatched, orders, emails, total: unmatched + orders + emails };
}

// ============================================================
// ACTIONS
// ============================================================

async function markResolved(
  db: any,
  tables: Tables,
  entityType: string,
  id: number,
  staff: ConfirmStaff,
  note: string,
  how: string
) {
  await logAuditAction(
    db,
    tables.auditLogs,
    RESOLVED_ACTION,
    entityType,
    id,
    `Đã xử lý (${how}): ${note}`,
    staff.id as number,
    staff.email || '',
    staff.fullname || '',
    undefined,
    JSON.stringify({ note, how })
  );
}

const checkNote = (note: unknown) => {
  const text = String(note || '').trim();
  if (text.length < NOTE_MIN_LENGTH) return { error: 'Vui lòng ghi chú cách đã xử lý (ít nhất 3 ký tự).' };
  if (text.length > NOTE_MAX_LENGTH) return { error: 'Ghi chú tối đa 300 ký tự.' };
  return { text };
};

/** "Đã xử lý" on an order or an email, with the staff member's note */
export async function resolveActionItemImpl(
  db: any,
  tables: Tables,
  args: { kind: 'order' | 'email'; id: number; note?: unknown },
  staff: ConfirmStaff,
  restrictToBranchIds: number[] | null
) {
  const note = checkNote(args.note);
  if (note.error) return { status: 400, message: note.error };
  const issues =
    args.kind === 'order' ? await readOrderIssues(db, tables, restrictToBranchIds) : await readEmailIssues(db, tables, restrictToBranchIds);
  const issue = issues.find((item) => item.id === Number(args.id));
  if (!issue) return { status: 404, message: 'Không tìm thấy mục cần xử lý.' };
  if (issue.resolved) return { status: 409, message: 'Mục này đã được xử lý.' };
  await markResolved(db, tables, args.kind === 'order' ? ORDER_ENTITY : EMAIL_ENTITY, issue.id, staff, note.text as string, 'handled');
  return { status: 200, message: 'Đã đánh dấu đã xử lý.' };
}

/** "Xác nhận vé" on an order issue: the same manual confirmation as on the invoices page, with the bank reference */
export async function confirmOrderIssueImpl(
  db: any,
  tables: Tables,
  args: { id: number },
  staff: ConfirmStaff,
  restrictToBranchIds: number[] | null,
  sendMailFn?: (to: string, subject: string, html: string) => Promise<any>,
  getBookingEmailHtml?: (data: any) => string,
  context?: { waitUntil: (promise: Promise<any>) => void }
) {
  const issue = (await readOrderIssues(db, tables, restrictToBranchIds)).find((item) => item.id === Number(args.id));
  if (!issue) return { status: 404, message: 'Không tìm thấy mục cần xử lý.' };
  if (issue.resolved) return { status: 409, message: 'Mục này đã được xử lý.' };
  if (issue.payment_status.toLowerCase() === 'paid') {
    return { status: 409, message: 'Đơn đã thanh toán. Hãy kiểm tra và đánh dấu đã xử lý (ví dụ sau khi hoàn tiền phần chuyển trùng).' };
  }
  const confirmed: any = await confirmBookingImpl(
    db,
    tables,
    { payment_id: issue.booking_id, payment_status: 'paid', transaction_id: issue.bank_ref || undefined },
    staff,
    restrictToBranchIds,
    sendMailFn,
    getBookingEmailHtml,
    context
  );
  if (confirmed?.status !== 200) return { status: confirmed?.status || 500, message: confirmed?.message || 'Không xác nhận được đơn.' };
  await markResolved(db, tables, ORDER_ENTITY, issue.id, staff, 'Nhân viên xác nhận vé', 'confirmed');
  return { status: 200, message: `Đã xác nhận vé cho đơn ${issue.pay_txt_code}.`, voucher_slot_unavailable: confirmed?.voucher_slot_unavailable === true };
}

/** "Gửi lại mail vé" on a failed ticket email */
export async function resendEmailIssueImpl(
  db: any,
  tables: Tables,
  args: { id: number },
  staff: ConfirmStaff,
  restrictToBranchIds: number[] | null,
  sendMailFn?: (to: string, subject: string, html: string) => Promise<any>,
  getBookingEmailHtml?: (data: any) => string,
  context?: { waitUntil: (promise: Promise<any>) => void }
) {
  const issue = (await readEmailIssues(db, tables, restrictToBranchIds)).find((item) => item.id === Number(args.id));
  if (!issue) return { status: 404, message: 'Không tìm thấy mục cần xử lý.' };
  if (!issue.can_resend) return { status: 400, message: 'Loại email này không gửi lại được. Hãy đánh dấu đã xử lý.' };
  const resent: any = await resendBookingEmailImpl(
    db,
    tables,
    { booking_id: issue.booking_id },
    staff as any,
    restrictToBranchIds,
    sendMailFn,
    getBookingEmailHtml,
    context
  );
  if (resent?.status !== 200) return { status: resent?.status || 500, message: resent?.message || 'Không gửi lại được email.' };
  await markResolved(db, tables, EMAIL_ENTITY, issue.id, staff, 'Đã gửi lại email vé', 'resent');
  return { status: 200, message: 'Đã gửi lại email vé.' };
}
