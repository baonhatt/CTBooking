import { Hono } from "hono";
import { cors } from "hono/cors";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
import { eq, desc, asc, and, like, or, sql, count } from "drizzle-orm";
import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import { getAllActiveMoviesToday, listMovies, getMovie } from "../../server/routes/user/movies";
import { createMovieImpl, updateMovieImpl, deleteMovieImpl, getMovieByIdImpl } from "../../server/routes/admin/movies";
import { getRevenueImpl, listTransactionsImpl, getTransactionByIdImpl } from "../../server/routes/admin/payments";
import { validateBookingImpl, createPaymentImpl, updatePaymentImpl, getBookingByIdImpl, getBookingByCodeImpl, confirmUseTicketImpl } from "../../server/routes/user/payments";
import { getDashboardMetricsImpl, getRevenueByDateImpl, getRevenue7DaysImpl, getRevenueByMonthImpl } from "../../server/routes/admin/dashboard";
import { getUsersImpl, getUserByIdImpl } from "../../server/routes/admin/users";
import { loginImpl, registerImpl } from "../../server/routes/user/auth";
import { forgetPassImpl, resetPasswordImpl, changePasswordImpl } from "../../server/routes/user/password";
import { listActiveToys } from "../../server/routes/user/toys";
import { listToysImpl, createToyImpl, getToyImpl, updateToyImpl, deleteToyImpl } from "../../server/routes/admin/toys";
import { listTicketPackagesImpl, getTicketPackageImpl, createTicketPackageImpl, updateTicketPackageImpl, deleteTicketPackageImpl } from "../../server/routes/admin/tickets";
import { listActiveTicketPackages } from "../../server/routes/user/tickets";
import { createSiteMediaImpl, listSiteMediaImpl, updateSiteMediaImpl, deleteSiteMediaImpl } from "../../server/routes/admin/site-media";
import { createMomoPaymentImpl, momoIpnImpl } from "../../server/routes/user/momo";
import { createVnpayPaymentImpl, vnpayIpnImpl } from "../../server/routes/user/vnpay";
import { listUserTransactionsImpl, getUserProfileByEmailImpl, updateUserProfileImpl } from "../../server/routes/user/users";
// import { getMailConfig, verifyMailProvider } from "../../server/routes/mail-service";
import {
  RL_MAX,
  RL_WINDOW_MS,
  attempts,
  hasCloudinary,
  cloudinarySignedParams,
  uploadCloudinaryImageDataURI,
  optimizeCloudinaryUrl,
  sendMail,
  getWelcomeEmailTemplate,
  getBookingEmailTemplate,
  getResetPasswordEmailTemplate,
  logSystemError,
} from "./utils";

type Bindings = {
  cinema_db: D1Database;
  r2_cinemastore: R2Bucket;
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
  VITE_RATE_LIMIT_BOOKING_CHECK_MAX: string;
  VITE_RATE_LIMIT_BOOKING_CHECK_WINDOWMS: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) return "https://cinesphere.com.vn";

      const allowedExact = new Set([
        "https://cinesphere.com.vn",
        "https://www.cinesphere.com.vn",
        "https://cinema-pages.pages.dev", // Pages production
      ]);

      if (allowedExact.has(origin)) return origin;

      // Allow all preview subdomains for cinema-pages on pages.dev
      try {
        const url = new URL(origin);
        if (
          url.hostname === "cinema-pages.pages.dev" ||
          url.hostname.endsWith(".cinema-pages.pages.dev")
        ) {
          return origin;
        }
      } catch {
        // ignore parse error, fall back to default
      }

      // Fallback: default to prod domain
      return "https://cinesphere.com.vn";
    },
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "Accept",
      "Origin",
      "Referer",
      "Access-Control-Request-Headers",
    ],
    exposeHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
    credentials: true,
  }),
);

app.use("*", async (c, next) => {
  await next();
});

app.get("/", (c) => c.json({ ok: true, service: "cinema-worker", time: Date.now() }));

app.get("/api/ping", (c) => {
  const ping = (typeof process !== "undefined" && (process as any).env?.PING_MESSAGE) ?? "ping";
  return c.json({ message: ping });
});

// Demo endpoint parity
app.get("/api/demo", (c) => {
  return c.json({ message: "Hello from Express server" }, 200);
});

