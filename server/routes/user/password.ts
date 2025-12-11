import { RequestHandler } from "express";
import { prisma } from "../../lib/prisma";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { sendMail } from "../mail-service";
import "dotenv/config";

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
  const resetLink = `${process.env.VITE_SERVER_BASE_URL}/reset-password?token=${token}`;
  const contentMail = `<!DOCTYPE html >
    <html>
    <head>
    <title>Đặt lại Mật khẩu </title>
      </head>
      <body style = "font-family: Arial, sans-serif; line-height: 1.6; color: #333;" >
        <div style="max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;" >
          <h2 style="color: #007bff;" > Yêu cầu Đặt lại Mật khẩu </h2>
          <p> Chào bạn, </p>
          <p> Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.Vui lòng nhấp vào nút dưới đây để tạo mật khẩu mới.Liên kết này sẽ hết hạn sau ** [THỜI GIAN HẾT HẠN] ** (ví dụ: 1 giờ).</p>
            <p style = "text-align: center; margin: 30px 0;">
              <a href="${resetLink}" style = "display: inline-block; padding: 10px 20px; background-color: #dc3545; color: #ffffff !important; text-decoration: none; border-radius: 5px; font-weight: bold;">
                Đặt lại Mật khẩu
              </a>
            </p>
            <p> Nếu bạn không yêu cầu thay đổi mật khẩu, vui lòng bỏ qua email này hoặc liên hệ với bộ phận hỗ trợ của chúng tôi.</p>
            <p> Trân trọng, <br>Đội ngũ Cinema App </p>
            <hr style = "border: 0; border-top: 1px solid #eee;">
            <p style="font-size: 0.8em; color: #777;" >Liên kết trực tiếp: <a href="#" >Ctbooing-support</a></p >
        </div>
      </body>
    </html>`
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

