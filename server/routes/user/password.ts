import { RequestHandler } from "express";
import { prisma } from "../../lib/prisma";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { sendMail } from "../mail-service";

export const handleForgetPass: RequestHandler = async (req, res) => {
  const email = (req.body as any).email;
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
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.tokens.create({
    data: {
      account_id: useracc.id,
      type: "reset_password",
      token: token,
      expired_at: new Date(Date.now() + 3600 * 1000),
    },
  });
  const resetLink = `http://localhost:8080/reset-password?token=${token}`;
  const contentMail = `
    <p>Chào bạn,</p>
    <p>Bạn đã yêu cầu đặt lại mật khẩu.</p>
    <p>Vui lòng nhấn vào liên kết để đổi mật khẩu: <b>${resetLink}</b></p>
    <p>Xin cảm ơn!</p>
    <br>
    <p>Đội ngũ hỗ trợ!!!</p>
    <p>&nbsp;&nbsp;Rạp Film</p>
  `;
  await sendMail(email, "Đặt lại mật khẩu - Film", contentMail);
  return res
    .status(200)
    .json({ status: "success", message: "Vui lòng kiểm tra email!" });
};

export const handleResetPassword: RequestHandler = async (req, res) => {
  const { token, newPassword } = req.body as { token?: string; newPassword?: string };

  const tokenRecord = await prisma.tokens.findFirst({
    where: {
      token: token,
      type: "reset_password",
      expired_at: {
        gte: new Date(),
      },
    },
  });

  if (!tokenRecord) {
    return res
      .status(400)
      .json({
        status: "error",
        message: "Token không hợp lệ hoặc đã hết hạn!",
      });
  }

  const hashedPassword = await bcrypt.hash(String(newPassword), 10);
  await prisma.accounts.update({
    where: { id: tokenRecord.account_id },
    data: { password: hashedPassword },
  });

  await prisma.tokens.delete({
    where: { id: tokenRecord.id },
  });

  return res
    .status(200)
    .json({
      status: "success",
      message: "Mật khẩu đã được đặt lại thành công!",
    });
};

export const changePassword: RequestHandler = async (req, res) => {
  try {
    const { email, oldPassword, newPassword } = req.body as { email?: string; oldPassword?: string; newPassword?: string };
    if (!email || !oldPassword || !newPassword) {
      return res.status(400).json({ message: "Thiếu thông tin đổi mật khẩu" });
    }
    const account = await prisma.accounts.findUnique({ where: { email } });
    if (!account || !account.password) {
      return res.status(404).json({ message: "Không tìm thấy tài khoản" });
    }
    const ok = await bcrypt.compare(oldPassword, account.password);
    if (!ok) return res.status(400).json({ message: "Mật khẩu hiện tại không đúng" });
    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.accounts.update({ where: { id: account.id }, data: { password: hashed, updated_at: new Date() } });
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};