// ----- Auth endpoints parity -----
app.post("/api/login", async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });
    const body = await c.req.json().catch(() => ({}));
    const r = await loginImpl(db, { accounts: schema.accounts, users: schema.users }, body as any);
    const status = typeof (r as any).status === "number" ? (r as any).status : 200;
    const payload = { ...(r as any), status: status >= 400 ? "error" : "success" };
    return c.json(payload as any, status as any);
  } catch {
    return c.json({ message: "Lỗi máy chủ nội bộ" }, 500);
  }
});
app.post("/api/register", async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });
    const body = await c.req.json().catch(() => ({}));
    const mailer = async (to: string, sub: string, html: string) => {
      const res = await sendMail(c.env, to, sub, html);
      if (!res.ok) throw new Error(`Email failed: ${res.status} ${res.body}`);
      return res;
    };
    const appBaseUrl = c.env.VITE_CLIENT_BASE_URL || "https://cinesphere.com.vn";
    const renderWelcome = (data: { customerName: string; email: string }) =>
      getWelcomeEmailTemplate(appBaseUrl, data);
    const r = await registerImpl(db, { accounts: schema.accounts, users: schema.users }, body as any, mailer, renderWelcome);
    const status = typeof (r as any).status === "number" ? (r as any).status : 200;
    const payload = { ...(r as any), status: status >= 400 ? "error" : "success" };
    return c.json(payload, status);
  } catch (err: any) {
    const body = await c.req.json().catch(() => ({}));
    logSystemError("register", err, body);
    const status = err?.status || 500;
    return c.json(
      {
        message: err?.message || "Lỗi máy chủ nội bộ",
        error: String(err),
        cause: err?.cause ? String(err.cause) : undefined,
        stack: err?.stack || null,
      },
      status,
    );
  }
});
app.post("/api/forget-password", async (c) => {
  let body: any = {};
  try {
    const db = drizzle(c.env.cinema_db, { schema });
    body = await c.req.json().catch(() => ({}));
    const email = String((body as any)?.email || "");
    const mailer = async (to: string, sub: string, html: string) => {
      const res = await sendMail(c.env, to, sub, html);
      if (!res.ok) throw new Error(`Email failed: ${res.status} ${res.body}`);
      return res;
    };
    // Xử lý Dynamic URL cho Reset Password link
    // 1. Ưu tiên lấy từ Origin header của request (Preview domain)
    let appBaseUrl = "";
    const origin = c.req.header("Origin");
    
    const allowHost = (host: string) =>
      host === "cinesphere.com.vn" ||
      host === "www.cinesphere.com.vn" ||
      host === "cinema-pages.pages.dev" ||
      host.endsWith(".cinema-pages.pages.dev");

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
      appBaseUrl = c.env.VITE_CLIENT_BASE_URL || "https://cinesphere.com.vn";
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
       const path = link.startsWith("/") ? link : `/${link}`;
       const fullLink = `${appBaseUrl}${path}`;
       return getResetPasswordEmailTemplate(appBaseUrl, fullLink);
    };

    const r = await forgetPassImpl(db, { accounts: schema.accounts, tokens: schema.tokens }, email, mailer, renderReset);
    const status = typeof (r as any).status === "number" ? (r as any).status : 200;
    const payload = { ...(r as any), status: status >= 400 ? "error" : "success" };
    return c.json(payload, status as any);
  } catch (err: any) {
    logSystemError("forget-password", err, body);
    return c.json({ message: "Lỗi máy chủ nội bộ", error: String(err?.message || err) }, 500);
  }
});
app.post("/api/reset-password", async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });
    const body = await c.req.json().catch(() => ({}));
    const r = await resetPasswordImpl(db, { accounts: schema.accounts, tokens: schema.tokens }, body as any);
    const status = typeof (r as any).status === "number" ? (r as any).status : 200;
    const payload = { ...(r as any), status: status >= 400 ? "error" : "success" };
    return c.json(payload, status as any);
  } catch {
    return c.json({ message: "Lỗi máy chủ nội bộ" }, 500);
  }
});

app.get("/api/admin/revenue", async (c) => {
  try {
    const from = String(c.req.query("from") || "");
    const to = String(c.req.query("to") || "");
    const status = String(c.req.query("status") || "paid");
    const db = drizzle(c.env.cinema_db, { schema });
    const r = await getRevenueImpl(db, { bookings: schema.bookings }, { from, to, status });
    return c.json(r);
  } catch (err: any) {
    return c.json({ message: String(err?.message || "Internal error") }, 500);
  }
});

app.get("/api/admin/transactions", async (c) => {
  try {
    const page = Number(c.req.query("page") || 1);
    const pageSize = Number(c.req.query("pageSize") || 20);
    const email = String(c.req.query("email") || "");
    const status = String(c.req.query("status") || "all");
    const sort = String(c.req.query("sort") || "created_at");
    const dir = String(c.req.query("dir") || "desc").toLowerCase() === "asc" ? "asc" : "desc";
    const payment_method = String(c.req.query("payment_method") || "");
    const from = String(c.req.query("from") || "");
    const to = String(c.req.query("to") || "");
    const db = drizzle(c.env.cinema_db, { schema });
    const r = await listTransactionsImpl(db, { bookings: schema.bookings, users: schema.users, accounts: schema.accounts, movies: schema.movies, ticket_packages: schema.ticket_packages }, { page, pageSize, email, status, sort, dir, payment_method, from, to });
    return c.json(r);
  } catch (err: any) {
    return c.json({ message: String(err?.message || "Internal error") }, 500);
  }
});

app.get("/api/admin/transactions/:id", async (c) => {
  try {
    const id = Number(c.req.param("id"));
    const db = drizzle(c.env.cinema_db, { schema });
    const r = await getTransactionByIdImpl(db, { bookings: schema.bookings, users: schema.users, accounts: schema.accounts, movies: schema.movies, ticket_packages: schema.ticket_packages }, id);
    if (!r) return c.json({ message: "Không tìm thấy" }, 404);
    return c.json(r);
  } catch (err: any) {
    return c.json({ message: String(err?.message || "Internal error") }, 500);
  }
});

app.get("/api/admin/dashboard/metrics", async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });
    const r = await getDashboardMetricsImpl(db, { movies: schema.movies, users: schema.users, bookings: schema.bookings });
    return c.json(r);
  } catch (err: any) {
    return c.json({ message: String(err?.message || "Internal error") }, 500);
  }
});

