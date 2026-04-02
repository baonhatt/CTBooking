// Main API server setup using Hono framework
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';
import { eq, desc, asc, and, like, or, sql, count } from 'drizzle-orm';
import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import { getAllActiveMoviesToday, listMovies, getMovie } from '../../server/routes/user/movies';
import {
  createMovieImpl,
  updateMovieImpl,
  deleteMovieImpl,
  getMovieByIdImpl,
  updateMovieStatusImpl
} from '../../server/routes/admin/movies';
import { getRevenueImpl, listTransactionsImpl, getTransactionByIdImpl } from '../../server/routes/admin/payments';
import {
  validateBookingImpl,
  createPaymentImpl,
  updatePaymentImpl,
  getBookingByIdImpl,
  getBookingByCodeImpl,
  confirmUseTicketImpl
} from '../../server/routes/user/payments';
import {
  getDashboardMetricsImpl,
  getRevenueByDateImpl,
  getRevenue7DaysImpl,
  getRevenueByMonthImpl
} from '../../server/routes/admin/dashboard';
import { getUsersImpl, getUserByIdImpl } from '../../server/routes/admin/users';
import { loginImpl, registerImpl } from '../../server/routes/user/auth';
import { forgetPassImpl, resetPasswordImpl, changePasswordImpl } from '../../server/routes/user/password';
import { listActiveToys } from '../../server/routes/user/toys';
import { listToysImpl, createToyImpl, getToyImpl, updateToyImpl, deleteToyImpl } from '../../server/routes/admin/toys';
import {
  listTicketPackagesImpl,
  getTicketPackageImpl,
  createTicketPackageImpl,
  updateTicketPackageImpl,
  deleteTicketPackageImpl
} from '../../server/routes/admin/tickets';
import { getEmailLogsImpl } from '../../server/routes/admin/email-logs';
import { listActiveTicketPackages } from '../../server/routes/user/tickets';
import {
  createSiteMediaImpl,
  listSiteMediaImpl,
  updateSiteMediaImpl,
  deleteSiteMediaImpl
} from '../../server/routes/admin/site-media';
import { getAdminSettingsImpl, updateAdminSettingsImpl } from '../../server/routes/admin/settings';
import { createMomoPaymentImpl, momoIpnImpl } from '../../server/routes/user/momo';
import { createVnpayPaymentImpl, vnpayIpnImpl } from '../../server/routes/user/vnpay';
import {
  listUserTransactionsImpl,
  getUserProfileByEmailImpl,
  updateUserProfileImpl
} from '../../server/routes/user/users';

// import { getMailConfig, verifyMailProvider } from "../../server/routes/mail-service";
import {
  RL_MAX,
  RL_WINDOW_MS,
  // attempts,
  hasCloudinary,
  cloudinarySignedParams,
  uploadCloudinaryImageDataURI,
  deleteCloudinaryImage,
  getPublicIdFromUrl,
  optimizeCloudinaryUrl,
  sendMail,
  getWelcomeEmailTemplate,
  getBookingEmailTemplate,
  getResetPasswordEmailTemplate,
  logSystemError,
  withCache,
  deleteCache,
  checkRateLimitKV
} from './utils';

type Bindings = {
  cinema_db: D1Database;
  r2_cinemastore: R2Bucket;
  KV_BINDING: any;
  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;
  CLOUDINARY_UPLOAD_FOLDER: string;
  VITE_MOMO_PARTNER_CODE: string;
  VITE_MOMO_ACCESS_KEY: string;
  VITE_MOMO_SECRET_KEY: string;
  VITE_MOMO_ENDPOINT: string;
  VITE_MOMO_IPN_URL: string;
  VITE_MOMO_REDIRECT_URL: string;
  VITE_VNPAY_TMN_CODE: string;
  VITE_VNPAY_HASH_SECRET: string;
  VITE_VNPAY_GATEWAY: string;
  VITE_VNPAY_RETURN_URL: string;
  VITE_SERVER_BASE_URL: string;
  VITE_CLIENT_BASE_URL: string;
  BREVO_API_KEY: string;
  BREVO_SENDER_EMAIL: string;
  BREVO_SENDER_NAME: string;
  RUNTIME_ENV: string;
  IS_PREVIEW?: string;
  VITE_RATE_LIMIT_BOOKING_CHECK_MAX: string;
  VITE_RATE_LIMIT_BOOKING_CHECK_WINDOWMS: string;
  AI: any; // Cloudflare Workers AI binding
};

const getCloudHelpers = (env: Bindings) => ({
  uploader: async (base64: string, folder: string) => {
    const res = await uploadCloudinaryImageDataURI(env, base64, folder);
    return { url: res.url };
  },
  deleter: async (url: string, type: 'image' | 'video' = 'image') => {
    const publicId = getPublicIdFromUrl(url);
    if (publicId) await deleteCloudinaryImage(env, publicId, type);
  }
});

const app = new Hono<{ Bindings: Bindings }>();

app.use(
  '*',
  cors({
    origin: (origin) => {
      if (!origin) return 'https://cinesphere.com.vn';

      // // Allow localhost for development
      // if (origin.startsWith("http://localhost:")) return origin;

      const allowedExact = new Set([
        'https://cinesphere.com.vn',
        'https://www.cinesphere.com.vn',
        'https://cinema-pages.pages.dev' // Pages production
      ]);

      if (allowedExact.has(origin)) return origin;

      // Allow all preview subdomains for cinema-pages on pages.dev
      try {
        const url = new URL(origin);
        if (url.hostname === 'cinema-pages.pages.dev' || url.hostname.endsWith('.cinema-pages.pages.dev')) {
          return origin;
        }
      } catch {
        // ignore parse error, fall back to default
      }

      // Fallback: default to prod domain
      return 'https://cinesphere.com.vn';
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'Referer', 'Access-Control-Request-Headers'],
    exposeHeaders: ['Content-Type', 'Authorization', 'X-KV-Cache'],
    maxAge: 86400,
    credentials: true
  })
);

// Global Error Handler for debugging preview issues
app.onError((err, c) => {
  console.error(`[Worker Error] ${err.message}`, err);
  return c.json(
    {
      status: 'error',
      message: err.message || 'Internal Server Error',
      stack: c.env.RUNTIME_ENV === 'development' || c.env.IS_PREVIEW === 'true' ? err.stack : undefined
    },
    500
  );
});

app.use('*', async (c, next) => {
  await next();
});

app.get('/', (c) => c.json({ ok: true, service: 'cinema-worker', time: Date.now() }));

app.get('/api/ping', (c) => {
  const ping = (typeof process !== 'undefined' && (process as any).env?.PING_MESSAGE) ?? 'ping';
  return c.json({ message: ping });
});

// Demo endpoint parity
app.get('/api/demo', (c) => {
  return c.json({ message: 'Hello from Express server' }, 200);
});

// ===== AUTHENTICATION ENDPOINTS =====
// Handles user authentication and account management
// User login endpoint
// POST /api/login
// Body: { email: string, password: string }
app.post('/api/login', async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });
    const body = await c.req.json().catch(() => ({}));
    const r = await loginImpl(db, { accounts: schema.accounts, users: schema.users }, body as any);
    const status = typeof (r as any).status === 'number' ? (r as any).status : 200;
    const payload = {
      ...(r as any),
      status: status >= 400 ? 'error' : 'success'
    };
    return c.json(payload as any, status as any);
  } catch {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});
