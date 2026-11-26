import { Hono, Context, Next } from 'hono';
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
  getMovieByIdImpl,
  listAdminMoviesImpl
} from '../../../../server/routes/admin/movies';
import { clampPage } from '../../../../server/lib/paging';

const getD1Tables = (schema: any) => ({ bookings: schema.bookings, users: schema.users, accounts: schema.accounts, movies: schema.movies, ticket_packages: schema.ticket_packages, email_logs: schema.email_logs, branches: schema.branches, showtimes: schema.showtimes });

type Variables = { staffId?: number; staffEmail?: string; staffFullname?: string; isSuperAdmin?: boolean; staffPermissions?: Array<{ module: string; action: string }>; staffBranchIds?: number[]; };
const moviesRouter = new Hono<{ Bindings: any; Variables: Variables }>();

/** The most movies one picker request may load (the showtime form lists every active movie of a branch). */
export const MOVIE_PICKER_MAX_PAGE_SIZE = 500;

/** The rights that may read the movie list: the Movies screen, and the movie pickers of the showtime and ticket package forms. */
const MOVIE_LIST_PERMISSIONS: Array<[string, string]> = [
  ['movies', 'view'],
  ['showtimes', 'view'],
  ['tickets', 'view']
];

/**
 * The Movies screen needs movies.view. Picker mode (?picker=1) is also open to staff who may view showtimes or ticket
 * packages, because their forms pick a movie.
 */
async function requireMovieListPermission(c: Context, next: Next) {
  if (c.get('isSuperAdmin')) return next();
  const granted = (c.get('staffPermissions') as Array<{ module: string; action: string }> | undefined) || [];
  const allowed = c.req.query('picker') === '1' ? MOVIE_LIST_PERMISSIONS : MOVIE_LIST_PERMISSIONS.slice(0, 1);
  const ok = allowed.some(([module, action]) => granted.some((p) => p.module === module && p.action === action));
  if (!ok) return c.json({ status: 'error', message: 'Không có quyền thực hiện thao tác này' }, 403);
  return next();
}

moviesRouter.get('/api/admin/movies', requireStaffAuth, requireMovieListPermission, async (c) => {
  try {
    const isPicker = c.req.query('picker') === '1';
    const { page, pageSize } = clampPage(
      c.req.query('page'),
      c.req.query('pageSize'),
      isPicker ? { maxPageSize: MOVIE_PICKER_MAX_PAGE_SIZE } : {}
    );
    const statusRaw = String(c.req.query('status') || 'all');
    const status = statusRaw === 'active' || statusRaw === 'inactive' ? statusRaw : 'all';
    const branchRaw = c.req.query('branch_id');
    const branchNumber = Number(branchRaw);
    const branch_id = branchRaw && branchRaw !== 'all' && Number.isInteger(branchNumber) && branchNumber > 0 ? branchNumber : null;

    const db = drizzle(c.env.cinema_db, { schema });
    const r = await listAdminMoviesImpl(
      db,
      { movies: schema.movies },
      {
        page,
        pageSize,
        q: String(c.req.query('q') || ''),
        sort: String(c.req.query('sort') || 'updated_at'),
        dir: String(c.req.query('dir') || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc',
        status,
        branch_id,
        restrictToBranchIds: getRestrictBranchIds(c)
      }
    );
    return c.json(r, 200);
  } catch {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

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

      // The screen reads only the outcome and the message, not the movie row
      const payload = {
        status: status >= 400 ? 'error' : 'success',
        message: (r as any).message
      };

      // Không cần xóa cache: KV cache cho phim đã bị vô hiệu hóa hoàn toàn

      return c.json(payload, status);
    } catch (err: any) {
      // A refusal (403: another branch's movie) keeps its code and message
      if (err?.statusCode) return c.json({ status: 'error', message: err.message }, err.statusCode);
      return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
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
      const { page, pageSize } = clampPage(c.req.query('page'), c.req.query('pageSize'), { defaultPageSize: 10 });
      const search = String(c.req.query('search') || '');
      const branch_id = c.req.query('branch_id') ? Number(c.req.query('branch_id')) : null;
      const restrictBranchIds = getRestrictBranchIds(c);

      const db = drizzle(c.env.cinema_db, { schema });

      const r = await listDeletedMoviesImpl(
        db,
        { movies: schema.movies, staffs: schema.staffs },
        { page, pageSize, search, sort: String(c.req.query('sort') || ''), dir: String(c.req.query('dir') || ''), branch_id, restrictToBranchIds: restrictBranchIds }
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
