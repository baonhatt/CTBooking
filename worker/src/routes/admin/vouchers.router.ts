import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../../../../shared/schema';
import { requireStaffAuth, requirePermission } from '../../middleware';
import { getRestrictBranchIds } from './admin-helpers';

import {
  listVouchersImpl,
  getVoucherImpl,
  createVoucherImpl,
  updateVoucherImpl,
  toggleVoucherStatusImpl,
  deleteVoucherImpl,
  restoreVoucherImpl,
  listDeletedVouchersImpl
} from '../../../../server/routes/admin/vouchers';

type Variables = { staffId?: number; staffEmail?: string; staffFullname?: string; isSuperAdmin?: boolean; staffPermissions?: Array<{ module: string; action: string }>; staffBranchIds?: number[]; };
const vouchersRouter = new Hono<{ Bindings: any; Variables: Variables }>();

vouchersRouter.get('/api/admin/vouchers', requireStaffAuth, requirePermission('vouchers', 'view'), async (c) => {
  try {
    const page = Number(c.req.query('page') || 1);
    const pageSize = Number(c.req.query('pageSize') || 20);
    const q = String(c.req.query('q') || '');
    const scope = c.req.query('scope') || '';
    const is_active = c.req.query('is_active');
    const sale_staff_id = c.req.query('sale_staff_id');
    const restrictBranchIds = getRestrictBranchIds(c);

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await listVouchersImpl(
      db,
      { vouchers: schema.vouchers, voucher_redemption_logs: schema.voucher_redemption_logs },
      { page, pageSize, q, scope, is_active, sale_staff_id, restrictToBranchIds: restrictBranchIds }
    );

    return c.json(r, 200 as any);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500 as any);
  }
});

// GET /api/admin/vouchers/:id - Get voucher detail
vouchersRouter.get('/api/admin/vouchers/:id', requireStaffAuth, requirePermission('vouchers', 'view'), async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const restrictBranchIds = getRestrictBranchIds(c);
    const db = drizzle(c.env.cinema_db, { schema });

    const r = await getVoucherImpl(
      db,
      {
        vouchers: schema.vouchers,
        auditLogs: schema.auditLogs,
        voucher_redemption_logs: schema.voucher_redemption_logs
      },
      id,
      restrictBranchIds
    );

    if (!r) return c.json({ message: 'Voucher không tồn tại' }, 404 as any);
    return c.json(r, 200 as any);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500 as any);
  }
});

// POST /api/admin/vouchers - Create new voucher
vouchersRouter.post('/api/admin/vouchers', requireStaffAuth, requirePermission('vouchers', 'create'), async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const db = drizzle(c.env.cinema_db, { schema });

    const staffId = c.get('staffId');
    const staffEmail = c.get('staffEmail');
    const staffFullname = c.get('staffFullname');

    const r = await createVoucherImpl(db, { vouchers: schema.vouchers, auditLogs: schema.auditLogs }, body, {
      id: staffId,
      email: staffEmail,
      fullname: staffFullname
    });

    return c.json(r, 201 as any);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500 as any);
  }
});

// PUT /api/admin/vouchers/:id - Update voucher
vouchersRouter.put('/api/admin/vouchers/:id', requireStaffAuth, requirePermission('vouchers', 'edit'), async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const body = await c.req.json().catch(() => ({}));
    const restrictBranchIds = getRestrictBranchIds(c);
    const db = drizzle(c.env.cinema_db, { schema });

    const staffId = c.get('staffId');
    const staffEmail = c.get('staffEmail');
    const staffFullname = c.get('staffFullname');

    const r = await updateVoucherImpl(
      db,
      { vouchers: schema.vouchers, auditLogs: schema.auditLogs },
      id,
      body,
      { id: staffId, email: staffEmail, fullname: staffFullname },
      restrictBranchIds
    );

    return c.json(r, 200 as any);
  } catch (err: any) {
    const errStatus = Number(err?.statusCode) || 500;
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, errStatus as any);
  }
});

