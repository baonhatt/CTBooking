import { Hono, Context } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../../../../shared/schema';
import { requireStaffAuth, requirePermission } from '../../middleware';
import { getRestrictBranchIds, getCloudHelpers } from './admin-helpers';

import {
  createMovieImpl,
  updateMovieImpl,
  deleteMovieImpl,
  updateMovieStatusImpl,
  restoreMovieImpl,
  listDeletedMoviesImpl,
  getMovieByIdImpl
} from '../../../../server/routes/admin/movies';

const getD1Tables = (schema: any) => ({ bookings: schema.bookings, users: schema.users, accounts: schema.accounts, movies: schema.movies, ticket_packages: schema.ticket_packages, email_logs: schema.email_logs, branches: schema.branches, showtimes: schema.showtimes });

type Variables = { staffId?: number; staffEmail?: string; staffFullname?: string; isSuperAdmin?: boolean; staffPermissions?: Array<{ module: string; action: string }>; staffBranchIds?: number[]; };
const moviesRouter = new Hono<{ Bindings: any; Variables: Variables }>();

moviesRouter.post('/api/admin/movies', requireStaffAuth, requirePermission('movies', 'create'), async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));

    const db = drizzle(c.env.cinema_db, { schema });

    const config = {
      CLOUDINARY_API_KEY: c.env.CLOUDINARY_API_KEY,

      CLOUDINARY_API_SECRET: c.env.CLOUDINARY_API_SECRET,

      CLOUDINARY_CLOUD_NAME: c.env.CLOUDINARY_CLOUD_NAME
    };

    const cloud = getCloudHelpers(c, c.env);

    const staffId = c.get('staffId');

    const staffEmail = c.get('staffEmail');

    const staffFullname = c.get('staffFullname');
    const restrictBranchIds = getRestrictBranchIds(c);

    const r = await createMovieImpl(
      db,

      { movies: schema.movies, auditLogs: schema.auditLogs },

      body as any,

      undefined,

      undefined,

      cloud.uploader,

      { id: staffId, email: staffEmail, fullname: staffFullname },
      restrictBranchIds
    );

    // Không cần xóa cache: KV cache cho phim đã bị vô hiệu hóa hoàn toàn

    const status = (r as any)?.status === 'error' ? 400 : 200;

    const payload = {
      ...(r as any),

      status: status >= 400 ? 'error' : 'success'
    };

    return c.json(payload, status);
  } catch (err: any) {
    return c.json({ status: 'error', message: err?.message || 'Lỗi máy chủ nội bộ' }, err?.statusCode || 500);
  }
});

moviesRouter.put('/api/admin/movies/:id', requireStaffAuth, requirePermission('movies', 'edit'), async (c) => {
  try {
    const id = Number(c.req.param('id'));

    const body = await c.req.json().catch(() => ({}));

    const db = drizzle(c.env.cinema_db, { schema });

    const config = {
      CLOUDINARY_API_KEY: c.env.CLOUDINARY_API_KEY,

      CLOUDINARY_API_SECRET: c.env.CLOUDINARY_API_SECRET,

      CLOUDINARY_CLOUD_NAME: c.env.CLOUDINARY_CLOUD_NAME
    };

    const { uploader: localUploader, deleter: localDeleter } = getCloudHelpers(c, c.env);

    const staffId = c.get('staffId');

    const staffEmail = c.get('staffEmail');

    const staffFullname = c.get('staffFullname');
    const restrictBranchIds = getRestrictBranchIds(c);

    const r = await updateMovieImpl(
      db,

      { movies: schema.movies, ticket_packages: schema.ticket_packages, auditLogs: schema.auditLogs },

      id,

      body as any,

      undefined,

      c.env,

      localUploader,

      localDeleter,

      { id: staffId, email: staffEmail, fullname: staffFullname },
      restrictBranchIds
    );

    if (!r) return c.json({ status: 'error', message: 'Không tìm thấy' }, 404);

    // Không cần xóa cache: KV cache cho phim đã bị vô hiệu hóa hoàn toàn

    return c.json(r, 200);
  } catch (err: any) {
    console.error('[PUT /api/admin/movies/:id] Error:', err?.message || err, err?.stack);

    const msg = err?.message || 'Lỗi máy chủ nội bộ';

    // Ưu tiên dùng statusCode từ error object nếu có (ví dụ conflict packages = 400)

    const statusCode = err?.statusCode || (msg.includes('Không thể') || msg.includes('đang được sử dụng') ? 400 : 500);

    return c.json({ status: 'error', message: msg }, statusCode);
  }
});

