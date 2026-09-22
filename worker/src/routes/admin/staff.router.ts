import { Hono, Context } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../../../../shared/schema';
import { requireStaffAuth, requirePermission } from '../../middleware';
import { getMailer } from './admin-helpers';

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

staffRouter.get('/api/admin/staff', requireStaffAuth, requirePermission('staff', 'view'), async (c) => {
  try {
    const page = Number(c.req.query('page') || '1');

    const pageSize = Number(c.req.query('pageSize') || '20');

    const q = c.req.query('q') || '';
    const includeInactive = c.req.query('includeInactive') === 'true';
    const roleId = c.req.query('roleId') ? Number(c.req.query('roleId')) : undefined;
    const branchId = c.req.query('branchId') ? Number(c.req.query('branchId')) : undefined;

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
      { page, pageSize, q, includeInactive, roleId, branchId }
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

        branches: schema.branches
      },
      id
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

    const staffMailer = getMailer(c);

    const r = await createStaffImpl(
      db,
      {
        staffs: schema.staffs,
        staffRoles: schema.staffRoles,
        staffBranches: schema.staffBranches,
        email_logs: schema.email_logs,
        auditLogs: schema.auditLogs
      },
      null,
      body,
      {
        isSuperAdmin: c.get('isSuperAdmin'),
        branchIds: c.get('staffBranchIds') || [],
        id: c.get('staffId'),
        email: c.get('staffEmail'),
        fullname: c.get('staffFullname')
      },
      c.env,
      { waitUntil: (p) => c.executionCtx.waitUntil(p) },
      staffMailer
    );

    if (r.status === 'error') return c.json(r, 400);

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
      {
        isSuperAdmin: c.get('isSuperAdmin'),
        branchIds: c.get('staffBranchIds') || [],
        id: c.get('staffId'),
        email: c.get('staffEmail'),
        fullname: c.get('staffFullname')
      },
      c.env,
      { waitUntil: (p) => c.executionCtx.waitUntil(p) }
    );

    if (r.status === 'error') return c.json(r, 400);

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

    const staffId = c.get('staffId');
    const staffEmail = c.get('staffEmail');
    const staffFullname = c.get('staffFullname');

    const r = await deleteStaffImpl(db, { staffs: schema.staffs, auditLogs: schema.auditLogs }, id, {
      id: staffId,
      email: staffEmail,
      fullname: staffFullname
    });

    if (r.status === 'error') return c.json(r, 400);

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
    const staffId = c.get('staffId');
    const staffEmail = c.get('staffEmail');
    const staffFullname = c.get('staffFullname');

    const r = await restoreStaffImpl(db, { staffs: schema.staffs, auditLogs: schema.auditLogs }, id, {
      id: staffId,
      email: staffEmail,
      fullname: staffFullname
    });

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

    const r = await listDeletedStaffImpl(db, { staffs: schema.staffs }, { page, pageSize, search });

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

      const body = await c.req.json().catch(() => ({}));

      const db = drizzle(c.env.cinema_db, { schema });

      const staffMailer = getMailer(c);

      const r = await resetStaffPasswordImpl(
        db,
        {
          staffs: schema.staffs,
          staffTokens: schema.staffTokens,
          email_logs: schema.email_logs,
          auditLogs: schema.auditLogs
        },
        null,
        id,
        body,
        c.env,
        { waitUntil: (p) => c.executionCtx.waitUntil(p) },
        staffMailer
      );

      if (r.status === 'error') return c.json(r, 400);

      return c.json(r);
    } catch (err: any) {
      return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
    }
  }
);


export default staffRouter;