app.get("/api/admin/dashboard/revenue-date", async (c) => {
  try {
    const date = String(c.req.query("date") || "");
    const status = String(c.req.query("status") || "paid");
    const db = drizzle(c.env.cinema_db, { schema });
    const r = await getRevenueByDateImpl(db, { bookings: schema.bookings }, { date, status });
    return c.json(r);
  } catch (err: any) {
    return c.json({ message: String(err?.message || "Internal error") }, 500);
  }
});

app.get("/api/admin/dashboard/revenue-7days", async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });
    const r = await getRevenue7DaysImpl(db, { bookings: schema.bookings });
    return c.json(r);
  } catch (err: any) {
    return c.json({ message: String(err?.message || "Internal error") }, 500);
  }
});

app.get("/api/admin/dashboard/revenue-month", async (c) => {
  try {
    const year = String(c.req.query("year") || "");
    const month = String(c.req.query("month") || "");
    const status = String(c.req.query("status") || "paid");
    const db = drizzle(c.env.cinema_db, { schema });
    const r = await getRevenueByMonthImpl(db, { bookings: schema.bookings }, { year, month, status });
    return c.json(r);
  } catch (err: any) {
    return c.json({ message: String(err?.message || "Internal error") }, 500);
  }
});

app.get("/api/admin/users", async (c) => {
  try {
    const page = Number(c.req.query("page") || 1);
    const pageSize = Number(c.req.query("pageSize") || 20);
    const q = String(c.req.query("q") || "");
    const db = drizzle(c.env.cinema_db, { schema });
    const r = await getUsersImpl(db, { users: schema.users, accounts: schema.accounts, bookings: schema.bookings }, { page, pageSize, q });
    return c.json(r);
  } catch (err: any) {
    return c.json({ message: String(err?.message || "Internal error") }, 500);
  }
});

app.get("/api/admin/users/:id", async (c) => {
  try {
    const id = Number(c.req.param("id"));
    const db = drizzle(c.env.cinema_db, { schema });
    const r = await getUserByIdImpl(db, { users: schema.users }, id);
    if (!r) return c.json({ message: "Không tìm thấy" }, 404);
    return c.json(r);
  } catch (err: any) {
    return c.json({ message: String(err?.message || "Internal error") }, 500);
  }
});

app.post("/api/admin/cloudinary/sign", async (c) => {
  try {
    const env = c.env;
    if (!hasCloudinary(env)) return c.json({ message: "Thiếu cấu hình Cloudinary" }, 400);
    const body = await c.req.json().catch(() => null);
    const folder = String(body?.folder || "");
    const resourceType = String(body?.resource_type || "");
    if (!folder || !resourceType) return c.json({ message: "Thiếu tham số cần thiết" }, 400);
    const timestamp = Math.floor(Date.now() / 1000);
    const params = {
      timestamp,
      folder,
      use_filename: "true",
      unique_filename: "false",
      overwrite: "true",
    } as Record<string, string | number>;
    const signed = await cloudinarySignedParams(env, params);
    return c.json({ timestamp, signature: signed.signature, api_key: signed.api_key });
  } catch (err: any) {
    return c.json({ message: String(err?.message || "Internal error") }, 500);
  }
});

// removed earlier non-parity /api/users/profile implementation to avoid duplication

