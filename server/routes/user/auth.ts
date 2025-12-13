import { RequestHandler } from "express";
import type { Login, Register } from "@shared/api";
import { prisma } from "../../lib/prisma";
import bcrypt from "bcryptjs";
import { sendMail } from "../mail-service";
import { getWelcomeEmailTemplate } from "../../lib/booking-utils";

export const handleLogin: RequestHandler = async (req, res) => {
  const { email, password } = req.body as Partial<Login>;
  const useracc = await prisma.accounts.findFirst({
    where: {
      email: email,
    },
  });
  if (!useracc) {
    return res
      .status(400)
      .json({ status: "error", message: "Email không tồn tại!" });
  }
  const isPasswordValid = await bcrypt.compare(password, useracc.password);
  if (!isPasswordValid) {
    return res
      .status(400)
      .json({ status: "error", message: "Mật khẩu không đúng!" });
  }
  const user = await prisma.users.findFirst({
    where: {
      id: useracc.user_id,
    },
  });
  return res
    .status(200)
    .json({
      status: "success",
      message: "Đăng nhập thành công!",
      user: { username: user?.fullname, email: email },
    });
};

export const handleRegister: RequestHandler = async (req, res) => {
  try {
    const { email, password } = req.body as Partial<Register>;
    const gender = (req.body as any).gender as string | undefined;
    const dobStr = (req.body as any).dob as string | undefined;
    const phone = (req.body as any).phone as string | undefined;

    if (!email || !password) {
      return res
        .status(400)
        .json({
          status: "error",
          message: "Email và mật khẩu không được để trống!",
        });
    }

    const existing = await prisma.accounts.findUnique({ where: { email } });
    if (existing) {
      return res
        .status(400)
        .json({ status: "error", message: "Email đã tồn tại" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let fullname = (req.body as any).name as string | undefined;
    if (!fullname || fullname.trim() === "") {
      fullname = email.split("@")[0];
    }
    const dob =
      dobStr && typeof dobStr === "string" && dobStr.trim()
        ? new Date(dobStr)
        : undefined;

    const newUser = await prisma.users.create({
      data: {
        fullname: fullname,
        phone: phone,
        gender: gender,
        dob: dob,
        accounts: {
          create: {
            email,
            password: hashedPassword,
          },
        },
      },
      include: { accounts: true },
    });

    try {
      const html = getWelcomeEmailTemplate({
        customerName: fullname || email.split("@")[0],
        email,
      });
      await sendMail(email, "🎉 Chào mừng bạn đến CINESPHERE", html);
    } catch (mailErr) {
      console.error("Gửi email chào mừng thất bại:", mailErr);
    }

    return res
      .status(201)
      .json({
        status: "success",
        message: "Đăng ký thành công",
        user: { id: newUser.id, email },
      });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: "error", message: "Server error" });
  }
};