moviesRouter.post(
  '/api/admin/movies-status/:id',
  requireStaffAuth,
  requirePermission('movies', 'toggle_status'),
  async (c) => {
    try {
      const id = Number(c.req.param('id'));

      const body: any = await c.req.json().catch(() => ({}));

      const is_active = body.is_active !== undefined ? body.is_active : false;

      const db = drizzle(c.env.cinema_db, { schema });

      const staffId = c.get('staffId');
      const staffEmail = c.get('staffEmail');
      const staffFullname = c.get('staffFullname');

      const r = await updateMovieStatusImpl(
        db,
        { movies: schema.movies, ticket_packages: schema.ticket_packages, auditLogs: schema.auditLogs },
        id,
        is_active,
        c.env,
        getRestrictBranchIds(c),
        { id: staffId, email: staffEmail, fullname: staffFullname }
      );

      const status = typeof (r as any).status === 'number' ? (r as any).status : 200;

      const payload = {
        ...(r as any),

        status: status >= 400 ? 'error' : 'success'
      };

      // Không cần xóa cache: KV cache cho phim đã bị vô hiệu hóa hoàn toàn

      return c.json(payload, status);
    } catch (err) {
      return new Response(JSON.stringify({ status: 'error', message: 'Lỗi máy chủ nội bộ' }), {
        status: 500,

        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
);

moviesRouter.delete('/api/admin/movies/:id', requireStaffAuth, requirePermission('movies', 'delete'), async (c) => {
  try {
    const id = Number(c.req.param('id'));

    const db = drizzle(c.env.cinema_db, { schema });

    const { deleter: localDeleter } = getCloudHelpers(c, c.env);

    const staffId = c.get('staffId');

    const staffEmail = c.get('staffEmail');

    const staffFullname = c.get('staffFullname');
    const restrictBranchIds = getRestrictBranchIds(c);

    const r = await deleteMovieImpl(
      db,
      { movies: schema.movies, auditLogs: schema.auditLogs, ticket_packages: schema.ticket_packages },
      id,
      c.env,
      localDeleter,
      { id: staffId, email: staffEmail, fullname: staffFullname },
      restrictBranchIds
    );

    if (!r) return c.json({ status: 'error', message: 'Không tìm thấy' }, 404);

    // Không cần xóa cache: KV cache cho phim đã bị vô hiệu hóa hoàn toàn

    return c.json(r, 200);
  } catch (err) {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

moviesRouter.post(
  '/api/admin/movies/:id/restore',
  requireStaffAuth,
  requirePermission('movies', 'restore'),
  async (c) => {
    try {
      const id = Number(c.req.param('id'));
      const db = drizzle(c.env.cinema_db, { schema });
      const staffId = c.get('staffId');
      const staffEmail = c.get('staffEmail');
      const staffFullname = c.get('staffFullname');
      const restrictBranchIds = getRestrictBranchIds(c);

      const r = await restoreMovieImpl(
        db,
        { movies: schema.movies, auditLogs: schema.auditLogs },
        id,
        {
          id: staffId,
          email: staffEmail,
          fullname: staffFullname
        },
        restrictBranchIds
      );

      return c.json(r, 200);
    } catch (err: any) {
      return c.json({ status: 'error', message: err.message || 'Lỗi máy chủ nội bộ' }, err.statusCode || 500);
    }
  }
);

moviesRouter.get(
  '/api/admin/deleted/movies',
  requireStaffAuth,
  requirePermission('movies', 'view_deleted'),
  async (c) => {
    try {
      const page = Number(c.req.query('page') || 1);
      const pageSize = Number(c.req.query('pageSize') || 10);
      const search = String(c.req.query('search') || '');
      const branch_id = c.req.query('branch_id') ? Number(c.req.query('branch_id')) : null;
      const restrictBranchIds = getRestrictBranchIds(c);

      const db = drizzle(c.env.cinema_db, { schema });

      const r = await listDeletedMoviesImpl(
        db,
        { movies: schema.movies, staffs: schema.staffs },
        { page, pageSize, search, branch_id, restrictToBranchIds: restrictBranchIds }
      );

      return c.json(r, 200);
    } catch (err) {
      return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
    }
  }
);

// ============================================================

moviesRouter.get('/api/admin/movies/:id', requireStaffAuth, requirePermission('movies', 'view'), async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const db = drizzle(c.env.cinema_db, { schema });
    const restrictBranchIds = getRestrictBranchIds(c);

    const r = await getMovieByIdImpl(
      db,
      {
        movies: schema.movies,
        bookings: schema.bookings,
        ticket_packages: schema.ticket_packages,
        auditLogs: schema.auditLogs
      },
      id,
      restrictBranchIds
    );

    if (!r) return c.json({ status: 'error', message: 'Không tìm thấy phim' }, 404);
    return c.json(r, 200);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});


export default moviesRouter;
