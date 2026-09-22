import { Hono, Context } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../../../../shared/schema';
import { requireStaffAuth, requirePermission } from '../../middleware';
import { getRestrictBranchIds, getMailer } from './admin-helpers';



const getD1Tables = (schema: any) => ({ bookings: schema.bookings, users: schema.users, accounts: schema.accounts, movies: schema.movies, ticket_packages: schema.ticket_packages, email_logs: schema.email_logs, branches: schema.branches, showtimes: schema.showtimes });

import { getBookingEmailTemplate } from '../../../../server/lib/email-templates';
import { logSystemError } from '../../utils';
import { getRevenueImpl, listTransactionsImpl, getTransactionByIdImpl } from '../../../../server/routes/admin/payments';
import { checkSepayTransactionImpl } from '../../../../server/routes/admin/sepay';
import { updatePaymentImpl } from '../../../../server/routes/user/booking/update';
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

paymentsRouter.get('/api/admin/transactions', requireStaffAuth, requirePermission('transactions', 'view'), async (c) => {
  try {
    const page = Number(c.req.query('page') || 1);

    const pageSize = Number(c.req.query('pageSize') || 20);

    const searchText = String(c.req.query('searchText') || '');

    const status = String(c.req.query('status') || 'all');

    const sort = String(c.req.query('sort') || 'created_at');

    const dir = String(c.req.query('dir') || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';

    const payment_method = String(c.req.query('payment_method') || '');

    const from = String(c.req.query('from') || '');

    const to = String(c.req.query('to') || '');
    const booking_type_raw = String(c.req.query('booking_type') || 'all');
    const booking_type = (['all', 'movie', 'vr'].includes(booking_type_raw) ? booking_type_raw : 'all') as
      | 'all'
      | 'movie'
      | 'vr';
    const branch_id_raw = c.req.query('branch_id');
    const branch_id = branch_id_raw && branch_id_raw !== 'all' ? Number(branch_id_raw) : undefined;

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
          vouchers: (schema as any).vouchers
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

    const r = await updatePaymentImpl(
      db,

      body as any,

      mailer,

      renderBooking,

      tables,

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

  const status = (r as any)?.status === 'error' ? 400 : 200;

  const payload = {
    ...(r as any),

    status: status >= 400 ? 'error' : 'success'
  };

  return c.json(payload, status);
});

// ============================================================
// ===== PHASE 1: MISSING ADMIN GET ROUTES (Leak Fixed) =======
// ============================================================


export default paymentsRouter;
