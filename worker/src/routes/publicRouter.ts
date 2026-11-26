import { hasStaffSession } from '../middleware';
import { Hono } from 'hono';
import { isLocal, parseMediaUrl, logSystemError, withCache, getBookingEmailTemplate } from '../utils';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../../../shared/schema';
import { getAllActiveMoviesToday } from '../../../server/routes/user/movies';
import { getPublicScheduleImpl } from '../../../server/routes/user/showtimes';
import { sendMail } from '../../../server/routes/mail-service';
import { listActiveTicketPackages } from '../../../server/routes/user/tickets';
import {
  listPublicBranches,
  getPublicDefaultBranch,
  getPublicBranchPaymentInfo,
  getPublicMovieDetail,
  listPublicSiteMedia,
  toPublicTicketPackage,
  toPublicVrPackage
} from '../../../server/routes/user/public-catalog';
import { listPublicPosts, getPublicPost } from '../../../server/routes/user/public-posts';
import { clampPage } from '../../../server/lib/paging';
import { validateBookingImpl } from '../../../server/routes/user/booking/validate';
import { createPaymentImpl } from '../../../server/routes/user/booking/create';
import { updatePaymentImpl } from '../../../server/routes/user/booking/update';
import { payFreeOrderNow } from '../../../server/routes/user/booking/free-order';
import { getMailer } from './admin/admin-helpers';
import { findBookingForOwner, bookingStatusPayload } from '../../../server/routes/user/booking/access';
import { expireBookingIfOverdue, isOverduePending } from '../../../server/routes/scheduled/booking-expiry';
import { resolveOrderTokenSecret, makeOrderToken, ORDER_TOKEN_HEADER } from '../../../server/lib/order-token';
import { validateSessionTokenImpl } from '../../../server/routes/user/auth';
import { formatDateForDb } from '../../../server/lib/date-utils';
import { sanitizePostHtml } from '../../../server/lib/sanitize-html';

import {
  listActiveVRPackagesImpl,
  validateVRBookingImpl,
  createVRBookingImpl
} from '../../../server/routes/user/vr-bookings';

import { validateVoucherForVRImpl } from '../../../server/routes/user/vouchers';

import {
  incrementPostViewImpl,
} from '../../../server/routes/admin/posts';


const publicRouter = new Hono<any>();

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

/**
 * A 0đ order (100% test voucher) is paid at once: ticket code and ticket email, no bank transfer. The booking in the
 * reply then says payment_status 'paid' and carries the ticket code, so the page goes straight to the result.
 */
async function payIfFree(c: any, db: any, createdBooking: any) {
  if (!createdBooking?.id) return;
  const appBaseUrl = c.env.VITE_CLIENT_BASE_URL || 'https://cinesphere.com.vn';
  const paid = await payFreeOrderNow(
    db,
    { ...getD1Tables(schema), auditLogs: schema.auditLogs },
    Number(createdBooking.id),
    getMailer(c),
    (data: any) => getBookingEmailTemplate(appBaseUrl, data),
    c.executionCtx
  );
  if (paid) Object.assign(createdBooking, paid);
}

/**
 * The new order as the booking page reads it: the id, the payment reference and deadline, the order token and the
 * server clock, and (for a 0đ order paid at once) the payment state and ticket code. Nothing else of the row is sent.
 */
function toCustomerBooking(booking: any) {
  return {
    id: booking.id,
    pay_txt_code: booking.pay_txt_code,
    order_token: booking.order_token,
    payment_expires_at: booking.payment_expires_at ?? null,
    server_now: booking.server_now,
    payment_status: booking.payment_status ?? 'pending',
    booking_code: booking.booking_code || null
  };
}

/**
 * The secret that signs per-order tokens. Null when it is not configured (outside localhost).
 * Routes call this BEFORE touching the database, so a configuration mistake never leaves a half-created order.
 */
function readOrderTokenSecret(c: any): string | null {
  try {
    return resolveOrderTokenSecret(c.env, c.req.url);
  } catch (err) {
    logSystemError('order-token-secret', err);
    return null;
  }
}

const ORDER_SYSTEM_NOT_READY = 'Hệ thống chưa sẵn sàng nhận đặt vé. Vui lòng thử lại sau.';

/**
 * The order form plus who is really signed in (from the session, never from the form): member-only packages are
 * checked against it. Any signed_in_account_id the browser sent is overwritten.
 */
