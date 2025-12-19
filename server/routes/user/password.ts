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
    return { status: 404, message: "Email không tồn tại!" };
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
    // Khi caller (Worker hoặc server khác) cung cấp renderer, ưu tiên để caller quyết định base URL.
    // Ở môi trường Node (Express), vẫn có thể dùng env để tạo link đầy đủ.
    let resetLink = `/reset-password?token=${token}`;
    if (typeof process !== "undefined" && process.env?.VITE_SERVER_BASE_URL) {
      resetLink = `${process.env.VITE_SERVER_BASE_URL}/reset-password?token=${token}`;
    }
    contentMail = getResetPasswordEmailHtml(resetLink);
  } else {
    const baseUrl = process.env.VITE_SERVER_BASE_URL || "https://cinesphere.com.vn";
    const resetLink = `${baseUrl}/reset-password?token=${token}`;
    contentMail = getResetPasswordEmailTemplate(resetLink);
  }

  const mailer = sendMailFn || sendMail;
  await mailer(email, "Đặt lại mật khẩu - Film", contentMail);
  return { status: 200, message: "Vui lòng kiểm tra email!" };
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
    return { status: 400, message: "Token không hợp lệ hoặc đã hết hạn!" };
  }
  const hashedPassword = await bcrypt.hash(String(newPassword), 10);
  await anyDb.update(tables.accounts)
    .set({ password: hashedPassword })
    .where(eq(tables.accounts.id, tokenRecord.account_id));
  await anyDb.delete(tables.tokens).where(eq(tables.tokens.id, tokenRecord.id));
  return { status: 200, message: "Mật khẩu đã được đặt lại thành công!" };
}

export async function changePasswordImpl(anyDb: any, tables: { accounts: any }, payload: { email?: string; oldPassword?: string; newPassword?: string }) {
  const { email, oldPassword, newPassword } = payload;
  if (!email || !oldPassword || !newPassword) {
    return { status: 400, message: "Thiếu thông tin đổi mật khẩu" };
  }
  const account = await anyDb.query.accounts.findFirst({ where: eq(tables.accounts.email, email) });
  if (!account || !account.password) {
    return { status: 404, message: "Không tìm thấy tài khoản" };
  }
  const ok = await bcrypt.compare(oldPassword, account.password);
  if (!ok) return { status: 400, message: "Mật khẩu hiện tại không đúng" };
  const hashed = await bcrypt.hash(newPassword, 10);
  await anyDb.update(tables.accounts)
    .set({ password: hashed, updated_at: new Date().toISOString() })
    .where(eq(tables.accounts.id, account.id));
  return { status: 200, message: "Đổi mật khẩu thành công" };
}

