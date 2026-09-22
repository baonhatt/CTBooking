import { Hono, Context } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../../../../shared/schema';
import { requireStaffAuth, requirePermission } from '../../middleware';
import { getRestrictBranchIds } from './admin-helpers';



import { getEmailLogsImpl } from '../../../../server/routes/admin/email-logs';
import { getAuditLogsImpl } from '../../../../server/lib/audit-logger';
import { getUsersImpl, getUserByIdImpl } from '../../../../server/routes/admin/users';
import { getEmailPreviewImpl } from '../../../../server/routes/admin/email-preview';
type Variables = { staffId?: number; staffEmail?: string; staffFullname?: string; isSuperAdmin?: boolean; staffPermissions?: Array<{ module: string; action: string }>; staffBranchIds?: number[]; };
const logsRouter = new Hono<{ Bindings: any; Variables: Variables }>();

logsRouter.get('/api/admin/email-logs', requireStaffAuth, requirePermission('email_logs', 'view'), async (c) => {
  try {
    const status = c.req.query('status') || 'all';

    const email_type = c.req.query('email_type') || 'all';

    const search = c.req.query('search') || '';

    const page = Number(c.req.query('page') || 1);

    const limit = Number(c.req.query('limit') || 20);

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await getEmailLogsImpl(
      db,

      {
        email_logs: schema.email_logs,

        users: schema.users,

        bookings: schema.bookings
      },

      { status, email_type, search, page, limit }
    );

    return c.json(r, 200);
  } catch (err: any) {
    return c.json({ status: 'error', message: err?.message || 'Internal error' }, 500);
  }
});

// ============================================================
// ===== USERS (Admin View) ===================================
// ============================================================

logsRouter.get('/api/admin/users', requireStaffAuth, requirePermission('users', 'view'), async (c) => {
  try {
    const page = Number(c.req.query('page') || 1);

    const pageSize = Number(c.req.query('pageSize') || 20);

    const q = String(c.req.query('q') || '');

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await getUsersImpl(
      db,

      {
        users: schema.users,

        accounts: schema.accounts,

        bookings: schema.bookings
      },

      { page, pageSize, q }
    );

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

logsRouter.get('/api/admin/users/:id', requireStaffAuth, requirePermission('users', 'view_detail'), async (c) => {
  try {
    const id = Number(c.req.param('id'));

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await getUserByIdImpl(
      db,

      {
        users: schema.users,

        bookings: schema.bookings,

        movies: schema.movies,

        ticket_packages: schema.ticket_packages,

        auditLogs: schema.auditLogs
      },

      id
    );

    if (!r) return c.json({ status: 'error', message: 'Không tìm thấy' }, 404);

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});



// ============================================================
// ===== AUDIT LOGS ===========================================
// ============================================================

logsRouter.get('/api/admin/audit-logs', requireStaffAuth, requirePermission('audit_logs', 'view'), async (c) => {
  try {
    const page = Number(c.req.query('page') || '1');

    const pageSize = Number(c.req.query('pageSize') || '20');

    const module = c.req.query('module') || '';

    const action = c.req.query('action') || '';

    const staffId = c.req.query('staffId') ? Number(c.req.query('staffId')) : undefined;

    const from = c.req.query('from') || '';

    const to = c.req.query('to') || '';

    const search = c.req.query('search') || '';

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await getAuditLogsImpl(
      db,
      { auditLogs: schema.auditLogs },
      {
        page,
        pageSize,
        module,
        action,
        staffId,
        from,
        to,
        search
      }
    );

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// ============================================================
// ===== MOVIES (Batch 2) =====================================
// ============================================================

// ===== SHOWTIMES (Batch 3) ==================================
// ============================================================

// ===== TOYS & TICKETS (Batch 4) =============================
// ============================================================


logsRouter.get('/api/admin/email-preview', requireStaffAuth, requirePermission('email_logs', 'view'), async (c) => {
  try {
    const r = await getEmailPreviewImpl();
    return c.json(r, 200);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});



export default logsRouter;