// User registration endpoint
// POST /api/register
// Body: { name: string, email: string, password: string, ... }
app.post('/api/register', async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });
    const body = await c.req.json().catch(() => ({}));
    const mailer = async (to: string, sub: string, html: string) => {
      const res = await sendMail(c.env, to, sub, html);
      if (!res.ok) throw new Error(`Email failed: ${res.status} ${res.body}`);
      return res;
    };
    // const appBaseUrl =
    //   c.env.VITE_CLIENT_BASE_URL || "https://cinesphere.com.vn";
    const appBaseUrl = 'https://cinesphere.com.vn';
    const renderWelcome = (data: { customerName: string; email: string }) => getWelcomeEmailTemplate(appBaseUrl, data);
    const r = await registerImpl(
      db,
      { accounts: schema.accounts, users: schema.users, email_logs: schema.email_logs },
      body as any,
      mailer,
      renderWelcome,
      c.env.RUNTIME_ENV,
      c.executionCtx
    );
    const status = typeof (r as any).status === 'number' ? (r as any).status : 200;
    const payload = {
      ...(r as any),
      status: status >= 400 ? 'error' : 'success'
    };
    return c.json(payload, status);
  } catch (err: any) {
    const body = await c.req.json().catch(() => ({}));
    logSystemError('register', err, body);
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
// Password reset request endpoint
// POST /api/forget-password
// Body: { email: string }
app.post('/api/forget-password', async (c) => {
  let body: any = {};
  try {
    const db = drizzle(c.env.cinema_db, { schema });
    body = await c.req.json().catch(() => ({}));
    const email = String((body as any)?.email || '');
    const mailer = async (to: string, sub: string, html: string) => {
      const res = await sendMail(c.env, to, sub, html);
      if (!res.ok) throw new Error(`Email failed: ${res.status} ${res.body}`);
      return res;
    };
    // Xử lý Dynamic URL cho Reset Password link
    // 1. Ưu tiên lấy từ Origin header của request (Preview domain)
    let appBaseUrl = '';
    const origin = c.req.header('Origin');

    const allowHost = (host: string) =>
      host === 'cinesphere.com.vn' ||
      host === 'www.cinesphere.com.vn' ||
      host === 'cinema-pages.pages.dev' ||
      host.endsWith('.cinema-pages.pages.dev');

    if (origin) {
      try {
        const u = new URL(origin);
        if (allowHost(u.hostname)) {
          appBaseUrl = origin;
        }
      } catch { }
    }

    // 2. Fallback về env
    if (!appBaseUrl) {
      appBaseUrl = c.env.VITE_CLIENT_BASE_URL || 'https://cinesphere.com.vn';
    }

    const renderReset = (link: string) => {
      // link ở đây là relative "/reset-password?token=..." do logic bên trong forgetPassImpl xử lý
      // Tuy nhiên, forgetPassImpl mặc định nối với process.env.VITE_SERVER_BASE_URL nếu không truyền callback
      // Nhưng ở đây ta truyền callback renderReset, nên ta tự build full link
      // Lưu ý: forgetPassImpl gọi callback này với tham số là link relative nếu ta custom?
      // Check lại server/routes/user/password.ts:
      // if (getResetPasswordEmailHtml) { ... resetLink = `/reset-password?token=${token}`; ... contentMail = getResetPasswordEmailHtml(resetLink); }
      // Vậy tham số link truyền vào đây chỉ là path relative. Ta cần nối với appBaseUrl.

      // Đảm bảo link không bị double slash
      const path = link.startsWith('/') ? link : `/${link}`;
      const fullLink = `${appBaseUrl}${path}`;
      return getResetPasswordEmailTemplate(appBaseUrl, fullLink);
    };

    const r = await forgetPassImpl(
      db,
      { accounts: schema.accounts, tokens: schema.tokens, email_logs: schema.email_logs },
      email,
      mailer,
      renderReset,
      c.env.RUNTIME_ENV,
      c.executionCtx
    );
    const status = typeof (r as any).status === 'number' ? (r as any).status : 200;
    const payload = {
      ...(r as any),
      status: status >= 400 ? 'error' : 'success'
    };
    return c.json(payload, status as any);
  } catch (err: any) {
    logSystemError('forget-password', err, body);
    return c.json({ message: 'Lỗi máy chủ nội bộ', error: String(err?.message || err) }, 500);
  }
});
// Password reset confirmation endpoint
// POST /api/reset-password
// Body: { token: string, newPassword: string, confirmPassword: string }
app.post('/api/reset-password', async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });
    const body = await c.req.json().catch(() => ({}));
    const r = await resetPasswordImpl(
      db,
      { accounts: schema.accounts, tokens: schema.tokens },
      body as any,
      c.env.RUNTIME_ENV
    );
    const status = typeof (r as any).status === 'number' ? (r as any).status : 200;
    const payload = {
      ...(r as any),
      status: status >= 400 ? 'error' : 'success'
    };
    return c.json(payload, status as any);
  } catch {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

app.get('/api/admin/revenue', async (c) => {
  try {
    const from = String(c.req.query('from') || '');
    const to = String(c.req.query('to') || '');
    const status = String(c.req.query('status') || 'paid');
    const db = drizzle(c.env.cinema_db, { schema });
    const r = await getRevenueImpl(db, { bookings: schema.bookings }, { from, to, status }, c.env.RUNTIME_ENV);
    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

app.get('/api/admin/transactions', async (c) => {
  try {
    const page = Number(c.req.query('page') || 1);
    const pageSize = Number(c.req.query('pageSize') || 20);
    const searchText = String(c.req.query('searchText') || '');
    const status = String(c.req.query('status') || 'all');
    const sort = String(c.req.query('sort') || 'created_at');
    const dir = String(c.req.query('dir') || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
    const payment_method = String(c.req.query('payment_method') || '');
    const from = String(c.req.query('from') || '');
    const to = String(c.req.query('to') || '');
    const db = drizzle(c.env.cinema_db, { schema });
    const r = await listTransactionsImpl(
      db,
      {
        bookings: schema.bookings,
        users: schema.users,
        accounts: schema.accounts,
        movies: schema.movies,
        ticket_packages: schema.ticket_packages
      },
      {
        page,
        pageSize,
        searchText,
        status,
        sort,
        dir,
        payment_method,
        from,
        to
      },
      c.env.RUNTIME_ENV
    );
    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

app.get('/api/admin/transactions/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const db = drizzle(c.env.cinema_db, { schema });
    const r = await getTransactionByIdImpl(
      db,
      {
        bookings: schema.bookings,
        users: schema.users,
        accounts: schema.accounts,
        movies: schema.movies,
        ticket_packages: schema.ticket_packages
      },
      id
    );
    if (!r) return c.json({ message: 'Không tìm thấy' }, 404);
    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// Get dashboard metrics (total users, movies, revenue, etc.)
// GET /api/admin/dashboard/metrics
app.get('/api/admin/dashboard/metrics', async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });
    const period = c.req.query('period') || 'week';
    const yearParam = c.req.query('year');
    const year = yearParam ? parseInt(yearParam) : undefined;
    const r = await getDashboardMetricsImpl(
      db,
      {
        movies: schema.movies,
        users: schema.users,
        bookings: schema.bookings,
        ticket_packages: schema.ticket_packages,
        toys: schema.toys
      },
      c.env.RUNTIME_ENV,
      period,
      year
    );
    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// Get revenue for a specific date
// GET /api/admin/dashboard/revenue-date?date=YYYY-MM-DD&status=paid
app.get('/api/admin/dashboard/revenue-date', async (c) => {
  try {
    const date = String(c.req.query('date') || '');
    const status = String(c.req.query('status') || 'paid');
    const yearParam = c.req.query('year');
    const year = yearParam ? parseInt(yearParam) : undefined;
    const db = drizzle(c.env.cinema_db, { schema });
    const r = await getRevenueByDateImpl(db, { bookings: schema.bookings }, { date, status, year }, c.env.RUNTIME_ENV);
    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// Get revenue data for the last 7 days
// GET /api/admin/dashboard/revenue-7days
app.get('/api/admin/dashboard/revenue-7days', async (c) => {
  try {
    const yearParam = c.req.query('year');
    const year = yearParam ? parseInt(yearParam) : undefined;
    const db = drizzle(c.env.cinema_db, { schema });
    const r = await getRevenue7DaysImpl(db, { bookings: schema.bookings }, c.env.RUNTIME_ENV, year);
    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// Get monthly revenue data
// GET /api/admin/dashboard/revenue-month?year=YYYY&month=MM&status=paid
app.get('/api/admin/dashboard/revenue-month', async (c) => {
  try {
    const year = String(c.req.query('year') || '');
    const month = String(c.req.query('month') || '');
    const status = String(c.req.query('status') || 'paid');
    const db = drizzle(c.env.cinema_db, { schema });
    const r = await getRevenueByMonthImpl(
      db,
      { bookings: schema.bookings },
      { year, month, status },
      c.env.RUNTIME_ENV
    );
    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// Get paginated list of users with optional search
// GET /api/admin/users?page=1&pageSize=20&q=search_term
app.get('/api/admin/users', async (c) => {
  try {
    const page = Number(c.req.query('page') || 1);
    const pageSize = Number(c.req.query('pageSize') || 20);
    const q = String(c.req.query('q') || '');
    const db = drizzle(c.env.cinema_db, { schema });
    const r = await getUsersImpl(
      db,
      {
        users: schema.users,
        accounts: schema.accounts,
        bookings: schema.bookings
      },
      { page, pageSize, q }
    );
    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// Admin settings endpoints
app.get('/api/admin/settings', async (c) => {
  try {
    const r = await getAdminSettingsImpl(c.env.KV_BINDING);
    return c.json(r);
  } catch (err: any) {
    return c.json({ message: String(err?.message || 'Internal error') }, 500);
  }
});

app.post('/api/admin/settings', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const r = await updateAdminSettingsImpl(c.env.KV_BINDING, body);
    return c.json(r);
  } catch (err: any) {
    return c.json({ message: String(err?.message || 'Internal error') }, 500);
  }
});

// Get user details by ID
// GET /api/admin/users/:id
app.get('/api/admin/users/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const db = drizzle(c.env.cinema_db, { schema });
    const r = await getUserByIdImpl(
      db,
      {
        users: schema.users,
        bookings: schema.bookings,
        movies: schema.movies,
        ticket_packages: schema.ticket_packages
      },
      id
    );
    if (!r) return c.json({ status: 'error', message: 'Không tìm thấy' }, 404);
    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// Generate Cloudinary signature for direct uploads
// POST /api/admin/cloudinary/sign
// Body: { folder: string, resource_type: string }
app.post('/api/admin/cloudinary/sign', async (c) => {
  try {
    const env = c.env;
    if (!hasCloudinary(env)) return c.json({ message: 'Thiếu cấu hình Cloudinary' }, 400);
    const body = await c.req.json().catch(() => null);
    const folder = String(body?.folder || '');
    const resourceType = String(body?.resource_type || '');
    if (!folder || !resourceType) return c.json({ message: 'Thiếu tham số cần thiết' }, 400);
    const timestamp = Math.floor(Date.now() / 1000);
    const params = {
      timestamp,
      folder,
      use_filename: 'true',
      unique_filename: 'false',
      overwrite: 'true'
    } as Record<string, string | number>;
    const signed = await cloudinarySignedParams(env, params);
    return c.json({
      timestamp,
      signature: signed.signature,
      api_key: signed.api_key
    });
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// Upload video file to Cloudinary or R2 storage
// POST /api/admin/uploads/video
// FormData: { file: File }
app.post('/api/admin/uploads/video', async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file');
    const folderParam = formData.get('folder');

    // Compatibility check: if parseBody was used before, we switch to formData for consistency with file uploads
    if (!file || !(file instanceof File)) {
      return c.json({ message: 'Thiếu tệp video' }, 400);
    }

    const mime = String(file.type || 'application/octet-stream').toLowerCase();
    if (!mime.startsWith('video/')) return c.json({ message: 'Chỉ chấp nhận tệp video' }, 400);

    const env = c.env;

    if (hasCloudinary(env)) {
      const cloudName = String(env.CLOUDINARY_CLOUD_NAME || '');
      const timestamp = Math.floor(Date.now() / 1000);

      // Determine folder with clean overwrite logic
      let folder = String(env.CLOUDINARY_UPLOAD_FOLDER || 'ctbooking/videos');
      if (folderParam) {
        const safeFolder = String(folderParam).replace(/[^a-zA-Z0-9._-]/g, '_');
        folder = `ctbooking/videos/${safeFolder}`;
      }

      const params = {
        timestamp,
        folder,
        use_filename: 'true',
        unique_filename: 'false',
        overwrite: 'true',
        eager: 'q_auto,w_1280,h_720,c_limit,f_mp4,vc_h264',
        eager_async: 'true'
      };
      const signed = await cloudinarySignedParams(env, params);
      const cf = new FormData();
      cf.append('file', file);
      cf.append('folder', folder);
      cf.append('use_filename', 'true');
      cf.append('unique_filename', 'false');
      cf.append('overwrite', 'true');
      cf.append('timestamp', String(timestamp));
      cf.append('api_key', signed.api_key);
      cf.append('signature', signed.signature);
      cf.append('eager', 'q_auto,w_1280,h_720,c_limit,f_mp4,vc_h264');
      cf.append('eager_async', 'true');
      const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`;
      const resp = await fetch(endpoint, { method: 'POST', body: cf });
      const data: any = await resp.json().catch(() => ({}));
      if (!resp.ok)
        return c.json(
          {
            message: String(data?.error?.message || `Cloudinary ${resp.status}`)
          },
          500
        );
      return c.json({
        public_id: String(data.public_id || ''),
        url: String(data.secure_url || data.url || ''),
        bytes: Number(data.bytes || file.size || 0),
        duration: typeof data.duration === 'number' ? data.duration : undefined,
        format: String(data.format || ''),
        width: typeof data.width === 'number' ? data.width : undefined,
        height: typeof data.height === 'number' ? data.height : undefined
      });
    }

    if (!env.r2_cinemastore) return c.json({ message: 'Thiếu R2 bucket hoặc Cloudinary' }, 500);

    const ext = (() => {
      const e = (file.name || '').split('.').pop()?.toLowerCase() || '';
      if (e) return e;
      if (mime.includes('mp4')) return 'mp4';
      if (mime.includes('webm')) return 'webm';
      if (mime.includes('mov')) return 'mov';
      return 'bin';
    })();
    const key = `uploads/videos/video_${Date.now()}.${ext}`;
    const arr = new Uint8Array(await file.arrayBuffer());
    await env.r2_cinemastore.put(key, arr, {
      httpMetadata: { contentType: mime }
    });
    return c.json({
      public_id: key,
      url: `/${key}`,
      bytes: Number(file.size || arr.byteLength || 0),
      format: ext
    });
  } catch (err: any) {
    return c.json({ message: String(err?.message || 'Upload error') }, 500);
  }
});

app.get('/api/getActiveMovies', async (c) => {
  try {
    /* TẠM THỜI VÔ HIỆU HÓA CACHE ĐỂ FIX LỖI KHÔNG CẬP NHẬT 
    if (c.env.KV_BINDING) {
      const cached = await c.env.KV_BINDING.get('active_movies_v2');
      if (cached) {
        return new Response(cached, {
          headers: {
            'Content-Type': 'application/json',
            'X-KV-Cache': 'HIT'
          }
        });
      }
    }
    */

    const db = drizzle(c.env.cinema_db, { schema });
    // Rate limit check using KV
    const ip = c.req.header('CF-Connecting-IP') || 'unknown';
    const allowed = await checkRateLimitKV(c.env, ip);
    if (!allowed) {
      return c.json(
        {
          message: 'Bạn đang thao tác quá nhanh. Vui lòng đợi một lát rồi thử lại.'
        },
        429
      );
    }

    const { activeMovies } = await getAllActiveMoviesToday(db, {
      movies: schema.movies
    });
    const optimized = activeMovies.map((m) => ({
      ...m,
      cover_image: optimizeCloudinaryUrl(m.cover_image ?? ''),
      detail_images: (() => {
        const v = m.detail_images;
        if (v === null || v === undefined) return '[]';
        try {
          const parsed = typeof v === 'string' ? JSON.parse(v) : v;
          if (Array.isArray(parsed)) {
            const opt = parsed.map((u: string) => optimizeCloudinaryUrl(u));
            return JSON.stringify(opt);
          }
          return typeof v === 'string' ? v : JSON.stringify(v);
        } catch {
          return '[]';
        }
      })()
    }));

    const responseBody = JSON.stringify({ activeMovies: optimized });

    // Save to KV with specific TTL (e.g., 1 hour) - TEMPORARILY DISABLED
    /*
    if (c.env.KV_BINDING) {
      // console.log("Putting activeMovies to KV");
      c.executionCtx.waitUntil(c.env.KV_BINDING.put('active_movies_v2', responseBody, { expirationTtl: 3600 }));
    }
    */

    return new Response(responseBody, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
        "Cloudflare-CDN-Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0",
        Vary: "Origin",
        "X-KV-Cache": "DISABLED"
      },
    });
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// Schema tables for D1
const getD1Tables = (schema: any) => ({
  bookings: schema.bookings,
  users: schema.users,
  accounts: schema.accounts,
  movies: schema.movies,
  ticket_packages: schema.ticket_packages,
  email_logs: schema.email_logs
});

// Validate booking details before payment
// POST /api/validate-booking
// Body: { movieId: number, showtime: string, seats: string[], ... }
app.post('/api/validate-booking', async (c) => {
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

// Create a new booking
// POST /api/create-booking
// Body: { movieId: number, showtime: string, seats: string[], paymentMethod: string, ... }
app.post('/api/create-booking', async (c) => {
  let body: any = {};
  try {
    const db = drizzle(c.env.cinema_db, { schema });
    const tables = getD1Tables(schema);
    body = await c.req.json().catch(() => ({}));
    // Pass schema tables to ensure correct schema is used (D1 schema instead of PostgreSQL)
    const r = await createPaymentImpl(db, body as any, tables, c.env.RUNTIME_ENV);
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

// Confirm a booking after payment
// POST /api/confirm-booking
// Body: { bookingId: string, paymentDetails: object }
app.post('/api/confirm-booking', async (c) => {
  let body: any = {};
  try {
    const db = drizzle(c.env.cinema_db, { schema });
    const tables = { ...getD1Tables(schema), email_logs: schema.email_logs };
    body = await c.req.json().catch(() => ({}));
    const mailer = async (to: string, sub: string, html: string) => {
      const res = await sendMail(c.env, to, sub, html);
      if (!res.ok) throw new Error(`Email failed: ${res.status} ${res.body}`);
      return res;
    };
    const appBaseUrl = c.env.VITE_CLIENT_BASE_URL || 'https://cinesphere.com.vn';
    const renderBooking = (data: any) => getBookingEmailTemplate(appBaseUrl, data);
    const r = await updatePaymentImpl(
      db,
      body as any,
      mailer,
      renderBooking,
      tables,
      c.env.RUNTIME_ENV,
      c.executionCtx
    );
    const status = typeof (r as any).status === 'number' ? (r as any).status : 200;
    const payload = {
      ...(r as any),
      status: status >= 400 ? 'error' : 'success'
    };
    return c.json(payload, status as any);
  } catch (err: any) {
    logSystemError('confirm-booking', err, body);
    return c.json({ message: err?.message || 'Lỗi máy chủ nội bộ' }, 500);
  }
});

// SePay Webhook
app.post('/api/sepay/webhook', async (c) => {
  try {
    const { handleSePayWebhookImpl } = await import('../../server/routes/webhook/sepay');
    const db = drizzle(c.env.cinema_db, { schema });
    const tables = { ...getD1Tables(schema), email_logs: schema.email_logs };
    const body = await c.req.json().catch(() => ({}));

    // Worker Mailer Injection
    const mailer = async (to: string, sub: string, html: string) => {
      const res = await sendMail(c.env, to, sub, html);
      if (!res.ok) throw new Error(`Email failed: ${res.status} ${res.body}`);
      return res;
    };
    const appBaseUrl = c.env.VITE_CLIENT_BASE_URL || 'https://cinesphere.com.vn';
    const renderBooking = (data: any) => getBookingEmailTemplate(appBaseUrl, data);

    const result = await handleSePayWebhookImpl(
      db,
      tables,
      body,
      mailer,
      renderBooking,
      c.env.RUNTIME_ENV,
      c.executionCtx
    );

    return c.json(result);
  } catch (err: any) {
    return c.json({ success: false, message: 'Internal Error' });
  }
});

app.get('/api/bookings/:id', async (c) => {
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

// Rate-limited code check with headers parity
app.get('/api/bookings-code/:code', async (c) => {
  // Rate Limit Check
  const max = Number(c.env.VITE_RATE_LIMIT_BOOKING_CHECK_MAX) || 10;
  const windowMs = Number(c.env.VITE_RATE_LIMIT_BOOKING_CHECK_WINDOWMS) || 60000;
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  const now = Date.now();
  // const list = attempts.get(ip) ?? []; // Removed
  // const filtered = list.filter((ts) => now - ts < windowMs);
  const filtered: number[] = []; // Placeholder to avoid breaking logic below

  if (filtered.length >= max) {
    const oldest = filtered[0];
    const retryMs = Math.max(0, windowMs - (now - oldest));
    const retrySec = Math.ceil(retryMs / 1000);
    c.header('Retry-After', String(retrySec));
    c.header('X-RateLimit-Limit', String(max));
    c.header('X-RateLimit-Remaining', '0');
    c.header('X-RateLimit-WindowMS', String(windowMs));
    return c.json(
      {
        status: 'error',
        message: `Quá nhiều yêu cầu, vui lòng thử lại sau ${retrySec}s`
      },
      429
    );
  }

  const remaining = Math.max(0, max - (filtered.length + 1));
  filtered.push(now);
  // attempts.set(ip, filtered); // Removed

  c.header('X-RateLimit-Limit', String(max));
  c.header('X-RateLimit-Remaining', String(remaining));
  c.header('X-RateLimit-WindowMS', String(windowMs));

  const db = drizzle(c.env.cinema_db, { schema });
  const tables = getD1Tables(schema);
  const code = String(c.req.param('code') || '');
  const r = await getBookingByCodeImpl(db, code, tables);
  const status = typeof (r as any).status === 'number' ? (r as any).status : 200;
  const payload = {
    ...(r as any),
    status: status >= 400 ? 'error' : 'success'
  };
  return c.json(payload, status as any);
});

app.post('/api/bookings-use', async (c) => {
  const db = drizzle(c.env.cinema_db, { schema });
  const tables = getD1Tables(schema);
  const body = await c.req.json().catch(() => ({}));
  const code = String((body as any)?.code || '');
  const r = await confirmUseTicketImpl(db, code, tables, c.env.RUNTIME_ENV);
  const status = (r as any)?.status === 'error' ? 400 : 200;
  const payload = {
    ...(r as any),
    status: status >= 400 ? 'error' : 'success'
  };
  return c.json(payload, status);
});

// Get list of movies
// GET /api/movies?page=1&pageSize=20&q=search_term
app.get('/api/movies', async (c) => {
  try {
    const page = Number(c.req.query('page') || 1);
    const pageSize = Number(c.req.query('pageSize') || 20);
    const q = String(c.req.query('q') || '').toLowerCase();
    const sortKey = String(c.req.query('sort') || 'updated_at');
    const dir = String(c.req.query('dir') || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
    const status = String(c.req.query('status') || 'all');
    const db = drizzle(c.env.cinema_db, { schema });
    const { items, total } = await listMovies(
      db,
      { movies: schema.movies },
      { page, pageSize, q, sort: sortKey, dir, status: status as any }
    );
    return c.json({ items, page, pageSize, total }, 200);
  } catch {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

// Create a new movie
// POST /api/movies
// Body: { title: string, description: string, ... }
app.post('/api/movies', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const db = drizzle(c.env.cinema_db, { schema });
    const config = {
      CLOUDINARY_API_KEY: c.env.CLOUDINARY_API_KEY,
      CLOUDINARY_API_SECRET: c.env.CLOUDINARY_API_SECRET,
      CLOUDINARY_CLOUD_NAME: c.env.CLOUDINARY_CLOUD_NAME
    };
    const { uploader: localUploader } = getCloudHelpers(c.env);
    const r = await createMovieImpl(db, { movies: schema.movies }, body as any, undefined, c.env, localUploader);
    // Clear cache active movies
    const origin = new URL(c.req.url).origin;
    await deleteCache(c.env, `${origin}/api/getActiveMovies`);

    const status = (r as any)?.status === 'error' ? 400 : 200;
    const payload = {
      ...(r as any),
      status: status >= 400 ? 'error' : 'success'
    };
    return c.json(payload, status);
  } catch {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

// Get movie details by ID
// GET /api/movies/:id
app.get('/api/movies/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const db = drizzle(c.env.cinema_db, { schema });
    const movie = await getMovie(db, { movies: schema.movies }, id);
    if (!movie) return c.json({ message: 'Không tìm thấy' }, 404);
    return c.json({ movie }, 200);
  } catch {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

app.get("/api/movies-detail/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const db = drizzle(c.env.cinema_db, { schema });
  const r = await getMovieByIdImpl(
    db,
    {
      movies: schema.movies,
      bookings: schema.bookings,
      ticket_packages: schema.ticket_packages,
    },
    id,
  );
  if (!r)
    return c.json({ status: "error", message: "Không tìm thấy phim" }, 404);

  return new Response(JSON.stringify(r), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
      "Cloudflare-CDN-Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
      "Pragma": "no-cache",
      "Expires": "0",
      Vary: "Origin",
    },
  });
});

// Update a movie
// PUT /api/movies/:id
// Body: { title: string, description: string, ... }
app.put('/api/movies/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const body = await c.req.json().catch(() => ({}));
    const db = drizzle(c.env.cinema_db, { schema });
    const config = {
      CLOUDINARY_API_KEY: c.env.CLOUDINARY_API_KEY,
      CLOUDINARY_API_SECRET: c.env.CLOUDINARY_API_SECRET,
      CLOUDINARY_CLOUD_NAME: c.env.CLOUDINARY_CLOUD_NAME
    };
    const { uploader: localUploader, deleter: localDeleter } = getCloudHelpers(c.env);
    const r = await updateMovieImpl(
      db,
      { movies: schema.movies, ticket_packages: schema.ticket_packages },
      id,
      body as any,
      undefined,
      c.env,
      localUploader,
      localDeleter
    );
    if (!r) return c.json({ status: 'error', message: 'Không tìm thấy' }, 404);

    // Clear cache active movies
    const origin = new URL(c.req.url).origin;
    await deleteCache(c.env, `${origin}/api/getActiveMovies`);
    await deleteCache(c.env, `${origin}/api/movies-detail/${id}`);

    return c.json(r, 200);
  } catch {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

app.post('/api/movies-status/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const body: any = await c.req.json().catch(() => ({}));
    const is_active = body.is_active !== undefined ? body.is_active : false;
    const db = drizzle(c.env.cinema_db, { schema });
    const r = await updateMovieStatusImpl(
      db,
      { movies: schema.movies, ticket_packages: schema.ticket_packages },
      id,
      is_active,
      c.env
    );
    const status = typeof (r as any).status === 'number' ? (r as any).status : 200;
    const payload = {
      ...(r as any),
      status: status >= 400 ? 'error' : 'success'
    };

    // Clear cache active movies
    const origin = new URL(c.req.url).origin;
    await deleteCache(c.env, `${origin}/api/getActiveMovies`);
    await deleteCache(c.env, `${origin}/api/movies-detail/${id}`);

    return c.json(payload, status);
  } catch (err) {
    return new Response(JSON.stringify({ status: 'error', message: 'Lỗi máy chủ nội bộ' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

// Delete a movie
// DELETE /api/movies/:id
app.delete('/api/movies/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const db = drizzle(c.env.cinema_db, { schema });
    const { deleter: localDeleter } = getCloudHelpers(c.env);
    const r = await deleteMovieImpl(db, { movies: schema.movies }, id, c.env, localDeleter);

    if (!r) return c.json({ status: 'error', message: 'Không tìm thấy' }, 404);

    // Clear cache active movies
    const origin = new URL(c.req.url).origin;
    await deleteCache(c.env, `${origin}/api/getActiveMovies`);
    await deleteCache(c.env, `${origin}/api/movies-detail/${id}`);

    return c.json(r, 200);
  } catch (err) {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

// Get list of users
// GET /api/users?page=1&pageSize=20&q=search_term
app.get('/api/users', async (c) => {
  try {
    const page = Number(c.req.query('page') || 1);
    const pageSize = Number(c.req.query('pageSize') || 20);
    const q = String(c.req.query('q') || '');
    const db = drizzle(c.env.cinema_db, { schema });
    const r = await getUsersImpl(
      db,
      {
        users: schema.users,
        accounts: schema.accounts,
        bookings: schema.bookings
      },
      { page, pageSize, q }
    );
    return c.json(r, 200);
  } catch {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

// Get email logs
// GET /api/admin/email-logs
app.get('/api/admin/email-logs', async (c) => {
  try {
    const status = c.req.query('status') || 'all';
    const email_type = c.req.query('email_type') || 'all';
    const search = c.req.query('search') || '';
    const page = Number(c.req.query('page') || 1);
    const limit = Number(c.req.query('limit') || 20);

    const db = drizzle(c.env.cinema_db, { schema });
    const r = await getEmailLogsImpl(
      db,
      {
        email_logs: schema.email_logs,
        users: schema.users,
        bookings: schema.bookings
      },
      { status, email_type, search, page, limit }
    );
    return c.json(r, 200);
  } catch (err: any) {
    return c.json({ status: 'error', message: err?.message || 'Internal error' }, 500);
  }
});

// Get user details by ID
// GET /api/users/:id
app.get('/api/users/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const db = drizzle(c.env.cinema_db, { schema });
    const r = await getUserByIdImpl(
      db,
      {
        users: schema.users,
        bookings: schema.bookings,
        movies: schema.movies,
        ticket_packages: schema.ticket_packages
      },
      id
    );
    if (!r) return c.json({ status: 'error', message: 'Không tìm thấy' }, 404);
    return c.json(r, 200);
  } catch {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

// Get user profile by email
// GET /api/users-profile?email=user@example.com
app.get('/api/users-profile', async (c) => {
  try {
    const emailRaw = String(c.req.query('email') || '');
    const db = drizzle(c.env.cinema_db, { schema });
    const r = await getUserProfileByEmailImpl(db, { accounts: schema.accounts, users: schema.users }, emailRaw);
    const status = typeof (r as any).status === 'number' ? (r as any).status : 200;
    const payload = {
      ...(r as any),
      status: status >= 400 ? 'error' : 'success'
    };
    return c.json(payload as any, status as any);
  } catch {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

// Update user profile
// POST /api/users-profile
// Body: { email: string, name: string, ... }
app.post('/api/users-profile', async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });
    const body = await c.req.json().catch(() => ({}));
    const r = await updateUserProfileImpl(
      db,
      { accounts: schema.accounts, users: schema.users },
      body as any,
      c.env.RUNTIME_ENV
    );
    const status = typeof (r as any).status === 'number' ? (r as any).status : 200;
    const payload = {
      ...(r as any),
      status: status >= 400 ? 'error' : 'success'
    };
    return c.json(payload as any, status);
  } catch {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

// Change user password
// POST /api/users-password
// Body: { oldPassword: string, newPassword: string }
app.post('/api/users-password', async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });
    const body = await c.req.json().catch(() => ({}));
    const r = await changePasswordImpl(db, { accounts: schema.accounts }, body as any, c.env.RUNTIME_ENV);
    const status = typeof (r as any).status === 'number' ? (r as any).status : 200;
    const payload = {
      ...(r as any),
      status: status >= 400 ? 'error' : 'success'
    };
    return c.json(payload, status);
  } catch {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

// Get user's transaction history
// GET /api/usersprofile/transactions?email=user@example.com&status=paid&page=1
app.get('/api/usersprofile/transactions', async (c) => {
  try {
    const email = String(c.req.query('email') || '');
    const status = String(c.req.query('status') || 'paid');
    const page = Number(c.req.query('page') || 1);
    const pageSize = Number(c.req.query('pageSize') || 10);
    const sort = String(c.req.query('sort') || 'created_at');
    const dir = String(c.req.query('dir') || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
    const payment_method = String(c.req.query('payment_method') || '');
    const from = String(c.req.query('from') || '');
    const to = String(c.req.query('to') || '');
    const db = drizzle(c.env.cinema_db, { schema });
    const r = await listUserTransactionsImpl(
      db,
      {
        accounts: schema.accounts,
        bookings: schema.bookings,
        movies: schema.movies,
        ticket_packages: schema.ticket_packages
      },
      { email, status, page, pageSize, sort, dir, payment_method, from, to },
      c.env.RUNTIME_ENV
    );
    return c.json(r, 200);
  } catch {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

// Get list of toys
// GET /api/toys?page=1&pageSize=20&q=search_term
app.get('/api/toys', async (c) => {
  try {
    const page = Number(c.req.query('page') || 1);
    const pageSize = Number(c.req.query('pageSize') || 20);
    const q = String(c.req.query('q') || '');
    const status = String(c.req.query('status') || 'all');
    const db = drizzle(c.env.cinema_db, { schema });
    const r = await listToysImpl(db, { toys: schema.toys }, { page, pageSize, q, status });
    return c.json(r, 200);
  } catch {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

// Get list of active toys
app.get('/api/toys-active', async (c) => {
  try {
    /* TẠM THỜI VÔ HIỆU HÓA CACHE
    if (c.env.KV_BINDING) {
      const cached = await c.env.KV_BINDING.get('activeToys');
      if (cached) {
        return new Response(cached, {
          headers: {
            'Content-Type': 'application/json',
            'X-KV-Cache': 'HIT'
          }
        });
      }
    }
    */

    const db = drizzle(c.env.cinema_db, { schema });
    const r = await listActiveToys(db, { toys: schema.toys });

    const responseBody = JSON.stringify(r);

    // Save to KV with specific TTL (e.g., 1 hour) - TEMPORARILY DISABLED
    /*
    if (c.env.KV_BINDING) {
      c.executionCtx.waitUntil(c.env.KV_BINDING.put('activeToys', responseBody, { expirationTtl: 3600 }));
    }
    */

    return new Response(responseBody, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
        "Cloudflare-CDN-Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0",
        Vary: "Origin",
        "X-KV-Cache": "DISABLED"
      },
    });
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// Get toy details by ID
// GET /api/toys/:id
app.get('/api/toys/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const db = drizzle(c.env.cinema_db, { schema });
    const r = await getToyImpl(db, { toys: schema.toys }, id);
    if (!r) return c.json({ message: 'Không tìm thấy' }, 404);
    return c.json(r, 200);
  } catch {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

// Create a new toy
// POST /api/toys
// Body: { name: string, description: string, ... }
app.post('/api/toys', async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });
    const body = await c.req.json().catch(() => ({}));
    const { uploader } = getCloudHelpers(c.env);
    const r = await createToyImpl(db, { toys: schema.toys }, body as any, c.env, uploader);
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

// Update a toy
// PUT /api/toys/:id
// Body: { name: string, description: string, ... }
app.put('/api/toys/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const db = drizzle(c.env.cinema_db, { schema });
    const body = await c.req.json().catch(() => ({}));
    const { uploader, deleter } = getCloudHelpers(c.env);
    const r = await updateToyImpl(db, { toys: schema.toys }, id, body as any, c.env, uploader, deleter);
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

// Delete a toy
// DELETE /api/toys/:id
app.delete('/api/toys/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const db = drizzle(c.env.cinema_db, { schema });
    const { deleter } = getCloudHelpers(c.env);
    const r = await deleteToyImpl(db, { toys: schema.toys }, id, c.env, deleter);
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

// Get list of ticket packages
// GET /api/tickets?page=1&pageSize=20&q=search_term
app.get('/api/tickets', async (c) => {
  try {
    const page = Number(c.req.query('page') || 1);
    const pageSize = Number(c.req.query('pageSize') || 20);
    const q = String(c.req.query('q') || '');
    const db = drizzle(c.env.cinema_db, { schema });
    const r = await listTicketPackagesImpl(
      db,
      { ticket_packages: schema.ticket_packages, movies: schema.movies },
      { page, pageSize, q }
    );
    return c.json(r, 200);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// Get list of active ticket packages
app.get('/api/tickets-active', async (c) => {
  try {
    /* TẠM THỜI VÔ HIỆU HÓA CACHE
    if (c.env.KV_BINDING) {
      const cached = await c.env.KV_BINDING.get('activeTicketPackages');
      if (cached) {
        return new Response(cached, {
          headers: {
            'Content-Type': 'application/json',
            'X-KV-Cache': 'HIT'
          }
        });
      }
    }
    */

    const db = drizzle(c.env.cinema_db, { schema });
    const r = await listActiveTicketPackages(db, {
      ticket_packages: schema.ticket_packages,
      movies: schema.movies
    });

    const responseBody = JSON.stringify(r);

    // Save to KV with specific TTL (e.g., 1 hour) - TEMPORARILY DISABLED
    /*
    if (c.env.KV_BINDING) {
      c.executionCtx.waitUntil(c.env.KV_BINDING.put('activeTicketPackages', responseBody, { expirationTtl: 3600 }));
    }
    */

    return new Response(responseBody, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
        "Cloudflare-CDN-Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0",
        Vary: "Origin",
        "X-KV-Cache": "DISABLED"
      },
    });
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// Get ticket package details by ID
// GET /api/tickets/:id
app.get('/api/tickets/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const db = drizzle(c.env.cinema_db, { schema });
    const r = await getTicketPackageImpl(db, { ticket_packages: schema.ticket_packages }, id);
    if (!r) return c.json({ message: 'Không tìm thấy' }, 404);
    return c.json(r, 200);
  } catch {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

// Create a new ticket package
// POST /api/tickets
// Body: { name: string, description: string, ... }
app.post('/api/tickets', async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });
    const body = await c.req.json().catch(() => ({}));
    const r = await createTicketPackageImpl(
      db,
      { ticket_packages: schema.ticket_packages, movies: schema.movies },
      body as any,
      c.env
    );

    // Clear cache active tickets
    const origin = new URL(c.req.url).origin;
    await deleteCache(c.env, `${origin}/api/tickets-active`);

    return c.json(r, 201);
  } catch {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

// Update a ticket package
// PUT /api/tickets/:id
// Body: { name: string, description: string, ... }
app.put('/api/tickets/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const db = drizzle(c.env.cinema_db, { schema });
    const body = await c.req.json().catch(() => ({}));
    const r = await updateTicketPackageImpl(
      db,
      { ticket_packages: schema.ticket_packages, movies: schema.movies },
      id,
      body as any,
      c.env
    );
    if (!r) return c.json({ status: 'error', message: 'Không tìm thấy' }, 404);

    // Clear cache active tickets
    const origin = new URL(c.req.url).origin;
    await deleteCache(c.env, `${origin}/api/tickets-active`);

    return c.json(r, 200);
  } catch {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

// Delete a ticket package
// DELETE /api/tickets/:id
app.delete('/api/tickets/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const db = drizzle(c.env.cinema_db, { schema });
    const r = await deleteTicketPackageImpl(
      db,
      { ticket_packages: schema.ticket_packages, bookings: schema.bookings },
      id,
      c.env
    );
    if (!r) return c.json({ status: 'error', message: 'Không tìm thấy' }, 404);

    // Clear cache active tickets
    const origin = new URL(c.req.url).origin;
    await deleteCache(c.env, `${origin}/api/tickets-active`);

    return c.json(r, 200);
  } catch {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

// Create site media
// POST /api/admin/site-media
// Body: { type: string, url: string, ... }
app.post('/api/admin/site-media', async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });
    const body = await c.req.json().catch(() => ({}));
    const r = await createSiteMediaImpl(db, { site_media: schema.site_media }, body as any, c.env.RUNTIME_ENV);
    return c.json(r, 201);
  } catch {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

// Upload Video (Worker Support) REMOVED DUPLICATE

// Update site media
// PUT /api/admin/site-media
// Body: { type: string, url: string, ... }
app.put('/api/admin/site-media', async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });
    const body = await c.req.json().catch(() => ({}));
    const r = await updateSiteMediaImpl(db, { site_media: schema.site_media }, body as any, c.env.RUNTIME_ENV);
    const status = (r as any)?.item ? 200 : 404;
    const payload = {
      ...(r as any),
      status: status >= 400 ? 'error' : 'success'
    };
    return c.json(payload as any, status);
  } catch {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

// Get list of site media
// GET /api/site-media?section=string&type=string&active=string
app.get('/api/site-media', async (c) => {
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

      return new Response(JSON.stringify(r), {
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

// Delete site media by ID
// DELETE /api/admin/site-media/:id
app.delete('/api/admin/site-media/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const db = drizzle(c.env.cinema_db, { schema });
    const { deleter } = getCloudHelpers(c.env);
    const r = await deleteSiteMediaImpl(db, { site_media: schema.site_media }, id, deleter);

    // Manual deletion from cloud storage for Worker environment
    if (r.ok && r.item && r.item.public_id) {
      const env = c.env;
      const publicId = String(r.item.public_id);

      // Try R2
      if (env.r2_cinemastore) {
        try {
          await env.r2_cinemastore.delete(publicId);
        } catch { }
      }

      // Try Cloudinary (manual fetch because SDK might not work in Worker or env missing in shared code)
      if (hasCloudinary(env)) {
        try {
          const type = r.item.type === 'video' ? 'video' : 'image';
          const timestamp = Math.floor(Date.now() / 1000);
          const params = { public_id: publicId, timestamp };
          const signed = await cloudinarySignedParams(env, params);
          const fd = new FormData();
          fd.append('public_id', publicId);
          fd.append('timestamp', String(timestamp));
          fd.append('api_key', signed.api_key);
          fd.append('signature', signed.signature);
          const cloudName = env.CLOUDINARY_CLOUD_NAME;
          const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/${type}/destroy`;
          await fetch(endpoint, { method: 'POST', body: fd });
        } catch { }
      }
    }

    const status = (r as any)?.ok ? 200 : 404;
    const payload = {
      ...(r as any),
      status: status >= 400 ? 'error' : 'success'
    };
    return c.json(payload as any, status);
  } catch (err: any) {
    return c.json({ message: err?.message || 'Lỗi máy chủ nội bộ' }, 500);
  }
});

// Debug mail parity
app.get('/api/debug/mail', async (_c) => {
  return new Response(
    JSON.stringify({
      ok: true,
      message: 'Mail debug endpoint disabled in Worker'
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
});

app.get('/api/debug/test-mail', async (c) => {
  const email = c.req.query('email');
  if (!email) return c.json({ error: 'Missing email param' }, 400);
  const res = await sendMail(c.env, email, 'Test Brevo Worker', '<h1>It works!</h1>');
  return c.json(res);
});

// Create MoMo payment request
// POST /api/payments/momo/create
// Body: { amount: number, orderId: string, orderInfo: string, ... }
app.post('/api/momo/create-payment', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));

    // 1) redirectUrl: ưu tiên lấy từ client (để support preview domain), nhưng phải kiểm tra hostname
    const rawRedirectFromClient = String((body as any)?.redirectUrl || '');
    let redirectUrl = '';
    const allowHost = (host: string) =>
      host === 'cinesphere.com.vn' ||
      host === 'www.cinesphere.com.vn' ||
      host === 'cinema-pages.pages.dev' ||
      host.endsWith('.cinema-pages.pages.dev');

    if (rawRedirectFromClient) {
      try {
        const u = new URL(rawRedirectFromClient);
        if (allowHost(u.hostname)) {
          redirectUrl = u.toString();
        }
      } catch {
        // ignore, sẽ fallback phía dưới
      }
    }

    // Fallback: Thử lấy từ Origin header của request (Dynamic cho Preview)
    if (!redirectUrl) {
      const origin = c.req.header('Origin');
      if (origin) {
        try {
          const u = new URL(origin);
          if (allowHost(u.hostname)) {
            const redirectPath = c.env.VITE_MOMO_REDIRECT_URL || '/checkout';
            redirectUrl = `${origin}${redirectPath}`;
          }
        } catch { }
      }
    }

    // Fallback: build từ env nếu client không gửi hoặc không hợp lệ
    if (!redirectUrl) {
      const clientBase = c.env.VITE_CLIENT_BASE_URL || 'https://cinesphere.com.vn';
      const redirectPath = c.env.VITE_MOMO_REDIRECT_URL || '/checkout';
      redirectUrl = redirectPath.startsWith('http') ? redirectPath : `${clientBase}${redirectPath}`;
    }

    // 2) ipnUrl: luôn dùng server base (không tin client, tránh bị đổi IPN)
    const serverBase = c.env.VITE_SERVER_BASE_URL || 'https://cinesphere.com.vn';
    const ipnPath = c.env.VITE_MOMO_IPN_URL || '/api/momo/ipn';
    const ipnUrl = ipnPath.startsWith('http') ? ipnPath : `${serverBase}${ipnPath}`;

    const config = {
      partnerCode: c.env.VITE_MOMO_PARTNER_CODE,
      accessKey: c.env.VITE_MOMO_ACCESS_KEY,
      secretKey: c.env.VITE_MOMO_SECRET_KEY,
      endpoint: c.env.VITE_MOMO_ENDPOINT,
      redirectUrl,
      ipnUrl
    };
    const r = await createMomoPaymentImpl({ ...body, ...config } as any);
    const status = typeof (r as any).status === 'number' ? (r as any).status : 200;
    const payload = {
      ...(r as any),
      status: status >= 400 ? 'error' : 'success'
    };
    return c.json(payload, status as any);
  } catch (err: any) {
    return c.json({ message: err?.message || 'Internal error' }, 500);
  }
});
app.post('/api/momo/ipn', async (_c) => {
  try {
    const r = await momoIpnImpl();
    return new Response(JSON.stringify(r), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch {
    return new Response(JSON.stringify({ result: false }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
app.post('/api/vnpay/create-payment', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const ip = c.req.header('CF-Connecting-IP') || '127.0.0.1';
    // returnUrl phải là URL frontend (nơi user quay lại)
    const rawReturnFromClient = String((body as any)?.returnUrl || '');
    let returnUrl = '';
    const allowHost = (host: string) =>
      host === 'cinesphere.com.vn' ||
      host === 'www.cinesphere.com.vn' ||
      host === 'cinema-pages.pages.dev' ||
      host.endsWith('.cinema-pages.pages.dev');

    if (rawReturnFromClient) {
      try {
        const u = new URL(rawReturnFromClient);
        if (allowHost(u.hostname)) {
          returnUrl = u.toString();
        }
      } catch {
        // ignore
      }
    }

    // Fallback: Thử lấy từ Origin header
    if (!returnUrl) {
      const origin = c.req.header('Origin');
      if (origin) {
        try {
          const u = new URL(origin);
          if (allowHost(u.hostname)) {
            const returnPath = c.env.VITE_VNPAY_RETURN_URL || '/checkout';
            returnUrl = `${origin}${returnPath}`;
          }
        } catch { }
      }
    }

    if (!returnUrl) {
      const clientBase = c.env.VITE_CLIENT_BASE_URL || 'https://cinesphere.com.vn';
      const returnPath = c.env.VITE_VNPAY_RETURN_URL || '/checkout';
      returnUrl = returnPath.startsWith('http') ? returnPath : `${clientBase}${returnPath}`;
    }

    const config = {
      tmnCode: c.env.VITE_VNPAY_TMN_CODE,
      hashSecret: c.env.VITE_VNPAY_HASH_SECRET,
      gateway: c.env.VITE_VNPAY_GATEWAY,
      returnUrl
    };
    const r = await createVnpayPaymentImpl({ ...(body as any), ip, ...config }, c.env.RUNTIME_ENV);
    const status = typeof (r as any).status === 'number' ? (r as any).status : 200;
    const payload = {
      ...(r as any),
      status: status >= 400 ? 'error' : 'success'
    };
    return c.json(payload, status as any);
  } catch (err: any) {
    return c.json({ message: err?.message || 'Internal error' }, 500);
  }
});
app.post('/api/vnpay/ipn', async (_c) => {
  const r = await vnpayIpnImpl();
  return new Response(JSON.stringify(r), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
});


// ===== AI ANALYTICS ENDPOINT =====
// POST /api/ai-analytics
// Body: { userMessage: string }
app.post("/api/ai-analytics", async (c) => {
  try {
    if (!c.env.AI) {
      return c.json({ error: "AI binding khong kha dung." }, 503);
    }

    const body = await c.req.json().catch(() => ({}));
    const userMessage = String((body as any).userMessage || "").trim();
    if (!userMessage) {
      return c.json({ error: "Thieu cau hoi (userMessage)." }, 400);
    }

    const db = drizzle(c.env.cinema_db, { schema });

    // 1. Overall summary
    const [sr] = await db
      .select({
        total_bookings: count(schema.bookings.id),
        total_revenue: sql<number>`COALESCE(SUM(CASE WHEN ${schema.bookings.payment_status}='paid' THEN ${schema.bookings.total_price} ELSE 0 END),0)`,
        paid_count: sql<number>`SUM(CASE WHEN ${schema.bookings.payment_status}='paid'    THEN 1 ELSE 0 END)`,
        pending_count: sql<number>`SUM(CASE WHEN ${schema.bookings.payment_status}='pending' THEN 1 ELSE 0 END)`,
        failed_count: sql<number>`SUM(CASE WHEN ${schema.bookings.payment_status}='failed'  THEN 1 ELSE 0 END)`,
        used_tickets: sql<number>`SUM(CASE WHEN ${schema.bookings.is_used}=1 THEN 1 ELSE 0 END)`,
      })
      .from(schema.bookings)
      .all();

    // 2. Revenue by payment method
    const revenueByMethod = await db
      .select({
        method: schema.bookings.payment_method,
        revenue: sql<number>`SUM(${schema.bookings.total_price})`,
        cnt: count(schema.bookings.id),
      })
      .from(schema.bookings)
      .where(eq(schema.bookings.payment_status, "paid"))
      .groupBy(schema.bookings.payment_method)
      .all();

    // 3. Top movies by bookings
    const topMovies = await db
      .select({
        title: schema.bookings.movie_title,
        bookings: count(schema.bookings.id),
        revenue: sql<number>`SUM(CASE WHEN ${schema.bookings.payment_status}='paid' THEN ${schema.bookings.total_price} ELSE 0 END)`,
      })
      .from(schema.bookings)
      .where(sql`${schema.bookings.movie_title} IS NOT NULL`)
      .groupBy(schema.bookings.movie_title)
      .orderBy(desc(count(schema.bookings.id)))
      .limit(10)
      .all();

    // 4. Peak booking hours (0-23)
    const peakHours = await db
      .select({
        hour: sql<number>`CAST(strftime('%H',${schema.bookings.created_at}) AS INTEGER)`,
        cnt: count(schema.bookings.id),
      })
      .from(schema.bookings)
      .groupBy(sql`strftime('%H',${schema.bookings.created_at})`)
      .orderBy(sql`strftime('%H',${schema.bookings.created_at})`)
      .all();

    // 5. Monthly revenue current year
    const yr = new Date().getFullYear();
    const monthlyRevenue = await db
      .select({
        month: sql<number>`CAST(strftime('%m',${schema.bookings.paid_at}) AS INTEGER)`,
        revenue: sql<number>`SUM(${schema.bookings.total_price})`,
        cnt: count(schema.bookings.id),
      })
      .from(schema.bookings)
      .where(
        and(
          eq(schema.bookings.payment_status, "paid"),
          sql`strftime('%Y',${schema.bookings.paid_at})='${sql.raw(String(yr))}'`
        )
      )
      .groupBy(sql`strftime('%m',${schema.bookings.paid_at})`)
      .orderBy(sql`strftime('%m',${schema.bookings.paid_at})`)
      .all();

    // 6. Top ticket packages
    const topPackages = await db
      .select({
        pkg: schema.bookings.ticket_package_name,
        cnt: count(schema.bookings.id),
        revenue: sql<number>`SUM(CASE WHEN ${schema.bookings.payment_status}='paid' THEN ${schema.bookings.total_price} ELSE 0 END)`,
      })
      .from(schema.bookings)
      .where(sql`${schema.bookings.ticket_package_name} IS NOT NULL`)
      .groupBy(schema.bookings.ticket_package_name)
      .orderBy(desc(count(schema.bookings.id)))
      .limit(8)
      .all();

    // 7. Ticket Packages Catalog
    const packagesCatalog = await db.select({
      name: schema.ticket_packages.name,
      price: schema.ticket_packages.price,
      combo: schema.ticket_packages.combo,
      is_active: schema.ticket_packages.is_active,
    }).from(schema.ticket_packages).all();

    // 8. Active Movies
    const activeMovies = await db.select({
      title: schema.movies.title,
    }).from(schema.movies).where(eq(schema.movies.is_active, true)).all();

    // 9. Recent 30 Bookings
    const recentBookings = await db.select({
      code: schema.bookings.booking_code,
      name: schema.bookings.name,
      email: schema.bookings.email,
      movie: schema.bookings.movie_title,
      pkg: schema.bookings.ticket_package_name,
      price: schema.bookings.total_price,
      status: schema.bookings.payment_status,
      date: sql<string>`strftime('%Y-%m-%d %H:%M', ${schema.bookings.created_at})`
    }).from(schema.bookings).orderBy(desc(schema.bookings.created_at)).limit(30).all();

    // 10. Daily revenue last 30 days
    const dailyRevenueRows = await db.select({
      date: sql<string>`strftime('%Y-%m-%d', ${schema.bookings.paid_at})`,
      revenue: sql<number>`SUM(${schema.bookings.total_price})`,
      cnt: count(schema.bookings.id)
    })
      .from(schema.bookings)
      .where(and(
        eq(schema.bookings.payment_status, "paid"),
        sql`${schema.bookings.paid_at} IS NOT NULL`
        // SQLite date comparison works with string comparison if formatted correctly.
        // We will just fetch top 30 recent paid days to be safe across dialects.
      ))
      .groupBy(sql`strftime('%Y-%m-%d', ${schema.bookings.paid_at})`)
      .orderBy(desc(sql`strftime('%Y-%m-%d', ${schema.bookings.paid_at})`))
      .limit(30)
      .all();

    // 11. Top users failed/cancelled
    const failedUsersRows = await db.select({
      email: schema.bookings.email,
      name: schema.bookings.name,
      failed_count: count(schema.bookings.id)
    })
      .from(schema.bookings)
      .where(sql`${schema.bookings.payment_status} IN ('failed', 'pending')`)
      .groupBy(schema.bookings.email, schema.bookings.name)
      .orderBy(desc(count(schema.bookings.id)))
      .limit(10)
      .all();

    // 12. Toys catalog
    const toysCatalog = await db.select({
      name: schema.toys.name,
      stock: schema.toys.stock,
      status: schema.toys.status,
      price: schema.toys.price
    }).from(schema.toys).all();

    const ctx = {
      summary: {
        total_bookings: Number(sr?.total_bookings ?? 0),
        total_revenue_paid: Number(sr?.total_revenue ?? 0),
        paid_bookings: Number(sr?.paid_count ?? 0),
        pending_bookings: Number(sr?.pending_count ?? 0),
        failed_bookings: Number(sr?.failed_count ?? 0),
        tickets_used: Number(sr?.used_tickets ?? 0),
      },
      revenue_by_payment_method: revenueByMethod.map(r => ({
        method: r.method ?? "unknown", revenue: Number(r.revenue ?? 0), count: Number(r.cnt ?? 0),
      })),
      top_movies: topMovies.map(r => ({
        title: r.title ?? "N/A", bookings: Number(r.bookings ?? 0), revenue: Number(r.revenue ?? 0),
      })),
      peak_booking_hours: peakHours.map(r => ({
        hour: Number(r.hour ?? 0), bookings: Number(r.cnt ?? 0),
      })),
      monthly_revenue: monthlyRevenue.map(r => ({
        month: Number(r.month ?? 0), revenue: Number(r.revenue ?? 0), count: Number(r.cnt ?? 0),
      })),
      top_ticket_packages: topPackages.map(r => ({
        package: r.pkg ?? "N/A", count: Number(r.cnt ?? 0), revenue: Number(r.revenue ?? 0),
      })),
      // MỚI: Dữ liệu mở rộng để AI linh hoạt hơn
      catalog_ticket_packages: packagesCatalog,
      catalog_active_movies: activeMovies.map(m => m.title),
      catalog_toys_inventory: toysCatalog,
      recent_30_bookings: recentBookings,
      daily_revenue_last_30_days: dailyRevenueRows.map(r => ({ date: r.date, revenue: Number(r.revenue ?? 0), count: Number(r.cnt ?? 0) })),
      top_users_failed_bookings: failedUsersRows.map(r => ({ email: r.email, name: r.name, failed_count: Number(r.failed_count ?? 0) }))
    };

    const systemPrompt = `Bạn là chuyên gia phân tích dữ liệu kinh doanh cho rạp chiếu phim CINESPHERE (chỉ có 1 phòng chiếu tại Việt Nam).
Dưới đây là DỮ LIỆU THỰC TẾ mới nhất từ hệ thống database (trích xuất dạng JSON). Bạn PHẢI dùng dữ liệu này để trả lời câu hỏi của người dùng.

DỮ LIỆU THỰC TẾ:
${JSON.stringify(ctx, null, 2)}

YÊU CẦU BẮT BUỘC KHÁC:
1. LUÔN LUÔN giao tiếp và trả lời bằng TIẾNG VIỆT có dấu (Vietnamese).
2. Phải trả về DUY NHẤT một chuỗi JSON hợp lệ. KHÔNG thêm bất kỳ văn bản ngoài JSON.
3. KỸ NĂNG GHÉP DỮ LIỆU (JOIN DATA): Nếu user hỏi nhiều thông tin đan chéo (như tìm gói hot nhất, sau đó hiển thị danh sách các code đặt vé của gói đó kèm ngày tháng và combo), bạn PHẢI tìm data từ nhiều mảng khác nhau (ví dụ: dùng "top_ticket_packages" để biết gói hot, sau đó lọc trong "recent_30_bookings" để lấy code/date, và lấy "catalog_ticket_packages" để xem combo).

Cấu trúc JSON bắt buộc phải tuân thủ:
{
  "internal_thought": "BẮT BUỘC: Viết ra suy luận của bạn từng bước bằng tiếng Việt trước khi tổng hợp data. Ví dụ: Bước 1: Tìm gói hot nhất. Bước 2: Lọc các booking có gói đó. Bước 3: Lấy thông tin ngày, code. Bước 4: Format output.",
  "display_type": "table" | "dynamic_chart" | "summary",
  "analysis_summary": "Câu trả lời thân thiện (100% tiếng Việt).",
  "ui_config": {
    "title": "Tiêu đề bảng/biểu đồ",
    "chart_type": "bar" | "line" | "pie",
    "x_axis_key": "tên key trục X",
    "y_axis_key": "tên key trục Y",
    "y_axis_label": "Nhãn trục Y",
    "color": "#6366f1"
  },
  "processed_data": [
    // TỰ DO TẠO CÁC PROPERTY MỚI BẰNG CÁCH GHÉP TỪ NHIỀU NGUỒN.
    // VD: { "package": "Vé 1 người", "code": "B123", "date": "2026-01-01", "combo": "Bắp nước" }
  ]
}

HƯỚNG DẪN CHỌN "display_type":
- "dynamic_chart": Lưu đồ xu hướng, so sánh (doanh thu tháng, giờ cao điểm).
- "table": Liệt kê chi tiết danh sách, lịch sử, so sánh có nhiều cột (VD: xem danh sách đơn hàng của 1 gói).
- "summary": Câu hỏi dạng thảo luận, không cần bảng.`;

    const aiResp: any = await c.env.AI.run("@cf/meta/llama-3-8b-instruct", {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_tokens: 1500,
      temperature: 0.3,
    });

    const rawText = String(aiResp?.response ?? aiResp?.result ?? "");

    let parsed: any;
    try {
      const m = rawText.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("no json");
      parsed = JSON.parse(m[0]);
    } catch {
      parsed = {
        display_type: "summary",
        analysis_summary: rawText || "AI khong the phan tich. Vui long thu lai.",
        ui_config: { title: "Ket qua phan tich" },
        processed_data: [],
      };
    }

    return c.json({ ok: true, result: parsed });
  } catch (err: any) {
    console.error("[ai-analytics]", err);
    return c.json({ error: String(err?.message || "Loi may chu noi bo") }, 500);
  }
});

export default app;
