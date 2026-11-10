import { Hono, Context } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../../../../shared/schema';
import { requireStaffAuth, requirePermission } from '../../middleware';
import { getRestrictBranchIds, getMailer } from './admin-helpers';



const getD1Tables = (schema: any) => ({
  bookings: schema.bookings,
  users: schema.users,
  accounts: schema.accounts,
  movies: schema.movies,
  ticket_packages: schema.ticket_packages,
  email_logs: schema.email_logs,
  branches: schema.branches,
  showtimes: schema.showtimes,
  booking_vr_items: (schema as any).booking_vr_items,
  vouchers: (schema as any).vouchers,
  voucher_redemption_logs: (schema as any).voucher_redemption_logs,
  auditLogs: (schema as any).auditLogs
});

import { getBookingEmailTemplate } from '../../../../server/lib/email-templates';
import { logSystemError } from '../../utils';
import { getRevenueImpl, listTransactionsImpl, getTransactionByIdImpl } from '../../../../server/routes/admin/payments';
import { checkSepayTransactionImpl } from '../../../../server/routes/admin/sepay';
import { confirmBookingImpl } from '../../../../server/routes/admin/confirm-booking';
import { clampPage, EXPORT_MAX_ROWS, MAX_PAGE_SIZE } from '../../../../server/lib/paging';
import { resendBookingEmailImpl } from '../../../../server/routes/admin/resend-booking-email';
import { confirmUseTicketImpl, getBookingByCodeImpl } from '../../../../server/routes/user/booking/query';
type Variables = { staffId?: number; staffEmail?: string; staffFullname?: string; isSuperAdmin?: boolean; staffPermissions?: Array<{ module: string; action: string }>; staffBranchIds?: number[]; };
const paymentsRouter = new Hono<{ Bindings: any; Variables: Variables }>();

