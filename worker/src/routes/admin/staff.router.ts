import { Hono, Context } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../../../../shared/schema';
import { requireStaffAuth, requirePermission } from '../../middleware';
import { getRestrictBranchIds, getMailer } from './admin-helpers';
import { queueStaffCredentialsEmail, resolve_staff_login_url } from '../../../../server/lib/staff-credentials-mail';
import { getEmailBrand } from '../../../../server/lib/email-layout';
import { eq } from 'drizzle-orm';

import {
  listStaffImpl,
  getStaffByIdImpl,
  createStaffImpl,
  updateStaffImpl,
  deleteStaffImpl,
  restoreStaffImpl,
  listDeletedStaffImpl,
  resetStaffPasswordImpl
} from '../../../../server/routes/admin/staff-management';

type Variables = { staffId?: number; staffEmail?: string; staffFullname?: string; isSuperAdmin?: boolean; staffPermissions?: Array<{ module: string; action: string }>; staffBranchIds?: number[]; };
const staffRouter = new Hono<{ Bindings: any; Variables: Variables }>();

/**
 * Emails the staff member their login details, and keeps the password on screen for the Super Admin only.
 * The mail is queued: a failure to send is recorded in the email log, it does not fail the request.
 */
function sendCredentialsAndHidePassword(
  c: Context<any>,
  db: any,
  kind: 'created' | 'reset',
  staff: { id: number; email: string; fullname: string },
  result: any
) {
  const password = String(result?.generated_password || '');
  if (!password) return;

  const mailer = getMailer(c);
  // Outside a real worker request (tests) there is no execution context
  let context: { waitUntil: (promise: Promise<any>) => void } | undefined;
  try {
    context = c.executionCtx;
  } catch {}
  queueStaffCredentialsEmail({
    anyDb: db,
    emailLogsTable: schema.email_logs,
    kind,
    staff,
    password,
    loginUrl: resolve_staff_login_url(c.req.header('Origin'), getEmailBrand().clientBaseUrl),
    sendMailFn: mailer,
    context
  });

  // Only the Super Admin sees the password on screen; everyone else gets it by email only
  if (!c.get('isSuperAdmin')) delete result.generated_password;
}

/** The signed-in staff member, as the Impl functions expect it. */
function getCaller(c: Context<any>) {
  return {
    isSuperAdmin: c.get('isSuperAdmin'),
    branchIds: c.get('staffBranchIds') || [],
    id: c.get('staffId'),
    email: c.get('staffEmail'),
    fullname: c.get('staffFullname')
  };
}

/** 403 for a refusal by permission or scope, 400 for any other error. */
function errorStatus(result: { code?: string }) {
  return result.code === 'forbidden' ? 403 : 400;
}

