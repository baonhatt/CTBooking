import { eq, and, gte } from 'drizzle-orm';
// import crypto from "crypto";
import bcrypt from 'bcryptjs';
import { mailQueue } from '../../lib/mail-queue';
import 'dotenv/config';
import { getResetPasswordEmailTemplate } from '../../lib/booking-utils';
import { formatDateForDb } from '../../lib/date-utils';

function randomToken() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function forgetPassImpl(
  anyDb: any,
  tables: { accounts: any; tokens: any; email_logs?: any },
  email: string,
  sendMailFn?: (to: string, subject: string, html: string) => Promise<any>,
  getResetPasswordEmailHtml?: (link: string) => string,
  context?: { waitUntil: (promise: Promise<any>) => void }
) {
  const useracc = await anyDb.query.accounts.findFirst({
    where: eq(tables.accounts.email, email)
  });
  if (!useracc) {
    return { status: 404, message: 'Email không tồn tại!' };
  }
  const token = randomToken();
  const expired_at_dt = new Date(Date.now() + 60 * 60 * 1000);
  await anyDb.insert(tables.tokens).values({
    account_id: useracc.id,
    type: 'reset_password',
    token: token,
    expired_at: formatDateForDb(expired_at_dt),
    created_at: formatDateForDb(new Date())
  });

  let contentMail = '';
  if (getResetPasswordEmailHtml) {
    // Khi caller (Worker hoặc server khác) cung cấp renderer, ưu tiên để caller quyết định base URL.
    // Ở môi trường Node (Express), vẫn có thể dùng env để tạo link đầy đủ.
    let resetLink = `/reset-password?token=${token}`;
    if (typeof process !== 'undefined' && process.env?.VITE_SERVER_BASE_URL) {
      resetLink = `${process.env.VITE_SERVER_BASE_URL}/reset-password?token=${token}`;
    }
    contentMail = getResetPasswordEmailHtml(resetLink);
  } else {
    const baseUrl = process.env.VITE_SERVER_BASE_URL || 'https://cinesphere.com.vn';
    const resetLink = `${baseUrl}/reset-password?token=${token}`;
    contentMail = getResetPasswordEmailTemplate(resetLink);
  }

  const mailer = sendMailFn;
  mailQueue.add(
    async () => {
      try {
        if (mailer) {
          await mailer(email, 'Đặt lại mật khẩu - Film', contentMail);
          console.log(`[MailQueue] Sent password reset email to ${email}`);
        } else {
          console.warn('[ForgetPassword] No mailer provided, skipping email');
        }
      } catch (e) {
        console.error(`[MailQueue] Failed to send password reset email to ${email}`, e);
        throw e;
      }
    },
    {
      db: anyDb,
      recipient: email,
      subject: 'Đặt lại mật khẩu - Film',
      emailType: 'reset_password',
      userId: useracc.id,
      emailLogsTable: tables.email_logs
    },
    context
  );

  return { status: 200, message: 'Vui lòng kiểm tra email!' };
}

export async function resetPasswordImpl(
  anyDb: any,
  tables: { accounts: any; tokens: any },
  payload: { token?: string; newPassword?: string }
) {
  const { token, newPassword } = payload;
  const now = new Date();
  const tokenRecord = await anyDb.query.tokens.findFirst({
    where: and(
      eq(tables.tokens.token, token || ''),
      eq(tables.tokens.type, 'reset_password'),
      gte(tables.tokens.expired_at, formatDateForDb(now))
    )
  });
  if (!tokenRecord) {
    return { status: 400, message: 'Token không hợp lệ hoặc đã hết hạn!' };
  }

  // Lấy thông tin tài khoản để kiểm tra mật khẩu cũ
  const account = await anyDb.query.accounts.findFirst({
    where: eq(tables.accounts.id, tokenRecord.account_id)
  });

  if (!account) {
    return { status: 400, message: 'Tài khoản không tồn tại!' };
  }

  // Kiểm tra nếu mật khẩu mới trùng với mật khẩu cũ
  const isMatch = await bcrypt.compare(String(newPassword), account.password);
  if (isMatch) {
    console.log(`[Security] User ${account.email} attempted to reset password with the same password.`);
    return { status: 400, message: 'Mật khẩu mới không được trùng với mật khẩu hiện tại' };
  }

  const hashedPassword = await bcrypt.hash(String(newPassword), 10);
  await anyDb
    .update(tables.accounts)
    .set({ password: hashedPassword, updated_at: formatDateForDb(now) })
    .where(eq(tables.accounts.id, tokenRecord.account_id));
  await anyDb.delete(tables.tokens).where(eq(tables.tokens.id, tokenRecord.id));

  return { status: 200, message: 'Mật khẩu đã được đặt lại thành công!' };
}

export async function changePasswordImpl(
  anyDb: any,
  tables: { accounts: any },
  payload: { accountId?: number; email?: string; oldPassword?: string; newPassword?: string }
) {
  const { accountId, oldPassword, newPassword } = payload;
  if (!accountId || !oldPassword || !newPassword) {
    return { status: 400, message: 'Thiếu thông tin đổi mật khẩu' };
  }
  const account = await anyDb.query.accounts.findFirst({ where: eq(tables.accounts.id, accountId) });
  if (!account || !account.password) {
    return { status: 404, message: 'Không tìm thấy tài khoản' };
  }
  const ok = await bcrypt.compare(oldPassword, account.password);
  if (!ok) return { status: 400, message: 'Mật khẩu hiện tại không đúng' };

  // Kiểm tra nếu mật khẩu mới trùng với mật khẩu cũ
  const isSamePassword = await bcrypt.compare(newPassword, account.password);
  if (isSamePassword) {
    return { status: 400, message: 'Mật khẩu mới không được trùng với mật khẩu hiện tại' };
  }

  const hashed = await bcrypt.hash(newPassword, 10);
  const now = new Date();
  await anyDb
    .update(tables.accounts)
    .set({ password: hashed, updated_at: formatDateForDb(now) })
    .where(eq(tables.accounts.id, account.id));
  return { status: 200, message: 'Đổi mật khẩu thành công' };
}
