import { RequestHandler } from "express";
import type { Login } from "@shared/api";
import { prisma } from '../lib/prisma'

export const handleLogin: RequestHandler = async (req, res) => {
  const { email, password } = req.body as Partial<Login>;
  const useracc = await prisma.accounts.findFirst({
    where: {
      email: email,
      password: password
    }
  })
  if (!useracc) {
    return res.status(200).json({ status: "error", message: "Sai email hoặc mật khẩu"});
  }
  const user = await prisma.users.findFirst({
    where: {
      id: useracc.user_id
    }
  })
  return res.status(200).json({ status: "success", message: "Đăng nhập thành công!", user: { username: user.fullname, email: email } });
};