// POST /api/admin/vouchers/:id/toggle-status - Toggle active status
vouchersRouter.post(
  '/api/admin/vouchers/:id/toggle-status',
  requireStaffAuth,
  requirePermission('vouchers', 'toggle_status'),
  async (c) => {
    try {
      const id = Number(c.req.param('id'));
      const restrictBranchIds = getRestrictBranchIds(c);
      const db = drizzle(c.env.cinema_db, { schema });

      const staffId = c.get('staffId');
      const staffEmail = c.get('staffEmail');
      const staffFullname = c.get('staffFullname');

      const r = await toggleVoucherStatusImpl(
        db,
        { vouchers: schema.vouchers, auditLogs: schema.auditLogs },
        id,
        { id: staffId, email: staffEmail, fullname: staffFullname },
        restrictBranchIds
      );

      return c.json(r, 200 as any);
    } catch (err: any) {
      const errStatus = Number(err?.statusCode) || 500;
      return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, errStatus as any);
    }
  }
);

// DELETE /api/admin/vouchers/:id - Soft delete voucher
vouchersRouter.delete('/api/admin/vouchers/:id', requireStaffAuth, requirePermission('vouchers', 'delete'), async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const restrictBranchIds = getRestrictBranchIds(c);
    const db = drizzle(c.env.cinema_db, { schema });

    const staffId = c.get('staffId');
    const staffEmail = c.get('staffEmail');
    const staffFullname = c.get('staffFullname');

    const r = await deleteVoucherImpl(
      db,
      { vouchers: schema.vouchers, auditLogs: schema.auditLogs },
      id,
      { id: staffId, email: staffEmail, fullname: staffFullname },
      restrictBranchIds
    );

    if (!r) return c.json({ status: 'error', message: 'Voucher không tồn tại' }, 404 as any);
    return c.json(r, 200 as any);
  } catch (err: any) {
    const errStatus = Number(err?.statusCode) || 500;
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, errStatus as any);
  }
});

// POST /api/admin/vouchers/:id/restore - Restore deleted voucher
vouchersRouter.post(
  '/api/admin/vouchers/:id/restore',
  requireStaffAuth,
  requirePermission('vouchers', 'restore'),
  async (c) => {
    try {
      const id = Number(c.req.param('id'));
      const restrictBranchIds = getRestrictBranchIds(c);
      const db = drizzle(c.env.cinema_db, { schema });

      const staffId = c.get('staffId');
      const staffEmail = c.get('staffEmail');
      const staffFullname = c.get('staffFullname');

      const r = await restoreVoucherImpl(
        db,
        { vouchers: schema.vouchers, auditLogs: schema.auditLogs },
        id,
        { id: staffId, email: staffEmail, fullname: staffFullname },
        restrictBranchIds
      );

      return c.json(r, 200 as any);
    } catch (err: any) {
      const errStatus = Number(err?.statusCode) || 500;
      return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, errStatus as any);
    }
  }
);

// GET /api/admin/deleted/vouchers - List deleted vouchers (trash)
vouchersRouter.get(
  '/api/admin/deleted/vouchers',
  requireStaffAuth,
  requirePermission('vouchers', 'view_deleted'),
  async (c) => {
    try {
      const page = Number(c.req.query('page') || 1);
      const pageSize = Number(c.req.query('pageSize') || 10);
      const search = String(c.req.query('q') || c.req.query('search') || '');
      const scope = c.req.query('scope') || '';
      const restrictBranchIds = getRestrictBranchIds(c);

      const db = drizzle(c.env.cinema_db, { schema });

      const r = await listDeletedVouchersImpl(
        db,
        { vouchers: schema.vouchers },
        { page, pageSize, search, scope, restrictToBranchIds: restrictBranchIds }
      );

      return c.json(r, 200 as any);
    } catch (err: any) {
      return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500 as any);
    }
  }
);



export default vouchersRouter;
