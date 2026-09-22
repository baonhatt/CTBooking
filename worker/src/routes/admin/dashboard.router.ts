import { Hono, Context } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../../../../shared/schema';
import { requireStaffAuth, requirePermission } from '../../middleware';
import { getRestrictBranchIds } from './admin-helpers';

import {
  getDashboardMetricsImpl,
  getRevenueByDateImpl,
  getRevenue7DaysImpl,
  getRevenueByMonthImpl
} from '../../../../server/routes/admin/dashboard';

type Variables = { staffId?: number; staffEmail?: string; staffFullname?: string; isSuperAdmin?: boolean; staffPermissions?: Array<{ module: string; action: string }>; staffBranchIds?: number[]; };
const dashboardRouter = new Hono<{ Bindings: any; Variables: Variables }>();

dashboardRouter.get('/api/admin/dashboard/metrics', requireStaffAuth, requirePermission('dashboard', 'view'), async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });

    const period = c.req.query('period') || 'week';

    const yearParam = c.req.query('year');

    const year = yearParam ? parseInt(yearParam) : undefined;
    const branchIdParam = c.req.query('branch_id');
    const branchId = branchIdParam && branchIdParam !== 'all' ? Number(branchIdParam) : undefined;
    const restrictBranchIds = getRestrictBranchIds(c);
    const branchIds =
      branchId !== undefined && !Number.isNaN(branchId)
        ? restrictBranchIds
          ? restrictBranchIds.filter((id) => id === branchId)
          : [branchId]
        : restrictBranchIds;

    const r = await getDashboardMetricsImpl(
      db,

      {
        movies: schema.movies,

        users: schema.users,

        bookings: schema.bookings,

        ticket_packages: schema.ticket_packages,

        toys: schema.toys,

        branches: schema.branches,

        booking_vr_items: schema.booking_vr_items,

        voucher_redemption_logs: schema.voucher_redemption_logs
      },

      period,

      year,
      branchIds
    );

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

dashboardRouter.get(
  '/api/admin/dashboard/revenue-date',
  requireStaffAuth,
  requirePermission('dashboard', 'view_revenue'),
  async (c) => {
    try {
      const date = String(c.req.query('date') || '');

      const status = String(c.req.query('status') || 'paid');

      const yearParam = c.req.query('year');

      const year = yearParam ? parseInt(yearParam) : undefined;
      const branchIdParam = c.req.query('branch_id');
      const branchId = branchIdParam && branchIdParam !== 'all' ? Number(branchIdParam) : undefined;
      const restrictBranchIds = getRestrictBranchIds(c);
      const branchIds =
        branchId !== undefined && !Number.isNaN(branchId)
          ? restrictBranchIds
            ? restrictBranchIds.filter((id) => id === branchId)
            : [branchId]
          : restrictBranchIds;

      const db = drizzle(c.env.cinema_db, { schema });

      const r = await getRevenueByDateImpl(db, { bookings: schema.bookings }, { date, status, year, branchIds });

      return c.json(r);
    } catch (err: any) {
      return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
    }
  }
);

dashboardRouter.get(
  '/api/admin/dashboard/revenue-7days',
  requireStaffAuth,
  requirePermission('dashboard', 'view_revenue'),
  async (c) => {
    try {
      const yearParam = c.req.query('year');

      const year = yearParam ? parseInt(yearParam) : undefined;
      const branchIdParam = c.req.query('branch_id');
      const branchId = branchIdParam && branchIdParam !== 'all' ? Number(branchIdParam) : undefined;
      const restrictBranchIds = getRestrictBranchIds(c);
      const branchIds =
        branchId !== undefined && !Number.isNaN(branchId)
          ? restrictBranchIds
            ? restrictBranchIds.filter((id) => id === branchId)
            : [branchId]
          : restrictBranchIds;

      const db = drizzle(c.env.cinema_db, { schema });

      const r = await getRevenue7DaysImpl(db, { bookings: schema.bookings }, year, branchIds);

      return c.json(r);
    } catch (err: any) {
      return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
    }
  }
);

dashboardRouter.get(
  '/api/admin/dashboard/revenue-month',
  requireStaffAuth,
  requirePermission('dashboard', 'view_revenue'),
  async (c) => {
    try {
      const year = String(c.req.query('year') || '');

      const month = String(c.req.query('month') || '');

      const status = String(c.req.query('status') || 'paid');
      const branchIdParam = c.req.query('branch_id');
      const branchId = branchIdParam && branchIdParam !== 'all' ? Number(branchIdParam) : undefined;
      const restrictBranchIds = getRestrictBranchIds(c);
      const branchIds =
        branchId !== undefined && !Number.isNaN(branchId)
          ? restrictBranchIds
            ? restrictBranchIds.filter((id) => id === branchId)
            : [branchId]
          : restrictBranchIds;

      const db = drizzle(c.env.cinema_db, { schema });

      const r = await getRevenueByMonthImpl(
        db,

        { bookings: schema.bookings },

        { year, month, status, branchIds }
      );

      return c.json(r);
    } catch (err: any) {
      return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
    }
  }
);

// ============================================================

export default dashboardRouter;
