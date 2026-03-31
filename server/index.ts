import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import multer from 'multer';
import { handleDemo } from './routes/user/demo';
import { getAllActiveMoviesToday, listMovies, getMovie } from './routes/user/movies';
import {
  createMovieImpl,
  updateMovieImpl,
  deleteMovieImpl,
  getMovieByIdImpl,
  updateMovieStatusImpl
} from './routes/admin/movies';
import { loginImpl, registerImpl } from './routes/user/auth';
import { forgetPassImpl, resetPasswordImpl, changePasswordImpl } from './routes/user/password';
import { createMomoPaymentImpl, momoIpnImpl } from './routes/user/momo';
import { createVnpayPaymentImpl, vnpayIpnImpl } from './routes/user/vnpay';
import {
  validateBookingImpl,
  createPaymentImpl,
  updatePaymentImpl,
  getBookingImpl,
  getBookingByIdImpl,
  getBookingByCodeImpl,
  confirmUseTicketImpl
} from './routes/user/payments';
import { getRevenueImpl, listTransactionsImpl, getTransactionByIdImpl } from './routes/admin/payments';
import { listActiveToys } from './routes/user/toys';
import { listToysImpl, createToyImpl, getToyImpl, updateToyImpl, deleteToyImpl } from './routes/admin/toys';
import { listPostsImpl, createPostImpl, getPostImpl, updatePostImpl, deletePostImpl } from './routes/admin/posts';
import {
  getDashboardMetricsImpl,
  getRevenueByDateImpl,
  getRevenue7DaysImpl,
  getRevenueByMonthImpl
} from './routes/admin/dashboard';
import { getUsersImpl, getUserByIdImpl } from './routes/admin/users';
import { updateUserProfileImpl, listUserTransactionsImpl, getUserProfileByEmailImpl } from './routes/user/users';
import {
  listTicketPackagesImpl,
  getTicketPackageImpl,
  createTicketPackageImpl,
  updateTicketPackageImpl,
  deleteTicketPackageImpl
} from './routes/admin/tickets';
import { uploadAdminVideo } from './routes/admin/uploads';
import { getEmailLogsImpl } from './routes/admin/email-logs';
import { listActiveTicketPackages } from './routes/user/tickets';
import { getMailConfig, verifyMailProvider } from './routes/mail-service';
import { generateCloudinarySignature } from './routes/admin/cloudinary-sign';
import { createSiteMediaImpl, listSiteMediaImpl, updateSiteMediaImpl } from './routes/admin/site-media';
import { db } from './db';
import {
  movies as pgMovies,
  bookings as pgBookings,
  users as pgUsers,
  accounts as pgAccounts,
  tokens as pgTokens,
  ticket_packages as pgTicketPackages,
  toys as pgToys,
  site_media as pgSiteMedia,
  email_logs as pgEmailLogs,
  posts as pgPosts
} from './db/schema';

