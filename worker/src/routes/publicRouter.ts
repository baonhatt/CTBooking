import { Hono } from 'hono';
import { isLocal, parseMediaUrl, logSystemError, withCache } from '../utils';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../../../shared/schema';
import { getAllActiveMoviesToday, listMovies, getMovie } from '../../../server/routes/user/movies';
import { getMovieByIdImpl } from '../../../server/routes/admin/movies';
import { getPublicScheduleImpl } from '../../../server/routes/user/showtimes';
import { listToysImpl, getToyImpl } from '../../../server/routes/admin/toys';
import { listActiveToys } from '../../../server/routes/user/toys';
import { sendMail } from '../../../server/routes/mail-service';
import { listSiteMediaImpl } from '../../../server/routes/admin/site-media';
import { listActiveTicketPackages } from '../../../server/routes/user/tickets';
import { listTicketPackagesImpl, getTicketPackageImpl } from '../../../server/routes/admin/tickets';
import { listPostsImpl, getPostImpl } from '../../../server/routes/admin/posts';
import {
  validateBookingImpl,
  createPaymentImpl,
  updatePaymentImpl,
  getBookingByIdImpl
} from '../../../server/routes/user/payments';

import {
  listActiveVRPackagesImpl,
  validateVRBookingImpl,
  createVRBookingImpl,
  getVRBookingByIdImpl
} from '../../../server/routes/user/vr-bookings';

import { validateVoucherForVRImpl } from '../../../server/routes/user/vouchers';

import {
  incrementPostViewImpl,
} from '../../../server/routes/admin/posts';

import {
  getBranchImpl,
  listBranchOptionsImpl,
  getDefaultBranchImpl
} from '../../../server/routes/admin/branches';


const publicRouter = new Hono<any>();

function stripAuditLogs(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => stripAuditLogs(item));
  }

  const clone: any = { ...obj };
  delete clone.created_at;
  delete clone.created_by;
  delete clone.updated_at;
  delete clone.updated_by;
  delete clone.created_by_staff_name;
  delete clone.updated_by_staff_name;
  delete clone.deleted_by_staff_id;

  for (const key in clone) {
    if (Object.prototype.hasOwnProperty.call(clone, key)) {
      clone[key] = stripAuditLogs(clone[key]);
    }
  }

  return clone;
}

// 3. Serve local uploads during development
publicRouter.get('/uploads/*', async (c) => {
  if (!isLocal(c.req.url)) return c.notFound();

  try {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const urlPath = new URL(c.req.url).pathname;
    const relativePath = urlPath.replace(/^\//, '');
    const filePath = path.resolve(process.cwd(), relativePath);

    // 1. Download if missing and on localhost
    if (!fs.existsSync(filePath)) {
      console.log(`[Worker Downloader] Missing file: ${urlPath}`);
      const cloudName = 'dzp3rbeix';
      const ext = path.extname(urlPath).toLowerCase();
      const isVideo = ['.mp4', '.webm', '.mov', '.m4v'].includes(ext);
      const resourceType = isVideo ? 'video' : 'image';
      const publicPath = urlPath.replace('/uploads/', '');
      const cloudinaryUrl = `https://res.cloudinary.com/${cloudName}/${resourceType}/upload/${publicPath}`;

      try {
        const targetDir = path.dirname(filePath);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        const response = await fetch(cloudinaryUrl);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          fs.writeFileSync(filePath, buffer);
          console.log(`[Worker Downloader] Saved to: ${filePath}`);
        } else {
          console.error(`[Worker Downloader] Cloudinary failed (${response.status}): ${cloudinaryUrl}`);
        }
      } catch (err) {
        console.error(`[Worker Downloader] Download Error:`, err);
      }
    }

    // 2. Serve the file
    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath).toLowerCase();
      const mimeMap: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.mov': 'video/quicktime'
      };

      return new Response(fs.readFileSync(filePath), {
        headers: {
          'Content-Type': mimeMap[ext] || 'application/octet-stream',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  } catch (err) {
    console.error('[Static Serve] Error:', err);
  }

  return c.notFound();
});

publicRouter.get('/', (c) => c.json({ ok: true, service: 'cinema-worker', time: Date.now() }));



const getD1Tables = (schema: any) => ({
  bookings: schema.bookings,
  users: schema.users,
  accounts: schema.accounts,
  movies: schema.movies,
  ticket_packages: schema.ticket_packages,
  email_logs: schema.email_logs,
  branches: schema.branches,
  booking_vr_items: schema.booking_vr_items,
  vouchers: schema.vouchers,
  voucher_redemption_logs: schema.voucher_redemption_logs
});

function getRestrictBranchIds(c: any): number[] | null {
  const isSuperAdmin = c.get('isSuperAdmin');
  const staffBranchIds = c.get('staffBranchIds') || [];
  return isSuperAdmin ? null : staffBranchIds;
}

publicRouter.get('/api/getActiveMovies', async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });

    // Rate limit check using KV

    const ip = c.req.header('CF-Connecting-IP') || 'unknown';

    // Không dùng KV cache: luôn truy vấn thẳng DB theo branch_id
    const branchId = c.req.query('branch_id') ? Number(c.req.query('branch_id')) : undefined;

    const { activeMovies } = await getAllActiveMoviesToday(
      db,
      {
        movies: schema.movies
      },
      branchId
    );
    const optimized = activeMovies.map((m) => {
      const opt = {
        ...m,
        cover_image: parseMediaUrl(m.cover_image ?? '', c)
      };
      delete (opt as any).detail_images;
      delete (opt as any).price;
      return opt;
    });

    const responseBody = JSON.stringify({ activeMovies: optimized });

    // Không ghi KV cache: trả thẳng kết quả từ DB
    return new Response(responseBody, {
      status: 200,

      headers: {
        'Content-Type': 'application/json',

        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',

        'Cloudflare-CDN-Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',

        Pragma: 'no-cache',

        Expires: '0',

        Vary: 'Origin',

        'X-KV-Cache': 'BYPASS'
      }
    });
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