app.post("/api/admin/uploads/video", async (c) => {
  try {
    const form = await c.req.parseBody();
    const file = form["file"] as File | null;
    if (!file) return c.json({ message: "Thiếu tệp video" }, 400);

    const mime = String(file.type || "application/octet-stream").toLowerCase();
    if (!mime.startsWith("video/")) return c.json({ message: "Chỉ chấp nhận tệp video" }, 400);

    const env = c.env;

    if (hasCloudinary(env)) {
      const cloudName = String(env.CLOUDINARY_CLOUD_NAME || "");
      const timestamp = Math.floor(Date.now() / 1000);
      const folder = String(env.CLOUDINARY_UPLOAD_FOLDER || "ctbooking/videos");
      const params = {
        timestamp,
        folder,
        use_filename: "true",
        unique_filename: "false",
        overwrite: "true",
        eager: "q_auto,w_1280,h_720,c_limit,f_mp4,vc_h264",
        eager_async: "true",
      };
      const signed = await cloudinarySignedParams(env, params);
      const cf = new FormData();
      cf.append("file", file);
      cf.append("folder", folder);
      cf.append("use_filename", "true");
      cf.append("unique_filename", "false");
      cf.append("overwrite", "true");
      cf.append("timestamp", String(timestamp));
      cf.append("api_key", signed.api_key);
      cf.append("signature", signed.signature);
      cf.append("eager", "q_auto,w_1280,h_720,c_limit,f_mp4,vc_h264");
      cf.append("eager_async", "true");
      const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`;
      const resp = await fetch(endpoint, { method: "POST", body: cf });
      const data: any = await resp.json().catch(() => ({}));
      if (!resp.ok) return c.json({ message: String(data?.error?.message || `Cloudinary ${resp.status}`) }, 500);
      return c.json({
        public_id: String(data.public_id || ""),
        url: String(data.secure_url || data.url || ""),
        bytes: Number(data.bytes || file.size || 0),
        duration: typeof data.duration === "number" ? data.duration : undefined,
        format: String(data.format || ""),
        width: typeof data.width === "number" ? data.width : undefined,
        height: typeof data.height === "number" ? data.height : undefined,
      });
    }

    if (!env.r2_cinemastore) return c.json({ message: "Thiếu R2 bucket hoặc Cloudinary" }, 500);

    const ext = (() => {
      const e = (file.name || "").split(".").pop()?.toLowerCase() || "";
      if (e) return e;
      if (mime.includes("mp4")) return "mp4";
      if (mime.includes("webm")) return "webm";
      if (mime.includes("mov")) return "mov";
      return "bin";
    })();
    const key = `uploads/videos/video_${Date.now()}.${ext}`;
    const arr = new Uint8Array(await file.arrayBuffer());
    await env.r2_cinemastore.put(key, arr, { httpMetadata: { contentType: mime } });
    return c.json({
      public_id: key,
      url: `/${key}`,
      bytes: Number(file.size || arr.byteLength || 0),
      format: ext,
    });
  } catch (err: any) {
    return c.json({ message: String(err?.message || "Upload error") }, 500);
  }
});

app.post("/api/getActiveMovies", async (c) => {
  const db = drizzle(c.env.cinema_db, { schema });
  const { activeMovies } = await getAllActiveMoviesToday(db, { movies: schema.movies });
  const optimized = activeMovies.map((m) => ({
    ...m,
    cover_image: optimizeCloudinaryUrl(m.cover_image ?? ""),
    detail_images: (() => {
      const v = m.detail_images;
      if (v === null || v === undefined) return "[]";
      try {
        const parsed = typeof v === "string" ? JSON.parse(v) : v;
        if (Array.isArray(parsed)) {
          const opt = parsed.map((u: string) => optimizeCloudinaryUrl(u));
          return JSON.stringify(opt);
        }
        return typeof v === "string" ? v : JSON.stringify(v);
      } catch { return "[]"; }
    })(),
  }));
  return c.json({ activeMovies: optimized });
});

// Schema tables for D1
const getD1Tables = (schema: any) => ({
  bookings: schema.bookings,
  users: schema.users,
  accounts: schema.accounts,
  movies: schema.movies,
  ticket_packages: schema.ticket_packages,
});

app.post("/api/validate-booking", async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });
    const tables = getD1Tables(schema);
    const r = await validateBookingImpl(db, await c.req.json(), tables);
    const status = typeof (r as any).status === "number" ? (r as any).status : 200;
    return c.json(r, status as any);
  } catch (err: any) {
    const status = err?.status || 500;
    const message = err?.message || "Lỗi máy chủ nội bộ";
    return c.json({ ok: false, message }, status);
  }
});

app.post("/api/create-booking", async (c) => {
  let body: any = {};
  try {
    const db = drizzle(c.env.cinema_db, { schema });
    const tables = getD1Tables(schema);
    body = await c.req.json().catch(() => ({}));
    // Pass schema tables to ensure correct schema is used (D1 schema instead of PostgreSQL)
    const r = await createPaymentImpl(db, body as any, tables);
    const status = typeof (r as any).status === "number" ? (r as any).status : 201;
    return c.json(r, status as any);
  } catch (err: any) {
    logSystemError("create-booking", err, body);
    const status = err?.status || 500;
    return c.json(
      {
        message: err?.message || "Lỗi máy chủ nội bộ",
        error: String(err),
        cause: err?.cause ? String(err.cause) : undefined,
        stack: err?.stack || null,
      },
      status,
    );
  }
});

app.post("/api/confirm-booking", async (c) => {
  let body: any = {};
  try {
    const db = drizzle(c.env.cinema_db, { schema });
    const tables = getD1Tables(schema);
    body = await c.req.json().catch(() => ({}));
    const mailer = async (to: string, sub: string, html: string) => {
      const res = await sendMail(c.env, to, sub, html);
      if (!res.ok) throw new Error(`Email failed: ${res.status} ${res.body}`);
      return res;
    };
    const appBaseUrl = c.env.VITE_CLIENT_BASE_URL || "https://cinesphere.com.vn";
    const renderBooking = (data: any) => getBookingEmailTemplate(appBaseUrl, data);
    const r = await updatePaymentImpl(db, body as any, mailer, renderBooking, tables);
    const status = typeof (r as any).status === "number" ? (r as any).status : 200;
    return c.json(r, status);
  } catch (err: any) {
    logSystemError("confirm-booking", err, body);
    return c.json({ message: err?.message || "Lỗi máy chủ nội bộ" }, 500);
  }
});

app.get("/api/bookings/:id", async (c) => {
  const db = drizzle(c.env.cinema_db, { schema });
  const tables = getD1Tables(schema);
  const id = Number(c.req.param("id"));
  const r = await getBookingByIdImpl(db, id, tables);
  if (!r) return c.json({ message: "Không tìm thấy đặt vé" }, 404);
  return c.json(r, 200);
});

// Rate-limited code check with headers parity
app.get("/api/bookings/code/:code", async (c) => {
  // Rate Limit Check
  const max = Number(c.env.VITE_RATE_LIMIT_BOOKING_CHECK_MAX) || 5;
  const windowMs = Number(c.env.VITE_RATE_LIMIT_BOOKING_CHECK_WINDOWMS) || 60000;
  const ip = c.req.header("CF-Connecting-IP") || "unknown";
  const now = Date.now();
  const list = attempts.get(ip) ?? [];
  const filtered = list.filter((ts) => now - ts < windowMs);

  if (filtered.length >= max) {
    const oldest = filtered[0];
    const retryMs = Math.max(0, windowMs - (now - oldest));
    const retrySec = Math.ceil(retryMs / 1000);
    c.header("Retry-After", String(retrySec));
    c.header("X-RateLimit-Limit", String(max));
    c.header("X-RateLimit-Remaining", "0");
    c.header("X-RateLimit-WindowMS", String(windowMs));
    return c.json({ message: `Quá nhiều yêu cầu, vui lòng thử lại sau ${retrySec}s` }, 429);
  }

  const remaining = Math.max(0, max - (filtered.length + 1));
  filtered.push(now);
  attempts.set(ip, filtered);

  c.header("X-RateLimit-Limit", String(max));
  c.header("X-RateLimit-Remaining", String(remaining));
  c.header("X-RateLimit-WindowMS", String(windowMs));

  const db = drizzle(c.env.cinema_db, { schema });
  const tables = getD1Tables(schema);
  const code = String(c.req.param("code") || "");
  const r = await getBookingByCodeImpl(db, code, tables);
  if (!r) {
    return c.json({ message: "Không tìm thấy vé với mã này." }, 404);
  }
  return c.json(r, 200);
});

app.post("/api/bookings/use", async (c) => {
  const db = drizzle(c.env.cinema_db, { schema });
  const tables = getD1Tables(schema);
  const body = await c.req.json().catch(() => ({}));
  const code = String((body as any)?.code || "");
  const r = await confirmUseTicketImpl(db, code, tables);
  const status = (r as any)?.status === "error" ? 400 : 200;
  return c.json(r, status);
});
app.get("/api/movies", async (c) => {
  try {
    const page = Number(c.req.query("page") || 1);
    const pageSize = Number(c.req.query("pageSize") || 20);
    const q = String(c.req.query("q") || "").toLowerCase();
    const sortKey = String(c.req.query("sort") || "updated_at");
    const dir = String(c.req.query("dir") || "desc").toLowerCase() === "asc" ? "asc" : "desc";
    const status = String(c.req.query("status") || "all");
    const db = drizzle(c.env.cinema_db, { schema });
    const { items, total } = await listMovies(db, { movies: schema.movies }, { page, pageSize, q, sort: sortKey, dir, status: status as any });
    return c.json({ items, page, pageSize, total }, 200);
  } catch {
    return c.json({ message: "Lỗi máy chủ nội bộ" }, 500);
  }
});

app.post("/api/movies", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const db = drizzle(c.env.cinema_db, { schema });
    const r = await createMovieImpl(db, { movies: schema.movies }, body as any);
    return c.json(r, 201);
  } catch {
    return c.json({ message: "Lỗi máy chủ nội bộ" }, 500);
  }
});

app.get("/api/movies/:id", async (c) => {
  try {
    const id = Number(c.req.param("id"));
    const db = drizzle(c.env.cinema_db, { schema });
    const movie = await getMovie(db, { movies: schema.movies }, id);
    if (!movie) return c.json({ message: "Không tìm thấy" }, 404);
    return c.json({ movie }, 200);
  } catch {
    return c.json({ message: "Lỗi máy chủ nội bộ" }, 500);
  }
});

app.get("/api/movies/detail/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const db = drizzle(c.env.cinema_db, { schema });
  const r = await getMovieByIdImpl(db, { movies: schema.movies, bookings: schema.bookings }, id);
  if (!r) return c.json({ message: "Không tìm thấy phim" }, 404);
  return c.json(r);
});

app.put("/api/movies/:id", async (c) => {
  try {
    const id = Number(c.req.param("id"));
    const body = await c.req.json().catch(() => ({}));
    const db = drizzle(c.env.cinema_db, { schema });
    const r = await updateMovieImpl(db, { movies: schema.movies }, id, body as any);
    if (!r) return c.json({ message: "Không tìm thấy" }, 404);
    return c.json(r, 200);
  } catch {
    return c.json({ message: "Lỗi máy chủ nội bộ" }, 500);
  }
});

app.delete("/api/movies/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const db = drizzle(c.env.cinema_db, { schema });
  const r = await deleteMovieImpl(db, { movies: schema.movies }, id);
  if (!r) return c.json({ message: "Không tìm thấy" }, 404);
  return c.json(r);
});

// ----- Users parity endpoints -----
app.get("/api/users", async (c) => {
  try {
    const page = Number(c.req.query("page") || 1);
    const pageSize = Number(c.req.query("pageSize") || 20);
    const q = String(c.req.query("q") || "");
    const db = drizzle(c.env.cinema_db, { schema });
    const r = await getUsersImpl(db, { users: schema.users, accounts: schema.accounts, bookings: schema.bookings }, { page, pageSize, q });
    return c.json(r, 200);
  } catch {
    return c.json({ message: "Lỗi máy chủ nội bộ" }, 500);
  }
});
app.get("/api/users/:id", async (c) => {
  try {
    const id = Number(c.req.param("id"));
    const db = drizzle(c.env.cinema_db, { schema });
    const r = await getUserByIdImpl(db, { users: schema.users }, id);
    if (!r) return c.json({ message: "Không tìm thấy" }, 404);
    return c.json(r, 200);
  } catch {
    return c.json({ message: "Lỗi máy chủ nội bộ" }, 500);
  }
});
app.get("/api/users/profile", async (c) => {
    try {
      const emailRaw = String(c.req.query("email") || "");
      const db = drizzle(c.env.cinema_db, { schema });
      const r = await getUserProfileByEmailImpl(db, { accounts: schema.accounts, users: schema.users }, emailRaw);
      const status = typeof (r as any).status === "number" ? (r as any).status : 200;
      const payload = { ...(r as any), status: status >= 400 ? "error" : "success" };
      return c.json(payload as any, status as any);
    } catch {
      return c.json({ message: "Lỗi máy chủ nội bộ" }, 500);
    }
  });
app.post("/api/users/profile", async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });
    const body = await c.req.json().catch(() => ({}));
    const r = await updateUserProfileImpl(db, { accounts: schema.accounts, users: schema.users }, body as any);
    const status = typeof (r as any).status === "number" ? (r as any).status : 200;
    const payload = { ...(r as any), status: status >= 400 ? "error" : "success" };
    return c.json(payload as any, status);
  } catch {
    return c.json({ message: "Lỗi máy chủ nội bộ" }, 500);
  }
});
app.post("/api/users/password", async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });
    const body = await c.req.json().catch(() => ({}));
    const r = await changePasswordImpl(db, { accounts: schema.accounts }, body as any);
    const status = typeof (r as any).status === "number" ? (r as any).status : 200;
    const payload = { ...(r as any), status: status >= 400 ? "error" : "success" };
    return c.json(payload, status);
  } catch {
    return c.json({ message: "Lỗi máy chủ nội bộ" }, 500);
  }
});
app.get("/api/usersprofile/transactions", async (c) => {
  try {
    const email = String(c.req.query("email") || "");
    const status = String(c.req.query("status") || "paid");
    const page = Number(c.req.query("page") || 1);
    const pageSize = Number(c.req.query("pageSize") || 10);
    const sort = String(c.req.query("sort") || "created_at");
    const dir = String(c.req.query("dir") || "desc").toLowerCase() === "asc" ? "asc" : "desc";
    const payment_method = String(c.req.query("payment_method") || "");
    const from = String(c.req.query("from") || "");
    const to = String(c.req.query("to") || "");
    const db = drizzle(c.env.cinema_db, { schema });
    const r = await listUserTransactionsImpl(db, { accounts: schema.accounts, bookings: schema.bookings }, { email, status, page, pageSize, sort, dir, payment_method, from, to });
    return c.json(r, 200);
  } catch {
    return c.json({ message: "Lỗi máy chủ nội bộ" }, 500);
  }
});

// ----- Toys endpoints -----
app.get("/api/toys", async (c) => {
  try {
    const page = Number(c.req.query("page") || 1);
    const pageSize = Number(c.req.query("pageSize") || 20);
    const q = String(c.req.query("q") || "");
    const db = drizzle(c.env.cinema_db, { schema });
    const r = await listToysImpl(db, { toys: schema.toys }, { page, pageSize, q });
    return c.json(r, 200);
  } catch {
    return c.json({ message: "Lỗi máy chủ nội bộ" }, 500);
  }
});
app.get("/api/toys/active", async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });
    const r = await listActiveToys(db, { toys: schema.toys });
    return c.json(r, 200);
  } catch {
    return c.json({ message: "Lỗi máy chủ nội bộ" }, 500);
  }
});
app.get("/api/toys/:id", async (c) => {
  try {
    const id = Number(c.req.param("id"));
    const db = drizzle(c.env.cinema_db, { schema });
    const r = await getToyImpl(db, { toys: schema.toys }, id);
    if (!r) return c.json({ message: "Không tìm thấy" }, 404);
    return c.json(r, 200);
  } catch {
    return c.json({ message: "Lỗi máy chủ nội bộ" }, 500);
  }
});
app.post("/api/toys", async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });
    const body = await c.req.json().catch(() => ({}));
    const r = await createToyImpl(db, { toys: schema.toys }, body as any);
    return c.json(r, 201);
  } catch {
    return c.json({ message: "Lỗi máy chủ nội bộ" }, 500);
  }
});
app.put("/api/toys/:id", async (c) => {
  try {
    const id = Number(c.req.param("id"));
    const db = drizzle(c.env.cinema_db, { schema });
    const body = await c.req.json().catch(() => ({}));
    const r = await updateToyImpl(db, { toys: schema.toys }, id, body as any);
    if (!r) return c.json({ message: "Không tìm thấy" }, 404);
    return c.json(r, 200);
  } catch {
    return c.json({ message: "Lỗi máy chủ nội bộ" }, 500);
  }
});
app.delete("/api/toys/:id", async (c) => {
  try {
    const id = Number(c.req.param("id"));
    const db = drizzle(c.env.cinema_db, { schema });
    const r = await deleteToyImpl(db, { toys: schema.toys }, id);
    if (!r) return c.json({ message: "Không tìm thấy" }, 404);
    return c.json(r, 200);
  } catch {
    return c.json({ message: "Lỗi máy chủ nội bộ" }, 500);
  }
});

// ----- Tickets endpoints -----
app.get("/api/tickets", async (c) => {
  try {
    const page = Number(c.req.query("page") || 1);
    const pageSize = Number(c.req.query("pageSize") || 20);
    const q = String(c.req.query("q") || "");
    const db = drizzle(c.env.cinema_db, { schema });
    const r = await listTicketPackagesImpl(db, { ticket_packages: schema.ticket_packages }, { page, pageSize, q });
    return c.json(r, 200);
  } catch {
    return c.json({ message: "Lỗi máy chủ nội bộ" }, 500);
  }
});
app.get("/api/tickets/active", async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });
    const r = await listActiveTicketPackages(db, { ticket_packages: schema.ticket_packages });
    return c.json(r, 200);
  } catch {
    return c.json({ message: "Lỗi máy chủ nội bộ" }, 500);
  }
});
app.get("/api/tickets/:id", async (c) => {
  try {
    const id = Number(c.req.param("id"));
    const db = drizzle(c.env.cinema_db, { schema });
    const r = await getTicketPackageImpl(db, { ticket_packages: schema.ticket_packages }, id);
    if (!r) return c.json({ message: "Không tìm thấy" }, 404);
    return c.json(r, 200);
  } catch {
    return c.json({ message: "Lỗi máy chủ nội bộ" }, 500);
  }
});
app.post("/api/tickets", async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });
    const body = await c.req.json().catch(() => ({}));
    const r = await createTicketPackageImpl(db, { ticket_packages: schema.ticket_packages }, body as any);
    return c.json(r, 201);
  } catch {
    return c.json({ message: "Lỗi máy chủ nội bộ" }, 500);
  }
});
app.put("/api/tickets/:id", async (c) => {
  try {
    const id = Number(c.req.param("id"));
    const db = drizzle(c.env.cinema_db, { schema });
    const body = await c.req.json().catch(() => ({}));
    const r = await updateTicketPackageImpl(db, { ticket_packages: schema.ticket_packages }, id, body as any);
    if (!r) return c.json({ message: "Không tìm thấy" }, 404);
    return c.json(r, 200);
  } catch {
    return c.json({ message: "Lỗi máy chủ nội bộ" }, 500);
  }
});
app.delete("/api/tickets/:id", async (c) => {
  try {
    const id = Number(c.req.param("id"));
    const db = drizzle(c.env.cinema_db, { schema });
    const r = await deleteTicketPackageImpl(db, { ticket_packages: schema.ticket_packages }, id);
    if (!r) return c.json({ message: "Không tìm thấy" }, 404);
    return c.json(r, 200);
  } catch {
    return c.json({ message: "Lỗi máy chủ nội bộ" }, 500);
  }
});

// ----- Site media endpoints -----
app.post("/api/admin/site-media", async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });
    const body = await c.req.json().catch(() => ({}));
    const r = await createSiteMediaImpl(db, { site_media: schema.site_media }, body as any);
    return c.json(r, 201);
  } catch {
    return c.json({ message: "Lỗi máy chủ nội bộ" }, 500);
  }
});
app.put("/api/admin/site-media", async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });
    const body = await c.req.json().catch(() => ({}));
    const r = await updateSiteMediaImpl(db, { site_media: schema.site_media }, body as any);
    const status = (r as any)?.item ? 200 : 404;
    const payload = { ...(r as any), status: status >= 400 ? "error" : "success" };
    return c.json(payload as any, status);
  } catch {
    return c.json({ message: "Lỗi máy chủ nội bộ" }, 500);
  }
});
app.get("/api/site-media", async (c) => {
  try {
    const section = String(c.req.query("section") || "");
    const type = String(c.req.query("type") || "");
    const active = String(c.req.query("active") || "");
    const db = drizzle(c.env.cinema_db, { schema });
    const r = await listSiteMediaImpl(db, { site_media: schema.site_media }, { section, type, active });
    return c.json(r, 200);
  } catch {
    return c.json({ message: "Lỗi máy chủ nội bộ" }, 500);
  }
});

app.delete("/api/admin/site-media/:id", async (c) => {
  try {
    const id = Number(c.req.param("id"));
    const db = drizzle(c.env.cinema_db, { schema });
    const r = await deleteSiteMediaImpl(db, { site_media: schema.site_media }, id);

    // Manual deletion from cloud storage for Worker environment
    if (r.ok && r.item && r.item.public_id) {
      const env = c.env;
      const publicId = String(r.item.public_id);

      // Try R2
      if (env.r2_cinemastore) {
        try { await env.r2_cinemastore.delete(publicId); } catch { }
      }

      // Try Cloudinary (manual fetch because SDK might not work in Worker or env missing in shared code)
      if (hasCloudinary(env)) {
        try {
          const type = r.item.type === "video" ? "video" : "image";
          const timestamp = Math.floor(Date.now() / 1000);
          const params = { public_id: publicId, timestamp };
          const signed = await cloudinarySignedParams(env, params);
          const fd = new FormData();
          fd.append("public_id", publicId);
          fd.append("timestamp", String(timestamp));
          fd.append("api_key", signed.api_key);
          fd.append("signature", signed.signature);
          const cloudName = env.CLOUDINARY_CLOUD_NAME;
          const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/${type}/destroy`;
          await fetch(endpoint, { method: "POST", body: fd });
        } catch { }
      }
    }

    const status = (r as any)?.ok ? 200 : 404;
    const payload = { ...(r as any), status: status >= 400 ? "error" : "success" };
    return c.json(payload as any, status);
  } catch (err: any) {
    return c.json({ message: err?.message || "Lỗi máy chủ nội bộ" }, 500);
  }
});

