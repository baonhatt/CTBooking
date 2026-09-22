import { Hono, Context } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../../../../shared/schema';
import { requireStaffAuth, requirePermission } from '../../middleware';
import { getRestrictBranchIds, getCloudHelpers } from './admin-helpers';



const getD1Tables = (schema: any) => ({ bookings: schema.bookings, users: schema.users, accounts: schema.accounts, movies: schema.movies, ticket_packages: schema.ticket_packages, email_logs: schema.email_logs, branches: schema.branches, showtimes: schema.showtimes });

import {
  createToyImpl,
  updateToyImpl,
  deleteToyImpl,
  restoreToyImpl,
  listDeletedToysImpl,
  listToysImpl,
  getToyImpl
} from '../../../../server/routes/admin/toys';
type Variables = { staffId?: number; staffEmail?: string; staffFullname?: string; isSuperAdmin?: boolean; staffPermissions?: Array<{ module: string; action: string }>; staffBranchIds?: number[]; };
const toysRouter = new Hono<{ Bindings: any; Variables: Variables }>();

toysRouter.post('/api/admin/toys', requireStaffAuth, requirePermission('toys', 'create'), async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });

    const body = await c.req.json().catch(() => ({}));

    const { uploader } = getCloudHelpers(c, c.env);

    const staffId = c.get('staffId');
    const staffEmail = c.get('staffEmail');
    const staffFullname = c.get('staffFullname');

    const r = await createToyImpl(
      db,
      { toys: schema.toys, auditLogs: schema.auditLogs },
      body as any,
      c.env,
      uploader,
      { id: staffId, email: staffEmail, fullname: staffFullname }
    );

    // --- LOGIC XÓA CACHE BẮT ĐẦU ---

    if (r) {
      const cache = (caches as any).default;

      const frontendOrigin = c.req.header('Origin');

      // Lấy domain backend tự động

      const backendOrigin = new URL(c.req.url).origin;

      const toytApiUrl = `${backendOrigin}/api/toys-active`;

      // 1. Xóa bản cache có Origin (dành cho trình duyệt/frontend)

      if (frontendOrigin) {
        c.executionCtx.waitUntil(
          cache.delete(
            new Request(toytApiUrl, {
              headers: { Origin: frontendOrigin }
            })
          )
        );
      }

      // 2. Xóa bản cache không có Origin (dành cho gọi trực tiếp/postman)

      c.executionCtx.waitUntil(cache.delete(new Request(toytApiUrl)));
    }

    // --- LOGIC XÓA CACHE KẾT THÚC ---

    return c.json(r, 201);
  } catch {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

toysRouter.put('/api/admin/toys/:id', requireStaffAuth, requirePermission('toys', 'edit'), async (c) => {
  try {
    const id = Number(c.req.param('id'));

    const db = drizzle(c.env.cinema_db, { schema });

    const body = await c.req.json().catch(() => ({}));

    const { uploader, deleter } = getCloudHelpers(c, c.env);

    const staffId = c.get('staffId');
    const staffEmail = c.get('staffEmail');
    const staffFullname = c.get('staffFullname');

    const r = await updateToyImpl(
      db,
      { toys: schema.toys, auditLogs: schema.auditLogs },
      id,
      body as any,
      c.env,
      uploader,
      deleter,
      { id: staffId, email: staffEmail, fullname: staffFullname }
    );

    if (!r) return c.json({ message: 'Không tìm thấy' }, 404);

    // --- LOGIC XÓA CACHE BẮT ĐẦU ---

    if (r) {
      const cache = (caches as any).default;

      const frontendOrigin = c.req.header('Origin');

      // Lấy domain backend tự động

      const backendOrigin = new URL(c.req.url).origin;

      const toytApiUrl = `${backendOrigin}/api/toys-active`;

      // 1. Xóa bản cache có Origin (dành cho trình duyệt/frontend)

      if (frontendOrigin) {
        c.executionCtx.waitUntil(
          cache.delete(
            new Request(toytApiUrl, {
              headers: { Origin: frontendOrigin }
            })
          )
        );
      }

      // 2. Xóa bản cache không có Origin (dành cho gọi trực tiếp/postman)

      c.executionCtx.waitUntil(cache.delete(new Request(toytApiUrl)));
    }

    // --- LOGIC XÓA CACHE KẾT THÚC ---

    return c.json(r, 200);
  } catch {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

toysRouter.delete('/api/admin/toys/:id', requireStaffAuth, requirePermission('toys', 'delete'), async (c) => {
  try {
    const id = Number(c.req.param('id'));

    const db = drizzle(c.env.cinema_db, { schema });

    const { deleter } = getCloudHelpers(c, c.env);

    const staffId = c.get('staffId');
    const staffEmail = c.get('staffEmail');
    const staffFullname = c.get('staffFullname');

    const r = await deleteToyImpl(db, { toys: schema.toys, auditLogs: schema.auditLogs }, id, c.env, deleter, {
      id: staffId,
      email: staffEmail,
      fullname: staffFullname
    });

    if (!r) return c.json({ message: 'Không tìm thấy' }, 404);

    // --- LOGIC XÓA CACHE BẮT ĐẦU ---

    if (r) {
      const cache = (caches as any).default;

      const frontendOrigin = c.req.header('Origin');

      // Lấy domain backend tự động

      const backendOrigin = new URL(c.req.url).origin;

      const toytApiUrl = `${backendOrigin}/api/toys-active`;

      // 1. Xóa bản cache có Origin (dành cho trình duyệt/frontend)

      if (frontendOrigin) {
        c.executionCtx.waitUntil(
          cache.delete(
            new Request(toytApiUrl, {
              headers: { Origin: frontendOrigin }
            })
          )
        );
      }

      // 2. Xóa bản cache không có Origin (dành cho gọi trực tiếp/postman)

      c.executionCtx.waitUntil(cache.delete(new Request(toytApiUrl)));
    }

    // --- LOGIC XÓA CACHE KẾT THÚC ---

    return c.json(r, 200);
  } catch {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

toysRouter.post('/api/admin/toys/:id/restore', requireStaffAuth, requirePermission('toys', 'restore'), async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const db = drizzle(c.env.cinema_db, { schema });
    const staffId = c.get('staffId');
    const staffEmail = c.get('staffEmail');
    const staffFullname = c.get('staffFullname');

    const r = await restoreToyImpl(db, { toys: schema.toys, auditLogs: schema.auditLogs }, id, {
      id: staffId,
      email: staffEmail,
      fullname: staffFullname
    });

    return c.json(r, 200);
  } catch (err: any) {
    return c.json({ status: 'error', message: err.message || 'Lỗi máy chủ nội bộ' }, err.statusCode || 500);
  }
});

toysRouter.get('/api/admin/deleted/toys', requireStaffAuth, requirePermission('toys', 'view_deleted'), async (c) => {
  try {
    const page = Number(c.req.query('page') || 1);
    const pageSize = Number(c.req.query('pageSize') || 10);
    const search = String(c.req.query('search') || '');

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await listDeletedToysImpl(db, { toys: schema.toys }, { page, pageSize, search });

    return c.json(r, 200);
  } catch (err) {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

// ===== BRANCHES (Batch 5) ===================================
// ============================================================


toysRouter.get('/api/admin/toys', requireStaffAuth, requirePermission('toys', 'view'), async (c) => {
  try {
    const page = Number(c.req.query('page') || 1);
    const pageSize = Number(c.req.query('pageSize') || 20);
    const q = String(c.req.query('q') || '');
    const status = String(c.req.query('status') || 'all');
    const db = drizzle(c.env.cinema_db, { schema });

    const r = await listToysImpl(db, { toys: schema.toys }, { page, pageSize, q, status });
    return c.json(r, 200);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

toysRouter.get('/api/admin/toys/:id', requireStaffAuth, requirePermission('toys', 'view'), async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const db = drizzle(c.env.cinema_db, { schema });

    const toy = await getToyImpl(db, { toys: schema.toys, auditLogs: schema.auditLogs }, id);
    if (!toy) return c.json({ message: 'Không tìm thấy' }, 404);

    return c.json({ toy }, 200);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});


export default toysRouter;