staffRouter.get('/api/admin/staff', requireStaffAuth, requirePermission('staff', 'view'), async (c) => {
  try {
    const page = Number(c.req.query('page') || '1');

    const pageSize = Number(c.req.query('pageSize') || '20');

    const q = c.req.query('q') || '';
    const includeInactive = c.req.query('includeInactive') === 'true';
    const roleId = c.req.query('roleId') ? Number(c.req.query('roleId')) : undefined;
    const branchId = c.req.query('branchId') ? Number(c.req.query('branchId')) : undefined;
    const restrictToBranchIds = getRestrictBranchIds(c);

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await listStaffImpl(
      db,
      {
        staffs: schema.staffs,

        staffRoles: schema.staffRoles,

        roles: schema.roles,

        staffBranches: schema.staffBranches,

        branches: schema.branches
      },
      { page, pageSize, q, includeInactive, roleId, branchId, restrictToBranchIds }
    );

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// GET /api/admin/staff/:id - Get staff by ID

staffRouter.get('/api/admin/staff/:id', requireStaffAuth, requirePermission('staff', 'view'), async (c) => {
  try {
    const id = Number(c.req.param('id'));

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await getStaffByIdImpl(
      db,
      {
        staffs: schema.staffs,

        staffRoles: schema.staffRoles,

        roles: schema.roles,

        staffBranches: schema.staffBranches,

        branches: schema.branches,

        auditLogs: schema.auditLogs
      },
      id,
      getCaller(c)
    );

    if (r.status === 'error') return c.json(r, 404);

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// POST /api/admin/staff - Create staff

staffRouter.post('/api/admin/staff', requireStaffAuth, requirePermission('staff', 'create'), async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await createStaffImpl(
      db,
      {
        staffs: schema.staffs,
        staffRoles: schema.staffRoles,
        staffBranches: schema.staffBranches,
        auditLogs: schema.auditLogs
      },
      null,
      body,
      getCaller(c)
    );

    if (r.status === 'error') return c.json(r, errorStatus(r));

    // The account already exists at this point, so a problem with the mail must not fail the request
    try {
      if ((r as any).staff) sendCredentialsAndHidePassword(c, db, 'created', (r as any).staff, r);
    } catch (mailError) {
      console.error('[StaffCredentials] Could not queue the account email:', mailError);
    }

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// PUT /api/admin/staff/:id - Update staff

staffRouter.put('/api/admin/staff/:id', requireStaffAuth, requirePermission('staff', 'edit'), async (c) => {
  try {
    const id = Number(c.req.param('id'));

    const body = await c.req.json().catch(() => ({}));

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await updateStaffImpl(
      db,
      {
        staffs: schema.staffs,
        staffRoles: schema.staffRoles,
        staffBranches: schema.staffBranches,
        auditLogs: schema.auditLogs
      },
      null,
      id,
      body,
      getCaller(c)
    );

    if (r.status === 'error') return c.json(r, errorStatus(r));

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// DELETE /api/admin/staff/:id - Delete staff

staffRouter.delete('/api/admin/staff/:id', requireStaffAuth, requirePermission('staff', 'delete'), async (c) => {
  try {
    const id = Number(c.req.param('id'));

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await deleteStaffImpl(
      db,
      { staffs: schema.staffs, staffBranches: schema.staffBranches, auditLogs: schema.auditLogs },
      id,
      getCaller(c)
    );

    if (r.status === 'error') return c.json(r, errorStatus(r));

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// POST /api/admin/staff/:id/restore
staffRouter.post('/api/admin/staff/:id/restore', requireStaffAuth, requirePermission('staff', 'restore'), async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const db = drizzle(c.env.cinema_db, { schema });
    const r = await restoreStaffImpl(
      db,
      { staffs: schema.staffs, staffBranches: schema.staffBranches, auditLogs: schema.auditLogs },
      id,
      getCaller(c)
    );

    if (r.status === 'error') return c.json(r, errorStatus(r));

    return c.json(r, 200);
  } catch (err: any) {
    return c.json({ status: 'error', message: err.message || 'Lỗi máy chủ nội bộ' }, err.statusCode || 500);
  }
});

// GET /api/admin/deleted/staff
staffRouter.get('/api/admin/deleted/staff', requireStaffAuth, requirePermission('staff', 'view_deleted'), async (c) => {
  try {
    const page = Number(c.req.query('page') || 1);
    const pageSize = Number(c.req.query('pageSize') || 10);
    const search = String(c.req.query('search') || '');

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await listDeletedStaffImpl(
      db,
      { staffs: schema.staffs },
      { page, pageSize, search, sort: String(c.req.query('sort') || ''), dir: String(c.req.query('dir') || '') }
    );

    return c.json(r, 200);
  } catch (err) {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

// POST /api/admin/staff/:id/reset-password - Reset staff password

staffRouter.post(
  '/api/admin/staff/:id/reset-password',
  requireStaffAuth,
  requirePermission('staff', 'reset_password'),
  async (c) => {
    try {
      const id = Number(c.req.param('id'));

      const db = drizzle(c.env.cinema_db, { schema });

      const r = await resetStaffPasswordImpl(
        db,
        {
          staffs: schema.staffs,
          staffTokens: schema.staffTokens,
          auditLogs: schema.auditLogs
        },
        null,
        id,
        getCaller(c)
      );

      if (r.status === 'error') return c.json(r, errorStatus(r));

      // The password is already changed at this point, so a problem with the mail must not fail the request
      try {
        const [staffRow] = await db
          .select({ id: schema.staffs.id, email: schema.staffs.email, fullname: schema.staffs.fullname })
          .from(schema.staffs)
          .where(eq(schema.staffs.id, id))
          .limit(1);
        if (staffRow) sendCredentialsAndHidePassword(c, db, 'reset', staffRow, r);
      } catch (mailError) {
        console.error('[StaffCredentials] Could not queue the reset email:', mailError);
      }

      return c.json(r);
    } catch (err: any) {
      return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
    }
  }
);


export default staffRouter;
