import { Hono, Context } from 'hono';
import { z } from 'zod';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../../../shared/schema';
import { eq } from 'drizzle-orm';

import {
  isLocal,
  logSystemError,
  getWelcomeEmailTemplate,
  getResetPasswordEmailTemplate,
  generateSessionToken,
  calculateSessionExpiry,
  verifyTurnstile
} from '../utils';
import { requireAuth } from '../middleware';

import {
  loginWithSessionImpl,
  validateOTPImpl,
  resendOTPImpl,
  registerImpl,
  checkEmailAvailableImpl
} from '../../../server/routes/user/auth';

import { forgetPassImpl, resetPasswordImpl, changePasswordImpl, checkResetTokenImpl } from '../../../server/routes/user/password';

import {
  getUserProfileByAccountIdImpl,
  updateUserProfileImpl,
  listUserTransactionsImpl
} from '../../../server/routes/user/users';

import { sendMail } from '../../../server/routes/mail-service';
import { resolveOrderTokenSecret, makeOrderToken } from '../../../server/lib/order-token';
import { clampPage } from '../../../server/lib/paging';

type Variables = {
  accountId?: number;
};

const userRouter = new Hono<{ Bindings: any; Variables: Variables }>();

function getMailer(c: Context) {
  return async (to: string, subject: string, html: string) => {
    const res = await sendMail(to, subject, html, c.env);
    if (res.ok) {
      console.log(`[Mailer] Sent email to ${to} via ${res.provider}`);
    }
    return res;
  };
}

const loginSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(1, 'Mật khẩu không được để trống'),
  turnstileToken: z.string().min(1, 'Mã xác thực không hợp lệ'),
}).passthrough();