async function withSignedInAccount(c: any, db: any, body: any) {
  return { ...(body || {}), signed_in_account_id: await getOptionalAccountId(c, db) };
}

/**
 * Packages marked "chỉ thành viên" are shown only to a signed-in customer (or a signed-in staff member, for the admin
 * screens). Everybody else gets the list without them.
 */
async function withoutMemberOnlyForVisitors<T extends { is_member_only?: any }>(c: any, db: any, packages: T[]): Promise<T[]> {
  if (!packages.some((pkg) => pkg?.is_member_only)) return packages;
  if ((await getOptionalAccountId(c, db)) || (await hasStaffSession(c))) return packages;
  return packages.filter((pkg) => !pkg?.is_member_only);
}

/** The signed-in customer's account id, when the request carries a valid customer session. Never throws. */
async function getOptionalAccountId(c: any, db: any): Promise<number | null> {
  try {
    const token =
      c.req.header('cookie')?.match(/session_token=([^;]+)/)?.[1] || c.req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return null;
    const validation = await validateSessionTokenImpl(db, { tokens: schema.tokens }, token);
    return validation.valid ? (validation.accountId ?? null) : null;
  } catch {
    return null;
  }
}

publicRouter.get('/api/getActiveMovies', async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });

    // Không dùng KV cache: luôn truy vấn thẳng DB theo branch_id
    const branchId = c.req.query('branch_id') ? Number(c.req.query('branch_id')) : undefined;

    const { activeMovies } = await getAllActiveMoviesToday(
      db,
      {
        movies: schema.movies
      },
      branchId
    );
    const optimized = activeMovies.map((m) => ({
      ...m,
      cover_image: parseMediaUrl(m.cover_image ?? '', c)
    }));

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

    const r = await validateBookingImpl(db, await withSignedInAccount(c, db, await c.req.json().catch(() => ({}))), tables);

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
    const secret = readOrderTokenSecret(c);
    if (!secret) return c.json({ status: 'error', message: ORDER_SYSTEM_NOT_READY }, 500);

    const db = drizzle(c.env.cinema_db, { schema });

    const tables = getD1Tables(schema);

    body = await c.req.json().catch(() => ({}));

    // Pass schema tables to ensure correct schema is used (D1 schema instead of PostgreSQL)

    const r = await createPaymentImpl(db, (await withSignedInAccount(c, db, body)) as any, tables);

    const status = typeof (r as any).status === 'number' ? (r as any).status : 200;

    const payload: any = {
      ...(r as any),

      status: status >= 400 ? 'error' : 'success'
    };

    // The token proves "this is my order" to the status and cancel routes. The server clock lets the payment page
    // count down against the server's time.
    if (status === 201 && payload.booking?.pay_txt_code) {
      payload.booking.order_token = await makeOrderToken(secret, payload.booking.id, payload.booking.pay_txt_code);
      payload.booking.server_now = formatDateForDb(new Date());
      await payIfFree(c, db, payload.booking);
      payload.booking = toCustomerBooking(payload.booking);
    }

    return c.json(payload, status as any);
  } catch (err: any) {
    logSystemError('create-booking', err, body);

    // The reason stays in the server log. The customer gets no stack trace and no database text.
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

publicRouter.post('/api/cancel-booking', async (c) => {
  let body: any = {};
  try {
    const secret = readOrderTokenSecret(c);
    if (!secret) return c.json({ status: 'error', message: ORDER_SYSTEM_NOT_READY }, 500);

    const db = drizzle(c.env.cinema_db, { schema });
    const tables = getD1Tables(schema);
    body = await c.req.json().catch(() => ({}));

    // Only the person who placed the order can cancel it: the order token, or a signed-in owner account.
    // Anything else gets the same answer as an order that does not exist.
    const booking = await findBookingForOwner(db, tables, {
      bookingId: Number(body?.payment_id),
      orderToken: c.req.header(ORDER_TOKEN_HEADER),
      secret,
      accountId: await getOptionalAccountId(c, db)
    });
    if (!booking) {
      return c.json({ status: 'error', message: 'Không tìm thấy đặt vé' }, 404);
    }

    // A customer can only close an order, never confirm a payment. Nothing from the body except the booking id is used.
    // Past the 10 minutes (the payment page's countdown ran out) the order is 'expired'; before that, 'cancelled'.
    const closingStatus = isOverduePending(booking) ? 'expired' : 'cancelled';
    const r = await updatePaymentImpl(
      db,
      { payment_id: booking.id, payment_status: closingStatus },
      undefined,
      undefined,
      tables,
      c.executionCtx
    );

    // The callers read only the HTTP status (200 cancelled, 409 already paid): the booking row is not sent back
    const status = typeof (r as any).status === 'number' ? (r as any).status : 200;
    return c.json({ status: status >= 400 ? 'error' : 'success', message: (r as any).message }, status as any);
  } catch (err: any) {
    logSystemError('cancel-booking', err, body);
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

// The payment status of one order, for the payment page. It needs the order token (or a signed-in owner) and returns
// only the payment state, the deadline and the server clock: no name, phone, email or ticket code.
async function handleBookingStatus(c: any) {
  try {
    const secret = readOrderTokenSecret(c);
    if (!secret) return c.json({ status: 'error', message: ORDER_SYSTEM_NOT_READY }, 500);

    const db = drizzle(c.env.cinema_db, { schema });

    const booking = await findBookingForOwner(db, getD1Tables(schema), {
      bookingId: Number(c.req.param('id')),
      orderToken: c.req.header(ORDER_TOKEN_HEADER),
      secret,
      accountId: await getOptionalAccountId(c, db)
    });
    if (!booking) {
      return c.json({ status: 'error', message: 'Không tìm thấy đặt vé' }, 404);
    }

    // An order past its 10 minutes is expired now (voucher use given back), not at the next cron run
    const current = await expireBookingIfOverdue(db, getD1Tables(schema), booking);
    return c.json(bookingStatusPayload(current), 200);
  } catch (err: any) {
    logSystemError('booking-status', err);
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
}

publicRouter.get('/api/bookings/:id', handleBookingStatus);

// The film popup of the home page: one active, not deleted movie with the fields the popup shows
publicRouter.get('/api/movies-detail/:id', async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });
    const movie = await getPublicMovieDetail(db, { movies: schema.movies }, Number(c.req.param('id')));

    if (!movie) return c.json({ status: 'error', message: 'Không tìm thấy phim' }, 404);

    const parsed = { ...movie, cover_image: parseMediaUrl(movie.cover_image, c) };

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
  } catch {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
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

    // Member-only packages are hidden from visitors first (that needs is_member_only), then each package is trimmed
    const visibleItems = await withoutMemberOnlyForVisitors(c, db, (r as any).items || []);
    const responseBody = JSON.stringify({ items: visibleItems.map(toPublicTicketPackage) });

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

publicRouter.get('/api/site-media', async (c) => {
  return await withCache(
    c.req.raw, // Đối tượng Request gốc

    c.env, // Các biến môi trường và bindings

    c.executionCtx, // Context để xử lý các tác vụ nền

    async () => {
      // Lấy các tham số từ query string

      const section = String(c.req.query('section') || '');

      const type = String(c.req.query('type') || '');

      // Khởi tạo Drizzle và truy vấn Database. Visitors only ever get active, not deleted media (an "active" query
      // parameter is ignored).

      const db = drizzle(c.env.cinema_db, { schema });

      const items = await listPublicSiteMedia(db, { site_media: schema.site_media }, { section, type });

      const parsed = {
        items: (items as any[]).map((m: any) => ({
          ...m,
          url: parseMediaUrl(m.url, c)
        }))
      };

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


publicRouter.get('/api/posts', async (c) => {
  try {
    // The page size is capped at 100 and a bad page number becomes 1
    const { page, pageSize } = clampPage(c.req.query('page'), c.req.query('pageSize'), { defaultPageSize: 10 });

    const q = String(c.req.query('q') || '');

    const db = drizzle(c.env.cinema_db, { schema });

    // Published posts only, without the article text, the SEO fields or the author
    const r = await listPublicPosts(db, { posts: schema.posts }, { page, pageSize, q });

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// Public: Get post detail (by ID or Slug)

publicRouter.get('/api/posts/:identifier', async (c) => {
  try {
    const identifier = c.req.param('identifier');

    const db = drizzle(c.env.cinema_db, { schema });

    // Published posts only (a draft is "not found"), without the author or the staff names of the audit log
    const post: any = await getPublicPost(db, { posts: schema.posts }, identifier);

    if (!post) return c.json({ message: 'Không tìm thấy bài viết' }, 404);

    // Posts saved before the save-time cleaning existed are cleaned here too, without touching the database
    const parsed = {
      ...post,
      content: sanitizePostHtml(post.content)
    };
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

    // Member-only packages are hidden from visitors first (that needs is_member_only), then each package is trimmed
    const visibleItems = await withoutMemberOnlyForVisitors(c, db, r.items || []);
    return c.json({ items: visibleItems.map(toPublicVrPackage) }, 200 as any);
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
        ticket_packages: schema.ticket_packages,
        // Needed for the per-customer limit: by email, and the customer's orders still waiting for payment
        bookings: schema.bookings
      },
      body
    );

    // What the booking page reads: valid, the message, the amount saved, and the code and note of the voucher.
    // The voucher's Sales person, usage counters and rules stay on the server.
    const result: any = r;
    return c.json(
      {
        valid: Boolean(result.valid),
        message: result.message,
        ...(result.error_code ? { error_code: result.error_code } : {}),
        ...(result.valid
          ? {
              discount_amount: result.discount_amount,
              voucher_details: {
                code: result.voucher_details?.code,
                description: result.voucher_details?.description || ''
              }
            }
          : {})
      },
      200 as any
    );
  } catch (err: any) {
    const errStatus = Number(err?.statusCode) || 500;
    return c.json({ valid: false, message: String(err?.message || 'Internal error') }, errStatus as any);
  }
});

publicRouter.post('/api/vr/validate-booking', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const db = drizzle(c.env.cinema_db, { schema });

    const r = await validateVRBookingImpl(db, await withSignedInAccount(c, db, body), {
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
    const secret = readOrderTokenSecret(c);
    if (!secret) return c.json({ success: false, error: ORDER_SYSTEM_NOT_READY }, 500 as any);

    const body = await c.req.json().catch(() => ({}));
    const db = drizzle(c.env.cinema_db, { schema });

    const r = await createVRBookingImpl(db, await withSignedInAccount(c, db, body), {
      ticket_packages: schema.ticket_packages,
      vouchers: schema.vouchers,
      voucher_redemption_logs: schema.voucher_redemption_logs,
      users: schema.users,
      accounts: schema.accounts,
      bookings: schema.bookings,
      booking_vr_items: schema.booking_vr_items,
      branches: schema.branches
    });

    const status = Number(r.status) || 200;
    const clone: any = { ...r };
    delete clone.status;

    if (status === 201 && clone.booking?.pay_txt_code) {
      clone.booking.order_token = await makeOrderToken(secret, clone.booking.id, clone.booking.pay_txt_code);
      clone.booking.server_now = formatDateForDb(new Date());
      await payIfFree(c, db, clone.booking);
      clone.booking = toCustomerBooking(clone.booking);
    }
    return c.json(clone, status as any);
  } catch (err: any) {
    logSystemError('vr-create-booking', err);
    return c.json({ success: false, error: 'Lỗi máy chủ nội bộ' }, 500 as any);
  }
});

// Same minimal status as /api/bookings/:id (VR orders live in the same table)
publicRouter.get('/api/vr/bookings/:id', handleBookingStatus);

// ============================================================
// ===== BRANCHES (Public) ====================================
// ============================================================

// The default branch, with the same fields as the list (the home page uses its id, the browser keeps it as the
// selected branch)
publicRouter.get('/api/branches/default', async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });

    const branch = await getPublicDefaultBranch(db, { branches: schema.branches });

    if (!branch) return c.json({ message: 'Không tìm thấy chi nhánh mặc định' }, 404);

    return c.json({ branch }, 200);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// The order's branch for the QR payment page: its name and bank account only
publicRouter.get('/api/branches/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const db = drizzle(c.env.cinema_db, { schema });

    const branch = await getPublicBranchPaymentInfo(db, { branches: schema.branches }, id);

    if (!branch) {
      return c.json({ message: 'Không tìm thấy chi nhánh' }, 404);
    }

    return c.json({ branch }, 200);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// The branches a customer can choose (active and open)
publicRouter.get('/api/branches', async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });

    const items = await listPublicBranches(db, { branches: schema.branches });

    return c.json({ items });
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

export default publicRouter;
