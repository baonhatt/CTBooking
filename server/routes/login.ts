import { RequestHandler } from "express";
import type { Login } from "@shared/api";

export const handleLogin: RequestHandler = (req, res) => {
  const users: Login[] = [
    { email: "admin@gmail.com", password: "123456" },
    { email: "user@gmail.com", password: "123456" },
  ];

  const { email, password } = req.body as Partial<Login>;

  if (!email || !password) {
    return res.status(400).json({ status: "error", message: "Missing credentials" });
  }

  const ok = users.some((u) => u.email === email && u.password === password);
  const username = (email.includes("@") ? email.split("@")[0] : email).trim();
  if (ok) {
    return res.status(200).json({ status: "success", message: "Login successful", user: { username: username, email: email } });
  }
  return res.status(401).json({ status: "error", message: "Invalid credentials" });
};