userRouter.post('/api/login', async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });

    const body = await c.req.json().catch(() => ({}));
    
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ status: 'error', message: parsed.error.issues[0].message }, 400);
    }

    // Cloudflare Turnstile Verification
    const turnstileToken = parsed.data.turnstileToken;
    const turnstileCheck = await verifyTurnstile(c.env, turnstileToken, c.req.url, c.req.header('CF-Connecting-IP'));
    if (!turnstileCheck.ok) {
      return c.json({ status: 'error', message: turnstileCheck.message }, turnstileCheck.status);
    }

    const mailer = getMailer(c);

    const r = await loginWithSessionImpl(
      db,

      { accounts: schema.accounts, users: schema.users, tokens: schema.tokens, email_logs: schema.email_logs },

      { ...parsed.data, days: 30 },

      generateSessionToken,

      calculateSessionExpiry,

      c.env.SETTINGS_KV,

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

userRouter.post('/api/validate-otp', async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });

    const body = await c.req.json().catch(() => ({}));

    const r = await validateOTPImpl(
      db,

      { accounts: schema.accounts, users: schema.users, tokens: schema.tokens, email_logs: schema.email_logs },

      { ...body, days: 30 },

      generateSessionToken,

      calculateSessionExpiry,

      c.env.SETTINGS_KV
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

userRouter.post('/api/resend-otp', async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });

    const body = await c.req.json().catch(() => ({}));

    // Cloudflare Turnstile Verification
    const turnstileToken = (body as any)?.turnstileToken;
    const turnstileCheck = await verifyTurnstile(c.env, turnstileToken, c.req.url, c.req.header('CF-Connecting-IP'));
    if (!turnstileCheck.ok) {
      return c.json({ status: 'error', message: turnstileCheck.message }, turnstileCheck.status);
    }

    const mailer = getMailer(c);

    const r = await resendOTPImpl(
      db,

      { accounts: schema.accounts, users: schema.users, tokens: schema.tokens, email_logs: schema.email_logs },

      body,

      c.env.SETTINGS_KV,

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

const registerSchema = z.object({
  email: z.string().email('Email không hợp lệ').max(254, 'Email quá dài'),
  password: z.string().min(1, 'Mật khẩu không được để trống'),
  name: z
    .string()
    .trim()
    .min(1, 'Tên không được để trống')
    .max(100, 'Tên tối đa 100 ký tự')
    .refine((value) => !/[<>]/.test(value), 'Tên không được chứa ký tự < hoặc >'),
  phone: z.string().optional(),
  gender: z.string().optional(),
  dob: z.string().optional(),
  turnstileToken: z.string().min(1, 'Mã xác thực không hợp lệ'),
}).passthrough();

// CHECK EMAIL (register form: "is this email still free?")
// No CAPTCHA, so the customer hears about a taken email on the first step, not after filling in the whole form. To keep it
// from being used to list the customers' emails, each IP may ask only CHECK_EMAIL_LIMIT times per CHECK_EMAIL_WINDOW_MS.
// The counters live in this worker instance only, so this is a brake, not a hard limit; /api/register still has its CAPTCHA.
const CHECK_EMAIL_LIMIT = 20;
const CHECK_EMAIL_WINDOW_MS = 60 * 1000;
const checkEmailHits = new Map<string, { count: number; windowStart: number }>();

function isCheckEmailLimited(ip: string): boolean {
  const now = Date.now();
  const hit = checkEmailHits.get(ip);
  if (!hit || now - hit.windowStart >= CHECK_EMAIL_WINDOW_MS) {
    // Old windows are dropped now and then so the map does not grow without end
    if (checkEmailHits.size > 5000) checkEmailHits.clear();
    checkEmailHits.set(ip, { count: 1, windowStart: now });
    return false;
  }
  hit.count += 1;
  return hit.count > CHECK_EMAIL_LIMIT;
}

const checkEmailSchema = z.object({ email: z.string().email('Email không hợp lệ') });

userRouter.post('/api/check-email', async (c) => {
  try {
    const clientIp = c.req.header('CF-Connecting-IP') || 'unknown';
    if (isCheckEmailLimited(clientIp)) {
      return c.json({ status: 'error', message: 'Bạn thử quá nhiều lần, vui lòng đợi một phút rồi thử lại.' }, 429);
    }

    const body = await c.req.json().catch(() => ({}));
    const parsed = checkEmailSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ status: 'error', message: parsed.error.issues[0].message }, 400);
    }

    const db = drizzle(c.env.cinema_db, { schema });
    const result = await checkEmailAvailableImpl(db, { accounts: schema.accounts }, parsed.data.email);
    return c.json({ status: 'success', ...result });
  } catch (err: any) {
    logSystemError('check-email', err, {});
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

userRouter.post('/api/register', async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });

    const body = await c.req.json().catch(() => ({}));
    
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ status: 'error', message: parsed.error.issues[0].message }, 400);
    }

    // Cloudflare Turnstile Verification
    const turnstileToken = parsed.data.turnstileToken;
    const turnstileCheck = await verifyTurnstile(c.env, turnstileToken, c.req.url, c.req.header('CF-Connecting-IP'));
    if (!turnstileCheck.ok) {
      return c.json({ status: 'error', message: turnstileCheck.message }, turnstileCheck.status);
    }

    const mailer = getMailer(c);

    const appBaseUrl = c.env.VITE_CLIENT_BASE_URL || 'https://cinesphere.com.vn';

    const renderWelcome = (data: { customerName: string; email: string }) => getWelcomeEmailTemplate(appBaseUrl, data);

    const r = await registerImpl(
      db,

      { accounts: schema.accounts, users: schema.users, email_logs: schema.email_logs },

      parsed.data as any,

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

userRouter.post('/api/forget-password', async (c) => {
  let body: any = {};

  try {
    const db = drizzle(c.env.cinema_db, { schema });

    body = await c.req.json().catch(() => ({}));

    // Cloudflare Turnstile Verification
    const turnstileToken = (body as any)?.turnstileToken;
    const turnstileCheck = await verifyTurnstile(c.env, turnstileToken, c.req.url, c.req.header('CF-Connecting-IP'));
    if (!turnstileCheck.ok) {
      return c.json({ status: 'error', message: turnstileCheck.message }, turnstileCheck.status);
    }

    const email = String((body as any)?.email || '');

    const mailer = getMailer(c);

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

    if (!appBaseUrl) {
      appBaseUrl = c.env.VITE_CLIENT_BASE_URL || 'https://cinesphere.com.vn';
    }

    const renderReset = (link: string) => {

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

userRouter.post('/api/reset-password/check', async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });
    const body: any = await c.req.json().catch(() => ({}));
    const result = await checkResetTokenImpl(
      db,
      { accounts: schema.accounts, tokens: schema.tokens },
      String(body?.token || '')
    );
    return c.json({ status: 'success', ...result });
  } catch {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

userRouter.post('/api/reset-password', async (c) => {
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

userRouter.post('/api/logout', async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });

    const token = c.req.header('cookie')?.match(/session_token=([^;]+)/)?.[1];

    if (token) {
      await db.delete(schema.tokens).where(eq(schema.tokens.token, token));
    }

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

userRouter.get('/api/user/profile', requireAuth, async (c) => {
  try {
    const accountId = c.get('accountId');
    const db = drizzle(c.env.cinema_db, { schema });

    const r = await getUserProfileByAccountIdImpl(db, { accounts: schema.accounts, users: schema.users }, accountId);

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

userRouter.post('/api/user/profile', requireAuth, async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });

    const body = await c.req.json().catch(() => ({}));
    body.accountId = c.get('accountId');

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

userRouter.post('/api/user/password', requireAuth, async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });

    const body = await c.req.json().catch(() => ({}));
    body.accountId = c.get('accountId');

    const r = await changePasswordImpl(db, { accounts: schema.accounts, tokens: schema.tokens }, body as any);

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

userRouter.get('/api/user/transactions', requireAuth, async (c) => {
  try {
    const accountId = c.get('accountId');
    const email = String(c.req.query('email') || '');
    const status = String(c.req.query('status') || 'all');

    // The page size is capped at 100 and a bad page number becomes 1
    const { page, pageSize } = clampPage(c.req.query('page'), c.req.query('pageSize'), { defaultPageSize: 10 });

    const sort = String(c.req.query('sort') || 'created_at');

    const dir = String(c.req.query('dir') || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';

    const payment_method = String(c.req.query('payment_method') || '');

    const from = String(c.req.query('from') || '');

    const to = String(c.req.query('to') || '');

    const db = drizzle(c.env.cinema_db, { schema });

    // Tokens for unpaid orders. If the secret is missing the history still works, just without them.
    let orderTokenSecret: string | null = null;
    try {
      orderTokenSecret = resolveOrderTokenSecret(c.env, c.req.url);
    } catch (err) {
      logSystemError('order-token-secret', err);
    }

    const r = await listUserTransactionsImpl(
      db,

      {
        accounts: schema.accounts,

        bookings: schema.bookings,

        movies: schema.movies,

        ticket_packages: schema.ticket_packages,

        booking_vr_items: schema.booking_vr_items,

        vouchers: schema.vouchers
      },

      {
        accountId,
        email,
        status,
        page,
        pageSize,
        sort,
        dir,
        payment_method,
        from,
        to,
        getOrderToken: orderTokenSecret
          ? (booking) => makeOrderToken(orderTokenSecret as string, booking.id, booking.pay_txt_code)
          : undefined
      }
    );

    return c.json(r, 200);
  } catch {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

export default userRouter;
