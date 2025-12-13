import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import { handleDemo } from "./routes/user/demo";
import { handleMovies2025, listMovies, getMovie, getAllActiveMoviesToday } from "./routes/user/movies";
import { createMovie, updateMovie, deleteMovie, getMovieById } from "./routes/admin/movies";
import { handleLogin, handleRegister } from "./routes/user/auth";
import { handleForgetPass, handleResetPassword, changePassword } from "./routes/user/password";
import { createMomoPayment, momoIpn } from "./routes/user/momo";
import { createVnpayPayment, vnpayIpn } from "./routes/user/vnpay";
import { createPayment, updatePayment, getBooking, getBookingById, getBookingByCode, validateBooking, confirmUseTicket } from "./routes/user/payments";
import { getRevenue, listTransactions, getTransactionById } from "./routes/admin/payments";
import { listActiveToys } from "./routes/user/toys";
import { listToys, createToy, getToy, updateToy, deleteToy } from "./routes/admin/toys";
import { getDashboardMetrics, getRevenueByDate, getRevenue7Days, getRevenueByMonth } from "./routes/admin/dashboard";
import { getUsers, getUserById } from "./routes/admin/users";
import { updateUserProfile, listUserTransactions } from "./routes/user/users";
import { listTicketPackages, getTicketPackage, createTicketPackage, updateTicketPackage, deleteTicketPackage } from "./routes/admin/tickets";
import { listActiveTicketPackages } from "./routes/user/tickets";

export function createServer() {
  const app = express();
  // Middleware
  app.use(cors());
  app.use(express.json({ limit: "20mb" }));
  app.use(express.urlencoded({ extended: true, limit: "20mb" }));

  const uploadDir = path.resolve(process.cwd(), "uploads");
  const uploadMoviesDir = path.join(uploadDir, "movies");
  try {
    fs.mkdirSync(uploadDir, { recursive: true });
    fs.mkdirSync(uploadMoviesDir, { recursive: true });
  } catch { };
  app.use("/uploads", express.static(uploadDir));

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  // ===== Security middlewares for sensitive endpoints =====
  const noStore: express.RequestHandler = (_req, res, next) => {
    res.set("Cache-Control", "no-store");
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
      const key = req.ip || "unknown";
      const now = Date.now();
      const list = attempts.get(key) ?? [];
      const filtered = list.filter((ts) => now - ts < windowMs);
      if (filtered.length >= max) {
        const oldest = filtered[0];
        const retryMs = Math.max(0, windowMs - (now - oldest));
        const retrySec = Math.ceil(retryMs / 1000);
        res.set("Retry-After", String(retrySec));
        res.set("X-RateLimit-Limit", String(max));
        res.set("X-RateLimit-Remaining", "0");
        res.set("X-RateLimit-WindowMS", String(windowMs));
        return res.status(429).json({ message: `Quá nhiều yêu cầu, vui lòng thử lại sau ${retrySec}s` });
      };
      const remaining = Math.max(0, max - (filtered.length + 1));
      res.locals.rateLimitRemaining = remaining;
      res.locals.rateLimitMax = max;
      res.locals.rateLimitWindowMs = windowMs;
      res.set("X-RateLimit-Limit", String(max));
      res.set("X-RateLimit-Remaining", String(remaining));
      res.set("X-RateLimit-WindowMS", String(windowMs));
      filtered.push(now);
      attempts.set(key, filtered);
      next();
    };
  };

  app.get("/api/demo", handleDemo);
  app.get("/api/movies/2025", handleMovies2025);
  app.get("/api/movies", listMovies);
  app.get("/api/movies/:id", getMovie);
  app.get("/api/movies/detail/:id", getMovieById);
  app.post("/api/movies", createMovie);
  app.put("/api/movies/:id", updateMovie);
  app.delete("/api/movies/:id", deleteMovie);
  app.post("/api/login", handleLogin);
  app.post("/api/register", handleRegister);
  app.post("/api/forget-password", handleForgetPass);
  app.post("/api/reset-password", handleResetPassword);
  app.post("/api/getActiveMovies", getAllActiveMoviesToday);
  app.post("/api/momo/create-payment", createMomoPayment);
  app.post("/api/momo/ipn", momoIpn);
  app.post("/api/vnpay/create-payment", createVnpayPayment);
  app.post("/api/vnpay/ipn", vnpayIpn);
  app.post("/api/validate-booking", validateBooking); // kiểm tra dữ liệu trước khi tạo booking
  app.post("/api/create-booking", createPayment); // sử dụng để tạo đặt vé sau khi ấn nút thanh toán
  app.post("/api/confirm-booking", updatePayment); // sử dụng để xử lý data do momo trả về sau khi người dùng thanh toán thành công
  app.get("/api/bookings/:id", getBookingById); // lấy booking info đầy đủ cho checkout page
  app.get("/api/bookings/code/:code", noStore, rateLimitCheckCode(), getBookingByCode); // lấy booking info theo mã vé cho ticket check
  app.post("/api/bookings/use", confirmUseTicket);
  app.get("/api/admin/revenue", getRevenue);
  app.get("/api/admin/transactions", listTransactions);
  app.get("/api/admin/transactions/:id", getTransactionById);
  app.get("/api/toys", listToys);
  app.get("/api/toys/active", listActiveToys);
  app.get("/api/toys/:id", getToy);
  app.post("/api/toys", createToy);
  app.put("/api/toys/:id", updateToy);
  app.delete("/api/toys/:id", deleteToy);
  app.get("/api/admin/dashboard/metrics", getDashboardMetrics);
  app.get("/api/admin/dashboard/revenue-date", getRevenueByDate);
  app.get("/api/admin/dashboard/revenue-7days", getRevenue7Days);
  app.get("/api/admin/dashboard/revenue-month", getRevenueByMonth);
  app.get("/api/users", getUsers);
  app.get("/api/users/:id", getUserById);
  app.post("/api/users/profile", updateUserProfile);
  app.post("/api/users/password", changePassword);
  app.get("/api/usersprofile/transactions", listUserTransactions);
  app.get("/api/tickets", listTicketPackages);
  app.get("/api/tickets/active", listActiveTicketPackages);
  app.get("/api/tickets/:id", getTicketPackage);
  app.post("/api/tickets", createTicketPackage);
  app.put("/api/tickets/:id", updateTicketPackage);
  app.delete("/api/tickets/:id", deleteTicketPackage);

  return app;
}
