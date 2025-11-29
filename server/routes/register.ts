import { RequestHandler } from "express";
import type { Register } from "@shared/api";
import { prisma } from '../lib/prisma'
import bcrypt from "bcryptjs";

export const handleRegister: RequestHandler = async (req, res) => {

  try {
    const { email, password } = req.body as Partial<Register>;

    if (!email || !password) {
      return res.status(400).json({ status: "error", message: "Email và mật khẩu không được để trống!" });
    }

    const existing = await prisma.accounts.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ status: "error", message: "Email đã tồn tại" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let fullname = req.body.name;
    if (!fullname || fullname.trim() === "") {
      fullname = email.split('@')[0];
    }

    const newUser = await prisma.users.create({
      data: {
        fullname: fullname,
        accounts: {
          create: {
            email,
            password: hashedPassword,
          },
        },
      },
      include: { accounts: true },
    });

    return res.status(201).json({ status: "success", message: "Đăng ký thành công", user: { id: newUser.id, email } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: "error", message: "Server error" });
  }
};
