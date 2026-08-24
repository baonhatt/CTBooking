// Main API server setup using Hono framework

import { Hono, Context } from 'hono';

import { cors } from 'hono/cors';

import { drizzle } from 'drizzle-orm/d1';

import * as schema from './schema';

import { eq, desc, asc, and, like, or, sql, count } from 'drizzle-orm';

import type { D1Database, R2Bucket, KVNamespace } from '@cloudflare/workers-types';

import { requireAuth, requireStaffAuth, requirePermission } from './middleware';

import { getAllActiveMoviesToday, listMovies, getMovie } from '../../server/routes/user/movies';

import {
  createMovieImpl,
  updateMovieImpl,
  deleteMovieImpl,
  getMovieByIdImpl,
  updateMovieStatusImpl,
  restoreMovieImpl,
  listDeletedMoviesImpl
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

function getRestrictBranchIds(c: any): number[] | null {
  const isSuperAdmin = c.get('isSuperAdmin');
  const staffBranchIds = c.get('staffBranchIds') || [];
  return isSuperAdmin ? null : staffBranchIds;
}

import {
  loginImpl,
  registerImpl,
  loginWithSessionImpl,
  validateSessionTokenImpl,
  validateOTPImpl,
  resendOTPImpl
} from '../../server/routes/user/auth';

import { forgetPassImpl, resetPasswordImpl, changePasswordImpl } from '../../server/routes/user/password';

import { listActiveToys } from '../../server/routes/user/toys';

import { listToysImpl, createToyImpl, getToyImpl, updateToyImpl, deleteToyImpl } from '../../server/routes/admin/toys';

import {
  listTicketPackagesImpl,
  getTicketPackageImpl,
  createTicketPackageImpl,
  updateTicketPackageImpl,
  deleteTicketPackageImpl,
  restoreTicketPackageImpl,
  listDeletedTicketPackagesImpl,
  toggleTicketStatusImpl
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

import {
  listPostsImpl,
  getPostImpl,
  createPostImpl,
  updatePostImpl,
  deletePostImpl,
  incrementPostViewImpl
} from '../../server/routes/admin/posts';

import {
  listBranchesImpl,
  listBranchOptionsImpl,
  getBranchImpl,
  getDefaultBranchImpl,
  createBranchImpl,
  updateBranchImpl,
  deleteBranchImpl,
  restoreBranchImpl,
  toggleBranchStatusImpl,
  toggleBranchOpenImpl,
  listDeletedBranchesImpl
} from '../../server/routes/admin/branches';

import {
  listShowtimesImpl,
  createShowtimeImpl,
  updateShowtimeImpl,
  deleteShowtimeImpl,
  copyShowtimesImpl
} from '../../server/routes/admin/showtimes';

import { getPublicScheduleImpl } from '../../server/routes/user/showtimes';

import {
  listActiveVRPackagesImpl,
  validateVRBookingImpl,
  createVRBookingImpl,
  getVRBookingByIdImpl,
} from '../../server/routes/user/vr-bookings';

import { validateVoucherForVRImpl } from '../../server/routes/user/vouchers';

import {
  listVouchersImpl,
  listDeletedVouchersImpl,
  getVoucherImpl,
  createVoucherImpl,
  updateVoucherImpl,
  toggleVoucherStatusImpl,
  deleteVoucherImpl,
  restoreVoucherImpl,
} from '../../server/routes/admin/vouchers';

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
  getWelcomeEmailTemplate,
  getBookingEmailTemplate,
  getResetPasswordEmailTemplate,
  logSystemError,
  withCache,
  checkRateLimitKV,
  isLocal,
  parseMediaUrl,
  localUploader,
  localDeleter,
  pingIndexNow,
  generateSessionToken,
  calculateSessionExpiry,
  formatDateForDb
} from './utils';

import { sendMail } from '../../server/routes/mail-service';

function getMailer(c: Context) {
  return async (to: string, subject: string, html: string) => {
    const res = await sendMail(to, subject, html, c.env);
    if (res.ok) {
      console.log(`[Mailer] Sent email to ${to} via ${res.provider}`);
    }
    return res;
  };
}

type Variables = {
  userId?: number;

  accountId?: number;

  staffId?: number;

  staffEmail?: string;

  staffFullname?: string;

  isSuperAdmin?: boolean;

  staffPermissions?: Array<{ module: string; action: string }>;

  staffBranchIds?: number[];
};

type Bindings = {
  cinema_db: D1Database;

  r2_cinemastore: R2Bucket;

  KV_BINDING: KVNamespace;

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

  IS_PREVIEW?: string;

  VITE_RATE_LIMIT_BOOKING_CHECK_MAX: string;

  VITE_RATE_LIMIT_BOOKING_CHECK_WINDOWMS: string;
  SUPER_ADMIN_EMAIL: string;
  SUPER_ADMIN_PASSWORD: string;
  SUPER_ADMIN_FULLNAME: string;

  AI: any; // Cloudflare Workers AI binding
};

const getCloudHelpers = (c: Context, env: Bindings) => {
  return {
    uploader: async (base64: string, folder: string) => {
      try {
        if (hasCloudinary(env)) {
          const res = await uploadCloudinaryImageDataURI(env, base64, folder);
          return { url: res.url };
        }
      } catch (err) {
        console.warn('[Uploader] Cloudinary upload failed, using Data URI fallback:', err);
      }
      return { url: base64 };
    },

    deleter: async (url: string, type: 'image' | 'video' = 'image') => {
      try {
        const publicId = getPublicIdFromUrl(url);
        if (publicId && hasCloudinary(env)) {
          await deleteCloudinaryImage(env, publicId, type);
        }
      } catch (err) {
        console.warn('[Deleter] Cloudinary delete warning:', err);
      }
    }
  };
};

const app = new Hono<{ Variables: Variables; Bindings: Bindings }>();

// DEBUG: Global Request Logger

app.use('*', async (c, next) => {
  const url = new URL(c.req.url);

  const isL = isLocal(c.req.url);

  console.log(`[Worker Request] ${c.req.method} ${url.pathname} (Local: ${isL})`);

  await next();
});

// Serve local uploads during development - MOVE TO TOP

app.get('/uploads/*', async (c) => {
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

app.use(
  '*',

  cors({
    origin: (origin, c) => {
      if (!origin) return 'https://cinesphere.com.vn';

      // Allow localhost for development automatically

      try {
        const url = new URL(c.req.url);

        if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
          if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
            return origin;
          }
        }
      } catch {}

      const allowedExact = new Set([
        'https://cinesphere.com.vn',

        'https://www.cinesphere.com.vn',

        'https://api.cinesphere.com.vn', // API domain

        'https://admin.cinesphere.com.vn', // Admin domain

        'https://cinema-pages.pages.dev', // Pages production

        'https://cinema-next-pages.pages.dev', // Next.js user client production

        'https://cinema-next.pages.dev', // Next.js user client (actual .pages.dev URL)

        'https://cinema-admin-pages.pages.dev' // Admin client production
      ]);

      if (allowedExact.has(origin)) return origin;

      // Allow all preview subdomains for cinema-pages, cinema-next-pages, cinema-admin-pages on pages.dev

      try {
        const url = new URL(origin);

        if (
          url.hostname === 'cinema-pages.pages.dev' ||
          url.hostname.endsWith('.cinema-pages.pages.dev') ||
          url.hostname === 'cinema-next-pages.pages.dev' ||
          url.hostname.endsWith('.cinema-next-pages.pages.dev') ||
          url.hostname === 'cinema-next.pages.dev' ||
          url.hostname.endsWith('.cinema-next.pages.dev') ||
          url.hostname === 'cinema-admin-pages.pages.dev' ||
          url.hostname.endsWith('.cinema-admin-pages.pages.dev')
        ) {
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

  let isLocal = false;

  try {
    const url = new URL(c.req.url);

    isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  } catch {}

  return c.json(
    {
      status: 'error',

      message: err.message || 'Internal Server Error',

      stack: isLocal || c.env.IS_PREVIEW === 'true' ? err.stack : undefined
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

    const mailer = getMailer(c);

    const r = await loginWithSessionImpl(
      db,

      { accounts: schema.accounts, users: schema.users, tokens: schema.tokens, email_logs: schema.email_logs },

      { ...body, days: 30 },

      generateSessionToken,

      calculateSessionExpiry,

      c.env.KV_BINDING,

      mailer,

      { waitUntil: (promise) => c.executionCtx.waitUntil(promise) }
    );

    const status = typeof (r as any).status === 'number' ? (r as any).status : 200;

    if (status === 200 && (r as any).requires_otp) {
      return c.json(
        {
          status: 'success',

          requires_otp: true,

          message: (r as any).message,

          temp_account_id: (r as any).temp_account_id,

          email: (r as any).email
        },
        200
      );
    }

    if (status === 200 && (r as any).user) {
      // Set httpOnly cookie

      const isLocalEnv = isLocal(c.req.url);

      const cookieOptions = isLocalEnv
        ? 'Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000' // 30 days
        : 'Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000';

      c.header('Set-Cookie', `session_token=${(r as any).token}; ${cookieOptions}`);

      return c.json(
        {
          status: 'success',

          message: (r as any).message,

          user: (r as any).user,

          token: (r as any).token
        },
        200
      );
    }

    const payload = {
      ...(r as any),

      status: status >= 400 ? 'error' : 'success'
    };

    return c.json(payload as any, status as any);
  } catch {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

// OTP validation endpoint

// POST /api/validate-otp

// Body: { temp_account_id: number, otp: string }

app.post('/api/validate-otp', async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });

    const body = await c.req.json().catch(() => ({}));

    const r = await validateOTPImpl(
      db,

      { accounts: schema.accounts, users: schema.users, tokens: schema.tokens, email_logs: schema.email_logs },

      { ...body, days: 30 },

      generateSessionToken,

      calculateSessionExpiry
    );

    const status = typeof (r as any).status === 'number' ? (r as any).status : 200;

    if (status === 200 && (r as any).user) {
      // Set httpOnly cookie

      const isLocalEnv = isLocal(c.req.url);

      const cookieOptions = isLocalEnv
        ? 'Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000' // 30 days
        : 'Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000';

      c.header('Set-Cookie', `session_token=${(r as any).token}; ${cookieOptions}`);

      return c.json(
        {
          status: 'success',

          message: (r as any).message,

          user: (r as any).user,

          token: (r as any).token
        },
        200
      );
    }

    const payload = {
      ...(r as any),

      status: status >= 400 ? 'error' : 'success'
    };

    return c.json(payload as any, status as any);
  } catch {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

// Resend OTP endpoint

// POST /api/resend-otp

// Body: { temp_account_id: number, email: string }

app.post('/api/resend-otp', async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });

    const body = await c.req.json().catch(() => ({}));

    const mailer = getMailer(c);

    const r = await resendOTPImpl(
      db,

      { accounts: schema.accounts, users: schema.users, tokens: schema.tokens, email_logs: schema.email_logs },

      body,

      c.env.KV_BINDING,

      mailer,

      { waitUntil: (promise) => c.executionCtx.waitUntil(promise) }
    );

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

    const mailer = getMailer(c);

    const appBaseUrl = c.env.VITE_CLIENT_BASE_URL || 'https://cinesphere.com.vn';

    const renderWelcome = (data: { customerName: string; email: string }) => getWelcomeEmailTemplate(appBaseUrl, data);

    const r = await registerImpl(
      db,

      { accounts: schema.accounts, users: schema.users, email_logs: schema.email_logs },

      body as any,

      mailer,

      renderWelcome,

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

    const mailer = getMailer(c);

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
      } catch {}
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

      body as any
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

// Logout endpoint

// POST /api/logout

app.post('/api/logout', async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });

    const token = c.req.header('cookie')?.match(/session_token=([^;]+)/)?.[1];

    if (token) {
      await db.delete(schema.tokens).where(eq(schema.tokens.token, token));
    }

    // Clear cookie

    const isLocalEnv = isLocal(c.req.url);

    const cookieOptions = isLocalEnv
      ? 'Path=/; HttpOnly; SameSite=Lax; Max-Age=0'
      : 'Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';

    c.header('Set-Cookie', `session_token=; ${cookieOptions}`);

    return c.json({ status: 'success', message: 'Đăng xuất thành công' });
  } catch {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

// DEPRECATED: Use /api/admin/auth/login instead
app.post('/api/admin/login', (c) => {
  return c.json(
    {
      status: 'error',
      message: 'Endpoint này đã bị xóa. Vui lòng dùng /api/admin/auth/login'
    },
    410
  );
});

/* Old handler removed for security
app.post('/api/admin/login_old', async (c) => {

        try {

                const db = drizzle(c.env.cinema_db, { schema });

                const body = await c.req.json().catch(() => ({}));

                const mailer = getMailer(c);

                        const res = await sendMail(c.env, to, sub, html);

                        if (!res.ok) throw new Error(`Email failed: ${res.status} ${res.body}`);

                        return res;

                };

                const r = await loginWithSessionImpl(

                        db,

                        { accounts: schema.accounts, users: schema.users, tokens: schema.tokens, email_logs: schema.email_logs },

                        { ...body, days: 1 },

                        generateSessionToken,

                        calculateSessionExpiry,

                        c.env.KV_BINDING,

                        mailer,

                        { waitUntil: (promise) => c.executionCtx.waitUntil(promise) }

                );

                const status = typeof (r as any).status === 'number' ? (r as any).status : 200;



                if (status === 200 && (r as any).requires_otp) {

                        return c.json({

                                status: 'success',

                                requires_otp: true,

                                message: (r as any).message,

                                temp_account_id: (r as any).temp_account_id,

                                email: (r as any).email

                        }, 200);

                }



                if (status === 200 && (r as any).user) {

                        // Set cookie với Max-Age 1 ngày (86400 seconds)

                        const isLocalEnv = isLocal(c.req.url);

                        const cookieOptions = isLocalEnv

                                ? 'Path=/; HttpOnly; SameSite=Lax; Max-Age=86400' // 1 day

                                : 'Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400'; // 1 day



                        c.header('Set-Cookie', `session_token=${(r as any).token}; ${cookieOptions}`);



                        return c.json({

                                status: 'success',

                                message: (r as any).message,

                                user: (r as any).user,

                                token: (r as any).token

                        }, 200);

                }



                const payload = {

                        ...(r as any),

                        status: status >= 400 ? 'error' : 'success'

                };

                return c.json(payload as any, status as any);

        } catch {
                return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
        }
}); */

app.get('/api/admin/revenue', requireStaffAuth, requirePermission('dashboard', 'view_revenue'), async (c) => {
  try {
    const from = String(c.req.query('from') || '');

    const to = String(c.req.query('to') || '');

    const status = String(c.req.query('status') || 'paid');

    const db = drizzle(c.env.cinema_db, { schema });
    const restrictBranchIds = getRestrictBranchIds(c);

    const r = await getRevenueImpl(
      db,
      { bookings: schema.bookings },
      { from, to, status, restrictToBranchIds: restrictBranchIds }
    );

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

app.get('/api/admin/transactions', requireStaffAuth, requirePermission('transactions', 'view'), async (c) => {
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
    const booking_type_raw = String(c.req.query('booking_type') || 'all');
    const booking_type = (['all', 'movie', 'vr'].includes(booking_type_raw) ? booking_type_raw : 'all') as 'all' | 'movie' | 'vr';
    const branch_id_raw = c.req.query('branch_id');
    const branch_id = branch_id_raw && branch_id_raw !== 'all' ? Number(branch_id_raw) : undefined;

    const db = drizzle(c.env.cinema_db, { schema });
    const restrictBranchIds = getRestrictBranchIds(c);

    const r = await listTransactionsImpl(
      db,
      {
        bookings: schema.bookings,
        users: schema.users,
        accounts: schema.accounts,
        movies: schema.movies,
        ticket_packages: schema.ticket_packages,
        vouchers: (schema as any).vouchers
      },
      {
        page,
        pageSize,

        searchText,

        status,

        sort,

        dir,

        payment_method,

        branch_id: branch_id,

        from,
        to,
        booking_type,
        restrictToBranchIds: restrictBranchIds
      }
    );

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

app.get('/api/admin/transactions/:id', requireStaffAuth, requirePermission('transactions', 'view'), async (c) => {
  try {
    const id = Number(c.req.param('id'));

    const db = drizzle(c.env.cinema_db, { schema });
    const restrictBranchIds = getRestrictBranchIds(c);

    const r = await getTransactionByIdImpl(
      db,

      {
        bookings: schema.bookings,

        users: schema.users,

        accounts: schema.accounts,

        movies: schema.movies,

        ticket_packages: schema.ticket_packages,

        branches: schema.branches,
        auditLogs: schema.auditLogs,
        booking_vr_items: (schema as any).booking_vr_items,
        vouchers: (schema as any).vouchers
      },
      id,
      restrictBranchIds
    );

    if (!r) return c.json({ message: 'Không tìm thấy' }, 404);

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// Get dashboard metrics (total users, movies, revenue, etc.)

// GET /api/admin/dashboard/metrics

app.get('/api/admin/dashboard/metrics', requireStaffAuth, requirePermission('dashboard', 'view'), async (c) => {
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

        branches: schema.branches
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

// Get revenue for a specific date

// GET /api/admin/dashboard/revenue-date?date=YYYY-MM-DD&status=paid

app.get(
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

// Get revenue data for the last 7 days

// GET /api/admin/dashboard/revenue-7days

app.get(
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

// Get monthly revenue data

// GET /api/admin/dashboard/revenue-month?year=YYYY&month=MM&status=paid

app.get(
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

app.get('/api/admin/users', requireStaffAuth, requirePermission('users', 'view'), async (c) => {
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

app.get('/api/admin/settings', requireStaffAuth, requirePermission('settings', 'view'), async (c) => {
  try {
    const r = await getAdminSettingsImpl(c.env.KV_BINDING);

    return c.json(r);
  } catch (err: any) {
    return c.json({ message: String(err?.message || 'Internal error') }, 500);
  }
});

app.post('/api/admin/settings', requireStaffAuth, requirePermission('settings', 'manage'), async (c) => {
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

app.get('/api/admin/users/:id', requireStaffAuth, requirePermission('users', 'view_detail'), async (c) => {
  try {
    const id = Number(c.req.param('id'));

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await getUserByIdImpl(
      db,

      {
        users: schema.users,

        bookings: schema.bookings,

        movies: schema.movies,

        ticket_packages: schema.ticket_packages,

        auditLogs: schema.auditLogs
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

app.post('/api/admin/cloudinary/sign', requireStaffAuth, requirePermission('uploads', 'upload'), async (c) => {
  try {
    const env = c.env;

    if (!hasCloudinary(env)) return c.json({ message: 'Thiếu cấu hình Cloudinary' }, 400);

    const body = await c.req.json().catch(() => null);

    const folder = String(body?.folder || '');

    const resourceType = String(body?.resource_type || '');

    if (!folder || !resourceType) return c.json({ message: 'Thiếu tham số cần thiết' }, 400);

    const timestamp = Math.floor(Date.now() / 1000);

    const isVideo = resourceType === 'video';

    const params = {
      timestamp,

      folder,

      use_filename: 'true',

      unique_filename: 'false',

      overwrite: 'true',

      ...(isVideo
        ? { allowed_formats: 'mp4,webm,mov', max_bytes: 104857600 } // 100MB for video
        : { allowed_formats: 'jpg,jpeg,png,webp,gif', max_bytes: 5242880 }) // 5MB for images
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

app.post('/api/admin/uploads/video', requireStaffAuth, requirePermission('uploads', 'upload'), async (c) => {
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

      cover_image: parseMediaUrl(m.cover_image ?? '', c),

      detail_images: (() => {
        const v = m.detail_images;

        if (v === null || v === undefined) return '[]';

        try {
          const parsed = typeof v === 'string' ? JSON.parse(v) : v;

          if (Array.isArray(parsed)) {
            const opt = parsed.map((u: string) => parseMediaUrl(u, c));

            return JSON.stringify(opt);
          }

          return typeof v === 'string' ? parseMediaUrl(v, c) : JSON.stringify(v);
        } catch {
          return '[]';
        }
      })()
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

// Schema tables for D1

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

// Confirm a booking after payment

// POST /api/confirm-booking

// Body: { bookingId: string, paymentDetails: object }

app.post('/api/confirm-booking', requireStaffAuth, requirePermission('ticket_check', 'validate'), async (c) => {
  let body: any = {};

  try {
    const db = drizzle(c.env.cinema_db, { schema });

    const tables = getD1Tables(schema);

    body = await c.req.json().catch(() => ({}));

    const mailer = getMailer(c);

    const appBaseUrl = c.env.VITE_CLIENT_BASE_URL || 'https://cinesphere.com.vn';

    const renderBooking = (data: any) => getBookingEmailTemplate(appBaseUrl, data);

    const r = await updatePaymentImpl(
      db,

      body as any,

      mailer,

      renderBooking,

      tables,

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

    const tables = getD1Tables(schema);

    const body = await c.req.json().catch(() => ({}));

    // Worker Mailer Injection

    const mailer = getMailer(c);

    const appBaseUrl = c.env.VITE_CLIENT_BASE_URL || 'https://cinesphere.com.vn';

    const renderBooking = (data: any) => getBookingEmailTemplate(appBaseUrl, data);

    const result = await handleSePayWebhookImpl(
      db,

      tables,

      body,

      mailer,

      renderBooking,

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

app.get('/api/bookings-code/:code', requireStaffAuth, requirePermission('ticket_check', 'scan'), async (c) => {
  // Rate Limit Check dùng KV

  const ip = c.req.header('CF-Connecting-IP') || 'unknown';

  const max = Number(c.env.VITE_RATE_LIMIT_BOOKING_CHECK_MAX) || 10;

  const windowMs = Number(c.env.VITE_RATE_LIMIT_BOOKING_CHECK_WINDOWMS) || 60000;

  const rlKey = `rl_booking_code:${ip}`;

  const current = await c.env.KV_BINDING?.get(rlKey);

  const count = current ? parseInt(current) : 0;

  if (count >= max) {
    const retrySec = Math.ceil(windowMs / 1000);

    c.header('Retry-After', String(retrySec));

    c.header('X-RateLimit-Limit', String(max));

    c.header('X-RateLimit-Remaining', '0');

    return c.json(
      {
        status: 'error',

        message: `Quá nhiều yêu cầu, vui lòng thử lại sau ${retrySec}s`
      },

      429
    );
  }

  // Tăng count và set TTL

  await c.env.KV_BINDING?.put(rlKey, String(count + 1), { expirationTtl: Math.ceil(windowMs / 1000) });

  c.header('X-RateLimit-Limit', String(max));

  c.header('X-RateLimit-Remaining', String(Math.max(0, max - (count + 1))));

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

app.post('/api/bookings-use', requireStaffAuth, requirePermission('ticket_check', 'validate'), async (c) => {
  const db = drizzle(c.env.cinema_db, { schema });

  const tables = getD1Tables(schema);

  const body = await c.req.json().catch(() => ({}));

  const code = String((body as any)?.code || '');

  const restrictBranchIds = getRestrictBranchIds(c);

  const r = await confirmUseTicketImpl(db, code, tables, restrictBranchIds);

  const status = (r as any)?.status === 'error' ? 400 : 200;

  const payload = {
    ...(r as any),

    status: status >= 400 ? 'error' : 'success'
  };

  return c.json(payload, status);
});

// Get list of movies

// GET /api/movies?page=1&pageSize=20&q=search_term&branch_id=1

app.get('/api/movies', async (c) => {
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

// Create a new movie

// POST /api/movies

// Body: { title: string, description: string, ... }

app.post('/api/movies', requireStaffAuth, requirePermission('movies', 'create'), async (c) => {
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

    const r = await createMovieImpl(
      db,

      { movies: schema.movies, auditLogs: schema.auditLogs },

      body as any,

      undefined,

      undefined,

      cloud.uploader,

      { id: staffId, email: staffEmail, fullname: staffFullname }
    );

    // Không cần xóa cache: KV cache cho phim đã bị vô hiệu hóa hoàn toàn

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
    const restrictBranchIds = getRestrictBranchIds(c);

    const movie = await getMovie(db, { movies: schema.movies }, id, restrictBranchIds);

    if (!movie) return c.json({ message: 'Không tìm thấy' }, 404);

    const parsedMovie = {
      ...movie,

      cover_image: parseMediaUrl(movie.cover_image, c)
    };

    return c.json({ movie: parsedMovie }, 200);
  } catch {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

app.get('/api/movies-detail/:id', async (c) => {
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

  const parsed = {
    ...r,

    cover_image: parseMediaUrl((r as any).cover_image, c),

    detail_images: Array.isArray((r as any).detail_images)
      ? (r as any).detail_images.map((u: string) => parseMediaUrl(u, c))
      : (r as any).detail_images
  };

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

// Update a movie

// PUT /api/movies/:id

// Body: { title: string, description: string, ... }

app.put('/api/movies/:id', requireStaffAuth, requirePermission('movies', 'edit'), async (c) => {
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
    console.error('[PUT /api/movies/:id] Error:', err?.message || err, err?.stack);

    const msg = err?.message || 'Lỗi máy chủ nội bộ';

    // Ưu tiên dùng statusCode từ error object nếu có (ví dụ conflict packages = 400)

    const statusCode = err?.statusCode || (msg.includes('Không thể') || msg.includes('đang được sử dụng') ? 400 : 500);

    return c.json({ status: 'error', message: msg }, statusCode);
  }
});

app.post('/api/movies-status/:id', requireStaffAuth, requirePermission('movies', 'toggle_status'), async (c) => {
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
});

// Delete a movie

// DELETE /api/movies/:id

app.delete('/api/movies/:id', requireStaffAuth, requirePermission('movies', 'delete'), async (c) => {
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

// POST /api/admin/movies/:id/restore
app.post('/api/admin/movies/:id/restore', requireStaffAuth, requirePermission('movies', 'restore'), async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const db = drizzle(c.env.cinema_db, { schema });
    const staffId = c.get('staffId');
    const staffEmail = c.get('staffEmail');
    const staffFullname = c.get('staffFullname');

    const r = await restoreMovieImpl(db, { movies: schema.movies, auditLogs: schema.auditLogs }, id, {
      id: staffId,
      email: staffEmail,
      fullname: staffFullname
    });

    return c.json(r, 200);
  } catch (err: any) {
    return c.json({ status: 'error', message: err.message || 'Lỗi máy chủ nội bộ' }, err.statusCode || 500);
  }
});

// GET /api/admin/deleted/movies
app.get('/api/admin/deleted/movies', requireStaffAuth, requirePermission('movies', 'view_deleted'), async (c) => {
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
});

app.get('/api/schedule', async (c) => {
  try {
    const branchId = Number(c.req.query('branch_id') || 0);
    const db = drizzle(c.env.cinema_db, { schema });
    const r = await getPublicScheduleImpl(db, {
      showtimes: schema.showtimes,
      movies: schema.movies
    }, branchId);
    return c.json(r, 200);
  } catch {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

app.get('/api/showtimes', requireStaffAuth, requirePermission('showtimes', 'view'), async (c) => {
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

app.post('/api/showtimes', requireStaffAuth, requirePermission('showtimes', 'create'), async (c) => {
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

app.post('/api/showtimes/copy', requireStaffAuth, requirePermission('showtimes', 'create'), async (c) => {
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

app.put('/api/showtimes/:id', requireStaffAuth, requirePermission('showtimes', 'edit'), async (c) => {
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

app.delete('/api/showtimes/:id', requireStaffAuth, requirePermission('showtimes', 'delete'), async (c) => {
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

app.get('/api/admin/email-logs', requireStaffAuth, requirePermission('email_logs', 'view'), async (c) => {
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

        ticket_packages: schema.ticket_packages,

        auditLogs: schema.auditLogs
      },

      id
    );

    if (!r) return c.json({ status: 'error', message: 'Không tìm thấy' }, 404);

    return c.json(r, 200);
  } catch {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

// ===== PROTECTED USER ROUTES (requires login) =====

// All routes in this section require valid session token

// Middleware: requireAuth checks session token from cookie or Authorization header

// Get user profile by email

// GET /api/users-profile?email=user@example.com

app.get('/api/users-profile', requireAuth, async (c) => {
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

app.post('/api/users-profile', requireAuth, async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });

    const body = await c.req.json().catch(() => ({}));

    const r = await updateUserProfileImpl(
      db,

      { accounts: schema.accounts, users: schema.users },

      body as any
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

app.post('/api/users-password', requireAuth, async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });

    const body = await c.req.json().catch(() => ({}));

    const r = await changePasswordImpl(db, { accounts: schema.accounts }, body as any);

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

app.get('/api/usersprofile/transactions', requireAuth, async (c) => {
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

      { email, status, page, pageSize, sort, dir, payment_method, from, to }
    );

    return c.json(r, 200);
  } catch {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

// ===== END PROTECTED USER ROUTES =====

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

    return c.json(
      {
        ...r,

        items: (r.items as any[]).map((t: any) => ({
          ...t,

          image: parseMediaUrl(t.image, c)
        }))
      },
      200
    );
  } catch {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

// Get list of active toys

app.get('/api/toys-active', async (c) => {
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

// Get toy details by ID

// GET /api/toys/:id

app.get('/api/toys/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'));

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await getToyImpl(db, { toys: schema.toys, auditLogs: schema.auditLogs }, id);

    if (!r) return c.json({ message: 'Không tìm thấy' }, 404);

    const parsedToy = {
      ...r,

      image: parseMediaUrl((r as any).image, c)
    };

    return c.json({ toy: parsedToy }, 200);
  } catch {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

// POST /api/toys/:id/restore
app.post('/api/admin/toys/:id/restore', requireStaffAuth, requirePermission('toys', 'restore'), async (c) => {
  try {
    const { restoreToyImpl } = await import('../../server/routes/admin/toys');
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

// GET /api/admin/deleted/toys
app.get('/api/admin/deleted/toys', requireStaffAuth, requirePermission('toys', 'view_deleted'), async (c) => {
  try {
    const { listDeletedToysImpl } = await import('../../server/routes/admin/toys');
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

// Create a new toy

// POST /api/toys

// Body: { name: string, description: string, ... }

app.post('/api/toys', requireStaffAuth, requirePermission('toys', 'create'), async (c) => {
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

// Update a toy

// PUT /api/toys/:id

// Body: { name: string, description: string, ... }

app.put('/api/toys/:id', requireStaffAuth, requirePermission('toys', 'edit'), async (c) => {
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

// Delete a toy

// DELETE /api/toys/:id

app.delete('/api/toys/:id', requireStaffAuth, requirePermission('toys', 'delete'), async (c) => {
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

// Get list of ticket packages

// GET /api/tickets?page=1&pageSize=20&q=search_term

app.get('/api/tickets', async (c) => {
  try {
    const page = Number(c.req.query('page') || 1);

    const pageSize = Number(c.req.query('pageSize') || 20);

    const q = String(c.req.query('q') || '');

    const includeInactive = c.req.query('includeInactive') === 'true';

    const typeRaw = c.req.query('type') || 'all';
    const type = (typeRaw === 'movie' || typeRaw === 'vr') ? typeRaw : 'all';

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

// Get list of active ticket packages

app.get('/api/tickets-active', async (c) => {
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

// Get ticket package details by ID

// GET /api/tickets/:id

app.get('/api/tickets/:id', async (c) => {
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
  } catch {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

// Create a new ticket package

// POST /api/tickets

// Body: { name: string, description: string, ... }

app.post('/api/tickets', requireStaffAuth, requirePermission('tickets', 'create'), async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });

    const body = await c.req.json().catch(() => ({}));

    const staffId = c.get('staffId');

    const staffEmail = c.get('staffEmail');

    const staffFullname = c.get('staffFullname');

    const r = await createTicketPackageImpl(
      db,

      { ticket_packages: schema.ticket_packages, movies: schema.movies, auditLogs: schema.auditLogs },

      body as any,

      c.env,

      { id: staffId, email: staffEmail, fullname: staffFullname }
    );

    // Không cần xóa cache: KV cache cho vé đã bị vô hiệu hóa hoàn toàn

    return c.json(r, 201);
  } catch {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

// Update a ticket package

// PUT /api/tickets/:id

// Body: { name: string, description: string, ... }

app.put('/api/tickets/:id', requireStaffAuth, requirePermission('tickets', 'edit'), async (c) => {
  try {
    const id = Number(c.req.param('id'));

    const db = drizzle(c.env.cinema_db, { schema });

    const body = await c.req.json().catch(() => ({}));

    const staffId = c.get('staffId');

    const staffEmail = c.get('staffEmail');

    const staffFullname = c.get('staffFullname');

    const r = await updateTicketPackageImpl(
      db,

      { ticket_packages: schema.ticket_packages, movies: schema.movies, auditLogs: schema.auditLogs },

      id,

      body as any,

      c.env,

      { id: staffId, email: staffEmail, fullname: staffFullname }
    );

    if (!r) return c.json({ status: 'error', message: 'Không tìm thấy' }, 404);

    // Không cần xóa cache: KV cache cho vé đã bị vô hiệu hóa hoàn toàn

    return c.json(r, 200);
  } catch (err: any) {
    console.error('Error updating ticket package:', err);
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

// DELETE /api/tickets/:id

app.delete('/api/tickets/:id', requireStaffAuth, requirePermission('tickets', 'delete'), async (c) => {
  try {
    const id = Number(c.req.param('id'));

    const db = drizzle(c.env.cinema_db, { schema });

    const staffId = c.get('staffId');

    const staffEmail = c.get('staffEmail');

    const staffFullname = c.get('staffFullname');

    const r = await deleteTicketPackageImpl(
      db,

      { ticket_packages: schema.ticket_packages, bookings: schema.bookings, auditLogs: schema.auditLogs },

      id,

      c.env,

      { id: staffId, email: staffEmail, fullname: staffFullname }
    );

    if (!r) return c.json({ status: 'error', message: 'Không tìm thấy' }, 404);

    // Không cần xóa cache: KV cache cho vé đã bị vô hiệu hóa hoàn toàn

    return c.json(r, 200);
  } catch {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

// POST /api/admin/tickets/:id/restore
app.post('/api/admin/tickets/:id/restore', requireStaffAuth, requirePermission('tickets', 'restore'), async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const db = drizzle(c.env.cinema_db, { schema });
    const staffId = c.get('staffId');
    const staffEmail = c.get('staffEmail');
    const staffFullname = c.get('staffFullname');

    const r = await restoreTicketPackageImpl(
      db,
      { ticket_packages: schema.ticket_packages, auditLogs: schema.auditLogs },
      id,
      { id: staffId, email: staffEmail, fullname: staffFullname }
    );

    return c.json(r, 200);
  } catch (err: any) {
    return c.json({ status: 'error', message: err.message || 'Lỗi máy chủ nội bộ' }, err.statusCode || 500);
  }
});

// GET /api/admin/deleted/tickets
app.get('/api/admin/deleted/tickets', requireStaffAuth, requirePermission('tickets', 'view_deleted'), async (c) => {
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
});

// POST /api/admin/tickets/:id/toggle-status
app.post('/api/admin/tickets/:id/toggle-status', requireStaffAuth, requirePermission('tickets', 'toggle_status'), async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const db = drizzle(c.env.cinema_db, { schema });
    const staffId = c.get('staffId');
    const staffEmail = c.get('staffEmail');
    const staffFullname = c.get('staffFullname');

    const r = await toggleTicketStatusImpl(
      db,
      { ticket_packages: schema.ticket_packages, auditLogs: schema.auditLogs },
      id,
      c.env,
      { id: staffId, email: staffEmail, fullname: staffFullname }
    );

    return c.json(r, 200);
  } catch (err: any) {
    return c.json({ status: 'error', message: err.message || 'Lỗi máy chủ nội bộ' }, err.statusCode || 500);
  }
});

// Create site media

// POST /api/admin/site-media

// Body: { type: string, url: string, ... }

app.post('/api/admin/site-media', requireStaffAuth, requirePermission('uploads', 'upload'), async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });

    const body = await c.req.json().catch(() => ({}));

    const staffId = c.get('staffId');
    const staffEmail = c.get('staffEmail');
    const staffFullname = c.get('staffFullname');

    const { deleter } = getCloudHelpers(c, c.env);
    const r = await createSiteMediaImpl(
      db,
      { site_media: schema.site_media, auditLogs: schema.auditLogs },
      body as any,
      deleter,
      { id: staffId, email: staffEmail, fullname: staffFullname }
    );

    return c.json(r, 201);
  } catch {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

// Upload Video (Worker Support) REMOVED DUPLICATE

// Update site media

// PUT /api/admin/site-media

// Body: { type: string, url: string, ... }

app.put('/api/admin/site-media', requireStaffAuth, requirePermission('uploads', 'upload'), async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });

    const body = await c.req.json().catch(() => ({}));

    const staffId = c.get('staffId');
    const staffEmail = c.get('staffEmail');
    const staffFullname = c.get('staffFullname');

    const { deleter } = getCloudHelpers(c, c.env);
    const r = await updateSiteMediaImpl(
      db,
      { site_media: schema.site_media, auditLogs: schema.auditLogs },
      body as any,
      deleter,
      { id: staffId, email: staffEmail, fullname: staffFullname }
    );

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

      const parsed = {
        ...r,

        items: (r.items as any[]).map((m: any) => ({
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

// Delete site media by ID

// DELETE /api/admin/site-media/:id

app.delete('/api/admin/site-media/:id', requireStaffAuth, requirePermission('uploads', 'delete'), async (c) => {
  try {
    const id = Number(c.req.param('id'));

    const db = drizzle(c.env.cinema_db, { schema });

    const staffId = c.get('staffId');
    const staffEmail = c.get('staffEmail');
    const staffFullname = c.get('staffFullname');

    const { deleter } = getCloudHelpers(c, c.env);

    const r = await deleteSiteMediaImpl(
      db,
      { site_media: schema.site_media, auditLogs: schema.auditLogs },
      id,
      deleter,
      { id: staffId, email: staffEmail, fullname: staffFullname }
    );

    // Manual deletion from cloud storage for Worker environment

    if (r.ok && r.item && r.item.public_id) {
      const env = c.env;

      const publicId = String(r.item.public_id);

      // Try R2

      if (env.r2_cinemastore) {
        try {
          await env.r2_cinemastore.delete(publicId);
        } catch {}
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
        } catch {}
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

  const res = await sendMail(email, 'Test Brevo Worker', '<h1>It works!</h1>', c.env);

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
        } catch {}
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
        } catch {}
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

    const r = await createVnpayPaymentImpl({ ...(body as any), ip, ...config });

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

app.post('/api/ai-analytics', async (c) => {
  try {
    if (!c.env.AI) {
      return c.json({ error: 'AI binding khong kha dung.' }, 503);
    }

    const body = await c.req.json().catch(() => ({}));

    const userMessage = String((body as any).userMessage || '').trim();

    if (!userMessage) {
      return c.json({ error: 'Thieu cau hoi (userMessage).' }, 400);
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

        used_tickets: sql<number>`SUM(CASE WHEN ${schema.bookings.is_used}=1 THEN 1 ELSE 0 END)`
      })

      .from(schema.bookings)

      .all();

    // 2. Revenue by payment method

    const revenueByMethod = await db

      .select({
        method: schema.bookings.payment_method,

        revenue: sql<number>`SUM(${schema.bookings.total_price})`,

        cnt: count(schema.bookings.id)
      })

      .from(schema.bookings)

      .where(eq(schema.bookings.payment_status, 'paid'))

      .groupBy(schema.bookings.payment_method)

      .all();

    // 3. Top movies by bookings

    const topMovies = await db

      .select({
        title: schema.bookings.movie_title,

        bookings: count(schema.bookings.id),

        revenue: sql<number>`SUM(CASE WHEN ${schema.bookings.payment_status}='paid' THEN ${schema.bookings.total_price} ELSE 0 END)`
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

        cnt: count(schema.bookings.id)
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

        cnt: count(schema.bookings.id)
      })

      .from(schema.bookings)

      .where(
        and(
          eq(schema.bookings.payment_status, 'paid'),

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

        revenue: sql<number>`SUM(CASE WHEN ${schema.bookings.payment_status}='paid' THEN ${schema.bookings.total_price} ELSE 0 END)`
      })

      .from(schema.bookings)

      .where(sql`${schema.bookings.ticket_package_name} IS NOT NULL`)

      .groupBy(schema.bookings.ticket_package_name)

      .orderBy(desc(count(schema.bookings.id)))

      .limit(8)

      .all();

    // 7. Ticket Packages Catalog

    const packagesCatalog = await db
      .select({
        name: schema.ticket_packages.name,

        price: schema.ticket_packages.price,

        combo: schema.ticket_packages.combo,

        is_active: schema.ticket_packages.is_active
      })
      .from(schema.ticket_packages)
      .all();

    // 8. Active Movies

    const activeMovies = await db
      .select({
        title: schema.movies.title
      })
      .from(schema.movies)
      .where(eq(schema.movies.is_active, true))
      .all();

    // 9. Recent 30 Bookings

    const recentBookings = await db
      .select({
        code: schema.bookings.booking_code,

        name: schema.bookings.name,

        email: schema.bookings.email,

        movie: schema.bookings.movie_title,

        pkg: schema.bookings.ticket_package_name,

        price: schema.bookings.total_price,

        status: schema.bookings.payment_status,

        date: sql<string>`strftime('%Y-%m-%d %H:%M', ${schema.bookings.created_at})`
      })
      .from(schema.bookings)
      .orderBy(desc(schema.bookings.created_at))
      .limit(30)
      .all();

    // 10. Daily revenue last 30 days

    const dailyRevenueRows = await db
      .select({
        date: sql<string>`strftime('%Y-%m-%d', ${schema.bookings.paid_at})`,

        revenue: sql<number>`SUM(${schema.bookings.total_price})`,

        cnt: count(schema.bookings.id)
      })

      .from(schema.bookings)

      .where(
        and(
          eq(schema.bookings.payment_status, 'paid'),

          sql`${schema.bookings.paid_at} IS NOT NULL`

          // SQLite date comparison works with string comparison if formatted correctly.

          // We will just fetch top 30 recent paid days to be safe across dialects.
        )
      )

      .groupBy(sql`strftime('%Y-%m-%d', ${schema.bookings.paid_at})`)

      .orderBy(desc(sql`strftime('%Y-%m-%d', ${schema.bookings.paid_at})`))

      .limit(30)

      .all();

    // 11. Top users failed/cancelled

    const failedUsersRows = await db
      .select({
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

    const toysCatalog = await db
      .select({
        name: schema.toys.name,

        stock: schema.toys.stock,

        status: schema.toys.status,

        price: schema.toys.price
      })
      .from(schema.toys)
      .all();

    const ctx = {
      summary: {
        total_bookings: Number(sr?.total_bookings ?? 0),

        total_revenue_paid: Number(sr?.total_revenue ?? 0),

        paid_bookings: Number(sr?.paid_count ?? 0),

        pending_bookings: Number(sr?.pending_count ?? 0),

        failed_bookings: Number(sr?.failed_count ?? 0),

        tickets_used: Number(sr?.used_tickets ?? 0)
      },

      revenue_by_payment_method: revenueByMethod.map((r) => ({
        method: r.method ?? 'unknown',
        revenue: Number(r.revenue ?? 0),
        count: Number(r.cnt ?? 0)
      })),

      top_movies: topMovies.map((r) => ({
        title: r.title ?? 'N/A',
        bookings: Number(r.bookings ?? 0),
        revenue: Number(r.revenue ?? 0)
      })),

      peak_booking_hours: peakHours.map((r) => ({
        hour: Number(r.hour ?? 0),
        bookings: Number(r.cnt ?? 0)
      })),

      monthly_revenue: monthlyRevenue.map((r) => ({
        month: Number(r.month ?? 0),
        revenue: Number(r.revenue ?? 0),
        count: Number(r.cnt ?? 0)
      })),

      top_ticket_packages: topPackages.map((r) => ({
        package: r.pkg ?? 'N/A',
        count: Number(r.cnt ?? 0),
        revenue: Number(r.revenue ?? 0)
      })),

      // MỚI: Dữ liệu mở rộng để AI linh hoạt hơn

      catalog_ticket_packages: packagesCatalog,

      catalog_active_movies: activeMovies.map((m) => m.title),

      catalog_toys_inventory: toysCatalog,

      recent_30_bookings: recentBookings,

      daily_revenue_last_30_days: dailyRevenueRows.map((r) => ({
        date: r.date,
        revenue: Number(r.revenue ?? 0),
        count: Number(r.cnt ?? 0)
      })),

      top_users_failed_bookings: failedUsersRows.map((r) => ({
        email: r.email,
        name: r.name,
        failed_count: Number(r.failed_count ?? 0)
      }))
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

    const aiResp: any = await c.env.AI.run('@cf/meta/llama-3-8b-instruct', {
      messages: [
        { role: 'system', content: systemPrompt },

        { role: 'user', content: userMessage }
      ],

      max_tokens: 1500,

      temperature: 0.3
    });

    const rawText = String(aiResp?.response ?? aiResp?.result ?? '');

    let parsed: any;

    try {
      const m = rawText.match(/\{[\s\S]*\}/);

      if (!m) throw new Error('no json');

      parsed = JSON.parse(m[0]);
    } catch {
      parsed = {
        display_type: 'summary',

        analysis_summary: rawText || 'AI khong the phan tich. Vui long thu lai.',

        ui_config: { title: 'Ket qua phan tich' },

        processed_data: []
      };
    }

    return c.json({ ok: true, result: parsed });
  } catch (err: any) {
    console.error('[ai-analytics]', err);

    return c.json({ error: String(err?.message || 'Loi may chu noi bo') }, 500);
  }
});

// ===== SITEMAP XML =====

app.get('/sitemap.xml', async (c) => {
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

// ===== POSTS ENDPOINTS (BLOG) =====

// Public: List published posts

app.get('/api/posts', async (c) => {
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

    return c.json({ ...r, items: parsedItems });
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// Public: Get post detail (by ID or Slug)

app.get('/api/posts/:identifier', async (c) => {
  try {
    const identifier = c.req.param('identifier');

    const db = drizzle(c.env.cinema_db, { schema });

    const post = await getPostImpl(db, { posts: schema.posts, auditLogs: schema.auditLogs }, identifier, true);

    if (!post) return c.json({ message: 'Không tìm thấy bài viết' }, 404);

    if (post.status !== 'published' && c.env.IS_PREVIEW !== 'true') {
      return c.json({ message: 'Bài viết không công khai' }, 403);
    }

    const parsed = {
      ...post,

      cover_image: parseMediaUrl(post.cover_image, c)
    };

    return c.json({ post: parsed }, 200);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// Admin: List all posts

app.get('/api/admin/posts', requireStaffAuth, requirePermission('posts', 'view'), async (c) => {
  try {
    const page = Number(c.req.query('page') || 1);

    const pageSize = Number(c.req.query('pageSize') || 10);

    const q = String(c.req.query('q') || '');

    const status = String(c.req.query('status') || 'all');

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

    return c.json({ ...r, items: parsedItems });
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// Admin: Get post by ID (any status)

app.get('/api/admin/posts/:id', requireStaffAuth, requirePermission('posts', 'view'), async (c) => {
  try {
    const id = c.req.param('id');

    const db = drizzle(c.env.cinema_db, { schema });

    const post = await getPostImpl(db, { posts: schema.posts, auditLogs: schema.auditLogs }, id, false);

    if (!post) return c.json({ message: 'Không tìm thấy bài viết' }, 404);

    const parsed = {
      ...post,

      cover_image: parseMediaUrl(post.cover_image, c)
    };

    return c.json({ post: parsed }, 200);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// Admin: Create post

app.post('/api/posts', requireStaffAuth, requirePermission('posts', 'create'), async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });

    const body = await c.req.json().catch(() => ({}));

    const staffId = c.get('staffId');
    const staffEmail = c.get('staffEmail');
    const staffFullname = c.get('staffFullname');

    const r = await createPostImpl(
      db,
      { posts: schema.posts, auditLogs: schema.auditLogs },
      body,
      c.env,
      getCloudHelpers(c, c.env).uploader,
      { id: staffId, email: staffEmail, fullname: staffFullname }
    );

    if (r && r.status === 'published') {
      const base = String(c.env.VITE_CLIENT_BASE_URL || 'https://cinesphere.com.vn').replace(/\/$/, '');

      const url = `${base}/bai-viet/${r.slug ? `${r.slug}-` : ''}${r.id}`;
      const sitemapUrl = `${base}/sitemap.xml`;

      c.executionCtx.waitUntil(pingIndexNow(c.env, [url, sitemapUrl]));
    }

    return c.json({ status: 'success', post: r });
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// Admin: Update post

app.put('/api/posts/:id', requireStaffAuth, requirePermission('posts', 'edit'), async (c) => {
  try {
    const id = Number(c.req.param('id'));

    const db = drizzle(c.env.cinema_db, { schema });

    const body = await c.req.json().catch(() => ({}));

    const helpers = getCloudHelpers(c, c.env);

    const staffId = c.get('staffId');
    const staffEmail = c.get('staffEmail');
    const staffFullname = c.get('staffFullname');

    const r = await updatePostImpl(
      db,
      { posts: schema.posts, auditLogs: schema.auditLogs },
      id,
      body,
      c.env,
      helpers.uploader,
      helpers.deleter,
      { id: staffId, email: staffEmail, fullname: staffFullname }
    );

    if (!r) return c.json({ message: 'Không tìm thấy' }, 404);

    if (r.status === 'published') {
      const base = String(c.env.VITE_CLIENT_BASE_URL || 'https://cinesphere.com.vn').replace(/\/$/, '');

      const url = `${base}/bai-viet/${r.slug ? `${r.slug}-` : ''}${r.id}`;
      const sitemapUrl = `${base}/sitemap.xml`;

      c.executionCtx.waitUntil(pingIndexNow(c.env, [url, sitemapUrl]));
    }

    return c.json({ status: 'success', post: r });
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// Admin: Delete post

app.delete('/api/posts/:id', requireStaffAuth, requirePermission('posts', 'delete'), async (c) => {
  try {
    const id = Number(c.req.param('id'));

    const db = drizzle(c.env.cinema_db, { schema });

    const staffId = c.get('staffId');
    const staffEmail = c.get('staffEmail');
    const staffFullname = c.get('staffFullname');
    const isSuperAdmin = c.get('isSuperAdmin');

    const r = await deletePostImpl(
      db,
      { posts: schema.posts, auditLogs: schema.auditLogs },
      id,
      getCloudHelpers(c, c.env).deleter,
      { id: staffId, email: staffEmail, fullname: staffFullname },
      isSuperAdmin
    );

    if (!r) return c.json({ message: 'Không tìm thấy' }, 404);

    return c.json({ status: 'success', message: isSuperAdmin ? 'Đã xóa vĩnh viễn' : 'Đã lưu trữ bài viết' });
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// Public: Increment post view count

app.post('/api/posts/:id/view', async (c) => {
  try {
    const id = Number(c.req.param('id'));

    const db = drizzle(c.env.cinema_db, { schema });

    await incrementPostViewImpl(db, { posts: schema.posts, auditLogs: schema.auditLogs }, id);

    return c.json({ status: 'success' });
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// Admin: List branches

app.get('/api/admin/branches', requireStaffAuth, requirePermission('branches', 'view'), async (c) => {
  try {
    const page = Number(c.req.query('page') || 1);

    const pageSize = Number(c.req.query('pageSize') || 10);

    const q = String(c.req.query('q') || '');

    const includeInactive = c.req.query('includeInactive') === 'true';

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await listBranchesImpl(
      db,
      {
        branches: schema.branches,
        movies: schema.movies,
        ticket_packages: schema.ticket_packages,
        bookings: schema.bookings
      },
      { page, pageSize, q, includeInactive }
    );

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// Admin: Get branch options (fast dropdown returning branch_id and name)

app.get('/api/admin/branches/options', requireStaffAuth, async (c) => {
  try {
    const includeInactive = c.req.query('includeInactive') === 'true';
    const onlyOpen = c.req.query('onlyOpen') === 'true';
    const restrictBranchIds = getRestrictBranchIds(c);

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await listBranchOptionsImpl(
      db,
      { branches: schema.branches },
      { includeInactive, onlyOpen, restrictToBranchIds: restrictBranchIds }
    );

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// Admin: Get branch by ID

app.get('/api/admin/branches/:id', requireStaffAuth, requirePermission('branches', 'view'), async (c) => {
  try {
    const id = Number(c.req.param('id'));

    const db = drizzle(c.env.cinema_db, { schema });

    const branch = await getBranchImpl(db, { branches: schema.branches, auditLogs: schema.auditLogs }, id);

    if (!branch) return c.json({ message: 'Không tìm thấy chi nhánh' }, 404);

    return c.json({ branch }, 200);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// Public: Get default branch

app.get('/api/branches/default', async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });

    const branch = await getDefaultBranchImpl(db, { branches: schema.branches });

    if (!branch) return c.json({ message: 'Không tìm thấy chi nhánh mặc định' }, 404);

    return c.json({ branch }, 200);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// Public: Fast branch options (returns branch_id and name for clients)

app.get('/api/branches/options', async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });

    const r = await listBranchOptionsImpl(
      db,
      { branches: schema.branches },
      { includeInactive: false, onlyOpen: true }
    );

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// Public: Get branch by ID
app.get('/api/branches/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const db = drizzle(c.env.cinema_db, { schema });

    const branch = await getBranchImpl(db, { branches: schema.branches, auditLogs: schema.auditLogs }, id);

    if (!branch || branch.deleted_at || !branch.is_active) {
      return c.json({ message: 'Không tìm thấy chi nhánh' }, 404);
    }

    return c.json({ branch }, 200);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// Public: List all active branches (for dropdown)

app.get('/api/branches', async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });

    const r = await listBranchOptionsImpl(
      db,
      { branches: schema.branches },
      { includeInactive: false, onlyOpen: true }
    );

    return c.json({
      items: r.items,
      page: 1,
      pageSize: r.items.length,
      total: r.items.length,
      totalPages: 1
    });
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// Admin: Create branch

app.post('/api/admin/branches', requireStaffAuth, requirePermission('branches', 'create'), async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });

    const body = await c.req.json().catch(() => ({}));

    const staffId = c.get('staffId');
    const staffEmail = c.get('staffEmail');
    const staffFullname = c.get('staffFullname');

    const r = await createBranchImpl(db, { branches: schema.branches, auditLogs: schema.auditLogs }, body, {
      id: staffId,
      email: staffEmail,
      fullname: staffFullname
    });

    return c.json({ status: 'success', branch: r.item });
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// Admin: Update branch

app.put('/api/admin/branches/:id', requireStaffAuth, requirePermission('branches', 'edit'), async (c) => {
  try {
    const id = Number(c.req.param('id'));

    const db = drizzle(c.env.cinema_db, { schema });

    const body = await c.req.json().catch(() => ({}));

    const staffId = c.get('staffId');
    const staffEmail = c.get('staffEmail');
    const staffFullname = c.get('staffFullname');

    const r = await updateBranchImpl(
      db,
      { branches: schema.branches, auditLogs: schema.auditLogs, bookings: schema.bookings },
      id,
      body,
      { id: staffId, email: staffEmail, fullname: staffFullname }
    );

    if (!r) return c.json({ message: 'Không tìm thấy chi nhánh' }, 404);

    return c.json({ status: 'success', branch: r });
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// Admin: Delete branch

app.delete('/api/admin/branches/:id', requireStaffAuth, requirePermission('branches', 'delete'), async (c) => {
  try {
    const id = Number(c.req.param('id'));

    const db = drizzle(c.env.cinema_db, { schema });

    const staffId = c.get('staffId');
    const staffEmail = c.get('staffEmail');
    const staffFullname = c.get('staffFullname');

    const r = await deleteBranchImpl(
      db,
      {
        branches: schema.branches,
        movies: schema.movies,
        ticket_packages: schema.ticket_packages,
        bookings: schema.bookings,
        staff_branches: schema.staffBranches,
        auditLogs: schema.auditLogs
      },
      id,
      { id: staffId, email: staffEmail, fullname: staffFullname }
    );

    if (!r) return c.json({ message: 'Không tìm thấy chi nhánh' }, 404);

    return c.json({ status: 'success', message: 'Đã xóa chi nhánh' });
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// Admin: Toggle branch status
app.post(
  '/api/admin/branches/:id/toggle-status',
  requireStaffAuth,
  requirePermission('branches', 'toggle_status'),
  async (c) => {
    try {
      const id = Number(c.req.param('id'));

      const db = drizzle(c.env.cinema_db, { schema });

      const staffId = c.get('staffId');
      const staffEmail = c.get('staffEmail');
      const staffFullname = c.get('staffFullname');

      const r = await toggleBranchStatusImpl(
        db,
        {
          branches: schema.branches,
          auditLogs: schema.auditLogs,
          staff_branches: schema.staffBranches
        },
        id,
        { id: staffId, email: staffEmail, fullname: staffFullname }
      );

      return c.json(r, 200);
    } catch (err: any) {
      return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
    }
  }
);

// Admin: Toggle branch open/close
app.post(
  '/api/admin/branches/:id/toggle-open',
  requireStaffAuth,
  requirePermission('branches', 'edit'),
  async (c) => {
    try {
      const id = Number(c.req.param('id'));
      const db = drizzle(c.env.cinema_db, { schema });
      const staffId = c.get('staffId');
      const staffEmail = c.get('staffEmail');
      const staffFullname = c.get('staffFullname');

      const r = await toggleBranchOpenImpl(
        db,
        {
          branches: schema.branches,
          auditLogs: schema.auditLogs,
          bookings: schema.bookings
        },
        id,
        { id: staffId, email: staffEmail, fullname: staffFullname }
      );

      return c.json(r, 200);
    } catch (err: any) {
      return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
    }
  }
);

// POST /api/admin/branches/:id/restore
app.post('/api/admin/branches/:id/restore', requireStaffAuth, requirePermission('branches', 'restore'), async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const db = drizzle(c.env.cinema_db, { schema });
    const staffId = c.get('staffId');
    const staffEmail = c.get('staffEmail');
    const staffFullname = c.get('staffFullname');

    const r = await restoreBranchImpl(db, { branches: schema.branches, auditLogs: schema.auditLogs }, id, {
      id: staffId,
      email: staffEmail,
      fullname: staffFullname
    });

    return c.json(r, 200);
  } catch (err: any) {
    return c.json({ status: 'error', message: err.message || 'Lỗi máy chủ nội bộ' }, err.statusCode || 500);
  }
});

// GET /api/admin/deleted/branches
app.get('/api/admin/deleted/branches', requireStaffAuth, requirePermission('branches', 'view_deleted'), async (c) => {
  try {
    const page = Number(c.req.query('page') || 1);
    const pageSize = Number(c.req.query('pageSize') || 10);
    const search = String(c.req.query('search') || '');

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await listDeletedBranchesImpl(
      db,
      { branches: schema.branches, staffs: schema.staffs },
      { page, pageSize, search }
    );

    return c.json(r, 200);
  } catch (err) {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

// ===== SETUP ENDPOINTS (RBAC) =====

// GET /api/admin/setup/super-admin - Check if super admin exists

app.get('/api/admin/setup/super-admin', async (c) => {
  try {
    const { checkSuperAdminExists } = await import('../../server/routes/admin/setup');

    const db = drizzle(c.env.cinema_db, { schema });

    const exists = await checkSuperAdminExists(db, { staffs: schema.staffs });

    return c.json({ exists });
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// POST /api/admin/setup/super-admin - Create first super admin

app.post('/api/admin/setup/super-admin', async (c) => {
  try {
    const { setupSuperAdminImpl } = await import('../../server/routes/admin/setup');

    const body = await c.req.json().catch(() => ({}));

    const db = drizzle(c.env.cinema_db, { schema });

    const env = {
      SUPER_ADMIN_EMAIL: c.env.SUPER_ADMIN_EMAIL,

      SUPER_ADMIN_PASSWORD: c.env.SUPER_ADMIN_PASSWORD,

      SUPER_ADMIN_FULLNAME: c.env.SUPER_ADMIN_FULLNAME
    };

    const r = await setupSuperAdminImpl(
      db,
      {
        staffs: schema.staffs,
        permissions: schema.permissions,
        roles: schema.roles,
        rolePermissions: schema.rolePermissions
      },
      body,
      env
    );

    if (r.status === 'error') return c.json(r, 409);

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// POST /api/admin/setup/seed-roles - Seed roles and permissions

app.post('/api/admin/setup/seed-roles', requireStaffAuth, async (c) => {
  try {
    const isSuperAdmin = c.get('isSuperAdmin');

    if (!isSuperAdmin) {
      return c.json({ status: 'error', message: 'Chỉ Super Admin mới có thể thực hiện thao tác này' }, 403);
    }

    const { seedRolesAndPermissionsImpl } = await import('../../server/routes/admin/setup');

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await seedRolesAndPermissionsImpl(db, {
      permissions: schema.permissions,

      roles: schema.roles,

      rolePermissions: schema.rolePermissions
    });

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// ===== STAFF AUTH ENDPOINTS =====

// POST /api/admin/auth/login - Staff login

app.post('/api/admin/auth/login', async (c) => {
  try {
    const { staffLoginImpl } = await import('../../server/routes/admin/staff-auth');

    const body = await c.req.json().catch(() => ({}));

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await staffLoginImpl(
      db,
      {
        staffs: schema.staffs,
        staffTokens: schema.staffTokens,
        auditLogs: schema.auditLogs,
        staffRoles: schema.staffRoles,
        staffBranches: schema.staffBranches,
        roles: schema.roles,
        rolePermissions: schema.rolePermissions,
        permissions: schema.permissions
      },
      c.env.KV_BINDING,
      body
    );

    if (r.status === 'error') return c.json(r, 400);

    // Set cookie

    c.header('Set-Cookie', `staff_session=${r.token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`);

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// POST /api/admin/auth/logout - Staff logout

app.post('/api/admin/auth/logout', requireStaffAuth, async (c) => {
  try {
    const { staffLogoutImpl } = await import('../../server/routes/admin/staff-auth');

    const token =
      c.req.header('cookie')?.match(/staff_session=([^;]+)/)?.[1] ||
      c.req.header('Authorization')?.replace('Bearer ', '');

    if (!token) return c.json({ status: 'error', message: 'Unauthorized' }, 401);

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await staffLogoutImpl(db, { staffTokens: schema.staffTokens }, token);

    // Clear cookie

    c.header('Set-Cookie', 'staff_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// GET /api/admin/auth/me - Get current staff info

app.get('/api/admin/auth/me', requireStaffAuth, async (c) => {
  try {
    const { staffGetMeImpl } = await import('../../server/routes/admin/staff-auth');

    const staffId = c.get('staffId');

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await staffGetMeImpl(
      db,
      {
        staffs: schema.staffs,
        staffRoles: schema.staffRoles,
        staffBranches: schema.staffBranches,
        roles: schema.roles,
        rolePermissions: schema.rolePermissions,
        permissions: schema.permissions
      },
      c.env.KV_BINDING,
      staffId
    );

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// POST /api/admin/auth/change-password - Change staff password (without OTP - legacy)

app.post('/api/admin/auth/change-password', requireStaffAuth, async (c) => {
  try {
    const { staffChangePasswordImpl } = await import('../../server/routes/admin/staff-auth');

    const staffId = c.get('staffId');

    const body = await c.req.json().catch(() => ({}));

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await staffChangePasswordImpl(
      db,
      {
        staffs: schema.staffs,
        staffTokens: schema.staffTokens,
        auditLogs: schema.auditLogs,
        staffRoles: schema.staffRoles,
        staffBranches: schema.staffBranches,
        roles: schema.roles,
        rolePermissions: schema.rolePermissions,
        permissions: schema.permissions
      },
      c.env.KV_BINDING,
      staffId,
      body
    );

    if (r.status === 'error') return c.json(r, 400);

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// POST /api/admin/auth/force-change-password - Change staff password without OTP (for force change state)

app.post('/api/admin/auth/force-change-password', requireStaffAuth, async (c) => {
  try {
    const { staffForceChangePasswordImpl } = await import('../../server/routes/admin/staff-auth');

    const staffId = c.get('staffId');

    const body = await c.req.json().catch(() => ({}));

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await staffForceChangePasswordImpl(
      db,
      {
        staffs: schema.staffs,
        staffTokens: schema.staffTokens,
        auditLogs: schema.auditLogs
      },
      c.env.KV_BINDING,
      staffId,
      body
    );

    if (r.status === 'error') return c.json(r, 400);

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// POST /api/admin/auth/request-password-change-otp - Request OTP for password change

app.post('/api/admin/auth/request-password-change-otp', requireStaffAuth, async (c) => {
  try {
    const { staffRequestPasswordChangeOTP } = await import('../../server/routes/admin/staff-auth');

    const staffId = c.get('staffId');

    const body = await c.req.json().catch(() => ({}));

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await staffRequestPasswordChangeOTP(
      db,
      { staffs: schema.staffs, staffTokens: schema.staffTokens, email_logs: schema.email_logs },
      staffId,
      body,
      getMailer(c),
      c.executionCtx
    );

    if (r.status === 'error') return c.json(r, 400);

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// POST /api/admin/auth/change-password-with-otp - Change password with OTP verification

app.post('/api/admin/auth/change-password-with-otp', requireStaffAuth, async (c) => {
  try {
    const { staffChangePasswordWithOTP } = await import('../../server/routes/admin/staff-auth');

    const staffId = c.get('staffId');

    const body = await c.req.json().catch(() => ({}));

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await staffChangePasswordWithOTP(
      db,
      { staffs: schema.staffs, staffTokens: schema.staffTokens, auditLogs: schema.auditLogs },
      c.env.KV_BINDING,
      staffId,
      body
    );

    if (r.status === 'error') return c.json(r, 400);

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// POST /api/admin/auth/forgot-password - Forgot password

app.post('/api/admin/auth/forgot-password', async (c) => {
  try {
    const { staffForgotPasswordImpl } = await import('../../server/routes/admin/staff-auth');

    const body = await c.req.json().catch(() => ({}));

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await staffForgotPasswordImpl(db, { staffs: schema.staffs, staffTokens: schema.staffTokens }, body);

    if (r.status === 'error') return c.json(r, 400);

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// POST /api/admin/auth/reset-password - Reset password with token

app.post('/api/admin/auth/reset-password', async (c) => {
  try {
    const { staffResetPasswordImpl } = await import('../../server/routes/admin/staff-auth');

    const body = await c.req.json().catch(() => ({}));

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await staffResetPasswordImpl(
      db,
      { staffs: schema.staffs, staffTokens: schema.staffTokens, auditLogs: schema.auditLogs },
      c.env.KV_BINDING,
      body
    );

    if (r.status === 'error') return c.json(r, 400);

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// ===== STAFF MANAGEMENT ENDPOINTS =====

// GET /api/admin/staff - List staff

app.get('/api/admin/staff', requireStaffAuth, requirePermission('staff', 'view'), async (c) => {
  try {
    const { listStaffImpl } = await import('../../server/routes/admin/staff-management');

    const page = Number(c.req.query('page') || '1');

    const pageSize = Number(c.req.query('pageSize') || '20');

    const q = c.req.query('q') || '';

    const includeInactive = c.req.query('includeInactive') === 'true';

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await listStaffImpl(
      db,
      {
        staffs: schema.staffs,

        staffRoles: schema.staffRoles,

        roles: schema.roles,

        staffBranches: schema.staffBranches,

        branches: schema.branches
      },
      { page, pageSize, q, includeInactive }
    );

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// GET /api/admin/staff/:id - Get staff by ID

app.get('/api/admin/staff/:id', requireStaffAuth, requirePermission('staff', 'view'), async (c) => {
  try {
    const { getStaffByIdImpl } = await import('../../server/routes/admin/staff-management');

    const id = Number(c.req.param('id'));

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await getStaffByIdImpl(
      db,
      {
        staffs: schema.staffs,

        staffRoles: schema.staffRoles,

        roles: schema.roles,

        staffBranches: schema.staffBranches,

        branches: schema.branches
      },
      id
    );

    if (r.status === 'error') return c.json(r, 404);

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// POST /api/admin/staff - Create staff

app.post('/api/admin/staff', requireStaffAuth, requirePermission('staff', 'create'), async (c) => {
  try {
    const { createStaffImpl } = await import('../../server/routes/admin/staff-management');

    const body = await c.req.json().catch(() => ({}));

    const db = drizzle(c.env.cinema_db, { schema });

    const staffMailer = getMailer(c);

    const r = await createStaffImpl(
      db,
      {
        staffs: schema.staffs,
        staffRoles: schema.staffRoles,
        staffBranches: schema.staffBranches,
        email_logs: schema.email_logs,
        auditLogs: schema.auditLogs
      },
      c.env.KV_BINDING,
      body,
      {
        isSuperAdmin: c.get('isSuperAdmin'),
        branchIds: c.get('staffBranchIds') || [],
        id: c.get('staffId'),
        email: c.get('staffEmail'),
        fullname: c.get('staffFullname')
      },
      c.env,
      { waitUntil: (p) => c.executionCtx.waitUntil(p) },
      staffMailer
    );

    if (r.status === 'error') return c.json(r, 400);

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// PUT /api/admin/staff/:id - Update staff

app.put('/api/admin/staff/:id', requireStaffAuth, requirePermission('staff', 'edit'), async (c) => {
  try {
    const { updateStaffImpl } = await import('../../server/routes/admin/staff-management');

    const id = Number(c.req.param('id'));

    const body = await c.req.json().catch(() => ({}));

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await updateStaffImpl(
      db,
      {
        staffs: schema.staffs,
        staffRoles: schema.staffRoles,
        staffBranches: schema.staffBranches,
        auditLogs: schema.auditLogs
      },
      c.env.KV_BINDING,
      id,
      body,
      {
        isSuperAdmin: c.get('isSuperAdmin'),
        branchIds: c.get('staffBranchIds') || [],
        id: c.get('staffId'),
        email: c.get('staffEmail'),
        fullname: c.get('staffFullname')
      },
      c.env,
      { waitUntil: (p) => c.executionCtx.waitUntil(p) }
    );

    if (r.status === 'error') return c.json(r, 400);

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// DELETE /api/admin/staff/:id - Delete staff

app.delete('/api/admin/staff/:id', requireStaffAuth, requirePermission('staff', 'delete'), async (c) => {
  try {
    const { deleteStaffImpl } = await import('../../server/routes/admin/staff-management');

    const id = Number(c.req.param('id'));

    const db = drizzle(c.env.cinema_db, { schema });

    const staffId = c.get('staffId');
    const staffEmail = c.get('staffEmail');
    const staffFullname = c.get('staffFullname');

    const r = await deleteStaffImpl(db, { staffs: schema.staffs, auditLogs: schema.auditLogs }, id, {
      id: staffId,
      email: staffEmail,
      fullname: staffFullname
    });

    if (r.status === 'error') return c.json(r, 400);

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// POST /api/admin/staff/:id/restore
app.post('/api/admin/staff/:id/restore', requireStaffAuth, requirePermission('staff', 'restore'), async (c) => {
  try {
    const { restoreStaffImpl } = await import('../../server/routes/admin/staff-management');
    const id = Number(c.req.param('id'));
    const db = drizzle(c.env.cinema_db, { schema });
    const staffId = c.get('staffId');
    const staffEmail = c.get('staffEmail');
    const staffFullname = c.get('staffFullname');

    const r = await restoreStaffImpl(db, { staffs: schema.staffs, auditLogs: schema.auditLogs }, id, {
      id: staffId,
      email: staffEmail,
      fullname: staffFullname
    });

    return c.json(r, 200);
  } catch (err: any) {
    return c.json({ status: 'error', message: err.message || 'Lỗi máy chủ nội bộ' }, err.statusCode || 500);
  }
});

// GET /api/admin/deleted/staff
app.get('/api/admin/deleted/staff', requireStaffAuth, requirePermission('staff', 'view_deleted'), async (c) => {
  try {
    const { listDeletedStaffImpl } = await import('../../server/routes/admin/staff-management');
    const page = Number(c.req.query('page') || 1);
    const pageSize = Number(c.req.query('pageSize') || 10);
    const search = String(c.req.query('search') || '');

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await listDeletedStaffImpl(db, { staffs: schema.staffs }, { page, pageSize, search });

    return c.json(r, 200);
  } catch (err) {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

// POST /api/admin/staff/:id/reset-password - Reset staff password

app.post(
  '/api/admin/staff/:id/reset-password',
  requireStaffAuth,
  requirePermission('staff', 'reset_password'),
  async (c) => {
    try {
      const { resetStaffPasswordImpl } = await import('../../server/routes/admin/staff-management');

      const id = Number(c.req.param('id'));

      const body = await c.req.json().catch(() => ({}));

      const db = drizzle(c.env.cinema_db, { schema });

      const staffMailer = getMailer(c);

      const r = await resetStaffPasswordImpl(
        db,
        {
          staffs: schema.staffs,
          staffTokens: schema.staffTokens,
          email_logs: schema.email_logs,
          auditLogs: schema.auditLogs
        },
        c.env.KV_BINDING,
        id,
        body,
        c.env,
        { waitUntil: (p) => c.executionCtx.waitUntil(p) },
        staffMailer
      );

      if (r.status === 'error') return c.json(r, 400);

      return c.json(r);
    } catch (err: any) {
      return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
    }
  }
);

// ===== ROLES MANAGEMENT ENDPOINTS =====

// GET /api/admin/roles - List roles

app.get('/api/admin/roles', requireStaffAuth, requirePermission('roles', 'view'), async (c) => {
  try {
    const { listRolesImpl } = await import('../../server/routes/admin/roles');

    const page = Number(c.req.query('page') || '1');

    const pageSize = Number(c.req.query('pageSize') || '100');

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await listRolesImpl(
      db,
      {
        roles: schema.roles,

        rolePermissions: schema.rolePermissions,

        permissions: schema.permissions
      },
      { page, pageSize }
    );

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// GET /api/admin/roles/:id - Get role by ID

app.get('/api/admin/roles/:id', requireStaffAuth, requirePermission('roles', 'view'), async (c) => {
  try {
    const { getRoleByIdImpl } = await import('../../server/routes/admin/roles');

    const id = Number(c.req.param('id'));

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await getRoleByIdImpl(
      db,
      {
        roles: schema.roles,

        rolePermissions: schema.rolePermissions,

        permissions: schema.permissions,

        auditLogs: schema.auditLogs
      },
      id
    );

    if (r.status === 'error') return c.json(r, 404);

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// POST /api/admin/roles - Create role

app.post('/api/admin/roles', requireStaffAuth, requirePermission('roles', 'create'), async (c) => {
  try {
    const { createRoleImpl } = await import('../../server/routes/admin/roles');

    const body = await c.req.json().catch(() => ({}));

    const db = drizzle(c.env.cinema_db, { schema });

    const staffId = c.get('staffId');

    const staffEmail = c.get('staffEmail');

    const staffFullname = c.get('staffFullname');

    const r = await createRoleImpl(
      db,
      {
        roles: schema.roles,

        rolePermissions: schema.rolePermissions,

        auditLogs: schema.auditLogs
      },
      body,
      { id: staffId, email: staffEmail, fullname: staffFullname }
    );

    if (r.status === 'error') return c.json(r, 400);

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// PUT /api/admin/roles/:id - Update role

app.put('/api/admin/roles/:id', requireStaffAuth, requirePermission('roles', 'edit'), async (c) => {
  try {
    const { updateRoleImpl } = await import('../../server/routes/admin/roles');

    const id = Number(c.req.param('id'));

    const body = await c.req.json().catch(() => ({}));

    const db = drizzle(c.env.cinema_db, { schema });

    const staffId = c.get('staffId');

    const staffEmail = c.get('staffEmail');

    const staffFullname = c.get('staffFullname');

    const isSuperAdmin = Boolean(c.get('isSuperAdmin'));

    const r = await updateRoleImpl(
      db,
      {
        roles: schema.roles,

        rolePermissions: schema.rolePermissions,

        auditLogs: schema.auditLogs
      },
      id,
      body,
      { id: staffId, email: staffEmail, fullname: staffFullname, isSuperAdmin }
    );

    if (r.status === 'error') return c.json(r, 400);

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// DELETE /api/admin/roles/:id - Delete role

app.delete('/api/admin/roles/:id', requireStaffAuth, requirePermission('roles', 'delete'), async (c) => {
  try {
    const { deleteRoleImpl } = await import('../../server/routes/admin/roles');

    const id = Number(c.req.param('id'));

    const db = drizzle(c.env.cinema_db, { schema });

    const staffId = c.get('staffId');

    const staffEmail = c.get('staffEmail');

    const staffFullname = c.get('staffFullname');

    const r = await deleteRoleImpl(
      db,
      {
        roles: schema.roles,

        staffRoles: schema.staffRoles,

        auditLogs: schema.auditLogs
      },
      id,
      { id: staffId, email: staffEmail, fullname: staffFullname }
    );

    if (r.status === 'error') return c.json(r, 400);

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// POST /api/admin/roles/:id/restore
app.post('/api/admin/roles/:id/restore', requireStaffAuth, requirePermission('roles', 'restore'), async (c) => {
  try {
    const { restoreRoleImpl } = await import('../../server/routes/admin/roles');
    const id = Number(c.req.param('id'));
    const db = drizzle(c.env.cinema_db, { schema });
    const staffId = c.get('staffId');
    const staffEmail = c.get('staffEmail');
    const staffFullname = c.get('staffFullname');

    const r = await restoreRoleImpl(db, { roles: schema.roles, auditLogs: schema.auditLogs }, id, {
      id: staffId,
      email: staffEmail,
      fullname: staffFullname
    });

    return c.json(r, 200);
  } catch (err: any) {
    return c.json({ status: 'error', message: err.message || 'Lỗi máy chủ nội bộ' }, err.statusCode || 500);
  }
});

// GET /api/admin/deleted/roles
app.get('/api/admin/deleted/roles', requireStaffAuth, requirePermission('roles', 'view_deleted'), async (c) => {
  try {
    const { listDeletedRolesImpl } = await import('../../server/routes/admin/roles');
    const page = Number(c.req.query('page') || 1);
    const pageSize = Number(c.req.query('pageSize') || 10);
    const search = String(c.req.query('search') || '');

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await listDeletedRolesImpl(
      db,
      { roles: schema.roles, staffs: schema.staffs },
      { page, pageSize, search }
    );

    return c.json(r, 200);
  } catch (err) {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

// GET /api/admin/permissions - List all permissions

app.get('/api/admin/permissions', requireStaffAuth, requirePermission('roles', 'view'), async (c) => {
  try {
    const { listPermissionsImpl } = await import('../../server/routes/admin/roles');

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await listPermissionsImpl(db, { permissions: schema.permissions });

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// ===== AUDIT LOGS ENDPOINTS =====

// GET /api/admin/audit-logs - List audit logs

app.get('/api/admin/audit-logs', requireStaffAuth, requirePermission('audit_logs', 'view'), async (c) => {
  try {
    const { getAuditLogsImpl } = await import('../../server/lib/audit-logger');

    const page = Number(c.req.query('page') || '1');

    const pageSize = Number(c.req.query('pageSize') || '20');

    const module = c.req.query('module') || '';

    const action = c.req.query('action') || '';

    const staffId = c.req.query('staffId') ? Number(c.req.query('staffId')) : undefined;

    const from = c.req.query('from') || '';

    const to = c.req.query('to') || '';

    const search = c.req.query('search') || '';

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await getAuditLogsImpl(
      db,
      { auditLogs: schema.auditLogs },
      {
        page,
        pageSize,
        module,
        action,
        staffId,
        from,
        to,
        search
      }
    );

    return c.json(r);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// ============================================================
// ===== VR BOOKING ENDPOINTS (USER PUBLIC) ==================
// ============================================================

// GET /api/vr/packages - List active VR packages for booking page
app.get('/api/vr/packages', async (c) => {
  try {
    const branchId = c.req.query('branch_id') ? Number(c.req.query('branch_id')) : undefined;
    const db = drizzle(c.env.cinema_db, { schema });

    const r = await listActiveVRPackagesImpl(
      db,
      { ticket_packages: schema.ticket_packages },
      branchId
    );

    return c.json(r, 200 as any);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500 as any);
  }
});

// POST /api/vr/voucher/validate - Validate a voucher code for VR cart
app.post('/api/vr/voucher/validate', async (c) => {
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

    return c.json(r, 200 as any);
  } catch (err: any) {
    const errStatus = Number(err?.statusCode) || 500;
    return c.json(
      { valid: false, message: String(err?.message || 'Internal error') },
      errStatus as any
    );
  }
});

// POST /api/vr/validate-booking - Validate VR booking input (pre-checkout)
app.post('/api/vr/validate-booking', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const db = drizzle(c.env.cinema_db, { schema });

    const r = await validateVRBookingImpl(
      db,
      body,
      {
        ticket_packages: schema.ticket_packages,
        vouchers: schema.vouchers,
        voucher_redemption_logs: schema.voucher_redemption_logs,
        users: schema.users
      }
    );

    const status = Number(r.status) || 200;
    const clone = { ...r };
    delete clone.status;
    return c.json(clone, status as any);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500 as any);
  }
});

// POST /api/vr/create-booking - Create VR booking + insert booking_vr_items
app.post('/api/vr/create-booking', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const db = drizzle(c.env.cinema_db, { schema });

    const r = await createVRBookingImpl(
      db,
      body,
      {
        ticket_packages: schema.ticket_packages,
        vouchers: schema.vouchers,
        voucher_redemption_logs: schema.voucher_redemption_logs,
        users: schema.users,
        bookings: schema.bookings,
        booking_vr_items: schema.booking_vr_items
      }
    );

    const status = Number(r.status) || 200;
    const clone: any = { ...r };
    delete clone.status;
    return c.json(clone, status as any);
  } catch (err: any) {
    return c.json({ success: false, error: String(err?.message || 'Internal error') }, 500 as any);
  }
});

// GET /api/vr/bookings/:id - Get VR booking by ID (with vr_items list)
app.get('/api/vr/bookings/:id', async (c) => {
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
// ===== ADMIN VOUCHER ENDPOINTS (Staff Auth + RBAC) =========
// ============================================================

// GET /api/admin/vouchers - List vouchers (pagination, search, filter)
app.get('/api/admin/vouchers', requireStaffAuth, requirePermission('vouchers', 'view'), async (c) => {
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
app.get('/api/admin/vouchers/:id', requireStaffAuth, requirePermission('vouchers', 'view'), async (c) => {
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
app.post('/api/admin/vouchers', requireStaffAuth, requirePermission('vouchers', 'create'), async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const db = drizzle(c.env.cinema_db, { schema });

    const staffId = c.get('staffId');
    const staffEmail = c.get('staffEmail');
    const staffFullname = c.get('staffFullname');

    const r = await createVoucherImpl(
      db,
      { vouchers: schema.vouchers, auditLogs: schema.auditLogs },
      body,
      { id: staffId, email: staffEmail, fullname: staffFullname }
    );

    return c.json(r, 201 as any);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500 as any);
  }
});

// PUT /api/admin/vouchers/:id - Update voucher
app.put('/api/admin/vouchers/:id', requireStaffAuth, requirePermission('vouchers', 'edit'), async (c) => {
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
app.post('/api/admin/vouchers/:id/toggle-status', requireStaffAuth, requirePermission('vouchers', 'toggle_status'), async (c) => {
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
});

// DELETE /api/admin/vouchers/:id - Soft delete voucher
app.delete('/api/admin/vouchers/:id', requireStaffAuth, requirePermission('vouchers', 'delete'), async (c) => {
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
app.post('/api/admin/vouchers/:id/restore', requireStaffAuth, requirePermission('vouchers', 'restore'), async (c) => {
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
});

// GET /api/admin/deleted/vouchers - List deleted vouchers (trash)
app.get('/api/admin/deleted/vouchers', requireStaffAuth, requirePermission('vouchers', 'view_deleted'), async (c) => {
  try {
    const page = Number(c.req.query('page') || 1);
    const pageSize = Number(c.req.query('pageSize') || 10);
    const search = String(c.req.query('q') || c.req.query('search') || '');
    const restrictBranchIds = getRestrictBranchIds(c);

    const db = drizzle(c.env.cinema_db, { schema });

    const r = await listDeletedVouchersImpl(
      db,
      { vouchers: schema.vouchers },
      { page, pageSize, search, restrictToBranchIds: restrictBranchIds }
    );

    return c.json(r, 200 as any);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500 as any);
  }
});

export default app;
