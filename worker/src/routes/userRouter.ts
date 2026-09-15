import { Hono, Context } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../../../shared/schema';
import { eq } from 'drizzle-orm';

import {
  isLocal,
  logSystemError,
  getWelcomeEmailTemplate,
  getResetPasswordEmailTemplate,
  generateSessionToken,
  calculateSessionExpiry
} from '../utils';
import { requireAuth, rateLimiter } from '../middleware';

import { loginWithSessionImpl, validateOTPImpl, resendOTPImpl, registerImpl } from '../../../server/routes/user/auth';

import { forgetPassImpl, resetPasswordImpl, changePasswordImpl } from '../../../server/routes/user/password';

import {
  getUserProfileByAccountIdImpl,
  updateUserProfileImpl,
  listUserTransactionsImpl
} from '../../../server/routes/user/users';

import { sendMail } from '../../../server/routes/mail-service';

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

userRouter.post('/api/login', rateLimiter(5, 60), async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });

    const body = await c.req.json().catch(() => ({}));

    // Cloudflare Turnstile Verification
    const turnstileToken = (body as any)?.turnstileToken;
    const turnstileSecret = c.env.TURNSTILE_SECRET;
    if (!isLocal(c.req.url) && turnstileSecret) {
      if (!turnstileToken) {
        return c.json({ status: 'error', message: 'Thiếu mã xác thực bảo mật (CAPTCHA). Vui lòng tải lại trang và thử lại.' }, 403);
      }
      try {
        const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `secret=${turnstileSecret}&response=${turnstileToken}`
        });
        const verifyData: any = await verifyRes.json();
        if (!verifyData.success) {
          return c.json({ status: 'error', message: 'Xác minh CAPTCHA thất bại. Vui lòng tải lại trang.' }, 403);
        }
      } catch (e) {
        return c.json({ status: 'error', message: 'Lỗi xác minh bảo mật nội bộ.' }, 500);
      }
    }

    const mailer = getMailer(c);

    const r = await loginWithSessionImpl(
      db,

      { accounts: schema.accounts, users: schema.users, tokens: schema.tokens, email_logs: schema.email_logs },

      { ...body, days: 30 },

      generateSessionToken,

      calculateSessionExpiry,

      null,

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

userRouter.post('/api/validate-otp', rateLimiter(5, 60), async (c) => {
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

userRouter.post('/api/resend-otp', rateLimiter(5, 60), async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });

    const body = await c.req.json().catch(() => ({}));

    // Cloudflare Turnstile Verification
    const turnstileToken = (body as any)?.turnstileToken;
    const turnstileSecret = c.env.TURNSTILE_SECRET;
    if (!isLocal(c.req.url) && turnstileSecret) {
      if (!turnstileToken) {
        return c.json({ status: 'error', message: 'Thiếu mã xác thực bảo mật (CAPTCHA). Vui lòng tải lại trang và thử lại.' }, 403);
      }
      try {
        const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `secret=${turnstileSecret}&response=${turnstileToken}`
        });
        const verifyData: any = await verifyRes.json();
        if (!verifyData.success) {
          return c.json({ status: 'error', message: 'Xác minh CAPTCHA thất bại. Vui lòng tải lại trang.' }, 403);
        }
      } catch (e) {
        return c.json({ status: 'error', message: 'Lỗi xác minh bảo mật mạng.' }, 500);
      }
    }

    const mailer = getMailer(c);

    const r = await resendOTPImpl(
      db,

      { accounts: schema.accounts, users: schema.users, tokens: schema.tokens, email_logs: schema.email_logs },

      body,

      null,

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

userRouter.post('/api/register', async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });

    const body = await c.req.json().catch(() => ({}));

    // Cloudflare Turnstile Verification
    const turnstileToken = (body as any)?.turnstileToken;
    const turnstileSecret = c.env.TURNSTILE_SECRET;
    if (!isLocal(c.req.url) && turnstileSecret) {
      if (!turnstileToken) {
        return c.json({ status: 'error', message: 'Thiếu mã xác thực bảo mật (CAPTCHA). Vui lòng thử lại.' }, 403);
      }
      try {
        const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `secret=${turnstileSecret}&response=${turnstileToken}`
        });
        const verifyData: any = await verifyRes.json();
        if (!verifyData.success) {
          return c.json({ status: 'error', message: 'Xác minh CAPTCHA thất bại. Vui lòng thử lại.' }, 403);
        }
      } catch (e) {
        return c.json({ status: 'error', message: 'Lỗi xác minh bảo mật mạng.' }, 500);
      }
    }

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

userRouter.post('/api/forget-password', async (c) => {
  let body: any = {};

  try {
    const db = drizzle(c.env.cinema_db, { schema });

    body = await c.req.json().catch(() => ({}));

    // Cloudflare Turnstile Verification
    const turnstileToken = (body as any)?.turnstileToken;
    const turnstileSecret = c.env.TURNSTILE_SECRET;
    if (!isLocal(c.req.url) && turnstileSecret) {
      if (!turnstileToken) {
        return c.json({ status: 'error', message: 'Thiếu mã xác thực bảo mật (CAPTCHA). Vui lòng thử lại.' }, 403);
      }
      try {
        const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `secret=${turnstileSecret}&response=${turnstileToken}`
        });
        const verifyData: any = await verifyRes.json();
        if (!verifyData.success) {
          return c.json({ status: 'error', message: 'Xác minh CAPTCHA thất bại. Vui lòng thử lại.' }, 403);
        }
      } catch (e) {
        return c.json({ status: 'error', message: 'Lỗi xác minh bảo mật mạng.' }, 500);
      }
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

userRouter.get('/api/users-profile', requireAuth, async (c) => {
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

userRouter.post('/api/users-profile', requireAuth, async (c) => {
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

userRouter.post('/api/users-password', requireAuth, async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });

    const body = await c.req.json().catch(() => ({}));
    body.accountId = c.get('accountId');

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

userRouter.get('/api/usersprofile/transactions', requireAuth, async (c) => {
  try {
    const accountId = c.get('accountId');
    const email = String(c.req.query('email') || '');
    const status = String(c.req.query('status') || 'all');

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

        ticket_packages: schema.ticket_packages,

        booking_vr_items: schema.booking_vr_items,

        vouchers: schema.vouchers
      },

      { accountId, email, status, page, pageSize, sort, dir, payment_method, from, to }
    );

    return c.json(r, 200);
  } catch {
    return c.json({ status: 'error', message: 'Lỗi máy chủ nội bộ' }, 500);
  }
});

export default userRouter;