publicRouter.post('/api/validate-booking', async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });

    const tables = getD1Tables(schema);

    const r = await validateBookingImpl(db, await c.req.json(), tables);

    const status = typeof (r as any).status === 'number' ? (r as any).status : 200;

    const payload = {
      ...(r as any),

      status: status >= 400 ? 'error' : 'success'
    };

    return c.json(payload, status as any);
  } catch (err: any) {
    const status = err?.status || 500;

    const message = err?.message || 'Lỗi máy chủ nội bộ';

    return c.json({ ok: false, message }, status);
  }
});

publicRouter.post('/api/create-booking', async (c) => {
  let body: any = {};

  try {
    const db = drizzle(c.env.cinema_db, { schema });

    const tables = getD1Tables(schema);

    body = await c.req.json().catch(() => ({}));

    // Pass schema tables to ensure correct schema is used (D1 schema instead of PostgreSQL)

    const r = await createPaymentImpl(db, body as any, tables);

    const status = typeof (r as any).status === 'number' ? (r as any).status : 200;

    const payload = {
      ...(r as any),

      status: status >= 400 ? 'error' : 'success'
    };

    return c.json(payload, status as any);
  } catch (err: any) {
    logSystemError('create-booking', err, body);

    const status = err?.status || 500;

    return c.json(
      {
        message: err?.message || 'Lỗi máy chủ nội bộ',

        error: String(err),

        cause: err?.cause ? String(err.cause) : undefined,

        stack: err?.stack || null
      },

      status
    );
  }
});

publicRouter.post('/api/cancel-booking', async (c) => {
  let body: any = {};
  try {
    const db = drizzle(c.env.cinema_db, { schema });
    const tables = getD1Tables(schema);
    body = await c.req.json().catch(() => ({}));

    // Force payment_status to 'failed' for safety so public users cannot confirm bookings
    const safeBody = {
      ...body,
      payment_status: 'failed'
    };

    const r = await updatePaymentImpl(db, safeBody as any, undefined, undefined, tables, c.executionCtx);

    const status = typeof (r as any).status === 'number' ? (r as any).status : 200;
    const payload = {
      ...(r as any),
      status: status >= 400 ? 'error' : 'success'
    };
    return c.json(payload, status as any);
  } catch (err: any) {
    logSystemError('cancel-booking', err, body);
    return c.json({ message: err?.message || 'Lỗi máy chủ nội bộ' }, 500);
  }
});

publicRouter.get('/api/bookings/:id', async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });

    const tables = getD1Tables(schema);

    const id = Number(c.req.param('id'));

    const r = await getBookingByIdImpl(db, id, tables);

    const status = typeof (r as any).status === 'number' ? (r as any).status : 200;

    const payload = {
      ...(r as any),

      status: status >= 400 ? 'error' : 'success'
    };

    return c.json(payload, status as any);
  } catch (err: any) {
    return c.json({ message: err?.message || 'Lỗi máy chủ nội bộ' }, 500);
  }
});