export function createServer() {
  const app = express();
  // Middleware
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  const uploadDir = path.resolve(process.cwd(), 'uploads');
  const uploadMoviesDir = path.join(uploadDir, 'movies');
  try {
    fs.mkdirSync(uploadDir, { recursive: true });
    fs.mkdirSync(uploadMoviesDir, { recursive: true });
    fs.mkdirSync(path.join(uploadDir, 'toys'), { recursive: true });
  } catch {}
  // --- Local Upload Logic ---
  const uploadVideoDir = path.join(uploadDir, 'videos');
  try {
    fs.mkdirSync(uploadDir, { recursive: true });
    fs.mkdirSync(uploadMoviesDir, { recursive: true });
    fs.mkdirSync(path.join(uploadDir, 'toys'), { recursive: true });
    fs.mkdirSync(uploadVideoDir, { recursive: true });
  } catch {}
  app.use('/uploads', express.static(uploadDir));

  // --- Local Upload Logic ---
  const localUploader = async (base64: string, folder: string) => {
    // folder format: "ctbooking/images/movies" -> we map to local "uploads/movies"
    // "ctbooking/toys" -> "uploads/toys"

    let localFolder = 'others';
    if (folder.includes('movies')) localFolder = 'movies';
    else if (folder.includes('toys')) localFolder = 'toys';

    const targetDir = path.join(uploadDir, localFolder);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    const matches = base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) throw new Error('Invalid base64 string');

    const type = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    const ext = type.split('/')[1] || 'bin';
    const filename = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
    const filePath = path.join(targetDir, filename);

    fs.writeFileSync(filePath, buffer);

    // Return relative URL
    // Server runs at localhost:8080 (or proxy via Vite).
    // We already serve /uploads via express.static
    return { url: `/uploads/${localFolder}/${filename}` };
  };

  const localDeleter = async (url: string) => {
    if (!url || typeof url !== 'string') return;
    // URL format: /uploads/movies/filename.jpg or http://.../uploads/movies/filename.jpg
    // We strictly handle relative paths starting with /uploads/ or full URLs pointing to this server

    let relativePath = url;
    if (url.startsWith('http')) {
      try {
        const u = new URL(url);
        relativePath = u.pathname;
      } catch {
        return;
      }
    }
    const safeDate = (dateVal: any) => {
      if (!dateVal) return null;
      if (typeof dateVal === 'string' && !dateVal.includes('T') && dateVal.includes(' ')) {
        // Convert "2025-12-15 02:15:31" to "2025-12-15T02:15:31"
        dateVal = dateVal.replace(' ', 'T');
      }
      const d = new Date(dateVal);
      return isNaN(d.getTime()) ? null : d.toISOString();
    };

    if (relativePath.startsWith('/uploads/')) {
      const filePath = path.join(process.cwd(), relativePath.slice(1)); // Remove leading /
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          console.error('Failed to delete local file:', filePath, e);
        }
      }
    }
  };

  // Example API routes
  app.get('/api/ping', (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? 'ping';
    res.json({ message: ping });
  });

  // ===== Security middlewares for sensitive endpoints =====
  const noStore: express.RequestHandler = (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  };
  const attempts = new Map<string, number[]>();
  const RL_MAX = (() => {
    const raw = process.env.VITE_RATE_LIMIT_BOOKING_CHECK_MAX;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 5;
  })();
  const RL_WINDOW_MS = (() => {
    const raw = process.env.VITE_RATE_LIMIT_BOOKING_CHECK_WINDOWMS;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 1000 ? n : 60_000;
  })();
  const rateLimitCheckCode = (max = RL_MAX, windowMs = RL_WINDOW_MS): express.RequestHandler => {
    return (req, res, next) => {
      const key = req.ip || 'unknown';
      const now = Date.now();
      const list = attempts.get(key) ?? [];
      const filtered = list.filter((ts) => now - ts < windowMs);
      if (filtered.length >= max) {
        const oldest = filtered[0];
        const retryMs = Math.max(0, windowMs - (now - oldest));
        const retrySec = Math.ceil(retryMs / 1000);
        res.set('Retry-After', String(retrySec));
        res.set('X-RateLimit-Limit', String(max));
        res.set('X-RateLimit-Remaining', '0');
        res.set('X-RateLimit-WindowMS', String(windowMs));
        return res.status(429).json({
          message: `Quá nhiều yêu cầu, vui lòng thử lại sau ${retrySec}s`
        });
      }
      const remaining = Math.max(0, max - (filtered.length + 1));
      res.locals.rateLimitRemaining = remaining;
      res.locals.rateLimitMax = max;
      res.locals.rateLimitWindowMs = windowMs;
      res.set('X-RateLimit-Limit', String(max));
      res.set('X-RateLimit-Remaining', String(remaining));
      res.set('X-RateLimit-WindowMS', String(windowMs));
      filtered.push(now);
      attempts.set(key, filtered);
      next();
    };
  };

  // --- SePay Webhook ---
  app.post('/api/sepay/webhook', async (req, res) => {
    const { handleSePayWebhookImpl } = await import('./routes/webhook/sepay');
    // Server uses default mailer implementation (undefined args)
    const result = await handleSePayWebhookImpl(db, pgTables, req.body);
    res.json(result);
  });

  app.get('/api/demo', handleDemo);
  //get list movies admin, không cần trả về status trong json, message - đã check
  app.get('/api/movies', async (req, res) => {
    try {
      const page = Number(req.query.page || 1);
      const pageSize = Number(req.query.pageSize || 20);
      const q = String(req.query.q || '').toLowerCase();
      const sortKey = String(req.query.sort || 'updated_at');
      const dir = String(req.query.dir || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
      const status = String(req.query.status || 'all');
      const { items, total } = await listMovies(
        db,
        { movies: pgMovies },
        { page, pageSize, q, sort: sortKey, dir, status: status as any }
      );
      res.status(200).json({ items, page, pageSize, total });
    } catch (error: any) {
      const errorMessage = error?.message || 'Lỗi máy chủ nội bộ';
      res.status(500).json({
        status: 'error',
        message: errorMessage
      });
    }
  });
  //get detail movies cho user web
  app.get('/api/movies/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const movie = await getMovie(db, { movies: pgMovies }, id);
      if (!movie) return res.status(404).json({ status: 'error', message: 'Không tìm thấy' });
      res.status(200).json({ movie });
    } catch (error: any) {
      const errorMessage = error?.message || 'Lỗi máy chủ nội bộ';
      res.status(500).json({
        status: 'error',
        message: errorMessage
      });
    }
  });
  //get detail movies cho modal detail
  app.get('/api/movies-detail/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const r = await getMovieByIdImpl(
        db,
        {
          movies: pgMovies,
          bookings: pgBookings,
          ticket_packages: pgTicketPackages
        },
        id
      );
      if (!r) return res.status(404).json({ status: 'error', message: 'Không tìm thấy phim' });
      res.status(200).json(r);
    } catch (error: any) {
      const errorMessage = error?.message || 'Lỗi máy chủ nội bộ';
      res.status(500).json({
        status: 'error',
        message: errorMessage
      });
    }
  });
  app.post('/api/movies', async (req, res) => {
    try {
      const r = await createMovieImpl(db, { movies: pgMovies }, req.body as any, undefined, undefined, localUploader);
      res.status(201).json(r);
    } catch (error: any) {
      const errorMessage = error?.message || 'Lỗi máy chủ nội bộ';
      res.status(500).json({
        status: 'error',
        message: errorMessage
      });
    }
  });
  app.put('/api/movies/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const r = await updateMovieImpl(
        db,
        { movies: pgMovies, ticket_packages: pgTicketPackages },
        id,
        req.body as any,
        undefined,
        undefined,
        localUploader,
        localDeleter
      );
      if (!r) return res.status(404).json({ status: 'error', message: 'Không tìm thấy' });
      res.status(200).json(r);
    } catch (error: any) {
      const errorMessage = error?.message || 'Lỗi máy chủ nội bộ';
      res.status(500).json({
        status: 'error',
        message: errorMessage
      });
    }
  });
  app.delete('/api/movies/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const r = await deleteMovieImpl(db, { movies: pgMovies }, id, localDeleter);
      if (!r) return res.status(404).json({ status: 'error', message: 'Không tìm thấy' });
      res.status(200).json(r);
    } catch (error: any) {
      const errorMessage = error?.message || 'Lỗi máy chủ nội bộ';
      res.status(500).json({
        status: 'error',
        message: errorMessage
      });
    }
  });
  app.post('/api/movies-status/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      // Log body to debug on Worker
      console.log(`[Status Update] ID: ${id}, Body:`, req.body);

      const is_active = req.body.is_active !== undefined ? req.body.is_active : req.body.isActive;

      if (typeof is_active === 'undefined') {
        return res.status(400).json({ status: 'error', message: 'Missing is_active field' });
      }

      const r = await updateMovieStatusImpl(
        db,
        { movies: pgMovies, ticket_packages: pgTicketPackages },
        id,
        is_active,
        process.env.RUNTIME_ENV
      );
      const status = typeof (r as any).status === 'number' ? (r as any).status : 200;
      const payload = {
        ...(r as any),
        status: status >= 400 ? 'error' : 'success'
      };
      res.status(status).json(payload);
    } catch (error: any) {
      const errorMessage = error?.message || 'Lỗi máy chủ nội bộ';
      res.status(500).json({
        status: 'error',
        message: errorMessage
      });
    }
  });
  app.post('/api/login', async (req, res) => {
    try {
      const r = await loginImpl(db, { accounts: pgAccounts, users: pgUsers }, req.body as any);
      const status = typeof (r as any).status === 'number' ? (r as any).status : 200;
      const payload = {
        ...(r as any),
        status: status >= 400 ? 'error' : 'success'
      };
      res.status(status).json(payload);
    } catch (error: any) {
      const errorMessage = error?.message || 'Lỗi máy chủ nội bộ';
      res.status(500).json({
        status: 'error',
        message: errorMessage
      });
    }
  });
  app.post('/api/register', async (req, res) => {
    try {
      const r = await registerImpl(
        db,
        { accounts: pgAccounts, users: pgUsers, email_logs: pgEmailLogs },
        req.body as any
      );
      const status = typeof (r as any).status === 'number' ? (r as any).status : 200;
      const payload = {
        ...(r as any),
        status: status >= 400 ? 'error' : 'success'
      };
      res.status(status).json(payload);
    } catch (error: any) {
      const errorMessage = error?.message || 'Lỗi máy chủ nội bộ';
      res.status(500).json({
        status: 'error',
        message: errorMessage
      });
    }
  });
  app.post('/api/forget-password', async (req, res) => {
    try {
      const email = String((req.body as any)?.email || '');
      const r = await forgetPassImpl(db, { accounts: pgAccounts, tokens: pgTokens, email_logs: pgEmailLogs }, email);
      const status = typeof (r as any).status === 'number' ? (r as any).status : 200;
      const payload = {
        ...(r as any),
        status: status >= 400 ? 'error' : 'success'
      };
      res.status(status).json(payload);
    } catch (error: any) {
      const errorMessage = error?.message || 'Lỗi máy chủ nội bộ';
      res.status(500).json({
        status: 'error',
        message: errorMessage
      });
    }
  });
  app.post('/api/reset-password', async (req, res) => {
    try {
      const r = await resetPasswordImpl(db, { accounts: pgAccounts, tokens: pgTokens }, req.body as any);
      const status = typeof (r as any).status === 'number' ? (r as any).status : 200;
      const payload = {
        ...(r as any),
        status: status >= 400 ? 'error' : 'success'
      };
      res.status(status).json(payload);
    } catch (error: any) {
      const errorMessage = error?.message || 'Lỗi máy chủ nội bộ';
      res.status(500).json({
        status: 'error',
        message: errorMessage
      });
    }
  });
  app.get('/api/getActiveMovies', async (_req, res) => {
    try {
      const result = await getAllActiveMoviesToday(db, { movies: pgMovies });
      return res.status(200).json(result);
    } catch (error: any) {
      console.error('Error in getActiveMovies:', error);
      return res.status(500).json({
        message: 'Lỗi máy chủ nội bộ',
        error: process.env.NODE_ENV === 'development' ? error?.message : undefined
      });
    }
  });
  app.post('/api/momo/create-payment', async (req, res) => {
    try {
      const r = await createMomoPaymentImpl(req.body as any);
      const status = typeof (r as any).status === 'number' ? (r as any).status : 200;
      const payload = {
        ...(r as any),
        status: status >= 400 ? 'error' : 'success'
      };
      res.status(status).json(payload);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || 'Internal error' });
    }
  });
  app.post('/api/momo/ipn', async (_req, res) => {
    try {
      const r = await momoIpnImpl();
      res.status(200).json(r);
    } catch {
      res.status(500).json({ result: false });
    }
  });
  app.post('/api/vnpay/create-payment', async (req, res) => {
    try {
      const ip = (req.headers['x-forwarded-for'] as any) || req.socket.remoteAddress || '127.0.0.1';
      const r = await createVnpayPaymentImpl({ ...(req.body as any), ip });
      const status = typeof (r as any).status === 'number' ? (r as any).status : 200;
      const payload = {
        ...(r as any),
        status: status >= 400 ? 'error' : 'success'
      };
      res.status(status).json(payload);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || 'Internal error' });
    }
  });
  app.post('/api/vnpay/ipn', async (_req, res) => {
    const r = await vnpayIpnImpl();
    res.status(200).json(r);
  });
  // Schema tables for PostgreSQL
  const pgTables = {
    bookings: pgBookings,
    users: pgUsers,
    accounts: pgAccounts,
    movies: pgMovies,
    ticket_packages: pgTicketPackages,
    email_logs: pgEmailLogs
  };

  app.post('/api/validate-booking', async (req, res) => {
    try {
      const r = await validateBookingImpl(db, req.body as any, pgTables);
      const status = typeof (r as any).status === 'number' ? (r as any).status : 200;
      const payload = {
        ...(r as any),
        status: status >= 400 ? 'error' : 'success'
      };
      res.status(status).json(payload);
    } catch (error: any) {
      res.status(500).json({ message: 'Lỗi máy chủ nội bộ', error: error?.message });
    }
  });
  app.post('/api/create-booking', async (req, res) => {
    try {
      const r = await createPaymentImpl(db, req.body as any, pgTables);
      const status = typeof (r as any).status === 'number' ? (r as any).status : 201;
      const payload = {
        ...(r as any),
        status: status >= 400 ? 'error' : 'success'
      };
      res.status(status).json(payload);
    } catch (error: any) {
      res.status(500).json({ message: 'Lỗi máy chủ nội bộ', error: error?.message });
    }
  });
  app.post('/api/confirm-booking', async (req, res) => {
    try {
      const r = await updatePaymentImpl(db, req.body as any, undefined, undefined, pgTables);
      const status = typeof (r as any).status === 'number' ? (r as any).status : 200;
      const payload = {
        ...(r as any),
        status: status >= 400 ? 'error' : 'success'
      };
      res.status(status).json(payload);
    } catch (error: any) {
      const errorMessage = error?.message || 'Lỗi máy chủ nội bộ';
      res.status(500).json({
        status: 'error',
        message: errorMessage
      });
    }
  });
  app.get('/api/bookings/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const r = await getBookingByIdImpl(db, id, pgTables);
      const status = typeof (r as any).status === 'number' ? (r as any).status : 200;
      const payload = {
        ...(r as any),
        status: status >= 400 ? 'error' : 'success'
      };
      res.status(status).json(payload);
    } catch (err: any) {
      res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    }
  });
  app.get('/api/bookings-code/:code', noStore, rateLimitCheckCode(), async (req, res) => {
    try {
      const code = String(req.params.code || '');
      const r = await getBookingByCodeImpl(db, code, pgTables);
      const status = typeof (r as any).status === 'number' ? (r as any).status : 200;
      if (status == 404) {
        const remaining =
          typeof (res.locals as any).rateLimitRemaining === 'number'
            ? (res.locals as any).rateLimitRemaining
            : undefined;
        const windowMs =
          typeof (res.locals as any).rateLimitWindowMs === 'number' ? (res.locals as any).rateLimitWindowMs : undefined;
        const suffix =
          remaining !== undefined && windowMs !== undefined
            ? ` Bạn còn ${remaining} lần thử trong ${Math.ceil(windowMs / 1000)}s`
            : '';
        return res.status(status).json({
          status: 'error',
          message: `Không tìm thấy vé với mã này.${suffix}`
        });
      }
      const payload = {
        ...(r as any),
        status: status >= 400 ? 'error' : 'success'
      };
      res.status(status).json(payload);
    } catch (err: any) {
      res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    }
  });
  app.post('/api/bookings-use', async (req, res) => {
    try {
      const code = String((req.body as any)?.code || '');
      const r = await confirmUseTicketImpl(db, code, pgTables);
      const status = typeof (r as any).status === 'number' ? (r as any).status : 200;
      const payload = {
        ...(r as any),
        status: status >= 400 ? 'error' : 'success'
      };
      res.status(status).json(payload);
    } catch (error: any) {
      const errorMessage = error?.message || 'Lỗi máy chủ nội bộ';
      res.status(500).json({
        status: 'error',
        message: errorMessage
      });
    }
  });
  app.get('/api/admin/revenue', async (req, res) => {
    try {
      const from = String(req.query.from || '');
      const to = String(req.query.to || '');
      const status = String(req.query.status || 'paid');
      const r = await getRevenueImpl(db, { bookings: pgBookings }, { from, to, status });
      res.status(200).json(r);
    } catch (error: any) {
      const errorMessage = error?.message || 'Lỗi máy chủ nội bộ';
      res.status(500).json({
        status: 'error',
        message: errorMessage
      });
    }
  });
  app.get('/api/admin/transactions', async (req, res) => {
    try {
      const page = Number(req.query.page || 1);
      const pageSize = Number(req.query.pageSize || 20);
      const searchText = String(req.query.searchText || '');
      const status = String(req.query.status || 'all');
      const sort = String(req.query.sort || 'created_at');
      const dir = String(req.query.dir || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
      const payment_method = String(req.query.payment_method || '');
      const from = String(req.query.from || '');
      const to = String(req.query.to || '');
      const r = await listTransactionsImpl(
        db,
        {
          bookings: pgBookings,
          users: pgUsers,
          accounts: pgAccounts,
          movies: pgMovies,
          ticket_packages: pgTicketPackages
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
        }
      );
      res.status(200).json(r);
    } catch (error: any) {
      const errorMessage = error?.message || 'Lỗi máy chủ nội bộ';
      res.status(500).json({
        status: 'error',
        message: errorMessage
      });
    }
  });
  app.get('/api/admin/transactions/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const r = await getTransactionByIdImpl(
        db,
        {
          bookings: pgBookings,
          users: pgUsers,
          accounts: pgAccounts,
          movies: pgMovies,
          ticket_packages: pgTicketPackages
        },
        id
      );
      if (!r) return res.status(404).json({ status: 'error', message: 'Không tìm thấy' });
      res.status(200).json(r);
    } catch (error: any) {
      const errorMessage = error?.message || 'Lỗi máy chủ nội bộ';
      res.status(500).json({
        status: 'error',
        message: errorMessage
      });
    }
  });
  app.get('/api/toys', async (req, res) => {
    try {
      const page = Number(req.query.page || 1);
      const pageSize = Number(req.query.pageSize || 20);
      const q = String(req.query.q || '');
      const status = String(req.query.status || 'all');
      const r = await listToysImpl(db, { toys: pgToys }, { page, pageSize, q, status });
      res.status(200).json(r);
    } catch (error: any) {
      const errorMessage = error?.message || 'Lỗi máy chủ nội bộ';
      res.status(500).json({
        status: 'error',
        message: errorMessage
      });
    }
  });
  app.get('/api/toys-active', async (_req, res) => {
    try {
      const r = await listActiveToys(db, { toys: pgToys });
      res.status(200).json(r);
    } catch (error: any) {
      const errorMessage = error?.message || 'Lỗi máy chủ nội bộ';
      res.status(500).json({
        status: 'error',
        message: errorMessage
      });
    }
  });
  app.get('/api/toys/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const r = await getToyImpl(db, { toys: pgToys }, id);
      if (!r) return res.status(404).json({ message: 'Không tìm thấy' });
      res.status(200).json(r);
    } catch (error: any) {
      const errorMessage = error?.message || 'Lỗi máy chủ nội bộ';
      res.status(500).json({
        status: 'error',
        message: errorMessage
      });
    }
  });
  app.post('/api/toys', async (req, res) => {
    try {
      const r = await createToyImpl(db, { toys: pgToys }, req.body as any, undefined, localUploader);
      res.status(201).json(r);
    } catch (error: any) {
      const errorMessage = error?.message || 'Lỗi máy chủ nội bộ';
      res.status(500).json({
        status: 'error',
        message: errorMessage
      });
    }
  });
  app.put('/api/toys/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const r = await updateToyImpl(db, { toys: pgToys }, id, req.body as any, undefined, localUploader, localDeleter);
      if (!r) return res.status(404).json({ message: 'Không tìm thấy' });
      res.status(200).json(r);
    } catch (error: any) {
      const errorMessage = error?.message || 'Lỗi máy chủ nội bộ';
      res.status(500).json({
        status: 'error',
        message: errorMessage
      });
    }
  });
  app.delete('/api/toys/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const r = await deleteToyImpl(db, { toys: pgToys }, id, localDeleter);
      if (!r) return res.status(404).json({ message: 'Không tìm thấy' });
      res.status(200).json(r);
    } catch (error: any) {
      const errorMessage = error?.message || 'Lỗi máy chủ nội bộ';
      res.status(500).json({
        status: 'error',
        message: errorMessage
      });
    }
  });

  // ===== POST MANAGEMENT =====
  app.get('/api/posts', async (req, res) => {
    try {
      const page = req.query.page ? parseInt(String(req.query.page)) : 1;
      const pageSize = req.query.pageSize ? parseInt(String(req.query.pageSize)) : 10;
      const q = req.query.q ? String(req.query.q) : undefined;
      const status = req.query.status ? String(req.query.status) : undefined;
      const r = await listPostsImpl(db, { posts: pgPosts }, { page, pageSize, q, status });
      res.status(200).json(r);
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error?.message || 'Internal error' });
    }
  });

  app.get('/api/posts/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const r = await getPostImpl(db, { posts: pgPosts }, id);
      if (!r) return res.status(404).json({ message: 'Không tìm thấy' });
      res.status(200).json({ post: r });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error?.message || 'Internal error' });
    }
  });

  app.post('/api/posts', async (req, res) => {
    try {
      const r = await createPostImpl(db, { posts: pgPosts }, req.body, undefined, localUploader);
      res.status(201).json({ post: r });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error?.message || 'Internal error' });
    }
  });

  app.put('/api/posts/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const r = await updatePostImpl(db, { posts: pgPosts }, id, req.body, undefined, localUploader, localDeleter);
      if (!r) return res.status(404).json({ message: 'Không tìm thấy' });
      res.status(200).json({ post: r });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error?.message || 'Internal error' });
    }
  });

  app.delete('/api/posts/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const r = await deletePostImpl(db, { posts: pgPosts }, id, localDeleter);
      if (!r) return res.status(404).json({ message: 'Không tìm thấy' });
      res.status(200).json(r);
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error?.message || 'Internal error' });
    }
  });

  app.get('/api/admin/dashboard/metrics', async (req, res) => {
    try {
      const period = String(req.query.period || 'week');
      const year = req.query.year ? parseInt(String(req.query.year)) : undefined;
      const r = await getDashboardMetricsImpl(
        db,
        {
          movies: pgMovies,
          toys: pgToys,
          users: pgUsers,
          bookings: pgBookings,
          ticket_packages: pgTicketPackages
        },
        undefined,
        period,
        year
      );
      res.status(200).json(r);
    } catch (error: any) {
      const errorMessage = error?.message || 'Lỗi máy chủ nội bộ';
      res.status(500).json({
        status: 'error',
        message: errorMessage
      });
    }
  });
  app.get('/api/admin/dashboard/revenue-date', async (req, res) => {
    try {
      const date = String(req.query.date || '');
      const status = String(req.query.status || 'paid');
      const year = req.query.year ? parseInt(String(req.query.year)) : undefined;
      const r = await getRevenueByDateImpl(db, { bookings: pgBookings }, { date, status, year });
      res.status(200).json(r);
    } catch (error: any) {
      const errorMessage = error?.message || 'Lỗi máy chủ nội bộ';
      res.status(500).json({
        status: 'error',
        message: errorMessage
      });
    }
  });

  app.get('/api/admin/dashboard/revenue-7days', async (req, res) => {
    try {
      const year = req.query.year ? parseInt(String(req.query.year)) : undefined;
      const r = await getRevenue7DaysImpl(db, { bookings: pgBookings }, undefined, year);
      res.status(200).json(r);
    } catch (error: any) {
      const errorMessage = error?.message || 'Lỗi máy chủ nội bộ';
      res.status(500).json({
        status: 'error',
        message: errorMessage
      });
    }
  });
  app.get('/api/admin/dashboard/revenue-month', async (req, res) => {
    try {
      const year = String(req.query.year || '');
      const month = String(req.query.month || '');
      const status = String(req.query.status || 'paid');
      const r = await getRevenueByMonthImpl(db, { bookings: pgBookings }, { year, month, status });
      res.status(200).json(r);
    } catch (error: any) {
      const errorMessage = error?.message || 'Lỗi máy chủ nội bộ';
      res.status(500).json({
        status: 'error',
        message: errorMessage
      });
    }
  });
  app.get('/api/admin/email-logs', async (req, res) => {
    try {
      const status = String(req.query.status || 'all');
      const email_type = String(req.query.email_type || 'all');
      const search = String(req.query.search || '');
      const page = Number(req.query.page || 1);
      const limit = Number(req.query.limit || 20);

      const r = await getEmailLogsImpl(
        db,
        {
          email_logs: pgEmailLogs,
          users: pgUsers,
          bookings: pgBookings
        },
        { status, email_type, search, page, limit }
      );
      res.status(200).json(r);
    } catch (err: any) {
      res.status(500).json({ status: 'error', message: err?.message || 'Internal error' });
    }
  });

  app.get('/api/admin/users', async (req, res) => {
    try {
      const page = Number(req.query.page || 1);
      const pageSize = Number(req.query.pageSize || 20);
      const q = String(req.query.q || '');
      const r = await getUsersImpl(
        db,
        { users: pgUsers, accounts: pgAccounts, bookings: pgBookings },
        { page, pageSize, q }
      );
      res.status(200).json(r);
    } catch (error: any) {
      const errorMessage = error?.message || 'Lỗi máy chủ nội bộ';
      res.status(500).json({
        status: 'error',
        message: errorMessage
      });
    }
  });
  app.get('/api/admin/users/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const r = await getUserByIdImpl(
        db,
        {
          users: pgUsers,
          bookings: pgBookings,
          movies: pgMovies,
          ticket_packages: pgTicketPackages
        },
        id
      );
      if (!r) return res.status(404).json({ message: 'Không tìm thấy' });
      res.status(200).json(r);
    } catch (error: any) {
      const errorMessage = error?.message || 'Lỗi máy chủ nội bộ';
      res.status(500).json({
        status: 'error',
        message: errorMessage
      });
    }
  });
  app.get('/api/users', async (req, res) => {
    try {
      const page = Number(req.query.page || 1);
      const pageSize = Number(req.query.pageSize || 20);
      const q = String(req.query.q || '');
      const r = await getUsersImpl(
        db,
        { users: pgUsers, accounts: pgAccounts, bookings: pgBookings },
        { page, pageSize, q }
      );
      res.status(200).json(r);
    } catch (error: any) {
      const errorMessage = error?.message || 'Lỗi máy chủ nội bộ';
      res.status(500).json({
        status: 'error',
        message: errorMessage
      });
    }
  });
  app.get('/api/users-profile', async (req, res) => {
    try {
      const emailRaw = String(req.query.email || '');
      const r = await getUserProfileByEmailImpl(db, { accounts: pgAccounts, users: pgUsers }, emailRaw);
      const status = typeof (r as any).status === 'number' ? (r as any).status : 200;
      const payload = {
        ...(r as any),
        status: status >= 400 ? 'error' : 'success'
      };
      res.status(status).json(payload);
    } catch (error: any) {
      const errorMessage = error?.message || 'Lỗi máy chủ nội bộ';
      res.status(500).json({
        status: 'error',
        message: errorMessage
      });
    }
  });
  app.get('/api/users/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const r = await getUserByIdImpl(
        db,
        {
          users: pgUsers,
          bookings: pgBookings,
          movies: pgMovies,
          ticket_packages: pgTicketPackages
        },
        id
      );
      if (!r) return res.status(404).json({ message: 'Không tìm thấy' });
      res.status(200).json(r);
    } catch (error: any) {
      const errorMessage = error?.message || 'Lỗi máy chủ nội bộ';
      res.status(500).json({
        status: 'error',
        message: errorMessage
      });
    }
  });
  app.post('/api/users-profile', async (req, res) => {
    try {
      const r = await updateUserProfileImpl(db, { accounts: pgAccounts, users: pgUsers }, req.body as any);
      const status = typeof (r as any).status === 'number' ? (r as any).status : 200;
      const payload = {
        ...(r as any),
        status: status >= 400 ? 'error' : 'success'
      };
      res.status(status).json(payload);
    } catch (err: any) {
      res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    }
  });
  app.post('/api/users/password', async (req, res) => {
    try {
      const r = await changePasswordImpl(db, { accounts: pgAccounts }, req.body as any);
      const status = typeof (r as any).status === 'number' ? (r as any).status : 200;
      const payload = {
        ...(r as any),
        status: status >= 400 ? 'error' : 'success'
      };
      res.status(status).json(payload);
    } catch (error: any) {
      const errorMessage = error?.message || 'Lỗi máy chủ nội bộ';
      res.status(500).json({
        status: 'error',
        message: errorMessage
      });
    }
  });
  app.get('/api/usersprofile/transactions', async (req, res) => {
    try {
      const email = String(req.query.email || '');
      const status = String(req.query.status || 'paid');
      const page = Number(req.query.page || 1);
      const pageSize = Number(req.query.pageSize || 20);
      const sort = String(req.query.sort || 'created_at');
      const dir = String(req.query.dir || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
      const payment_method = String(req.query.payment_method || '');
      const from = String(req.query.from || '');
      const to = String(req.query.to || '');
      const r = await listUserTransactionsImpl(
        db,
        {
          accounts: pgAccounts,
          bookings: pgBookings,
          movies: pgMovies,
          ticket_packages: pgTicketPackages
        },
        { email, status, page, pageSize, sort, dir, payment_method, from, to }
      );
      res.status(200).json(r);
    } catch (err) {
      res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    }
  });
  app.get('/api/tickets', async (req, res) => {
    try {
      const page = Number(req.query.page || 1);
      const pageSize = Number(req.query.pageSize || 20);
      const q = String(req.query.q || '');
      const includeInactive = req.query.includeInactive === 'true';
      const r = await listTicketPackagesImpl(
        db,
        { ticket_packages: pgTicketPackages, movies: pgMovies },
        { page, pageSize, q, includeInactive }
      );
      res.status(200).json(r);
    } catch (error: any) {
      const errorMessage = error?.message || 'Lỗi máy chủ nội bộ';
      res.status(500).json({
        status: 'error',
        message: errorMessage
      });
    }
  });
  app.get('/api/tickets-active', async (_req, res) => {
    try {
      const r = await listActiveTicketPackages(db, {
        ticket_packages: pgTicketPackages,
        movies: pgMovies
      });
      res.status(200).json(r);
    } catch (error: any) {
      const errorMessage = error?.message || 'Lỗi máy chủ nội bộ';
      res.status(500).json({
        status: 'error',
        message: errorMessage
      });
    }
  });
  app.get('/api/tickets/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const r = await getTicketPackageImpl(db, { ticket_packages: pgTicketPackages }, id);
      if (!r) return res.status(404).json({ message: 'Không tìm thấy' });
      res.status(200).json(r);
    } catch (error: any) {
      const errorMessage = error?.message || 'Lỗi máy chủ nội bộ';
      res.status(500).json({
        status: 'error',
        message: errorMessage
      });
    }
  });
  app.post('/api/tickets', async (req, res) => {
    try {
      const r = await createTicketPackageImpl(
        db,
        { ticket_packages: pgTicketPackages, movies: pgMovies },
        req.body as any,
        process.env
      );
      res.status(201).json(r);
    } catch (error: any) {
      const errorMessage = error?.message || 'Lỗi máy chủ nội bộ';
      res.status(500).json({
        status: 'error',
        message: errorMessage
      });
    }
  });
  app.put('/api/tickets/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const r = await updateTicketPackageImpl(
        db,
        { ticket_packages: pgTicketPackages, movies: pgMovies },
        id,
        req.body as any,
        process.env
      );
      if (!r) return res.status(404).json({ status: 'error', message: 'Không tìm thấy' });
      res.status(200).json(r);
    } catch (error: any) {
      const errorMessage = error?.message || 'Lỗi máy chủ nội bộ';
      res.status(500).json({
        status: 'error',
        message: errorMessage
      });
    }
  });
  app.delete('/api/tickets/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const r = await deleteTicketPackageImpl(
        db,
        { ticket_packages: pgTicketPackages, bookings: pgBookings },
        id,
        process.env
      );
      if (!r) return res.status(404).json({ message: 'Không tìm thấy' });
      res.status(200).json(r);
    } catch (error: any) {
      const errorMessage = error?.message || 'Lỗi máy chủ nội bộ';
      res.status(500).json({
        status: 'error',
        message: errorMessage
      });
    }
  });
  // app.post("/api/admin/uploads/video", uploadAdminVideo);
  // Override: Use local upload logic for video if running locally
  app.post('/api/admin/uploads/video', (req, res, next) => {
    // Local implementation
    const storage = multer.diskStorage({
      destination: (req: any, _file: any, cb: any) => {
        // Get folder from body (must be sent before file in FormData) or query
        const folderParam = req.body.folder || req.query.folder || 'general';
        // Sanitize folder name
        const safeFolder = folderParam.replace(/[^a-zA-Z0-9._-]/g, '_');
        const targetDir = path.join(uploadVideoDir, safeFolder);
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
        cb(null, targetDir);
      },
      filename: (_req: any, file: any, cb: any) => {
        const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        // Removed timestamp to allow overwrite
        cb(null, safe);
      }
    });
    const upload = multer({
      storage,
      limits: { fileSize: 1024 * 1024 * 2048 },
      fileFilter: (_req: any, file: any, cb: any) => {
        if (!file.mimetype.startsWith('video/')) return cb(new Error('Chỉ chấp nhận video'));
        cb(null, true);
      }
    }).single('file');

    upload(req, res, (err: any) => {
      if (err) return res.status(400).json({ message: err.message });
      const file = (req as any).file;
      if (!file) return res.status(400).json({ message: 'Thiếu tệp video' });

      // Determine relative path based on where we saved it
      // file.destination gives absolute path, we need relative to root for URL
      // We know we saved to uploadVideoDir / safeFolder
      const folderParam = req.body.folder || req.query.folder || 'general';
      const safeFolder = folderParam.replace(/[^a-zA-Z0-9._-]/g, '_');

      res.status(200).json({
        public_id: file.filename,
        // Construct URL: /uploads/videos/folder/filename
        url: `/uploads/videos/${safeFolder}/${file.filename}`,
        bytes: file.size,
        duration: 0,
        format: file.mimetype.split('/')[1] || 'mp4',
        width: 0,
        height: 0
      });
    });
  });
  app.post('/api/admin/cloudinary/sign', generateCloudinarySignature);
  app.post('/api/admin/site-media', async (req, res) => {
    try {
      const r = await createSiteMediaImpl(db, { site_media: pgSiteMedia }, req.body as any);
      res.status(201).json(r);
    } catch (error: any) {
      const errorMessage = error?.message || 'Lỗi máy chủ nội bộ';
      res.status(500).json({
        status: 'error',
        message: errorMessage
      });
    }
  });
  app.put('/api/admin/site-media', async (req, res) => {
    try {
      const r = await updateSiteMediaImpl(db, { site_media: pgSiteMedia }, req.body as any);
      const status = (r as any)?.item ? 200 : 404;
      res.status(status).json({ ...r });
    } catch (error: any) {
      const errorMessage = error?.message || 'Lỗi máy chủ nội bộ';
      res.status(500).json({
        status: 'error',
        message: errorMessage
      });
    }
  });
  app.delete('/api/admin/site-media/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { deleteSiteMediaImpl } = await import('./routes/admin/site-media');
      const r = await deleteSiteMediaImpl(db, { site_media: pgSiteMedia }, id, localDeleter);
      const status = r.ok ? 200 : 404;
      res.status(status).json(r);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || 'Lỗi máy chủ nội bộ' });
    }
  });
  // app.post("/api/admin/site-media/sync", ... ) -> Removed as user requested "Overwrite" logic instead of "Delete All"
  app.get('/api/site-media', async (req, res) => {
    try {
      const section = String(req.query.section || '');
      const type = String(req.query.type || '');
      const active = String(req.query.active || '');
      const r = await listSiteMediaImpl(db, { site_media: pgSiteMedia }, { section, type, active });
      res.status(200).json(r);
    } catch (error: any) {
      const errorMessage = error?.message || 'Lỗi máy chủ nội bộ';
      res.status(500).json({
        status: 'error',
        message: errorMessage
      });
    }
  });

  app.get('/api/debug/mail', async (_req, res) => {
    try {
      const config = getMailConfig();
      const verify = await verifyMailProvider();
      res.status(200).json({ config, verify });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || 'Internal error' });
    }
  });

  return app;
}