paymentsRouter.get('/api/admin/revenue', requireStaffAuth, requirePermission('dashboard', 'view_revenue'), async (c) => {
  try {
    const from = String(c.req.query('from') || '');

    const to = String(c.req.query('to') || '');

    const status = String(c.req.query('status') || 'paid');

    const db = drizzle(c.env.cinema_db, { schema });
    const restrictBranchIds = getRestrictBranchIds(c);

    const r = await getRevenueImpl(
      db,
      { bookings: schema.bookings },
      { from, to, status, restrictToBranchIds: restrictBranchIds }
    );

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

paymentsRouter.get('/api/admin/sepay/check', requireStaffAuth, requirePermission('ticket_check', 'validate'), async (c) => {
  try {
    const code = c.req.query('code') || '';
    const amount = Number(c.req.query('amount') || 0);

    const sepayToken = c.env.SEPAY_API_TOKEN;

    const r = await checkSepayTransactionImpl(code, amount, sepayToken);
    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// The filters of the transaction list, read from the query string. Used by the list and by the export.
function readTransactionFilters(c: any) {
  const searchText = String(c.req.query('searchText') || '');
  const status = String(c.req.query('status') || 'all');
  const sort = String(c.req.query('sort') || 'created_at');
  const dir = String(c.req.query('dir') || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
  const payment_method = String(c.req.query('payment_method') || '');
  const from = String(c.req.query('from') || '');
  const to = String(c.req.query('to') || '');
  const booking_type_raw = String(c.req.query('booking_type') || 'all');
  const booking_type = (['all', 'movie', 'vr'].includes(booking_type_raw) ? booking_type_raw : 'all') as 'all' | 'movie' | 'vr';
  const branch_id_raw = c.req.query('branch_id');
  const branch_id = branch_id_raw && branch_id_raw !== 'all' ? Number(branch_id_raw) : undefined;
  return { searchText, status, sort, dir, payment_method, from, to, booking_type, branch_id } as const;
}

const TRANSACTION_TABLES = {
  bookings: schema.bookings,
  users: schema.users,
  accounts: schema.accounts,
  movies: schema.movies,
  ticket_packages: schema.ticket_packages,
  vouchers: (schema as any).vouchers,
  booking_vr_items: (schema as any).booking_vr_items
};

paymentsRouter.get('/api/admin/transactions', requireStaffAuth, requirePermission('transactions', 'view'), async (c) => {
  try {
    // The page size is capped at 100 and a bad page number becomes 1
    const { page, pageSize } = clampPage(c.req.query('page'), c.req.query('pageSize'));
    const { searchText, status, sort, dir, payment_method, from, to, booking_type, branch_id } = readTransactionFilters(c);

    const db = drizzle(c.env.cinema_db, { schema });
    const restrictBranchIds = getRestrictBranchIds(c);

    const r = await listTransactionsImpl(
      db,
      {
        bookings: schema.bookings,
        users: schema.users,
        accounts: schema.accounts,
        movies: schema.movies,
        ticket_packages: schema.ticket_packages,
        vouchers: (schema as any).vouchers,
        booking_vr_items: (schema as any).booking_vr_items
      },
      {
        page,
        pageSize,

        searchText,

        status,

        sort,

        dir,

        payment_method,

        branch_id: branch_id,

        from,
        to,
        booking_type,
        restrictToBranchIds: restrictBranchIds
      }
    );

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// Registered BEFORE /api/admin/transactions/:id, otherwise ":id" would match the word "export".
// Export of the transaction list: at most 5000 rows, read in pages of 100. It tells the screen when it cut the list.
// Needs the export right (the screen already hides the button without it), not only the view right
paymentsRouter.get('/api/admin/transactions/export', requireStaffAuth, requirePermission('transactions', 'export'), async (c) => {
  try {
    const filters = readTransactionFilters(c);
    const db = drizzle(c.env.cinema_db, { schema });
    const restrictBranchIds = getRestrictBranchIds(c);

    const items: any[] = [];
    let total = 0;
    for (let page = 1; items.length < EXPORT_MAX_ROWS; page++) {
      const r: any = await listTransactionsImpl(db, TRANSACTION_TABLES, {
        page,
        pageSize: MAX_PAGE_SIZE,
        ...filters,
        branch_id: filters.branch_id,
        restrictToBranchIds: restrictBranchIds
      });
      total = r.total;
      items.push(...r.items);
      if (r.items.length < MAX_PAGE_SIZE) break;
    }
    const rows = items.slice(0, EXPORT_MAX_ROWS);
    return c.json({ items: rows, total, truncated: total > rows.length, limit: EXPORT_MAX_ROWS });
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

paymentsRouter.get(
  '/api/admin/transactions/:id',
  requireStaffAuth,
  requirePermission('transactions', 'view'),
  async (c) => {
    try {
      const id = Number(c.req.param('id'));

      const db = drizzle(c.env.cinema_db, { schema });
      const restrictBranchIds = getRestrictBranchIds(c);

      const r = await getTransactionByIdImpl(
        db,

        {
          bookings: schema.bookings,

          users: schema.users,

          accounts: schema.accounts,

          movies: schema.movies,

          ticket_packages: schema.ticket_packages,

          branches: schema.branches,
          auditLogs: schema.auditLogs,
          booking_vr_items: (schema as any).booking_vr_items,
          vouchers: (schema as any).vouchers,
          staffs: schema.staffs
        },
        id,
        restrictBranchIds
      );

      if (!r) return c.json({ message: 'Không tìm thấy' }, 404);

      return c.json(r);
    } catch (err: any) {
      return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
    }
  }
);

// ============================================================
// ===== SETTINGS & EMAIL LOGS ================================
// ============================================================


paymentsRouter.post('/api/admin/confirm-booking', requireStaffAuth, requirePermission('ticket_check', 'validate'), async (c) => {
  let body: any = {};

  try {
    const db = drizzle(c.env.cinema_db, { schema });

    const tables = getD1Tables(schema);

    body = await c.req.json().catch(() => ({}));

    const mailer = getMailer(c);

    const appBaseUrl = c.env.VITE_CLIENT_BASE_URL || 'https://cinesphere.com.vn';

    const renderBooking = (data: any) => getBookingEmailTemplate(appBaseUrl, data);

    // The staff member and branch scope come from the session, never from the request body
    const r = await confirmBookingImpl(
      db,

      tables,

      body as any,

      { id: c.get('staffId'), email: c.get('staffEmail'), fullname: c.get('staffFullname') },

      getRestrictBranchIds(c),

      mailer,

      renderBooking,

      c.executionCtx
    );

    const status = typeof (r as any).status === 'number' ? (r as any).status : 200;

    const payload = {
      ...(r as any),

      status: status >= 400 ? 'error' : 'success'
    };

    return c.json(payload, status as any);
  } catch (err: any) {
    logSystemError('confirm-booking', err, body);

    return c.json({ message: err?.message || 'Lỗi máy chủ nội bộ' }, 500);
  }
});

// Staff send the confirmation email of a paid order again. Uses the existing ticket_check.validate right.
paymentsRouter.post('/api/admin/bookings-resend-email', requireStaffAuth, requirePermission('ticket_check', 'validate'), async (c) => {
  let body: any = {};

  try {
    const db = drizzle(c.env.cinema_db, { schema });
    const tables = getD1Tables(schema);
    body = await c.req.json().catch(() => ({}));

    const appBaseUrl = c.env.VITE_CLIENT_BASE_URL || 'https://cinesphere.com.vn';
    const renderBooking = (data: any) => getBookingEmailTemplate(appBaseUrl, data);

    // The staff member and branch scope come from the session, never from the request body
    const r = await resendBookingEmailImpl(
      db,
      tables,
      body,
      { id: c.get('staffId'), email: c.get('staffEmail'), fullname: c.get('staffFullname') },
      getRestrictBranchIds(c),
      getMailer(c),
      renderBooking,
      c.executionCtx
    );

    const status = typeof (r as any).status === 'number' ? (r as any).status : 200;
    return c.json({ ...(r as any), status: status >= 400 ? 'error' : 'success' }, status as any);
  } catch (err: any) {
    logSystemError('resend-booking-email', err, body);
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

// Ticket checking control system
paymentsRouter.get('/api/admin/bookings-code/:code', requireStaffAuth, requirePermission('ticket_check', 'scan'), async (c) => {


  const db = drizzle(c.env.cinema_db, { schema });

  const tables = getD1Tables(schema);

  const code = String(c.req.param('code') || '');

  const r = await getBookingByCodeImpl(db, code, tables);

  const status = typeof (r as any).status === 'number' ? (r as any).status : 200;

  const payload = {
    ...(r as any),

    status: status >= 400 ? 'error' : 'success'
  };

  return c.json(payload, status as any);
});

paymentsRouter.post('/api/admin/bookings-use', requireStaffAuth, requirePermission('ticket_check', 'validate'), async (c) => {
  const db = drizzle(c.env.cinema_db, { schema });

  const tables = getD1Tables(schema);

  const body = await c.req.json().catch(() => ({}));

  const code = String((body as any)?.code || '');
  const allowExpired = Boolean((body as any)?.allow_expired);

  const restrictBranchIds = getRestrictBranchIds(c);
  const staffInfo = {
    id: c.get('staffId'),
    email: c.get('staffEmail'),
    fullname: c.get('staffFullname')
  };

  const r = await confirmUseTicketImpl(db, code, tables, restrictBranchIds, allowExpired, staffInfo);

  // The impl answers with a numeric HTTP status (400 for a ticket already used, 403, 404 ...). It used to be compared
  // with the word 'error', so a ticket that was already used was reported as a success.
  const rawStatus = (r as any)?.status;
  const status = typeof rawStatus === 'number' ? rawStatus : rawStatus === 'error' ? 400 : 200;

  const payload = {
    ...(r as any),

    status: status >= 400 ? 'error' : 'success'
  };

  return c.json(payload, status as any);
});

// ============================================================
// ===== PHASE 1: MISSING ADMIN GET ROUTES (Leak Fixed) =======
// ============================================================


export default paymentsRouter;
