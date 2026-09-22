import { Hono, Context } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../../../../shared/schema';
import { requireStaffAuth, requirePermission } from '../../middleware';
import { getRestrictBranchIds } from './admin-helpers';

import {
  listRolesImpl,
  getRoleByIdImpl,
  createRoleImpl,
  updateRoleImpl,
  deleteRoleImpl,
  restoreRoleImpl,
  listDeletedRolesImpl,
  listPermissionsImpl
} from '../../../../server/routes/admin/roles';

type Variables = { staffId?: number; staffEmail?: string; staffFullname?: string; isSuperAdmin?: boolean; staffPermissions?: Array<{ module: string; action: string }>; staffBranchIds?: number[]; };
const rolesRouter = new Hono<{ Bindings: any; Variables: Variables }>();

rolesRouter.get('/api/admin/roles', requireStaffAuth, requirePermission('roles', 'view'), async (c) => {
  try {
    const page = Number(c.req.query('page') || '1');
    const pageSize = Number(c.req.query('pageSize') || '100');
    const q = c.req.query('q') || '';
    const isSystemParam = c.req.query('isSystem');
    const isSystem = isSystemParam === 'true' ? true : isSystemParam === 'false' ? false : undefined;

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await listRolesImpl(
      db,
      {
        roles: schema.roles,

        rolePermissions: schema.rolePermissions,

        permissions: schema.permissions
      },
      { page, pageSize, q, isSystem }
    );

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// GET /api/admin/roles/:id - Get role by ID

rolesRouter.get('/api/admin/roles/:id', requireStaffAuth, requirePermission('roles', 'view'), async (c) => {
  try {
    const id = Number(c.req.param('id'));

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await getRoleByIdImpl(
      db,
      {
        roles: schema.roles,

        rolePermissions: schema.rolePermissions,

        permissions: schema.permissions,

        auditLogs: schema.auditLogs
      },
      id
    );

    if (r.status === 'error') return c.json(r, 404);

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// POST /api/admin/roles - Create role

rolesRouter.post('/api/admin/roles', requireStaffAuth, requirePermission('roles', 'create'), async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));

    const db = drizzle(c.env.cinema_db, { schema });

    const staffId = c.get('staffId');

    const staffEmail = c.get('staffEmail');

    const staffFullname = c.get('staffFullname');

    const r = await createRoleImpl(
      db,
      {
        roles: schema.roles,

        rolePermissions: schema.rolePermissions,

        auditLogs: schema.auditLogs
      },
      body,
      { id: staffId, email: staffEmail, fullname: staffFullname }
    );

    if (r.status === 'error') return c.json(r, 400);

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// PUT /api/admin/roles/:id - Update role

rolesRouter.put('/api/admin/roles/:id', requireStaffAuth, requirePermission('roles', 'edit'), async (c) => {
  try {
    const id = Number(c.req.param('id'));

    const body = await c.req.json().catch(() => ({}));

    const db = drizzle(c.env.cinema_db, { schema });

    const staffId = c.get('staffId');

    const staffEmail = c.get('staffEmail');

    const staffFullname = c.get('staffFullname');

    const isSuperAdmin = Boolean(c.get('isSuperAdmin'));

    const r = await updateRoleImpl(
      db,
      {
        roles: schema.roles,

        rolePermissions: schema.rolePermissions,

        auditLogs: schema.auditLogs
      },
      id,
      body,
      { id: staffId, email: staffEmail, fullname: staffFullname, isSuperAdmin }
    );

    if (r.status === 'error') return c.json(r, 400);

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// DELETE /api/admin/roles/:id - Delete role

rolesRouter.delete('/api/admin/roles/:id', requireStaffAuth, requirePermission('roles', 'delete'), async (c) => {
  try {
    const id = Number(c.req.param('id'));

    const db = drizzle(c.env.cinema_db, { schema });

    const staffId = c.get('staffId');

    const staffEmail = c.get('staffEmail');

    const staffFullname = c.get('staffFullname');

    const r = await deleteRoleImpl(
      db,
      {
        roles: schema.roles,

        staffRoles: schema.staffRoles,

        auditLogs: schema.auditLogs
      },
      id,
      { id: staffId, email: staffEmail, fullname: staffFullname }
    );

    if (r.status === 'error') return c.json(r, 400);

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// POST /api/admin/roles/:id/restore
rolesRouter.post('/api/admin/roles/:id/restore', requireStaffAuth, requirePermission('roles', 'restore'), async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const db = drizzle(c.env.cinema_db, { schema });
    const staffId = c.get('staffId');
    const staffEmail = c.get('staffEmail');
    const staffFullname = c.get('staffFullname');

    const r = await restoreRoleImpl(db, { roles: schema.roles, auditLogs: schema.auditLogs }, id, {
      id: staffId,
      email: staffEmail,
      fullname: staffFullname
    });

    return c.json(r, 200);
  } catch (err: any) {
    return c.json({ status: 'error', message: err.message || 'Lỗi máy chủ nội bộ' }, err.statusCode || 500);
  }
});

// GET /api/admin/deleted/roles
rolesRouter.get('/api/admin/deleted/roles', requireStaffAuth, requirePermission('roles', 'view_deleted'), async (c) => {
  try {
    const page = Number(c.req.query('page') || 1);
    const pageSize = Number(c.req.query('pageSize') || 10);
    const search = String(c.req.query('search') || '');

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await listDeletedRolesImpl(
      db,
      { roles: schema.roles, staffs: schema.staffs },
      { page, pageSize, search }
    );

    return c.json(r, 200);
  } catch (err) {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

rolesRouter.get('/api/admin/permissions', requireStaffAuth, requirePermission('roles', 'view'), async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });

    const r = await listPermissionsImpl(db, { permissions: schema.permissions });

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// ============================================================
// ===== VOUCHERS (Batch 7) ===================================
// ============================================================


export default rolesRouter;
