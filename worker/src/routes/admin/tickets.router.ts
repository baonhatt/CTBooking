import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../../../../shared/schema';
import { requireStaffAuth, requirePermission } from '../../middleware';
import { getRestrictBranchIds } from './admin-helpers';

import {
  createTicketPackageImpl,
  updateTicketPackageImpl,
  deleteTicketPackageImpl,
  restoreTicketPackageImpl,
  listDeletedTicketPackagesImpl,
  toggleTicketStatusImpl,
  listTicketPackagesImpl,
  getTicketPackageImpl
} from '../../../../server/routes/admin/tickets';

const getD1Tables = (schema: any) => ({ bookings: schema.bookings, users: schema.users, accounts: schema.accounts, movies: schema.movies, ticket_packages: schema.ticket_packages, email_logs: schema.email_logs, branches: schema.branches, showtimes: schema.showtimes });

type Variables = { staffId?: number; staffEmail?: string; staffFullname?: string; isSuperAdmin?: boolean; staffPermissions?: Array<{ module: string; action: string }>; staffBranchIds?: number[]; };
const ticketsRouter = new Hono<{ Bindings: any; Variables: Variables }>();

ticketsRouter.post('/api/admin/tickets', requireStaffAuth, requirePermission('tickets', 'create'), async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });

    const body = await c.req.json().catch(() => ({}));

    const staffId = c.get('staffId');

    const staffEmail = c.get('staffEmail');

    const staffFullname = c.get('staffFullname');
    const restrictBranchIds = getRestrictBranchIds(c);

    const r = await createTicketPackageImpl(
      db,

      { ticket_packages: schema.ticket_packages, movies: schema.movies, auditLogs: schema.auditLogs },

      body as any,

      c.env,

      { id: staffId, email: staffEmail, fullname: staffFullname },
      restrictBranchIds
    );

    // Không cần xóa cache: KV cache cho vé đã bị vô hiệu hóa hoàn toàn

    return c.json(r, 201);
  } catch {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

ticketsRouter.put('/api/admin/tickets/:id', requireStaffAuth, requirePermission('tickets', 'edit'), async (c) => {
  try {
    const id = Number(c.req.param('id'));

    const db = drizzle(c.env.cinema_db, { schema });

    const body = await c.req.json().catch(() => ({}));

    const staffId = c.get('staffId');

    const staffEmail = c.get('staffEmail');

    const staffFullname = c.get('staffFullname');
    const restrictBranchIds = getRestrictBranchIds(c);

    const r = await updateTicketPackageImpl(
      db,

      { ticket_packages: schema.ticket_packages, movies: schema.movies, auditLogs: schema.auditLogs },

      id,

      body as any,

      c.env,

      { id: staffId, email: staffEmail, fullname: staffFullname },
      restrictBranchIds
    );

    if (!r) return c.json({ status: 'error', message: 'Không tìm thấy' }, 404);

    // Không cần xóa cache: KV cache cho vé đã bị vô hiệu hóa hoàn toàn

    return c.json(r, 200);
  } catch (err: any) {
    console.error('Error updating ticket package:', err);
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

ticketsRouter.delete('/api/admin/tickets/:id', requireStaffAuth, requirePermission('tickets', 'delete'), async (c) => {
  try {
    const id = Number(c.req.param('id'));

    const db = drizzle(c.env.cinema_db, { schema });

    const staffId = c.get('staffId');

    const staffEmail = c.get('staffEmail');

    const staffFullname = c.get('staffFullname');
    const restrictBranchIds = getRestrictBranchIds(c);

    const r = await deleteTicketPackageImpl(
      db,

      { ticket_packages: schema.ticket_packages, bookings: schema.bookings, auditLogs: schema.auditLogs },

      id,

      c.env,

      { id: staffId, email: staffEmail, fullname: staffFullname },
      restrictBranchIds
    );

    if (!r) return c.json({ status: 'error', message: 'Không tìm thấy' }, 404);

    // Không cần xóa cache: KV cache cho vé đã bị vô hiệu hóa hoàn toàn

    return c.json(r, 200);
  } catch {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

ticketsRouter.post(
  '/api/admin/tickets/:id/restore',
  requireStaffAuth,
  requirePermission('tickets', 'restore'),
  async (c) => {
    try {
      const id = Number(c.req.param('id'));
      const db = drizzle(c.env.cinema_db, { schema });
      const staffId = c.get('staffId');
      const staffEmail = c.get('staffEmail');
      const staffFullname = c.get('staffFullname');
      const restrictBranchIds = getRestrictBranchIds(c);

      const r = await restoreTicketPackageImpl(
        db,
        { ticket_packages: schema.ticket_packages, auditLogs: schema.auditLogs },
        id,
        { id: staffId, email: staffEmail, fullname: staffFullname },
        restrictBranchIds
      );

      return c.json(r, 200);
    } catch (err: any) {
      return c.json({ status: 'error', message: err.message || 'Lỗi máy chủ nội bộ' }, err.statusCode || 500);
    }
  }
);

ticketsRouter.get(
  '/api/admin/deleted/tickets',
  requireStaffAuth,
  requirePermission('tickets', 'view_deleted'),
  async (c) => {
    try {
      const page = Number(c.req.query('page') || 1);
      const pageSize = Number(c.req.query('pageSize') || 10);
      const search = String(c.req.query('search') || '');
      const branch_id = c.req.query('branch_id') ? Number(c.req.query('branch_id')) : null;
      const restrictBranchIds = getRestrictBranchIds(c);

      const db = drizzle(c.env.cinema_db, { schema });

      const r = await listDeletedTicketPackagesImpl(
        db,
        { ticket_packages: schema.ticket_packages, staffs: schema.staffs },
        { page, pageSize, search, branch_id, restrictToBranchIds: restrictBranchIds }
      );

      return c.json(r, 200);
    } catch (err) {
      return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
    }
  }
);

ticketsRouter.post(
  '/api/admin/tickets/:id/toggle-status',
  requireStaffAuth,
  requirePermission('tickets', 'toggle_status'),
  async (c) => {
    try {
      const id = Number(c.req.param('id'));
      const db = drizzle(c.env.cinema_db, { schema });
      const staffId = c.get('staffId');
      const staffEmail = c.get('staffEmail');
      const staffFullname = c.get('staffFullname');
      const restrictBranchIds = getRestrictBranchIds(c);

      const r = await toggleTicketStatusImpl(
        db,
        { ticket_packages: schema.ticket_packages, auditLogs: schema.auditLogs },
        id,
        c.env,
        { id: staffId, email: staffEmail, fullname: staffFullname },
        restrictBranchIds
      );

      return c.json(r, 200);
    } catch (err: any) {
      return c.json({ status: 'error', message: err.message || 'Lỗi máy chủ nội bộ' }, err.statusCode || 500);
    }
  }
);

// ============================================================

ticketsRouter.get('/api/admin/tickets', requireStaffAuth, requirePermission('tickets', 'view'), async (c) => {
  try {
    const page = Number(c.req.query('page') || 1);
    const pageSize = Number(c.req.query('pageSize') || 20);
    const q = String(c.req.query('q') || '');
    const includeInactive = c.req.query('includeInactive') === 'true';
    const typeRaw = c.req.query('type') || 'all';
    const type = typeRaw === 'movie' || typeRaw === 'vr' ? typeRaw : 'all';
    
    const db = drizzle(c.env.cinema_db, { schema });
    const restrictBranchIds = getRestrictBranchIds(c);
    const branchIdRaw = c.req.query('branch_id');
    const branchId = branchIdRaw && branchIdRaw !== 'all' ? Number(branchIdRaw) : undefined;

    const r = await listTicketPackagesImpl(
      db,
      { ticket_packages: schema.ticket_packages, movies: schema.movies },
      { page, pageSize, q, includeInactive, branch_id: branchId, restrictToBranchIds: restrictBranchIds, type }
    );
    return c.json(r, 200);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

ticketsRouter.get('/api/admin/tickets/:id', requireStaffAuth, requirePermission('tickets', 'view'), async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const db = drizzle(c.env.cinema_db, { schema });
    const restrictBranchIds = getRestrictBranchIds(c);

    const r = await getTicketPackageImpl(
      db,
      { ticket_packages: schema.ticket_packages, auditLogs: schema.auditLogs },
      id,
      restrictBranchIds
    );
    if (!r) return c.json({ message: 'Không tìm thấy' }, 404);
    return c.json(r, 200);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});


export default ticketsRouter;