publicRouter.get('/api/movies', async (c) => {
  try {
    const page = Number(c.req.query('page') || 1);

    const pageSize = Number(c.req.query('pageSize') || 20);

    const q = String(c.req.query('q') || '').toLowerCase();

    const sortKey = String(c.req.query('sort') || 'updated_at');

    const dir = String(c.req.query('dir') || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';

    const status = String(c.req.query('status') || 'all');

    const branchIdRaw = c.req.query('branch_id');
    const branchId = branchIdRaw && branchIdRaw !== 'all' ? Number(branchIdRaw) : undefined;

    const db = drizzle(c.env.cinema_db, { schema });
    const restrictBranchIds = getRestrictBranchIds(c);

    const { items, total } = await listMovies(
      db,

      { movies: schema.movies },

      {
        page,
        pageSize,
        q,
        sort: sortKey,
        dir,
        status: status as any,
        branch_id: branchId,
        restrictToBranchIds: restrictBranchIds
      }
    );

    const parsedItems = items.map((m: any) => ({
      ...m,

      cover_image: parseMediaUrl(m.cover_image, c)
    }));

    return c.json({ items: parsedItems, page, pageSize, total }, 200);
  } catch {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});



publicRouter.get('/api/movies-detail/:id', async (c) => {
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

  const parsed = stripAuditLogs({
    ...r,
    cover_image: parseMediaUrl((r as any).cover_image, c)
  });
  
  delete parsed.detail_images;
  delete parsed.stats;
  delete parsed.applicable_packages;

  return new Response(JSON.stringify(parsed), {
    status: 200,

    headers: {
      'Content-Type': 'application/json',

      'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',

      'Cloudflare-CDN-Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',

      Pragma: 'no-cache',

      Expires: '0',

      Vary: 'Origin'
    }
  });
});
publicRouter.get('/api/schedule', async (c) => {
  try {
    const branchId = Number(c.req.query('branch_id') || 0);
    const db = drizzle(c.env.cinema_db, { schema });
    const r = await getPublicScheduleImpl(
      db,
      {
        showtimes: schema.showtimes,
        movies: schema.movies
      },
      branchId
    );
    return c.json(r, 200);
  } catch {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

publicRouter.get('/api/toys', async (c) => {
  try {
    const page = Number(c.req.query('page') || 1);

    const pageSize = Number(c.req.query('pageSize') || 20);

    const q = String(c.req.query('q') || '');

    const status = String(c.req.query('status') || 'all');

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await listToysImpl(db, { toys: schema.toys }, { page, pageSize, q, status });

    return c.json(
      stripAuditLogs({
        ...r,
        items: (r.items as any[]).map((t: any) => ({
          ...t,
          image: parseMediaUrl(t.image, c)
        }))
      }),
      200
    );
  } catch {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

publicRouter.get('/api/toys-active', async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });

    const r = await listActiveToys(db, { toys: schema.toys });

    const parsed = (r.items || []).map((t: any) => ({
      ...t,

      image: parseMediaUrl(t.image, c)
    }));

    return c.json(parsed, 200);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

publicRouter.get('/api/toys/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'));

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await getToyImpl(db, { toys: schema.toys, auditLogs: schema.auditLogs }, id);

    if (!r) return c.json({ message: 'Không tìm thấy' }, 404);

    const parsedToy = stripAuditLogs({
      ...r,
      image: parseMediaUrl((r as any).image, c)
    });
    return c.json({ toy: parsedToy }, 200);
  } catch {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});
publicRouter.get('/api/tickets', async (c) => {
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

    return c.json(stripAuditLogs(r), 200);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

publicRouter.get('/api/tickets-active', async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });

    const branchId = c.req.query('branch_id') ? Number(c.req.query('branch_id')) : undefined;

    const r = await listActiveTicketPackages(
      db,
      {
        ticket_packages: schema.ticket_packages,

        movies: schema.movies
      },
      branchId
    );

    const responseBody = JSON.stringify(r);

    // Không ghi KV cache: trả thẳng kết quả từ DB
    return new Response(responseBody, {
      status: 200,

      headers: {
        'Content-Type': 'application/json',

        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',

        'Cloudflare-CDN-Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',

        Pragma: 'no-cache',

        Expires: '0',

        Vary: 'Origin',

        'X-KV-Cache': 'BYPASS'
      }
    });
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

publicRouter.get('/api/tickets/:id', async (c) => {
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

    return c.json(stripAuditLogs(r), 200);
  } catch {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

publicRouter.get('/api/site-media', async (c) => {
  return await withCache(
    c.req.raw, // Đối tượng Request gốc

    c.env, // Các biến môi trường và bindings

    c.executionCtx, // Context để xử lý các tác vụ nền

    async () => {
      // Lấy các tham số từ query string

      const section = String(c.req.query('section') || '');

      const type = String(c.req.query('type') || '');

      const active = String(c.req.query('active') || '');

      // Khởi tạo Drizzle và truy vấn Database

      const db = drizzle(c.env.cinema_db, { schema });

      const r = await listSiteMediaImpl(db, { site_media: schema.site_media }, { section, type, active });

      const parsed = stripAuditLogs({
        ...r,
        items: (r.items as any[]).map((m: any) => ({
          ...m,
          url: parseMediaUrl(m.url, c)
        }))
      });

      return new Response(JSON.stringify(parsed), {
        status: 200,

        headers: {
          'Content-Type': 'application/json',

          'Cache-Control': 'public, s-maxage=300',

          'Cloudflare-CDN-Cache-Control': 'max-age=300',

          Vary: 'Origin'
        }
      });
    },

    900 // Thời gian cache là 900 giây (15 phút)
  );
});

publicRouter.get('/api/debug/mail', async (_c) => {
  return new Response(
    JSON.stringify({
      ok: true,

      message: 'Mail debug endpoint disabled in Worker'
    }),

    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
});


// ===== SITEMAP XML =====

publicRouter.get('/sitemap.xml', async (c) => {
  try {
    const baseUrl = (c.env.VITE_CLIENT_BASE_URL || 'https://cinesphere.com.vn').replace(/\/$/, '');

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await listPostsImpl(
      db,
      { posts: schema.posts, auditLogs: schema.auditLogs },
      { page: 1, pageSize: 1000, status: 'published' }
    );

    const posts = r.items as Array<{ id: number; slug?: string | null; updated_at?: string | null }>;

    const now = new Date().toISOString().split('T')[0];

    const staticPages = [
      { url: '/', priority: '1.0', changefreq: 'weekly' },

      { url: '/bai-viet', priority: '0.9', changefreq: 'daily' }
    ];

    const urlBlocks = [
      ...staticPages.map(
        (p) =>
          `  <url>\n    <loc>${baseUrl}${p.url}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>`
      ),

      ...posts.map((p) => {
        const slug = p.slug ? `${p.slug}-${p.id}` : String(p.id);

        const lastmod = p.updated_at ? String(p.updated_at).split('T')[0] : now;

        return `  <url>\n    <loc>${baseUrl}/bai-viet/${slug}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>`;
      })
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlBlocks.join('\n')}\n</urlset>`;

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',

        'Cache-Control': 'public, max-age=600'
      }
    });
  } catch {
    return new Response('Error generating sitemap', { status: 500 });
  }
});

publicRouter.get('/api/posts', async (c) => {
  try {
    const page = Number(c.req.query('page') || 1);

    const pageSize = Number(c.req.query('pageSize') || 10);

    const q = String(c.req.query('q') || '');

    const status = 'published';

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await listPostsImpl(
      db,
      { posts: schema.posts, auditLogs: schema.auditLogs },
      { page, pageSize, q, status }
    );

    const parsedItems = (r.items || []).map((p: any) => ({
      ...p,

      cover_image: parseMediaUrl(p.cover_image, c)
    }));

    return c.json(stripAuditLogs({ ...r, items: parsedItems }));
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// Public: Get post detail (by ID or Slug)

publicRouter.get('/api/posts/:identifier', async (c) => {
  try {
    const identifier = c.req.param('identifier');

    const db = drizzle(c.env.cinema_db, { schema });

    const post = await getPostImpl(db, { posts: schema.posts, auditLogs: schema.auditLogs }, identifier, true);

    if (!post) return c.json({ message: 'Không tìm thấy bài viết' }, 404);

    if (post.status !== 'published' && c.env.IS_PREVIEW !== 'true') {
      return c.json({ message: 'Bài viết không công khai' }, 403);
    }

    const parsed = stripAuditLogs({
      ...post,
      cover_image: parseMediaUrl(post.cover_image, c)
    });
    return c.json({ post: parsed }, 200);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

publicRouter.post('/api/posts/:id/view', async (c) => {
  try {
    const id = Number(c.req.param('id'));

    const db = drizzle(c.env.cinema_db, { schema });

    await incrementPostViewImpl(db, { posts: schema.posts, auditLogs: schema.auditLogs }, id);

    return c.json({ status: 'success' });
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// ============================================================
// ===== VR BOOKING ENDPOINTS =================================
// ============================================================

publicRouter.get('/api/vr/packages', async (c) => {
  try {
    const branchId = c.req.query('branch_id') ? Number(c.req.query('branch_id')) : undefined;
    const db = drizzle(c.env.cinema_db, { schema });

    const r = await listActiveVRPackagesImpl(db, { ticket_packages: schema.ticket_packages }, branchId);

    return c.json(r, 200 as any);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500 as any);
  }
});

publicRouter.post('/api/vr/voucher/validate', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const db = drizzle(c.env.cinema_db, { schema });

    const r = await validateVoucherForVRImpl(
      db,
      {
        vouchers: schema.vouchers,
        voucher_redemption_logs: schema.voucher_redemption_logs,
        ticket_packages: schema.ticket_packages
      },
      body
    );

    const stripped = stripAuditLogs(r);
    if (stripped.voucher_details) {
      delete stripped.voucher_details.sale_staff_id;
      delete stripped.voucher_details.sale_email;
      delete stripped.voucher_details.usage_limit;
      delete stripped.voucher_details.per_user_limit;
      delete stripped.voucher_details.used_count;
    }
    return c.json(stripped, 200 as any);
  } catch (err: any) {
    const errStatus = Number(err?.statusCode) || 500;
    return c.json({ valid: false, message: String(err?.message || 'Internal error') }, errStatus as any);
  }
});

publicRouter.post('/api/vr/validate-booking', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const db = drizzle(c.env.cinema_db, { schema });

    const r = await validateVRBookingImpl(db, body, {
      ticket_packages: schema.ticket_packages,
      vouchers: schema.vouchers,
      voucher_redemption_logs: schema.voucher_redemption_logs,
      users: schema.users
    });

    const status = Number(r.status) || 200;
    const clone = { ...r };
    delete clone.status;
    return c.json(clone, status as any);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500 as any);
  }
});

publicRouter.post('/api/vr/create-booking', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const db = drizzle(c.env.cinema_db, { schema });

    const r = await createVRBookingImpl(db, body, {
      ticket_packages: schema.ticket_packages,
      vouchers: schema.vouchers,
      voucher_redemption_logs: schema.voucher_redemption_logs,
      users: schema.users,
      bookings: schema.bookings,
      booking_vr_items: schema.booking_vr_items
    });

    const status = Number(r.status) || 200;
    const clone: any = { ...r };
    delete clone.status;
    return c.json(clone, status as any);
  } catch (err: any) {
    return c.json({ success: false, error: String(err?.message || 'Internal error') }, 500 as any);
  }
});

publicRouter.get('/api/vr/bookings/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const db = drizzle(c.env.cinema_db, { schema });

    const r = await getVRBookingByIdImpl(
      db,
      {
        bookings: schema.bookings,
        booking_vr_items: schema.booking_vr_items,
        voucher_redemption_logs: schema.voucher_redemption_logs
      },
      id
    );

    if (!r) return c.json({ message: 'Không tìm thấy booking VR' }, 404 as any);
    return c.json(r, 200 as any);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500 as any);
  }
});

// ============================================================
// ===== BRANCHES (Public) ====================================
// ============================================================

publicRouter.get('/api/branches/default', async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });

    const branch = await getDefaultBranchImpl(db, { branches: schema.branches });

    if (!branch) return c.json({ message: 'Không tìm thấy chi nhánh mặc định' }, 404);

    return c.json({ branch }, 200);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

publicRouter.get('/api/branches/options', async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });

    const r = await listBranchOptionsImpl(
      db,
      { branches: schema.branches },
      { includeInactive: false, onlyOpen: true }
    );

    return c.json(stripAuditLogs(r));
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

publicRouter.get('/api/branches/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const db = drizzle(c.env.cinema_db, { schema });

    const branch = await getBranchImpl(db, { branches: schema.branches, auditLogs: schema.auditLogs }, id);

    if (!branch || branch.deleted_at || !branch.is_active) {
      return c.json({ message: 'Không tìm thấy chi nhánh' }, 404);
    }

    return c.json({ branch: stripAuditLogs(branch) }, 200);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

publicRouter.get('/api/branches', async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });

    const r = await listBranchOptionsImpl(
      db,
      { branches: schema.branches },
      { includeInactive: false, onlyOpen: true }
    );

    return c.json({
      items: stripAuditLogs(r.items),
      page: 1,
      pageSize: r.items.length,
      total: r.items.length,
      totalPages: 1
    });
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

export default publicRouter;
