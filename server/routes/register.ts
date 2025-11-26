import { RequestHandler } from "express";
import type { Register } from "@shared/api";

export const handleRegister: RequestHandler = (req, res) => {
  const users: Register[] = [];

  const { email, password } = req.body as Partial<Register>;

  if (!email || !password) {
    return res.status(400).json({ status: "error", message: "Missing credentials" });
  }

  const username = (email.includes("@") ? email.split("@")[0] : email).trim();
  return res.status(200).json({ status: "success", message: "Register successful", user: { username: username, email: email } });
};
