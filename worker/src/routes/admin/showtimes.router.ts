import { Hono, Context } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../../../../shared/schema';
import { requireStaffAuth, requirePermission } from '../../middleware';
import { getRestrictBranchIds } from './admin-helpers';

import {
  listShowtimesImpl,
  createShowtimeImpl,
  copyShowtimesImpl,
  updateShowtimeImpl,
  deleteShowtimeImpl
} from '../../../../server/routes/admin/showtimes';

type Variables = { staffId?: number; staffEmail?: string; staffFullname?: string; isSuperAdmin?: boolean; staffPermissions?: Array<{ module: string; action: string }>; staffBranchIds?: number[]; };
const showtimesRouter = new Hono<{ Bindings: any; Variables: Variables }>();

showtimesRouter.get('/api/admin/showtimes', requireStaffAuth, requirePermission('showtimes', 'view'), async (c) => {
  try {
    const branchId = Number(c.req.query('branch_id') || 0);
    const db = drizzle(c.env.cinema_db, { schema });
    const r = await listShowtimesImpl(
      db,
      { showtimes: schema.showtimes, movies: schema.movies },
      branchId,
      getRestrictBranchIds(c)
    );
    const status = (r as any).statusCode || 200;
    return c.json(r, status >= 400 ? status : 200);
  } catch (err: any) {
    return c.json({ status: 'error', message: err.message || 'Lỗi máy chủ nội bộ' }, err.statusCode || 500);
  }
});

showtimesRouter.post('/api/admin/showtimes', requireStaffAuth, requirePermission('showtimes', 'create'), async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const db = drizzle(c.env.cinema_db, { schema });
    const staffId = c.get('staffId');
    const staffEmail = c.get('staffEmail');
    const staffFullname = c.get('staffFullname');
    const r = await createShowtimeImpl(
      db,
      {
        showtimes: schema.showtimes,
        movies: schema.movies,
        branches: schema.branches,
        auditLogs: schema.auditLogs
      },
      body,
      getRestrictBranchIds(c),
      { id: staffId, email: staffEmail, fullname: staffFullname }
    );
    const status = (r as any).statusCode || 200;
    return c.json(r, status >= 400 ? status : 200);
  } catch (err: any) {
    return c.json({ status: 'error', message: err.message || 'Lỗi máy chủ nội bộ' }, err.statusCode || 500);
  }
});

showtimesRouter.post('/api/admin/showtimes/copy', requireStaffAuth, requirePermission('showtimes', 'create'), async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const db = drizzle(c.env.cinema_db, { schema });
    const staffId = c.get('staffId');
    const staffEmail = c.get('staffEmail');
    const staffFullname = c.get('staffFullname');
    const r = await copyShowtimesImpl(
      db,
      { showtimes: schema.showtimes, auditLogs: schema.auditLogs },
      body,
      getRestrictBranchIds(c),
      { id: staffId, email: staffEmail, fullname: staffFullname }
    );
    const status = (r as any).statusCode || 200;
    return c.json(r, status >= 400 ? status : 200);
  } catch (err: any) {
    return c.json({ status: 'error', message: err.message || 'Lỗi máy chủ nội bộ' }, err.statusCode || 500);
  }
});

showtimesRouter.put('/api/admin/showtimes/:id', requireStaffAuth, requirePermission('showtimes', 'edit'), async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const body = await c.req.json().catch(() => ({}));
    const db = drizzle(c.env.cinema_db, { schema });
    const staffId = c.get('staffId');
    const staffEmail = c.get('staffEmail');
    const staffFullname = c.get('staffFullname');
    const r = await updateShowtimeImpl(
      db,
      { showtimes: schema.showtimes, movies: schema.movies, auditLogs: schema.auditLogs },
      id,
      body,
      getRestrictBranchIds(c),
      { id: staffId, email: staffEmail, fullname: staffFullname }
    );
    const status = (r as any).statusCode || 200;
    return c.json(r, status >= 400 ? status : 200);
  } catch (err: any) {
    return c.json({ status: 'error', message: err.message || 'Lỗi máy chủ nội bộ' }, err.statusCode || 500);
  }
});

showtimesRouter.delete('/api/admin/showtimes/:id', requireStaffAuth, requirePermission('showtimes', 'delete'), async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const db = drizzle(c.env.cinema_db, { schema });
    const staffId = c.get('staffId');
    const staffEmail = c.get('staffEmail');
    const staffFullname = c.get('staffFullname');
    const r = await deleteShowtimeImpl(
      db,
      { showtimes: schema.showtimes, auditLogs: schema.auditLogs },
      id,
      getRestrictBranchIds(c),
      { id: staffId, email: staffEmail, fullname: staffFullname }
    );
    const status = (r as any).statusCode || 200;
    return c.json(r, status >= 400 ? status : 200);
  } catch (err: any) {
    return c.json({ status: 'error', message: err.message || 'Lỗi máy chủ nội bộ' }, err.statusCode || 500);
  }
});

// ============================================================

export default showtimesRouter;
