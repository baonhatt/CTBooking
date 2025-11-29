import { RequestHandler } from "express";
import type { Login } from "@shared/api";
import { prisma } from '../lib/prisma'
import bcrypt from "bcryptjs";

export const handleLogin: RequestHandler = async (req, res) => {
  console.log("🚀 ~ handleLogin ~ req:", req)
  const { email, password } = req.body as Partial<Login>;
  const useracc = await prisma.accounts.findFirst({
    where: {
      email: email,
    }
  })
  if (!useracc) {
    return res.status(400).json({ status: "error", message: "Email không tồn tại!" });
  }
  const isPasswordValid = await bcrypt.compare(password, useracc.password);
  if (!isPasswordValid) {
    return res.status(400).json({ status: "error", message: "Mật khẩu không đúng!" });
  }
  const user = await prisma.users.findFirst({
    where: {
      id: useracc.user_id
    }
  })
  return res.status(200).json({ status: "success", message: "Đăng nhập thành công!", user: { username: user.fullname, email: email } });
};
