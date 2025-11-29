import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { handleMovies2025 } from "./routes/movies";
import { handleLogin } from "./routes/login";
import { handleRegister } from "./routes/register";
import { handleForgetPass, handleResetPassword } from "./routes/forget-pass";


export function createServer() {
  const app = express();
  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);
  app.get("/api/movies/2025", handleMovies2025);
  app.post("/api/login", handleLogin);
  app.post("/api/register", handleRegister);
  app.post("/api/forget-password", handleForgetPass);
  app.post("/api/reset-password", handleResetPassword);

  return app;
}