// Debug mail parity
app.get("/api/debug/mail", async (_c) => {
  return new Response(JSON.stringify({ ok: true, message: "Mail debug endpoint disabled in Worker" }), { status: 200, headers: { "Content-Type": "application/json" } });
});

app.get("/api/debug/test-mail", async (c) => {
  const email = c.req.query("email");
  if (!email) return c.json({ error: "Missing email param" }, 400);
  const res = await sendMail(c.env, email, "Test Brevo Worker", "<h1>It works!</h1>");
  return c.json(res);
});

// ----- Payment provider endpoints -----
app.post("/api/momo/create-payment", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));

    // 1) redirectUrl: ưu tiên lấy từ client (để support preview domain), nhưng phải kiểm tra hostname
    const rawRedirectFromClient = String((body as any)?.redirectUrl || "");
    let redirectUrl = "";
    const allowHost = (host: string) =>
      host === "cinesphere.com.vn" ||
      host === "www.cinesphere.com.vn" ||
      host === "cinema-pages.pages.dev" ||
      host.endsWith(".cinema-pages.pages.dev");

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
      const origin = c.req.header("Origin");
      if (origin) {
        try {
          const u = new URL(origin);
          if (allowHost(u.hostname)) {
            const redirectPath = c.env.VITE_MOMO_REDIRECT_URL || "/checkout";
            redirectUrl = `${origin}${redirectPath}`;
          }
        } catch { }
      }
    }

    // Fallback: build từ env nếu client không gửi hoặc không hợp lệ
    if (!redirectUrl) {
      const clientBase = c.env.VITE_CLIENT_BASE_URL || "https://cinesphere.com.vn";
      const redirectPath = c.env.VITE_MOMO_REDIRECT_URL || "/checkout";
      redirectUrl = redirectPath.startsWith("http") ? redirectPath : `${clientBase}${redirectPath}`;
    }

    // 2) ipnUrl: luôn dùng server base (không tin client, tránh bị đổi IPN)
    const serverBase = c.env.VITE_SERVER_BASE_URL || "https://cinesphere.com.vn";
    const ipnPath = c.env.VITE_MOMO_IPN_URL || "/api/momo/ipn";
    const ipnUrl = ipnPath.startsWith("http") ? ipnPath : `${serverBase}${ipnPath}`;

    const config = {
      partnerCode: c.env.VITE_MOMO_PARTNER_CODE,
      accessKey: c.env.VITE_MOMO_ACCESS_KEY,
      secretKey: c.env.VITE_MOMO_SECRET_KEY,
      endpoint: c.env.VITE_MOMO_ENDPOINT,
      redirectUrl,
      ipnUrl,
    };
    const r = await createMomoPaymentImpl({ ...body, ...config } as any);
    const status = typeof (r as any).status === "number" ? (r as any).status : 200;
    const payload = { ...(r as any), status: status >= 400 ? "error" : "success" };
    return c.json(payload, status as any);
  } catch (err: any) {
    return c.json({ message: err?.message || "Internal error" }, 500);
  }
});
app.post("/api/momo/ipn", async (_c) => {
  try {
    const r = await momoIpnImpl();
    return new Response(JSON.stringify(r), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch {
    return new Response(JSON.stringify({ result: false }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
app.post("/api/vnpay/create-payment", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const ip = c.req.header("CF-Connecting-IP") || "127.0.0.1";
    // returnUrl phải là URL frontend (nơi user quay lại)
    const rawReturnFromClient = String((body as any)?.returnUrl || "");
    let returnUrl = "";
    const allowHost = (host: string) =>
      host === "cinesphere.com.vn" ||
      host === "www.cinesphere.com.vn" ||
      host === "cinema-pages.pages.dev" ||
      host.endsWith(".cinema-pages.pages.dev");

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
      const origin = c.req.header("Origin");
      if (origin) {
        try {
          const u = new URL(origin);
          if (allowHost(u.hostname)) {
            const returnPath = c.env.VITE_VNPAY_RETURN_URL || "/checkout";
            returnUrl = `${origin}${returnPath}`;
          }
        } catch { }
      }
    }

    if (!returnUrl) {
      const clientBase = c.env.VITE_CLIENT_BASE_URL || "https://cinesphere.com.vn";
      const returnPath = c.env.VITE_VNPAY_RETURN_URL || "/checkout";
      returnUrl = returnPath.startsWith("http") ? returnPath : `${clientBase}${returnPath}`;
    }

    const config = {
      tmnCode: c.env.VITE_VNPAY_TMN_CODE,
      hashSecret: c.env.VITE_VNPAY_HASH_SECRET,
      gateway: c.env.VITE_VNPAY_GATEWAY,
      returnUrl,
    };
    const r = await createVnpayPaymentImpl({ ...(body as any), ip, ...config });
    const status = typeof (r as any).status === "number" ? (r as any).status : 200;
    const payload = { ...(r as any), status: status >= 400 ? "error" : "success" };
    return c.json(payload, status as any);
  } catch (err: any) {
    return c.json({ message: err?.message || "Internal error" }, 500);
  }
});
app.post("/api/vnpay/ipn", async (_c) => {
  const r = await vnpayIpnImpl();
  return new Response(JSON.stringify(r), { status: 200, headers: { "Content-Type": "application/json" } });
});

export default app;
