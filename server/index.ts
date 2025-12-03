import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import {
  handleMovies2025,
  createMovie,
  listMovies,
  getMovie,
  updateMovie,
  deleteMovie,
  listShowtimes,
  createShowtime,
  updateShowtime,
  deleteShowtime,
  createShowtimesBatch,
  getMovieById,
} from "./routes/movies";
import { handleLogin } from "./routes/login";
import { handleRegister } from "./routes/register";
import { handleForgetPass, handleResetPassword } from "./routes/forget-pass";
import { getAllActiveMoviesToday } from "./routes/movies";
import { createMomoPayment, momoIpn } from "./routes/momo";
import { createVnpayPayment, vnpayIpn } from "./routes/vnpay";
import {
  createPayment,
  updatePayment,
  getRevenue,
  listTransactions,
  getTransactionById,
} from "./routes/payment";
import {
  listToys,
  listActiveToys,
  createToy,
  getToy,
  updateToy,
  deleteToy,
} from "./routes/toys";
import {
  getDashboardMetrics,
  getRevenueByDate,
  getRevenue7Days,
  getRevenueByMonth,
} from "./routes/dashboard";
import { getUsers, getUserById } from "./routes/users";
import { getShowtimeById } from "./routes/showtimes";

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
  } catch { }
  app.use("/uploads", express.static(uploadDir));

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);
  app.get("/api/movies/2025", handleMovies2025);
  app.get("/api/movies", listMovies);
  app.get("/api/movies/:id", getMovie);
  app.get("/api/movies/detail/:id", getMovieById);
  app.post("/api/movies", createMovie);
  app.put("/api/movies/:id", updateMovie);
  app.delete("/api/movies/:id", deleteMovie);
  app.get("/api/showtimes", listShowtimes);
  app.post("/api/showtimes", createShowtime);
  app.post("/api/showtimes/batch", createShowtimesBatch);
  app.put("/api/showtimes/:id", updateShowtime);
  app.delete("/api/showtimes/:id", deleteShowtime);
  app.get("/api/showtimes/detail/:id", getShowtimeById);
  app.post("/api/login", handleLogin);
  app.post("/api/register", handleRegister);
  app.post("/api/forget-password", handleForgetPass);
  app.post("/api/reset-password", handleResetPassword);
  app.post("/api/getActiveMovies", getAllActiveMoviesToday);
  app.post("/api/momo/create-payment", createMomoPayment);
  app.post("/api/momo/ipn", momoIpn);
  app.post("/api/vnpay/create-payment", createVnpayPayment);
  app.post("/api/vnpay/ipn", vnpayIpn);
  app.post("/api/create-booking", createPayment); // sử dụng để tạo đặt vé sau khi ấn nút thanh toán
  app.post("/api/confirm-booking", updatePayment); // sử dụng để xử lý data do momo trả về sau khi người dùng thanh toán thành công
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

  return app;
}
