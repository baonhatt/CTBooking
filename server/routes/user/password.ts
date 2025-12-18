import { accounts, tokens } from "../../db/schema";
import { eq, and, gte } from "drizzle-orm";
// import crypto from "crypto";
import bcrypt from "bcryptjs";
import { sendMail } from "../mail-service";
import "dotenv/config";

function randomToken() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

import { getResetPasswordEmailTemplate } from "../../lib/booking-utils";

export async function forgetPassImpl(anyDb: any, tables: { accounts: any; tokens: any }, email: string, sendMailFn?: (to: string, subject: string, html: string) => Promise<any>, getResetPasswordEmailHtml?: (link: string) => string) {
  const useracc = await anyDb.query.accounts.findFirst({
    where: eq(tables.accounts.email, email),
  });
  if (!useracc) {
    return { status: "error", message: "Email không tồn tại!" };
  }
  const token = randomToken();
  await anyDb.insert(tables.tokens).values({
    account_id: useracc.id,
    type: "reset_password",
    token: token,
    expired_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });
  
  let contentMail = "";
  if (getResetPasswordEmailHtml) {
    // If renderer provided, use it. We assume the renderer handles the full link construction or we pass the link.
    // However, the signature I proposed is (link: string) => string.
    // But how do we get the base URL? 
    // If getResetPasswordEmailHtml is provided, the caller (Worker) should have already bound the base URL or we pass the relative token?
    // Let's assume we pass the FULL link.
    // But wait, the Worker knows the base URL.
    // If we rely on process.env.VITE_SERVER_BASE_URL here, it might fail in Worker.
    // So we should try to construct the link using a default if env is missing, OR let the renderer handle it if it takes a token?
    // Let's stick to passing the link.
    const baseUrl = (typeof process !== "undefined" && process.env?.VITE_SERVER_BASE_URL) ? process.env.VITE_SERVER_BASE_URL : "https://cinesphere.com.vn";
    const resetLink = `${baseUrl}/reset-password?token=${token}`;
    contentMail = getResetPasswordEmailHtml(resetLink);
  } else {
    const resetLink = `${process.env.VITE_SERVER_BASE_URL}/reset-password?token=${token}`;
    contentMail = getResetPasswordEmailTemplate(resetLink);
  }

  const mailer = sendMailFn || sendMail;
  await mailer(email, "Đặt lại mật khẩu - Film", contentMail);
  return { status: "success", message: "Vui lòng kiểm tra email!" };
}

export async function resetPasswordImpl(anyDb: any, tables: { accounts: any; tokens: any }, payload: { token?: string; newPassword?: string }) {
  const { token, newPassword } = payload;
  const tokenRecord = await anyDb.query.tokens.findFirst({
    where: and(
      eq(tables.tokens.token, token || ""),
      eq(tables.tokens.type, "reset_password"),
      gte(tables.tokens.expired_at, new Date().toISOString())
    ),
  });
  if (!tokenRecord) {
    return { status: "error", message: "Token không hợp lệ hoặc đã hết hạn!" };
  }
  const hashedPassword = await bcrypt.hash(String(newPassword), 10);
  await anyDb.update(tables.accounts)
    .set({ password: hashedPassword })
    .where(eq(tables.accounts.id, tokenRecord.account_id));
  await anyDb.delete(tables.tokens).where(eq(tables.tokens.id, tokenRecord.id));
  return { status: "success", message: "Mật khẩu đã được đặt lại thành công!" };
}

export async function changePasswordImpl(anyDb: any, tables: { accounts: any }, payload: { email?: string; oldPassword?: string; newPassword?: string }) {
  const { email, oldPassword, newPassword } = payload;
  if (!email || !oldPassword || !newPassword) {
    return { status: "error", message: "Thiếu thông tin đổi mật khẩu" };
  }
  const account = await anyDb.query.accounts.findFirst({ where: eq(tables.accounts.email, email) });
  if (!account || !account.password) {
    return { status: "error", message: "Không tìm thấy tài khoản" };
  }
  const ok = await bcrypt.compare(oldPassword, account.password);
  if (!ok) return { status: "error", message: "Mật khẩu hiện tại không đúng" };
  const hashed = await bcrypt.hash(newPassword, 10);
  await anyDb.update(tables.accounts)
    .set({ password: hashed, updated_at: new Date().toISOString() })
    .where(eq(tables.accounts.id, account.id));
  return { ok: true };
}

