// Main API server setup using Hono framework

import { Hono } from 'hono';
import publicRouter from './routes/publicRouter';
import userRouter from './routes/userRouter';
import adminRouter from './routes/adminRouter';
import webhookRouter from './routes/webhookRouter';

import { cors } from 'hono/cors';

import { drizzle } from 'drizzle-orm/d1';

import * as schema from '../../shared/schema';

import type { D1Database, R2Bucket } from '@cloudflare/workers-types';

import { requireStaffAuth } from './middleware';

import { expireStaleBookingsImpl } from '../../server/routes/scheduled/booking-expiry';
import { isLocal } from './utils';

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

  CLOUDINARY_CLOUD_NAME: string;

  CLOUDINARY_API_KEY: string;

  CLOUDINARY_API_SECRET: string;

  CLOUDINARY_UPLOAD_FOLDER: string;

  VITE_SERVER_BASE_URL: string;

  VITE_CLIENT_BASE_URL: string;

  BREVO_API_KEY: string;

  BREVO_SENDER_EMAIL: string;

  BREVO_SENDER_NAME: string;

  IS_PREVIEW?: string;

  SUPER_ADMIN_EMAIL: string;
  SUPER_ADMIN_PASSWORD: string;
  SUPER_ADMIN_FULLNAME: string;
};

const app = new Hono<{ Variables: Variables; Bindings: Bindings }>();

// 1. CORS Middleware - MUST BE THE VERY FIRST MIDDLEWARE
app.use(
  '*',
  cors({
    origin: (origin, c) => {
      if (!origin) return 'https://cinesphere.com.vn';

      // 1. Allow localhost & 127.0.0.1 for development
      try {
        const url = new URL(origin);
        if (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname.endsWith('.localhost')) {
          return origin;
        }

        // 2. Allow all cinesphere.com.vn domains & subdomains
        if (url.hostname === 'cinesphere.com.vn' || url.hostname.endsWith('.cinesphere.com.vn')) {
          return origin;
        }

        // 3. Allow all Cloudflare Pages domains & subdomains (*.pages.dev)
        if (url.hostname === 'pages.dev' || url.hostname.endsWith('.pages.dev')) {
          return origin;
        }

        // 4. Allow all Cloudflare Workers domains (*.workers.dev)
        if (url.hostname === 'workers.dev' || url.hostname.endsWith('.workers.dev')) {
          return origin;
        }
      } catch {
        // ignore parse error
      }

      // Default fallback: echo origin if available, otherwise prod domain
      return origin || 'https://cinesphere.com.vn';
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
    allowHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Origin',
      'Referer',
      'User-Agent',
      'X-Requested-With',
      'Access-Control-Request-Headers',
      'Access-Control-Request-Method',
      'x-branch-id',
      'x-staff-token',
      'x-client-version'
    ],
    exposeHeaders: ['Content-Type', 'Authorization', 'X-KV-Cache', 'ETag'],
    maxAge: 86400,
    credentials: true
  })
);

// API NAMESPACE LOCKS
// Prevents any accidental exposition of admin or user endpoints due to missing trailing middlewares
app.use('/api/admin/*', async (c, next) => {
  const url = new URL(c.req.url);
  const publicPaths = [
    '/api/admin/setup/super-admin',
    '/api/admin/auth/login',
    '/api/admin/auth/forgot-password',
    '/api/admin/auth/reset-password'
  ];
  if (publicPaths.includes(url.pathname)) {
    return next();
  }
  return requireStaffAuth(c, next);
});

// 2. DEBUG: Global Request Logger
app.use('*', async (c, next) => {
  const url = new URL(c.req.url);
  const isL = isLocal(c.req.url);
  console.log(`[Worker Request] ${c.req.method} ${url.pathname} (Local: ${isL})`);
  await next();
});

// 3. Serve local uploads during development
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

// ===== SUB-ROUTERS =====
// Public, User, and Admin routes delegated to dedicated router files
app.route('/', publicRouter);
app.route('/', userRouter);
app.route('/', adminRouter);
app.route('/', webhookRouter);

export default {
  fetch: app.fetch,
  async scheduled(event: any, env: Bindings, ctx: any) {
    console.log(`[Scheduled Cron] Running stale booking expiry task at ${new Date().toISOString()}`);
    try {
      const db = drizzle(env.cinema_db, { schema });
      const result = await expireStaleBookingsImpl(db, {
        bookings: schema.bookings,
        vouchers: schema.vouchers
      });
      console.log(
        `[Scheduled Cron] Task completed: expired ${result.expired_count} booking(s), released ${result.voucher_releases} voucher usage(s)`
      );
    } catch (err) {
      console.error('[Scheduled Cron] Task failed:', err);
    }
  }
};
