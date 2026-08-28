import { eq, and, gte, lt, isNull } from 'drizzle-orm';
import { mailQueue } from './mail-queue';
import { getOTPEmailTemplate, getStaffPasswordChangeOTPTemplate } from './email-templates';
import { formatDateForDb } from './date-utils';

export function generateOTP(length: number = 6): string {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * digits.length)];
  }
  return otp;
}

export async function sendOTPEmail(
  anyDb: any,
  tables: { email_logs?: any },
  to: string,
  customerName: string,
  otp: string,
  expiryMinutes: number,
  sendMailFn?: (to: string, subject: string, html: string) => Promise<any>,
  context?: { waitUntil: (promise: Promise<any>) => void }
) {
  const html = getOTPEmailTemplate({
    customerName,
    email: to,
    otp,
    expiryMinutes
  });

  try {
    await mailQueue.add(
      async () => {
        try {
          await sendMailFn(to, '🔐 Mã Xác Thực - CINESPHERE', html);
          console.log(`[OTP] Sent OTP to ${to}`);
        } catch (e) {
          console.error(`[OTP] Failed to send OTP to ${to}`, e);
          throw e;
        }
      },
      {
        db: anyDb,
        recipient: to,
        subject: '🔐 Mã Xác Thực - CINESPHERE',
        emailType: 'otp',
        emailLogsTable: tables.email_logs
      },
      context
    );
    return { success: true };
  } catch (error) {
    console.error('[OTP] Error adding to mail queue:', error);
    return { success: false, error };
  }
}

export async function createOTPRecord(
  anyDb: any,
  tables: { tokens: any },
  accountId: number,
  otp: string,
  expiryMinutes: number
) {
  const expiredAt = new Date();
  expiredAt.setMinutes(expiredAt.getMinutes() + expiryMinutes);

  // Delete existing OTP tokens for this account (invalidate old OTPs)
  await anyDb.delete(tables.tokens).where(and(eq(tables.tokens.account_id, accountId), eq(tables.tokens.type, 'otp')));

  // Insert new OTP token
  const inserted = await anyDb
    .insert(tables.tokens)
    .values({
      account_id: accountId,
      type: 'otp',
      token: otp,
      expired_at: formatDateForDb(expiredAt),
      created_at: formatDateForDb(new Date())
    })
    .returning();

  return inserted[0];
}

export async function validateOTP(
  anyDb: any,
  tables: { tokens: any },
  accountId: number,
  otp: string
): Promise<{ valid: boolean; attempts?: number; error?: string }> {
  const tokenRecord = await anyDb.query.tokens.findFirst({
    where: and(eq(tables.tokens.account_id, accountId), eq(tables.tokens.type, 'otp'), eq(tables.tokens.token, otp))
  });

  if (!tokenRecord) {
    return { valid: false, error: 'OTP không đúng' };
  }

  // Check expiry
  if (tokenRecord.expired_at) {
    const expiredAt = new Date(tokenRecord.expired_at);
    if (expiredAt < new Date()) {
      // Delete expired OTP
      await anyDb.delete(tables.tokens).where(eq(tables.tokens.id, tokenRecord.id));
      return { valid: false, error: 'OTP đã hết hạn' };
    }
  }

  return { valid: true };
}

export async function deleteOTP(anyDb: any, tables: { tokens: any }, accountId: number) {
  await anyDb.delete(tables.tokens).where(and(eq(tables.tokens.account_id, accountId), eq(tables.tokens.type, 'otp')));
}

export async function canResendOTP(
  anyDb: any,
  tables: { tokens: any },
  accountId: number,
  cooldownSeconds: number
): Promise<{ canResend: boolean; secondsRemaining?: number }> {
  const tokenRecord = await anyDb.query.tokens.findFirst({
    where: and(eq(tables.tokens.account_id, accountId), eq(tables.tokens.type, 'otp')),
    orderBy: (tokens: any, { desc }) => [desc(tokens.created_at)]
  });

  if (!tokenRecord) {
    return { canResend: true };
  }

  const createdAt = new Date(tokenRecord.created_at);
  const now = new Date();
  const elapsedSeconds = Math.floor((now.getTime() - createdAt.getTime()) / 1000);

  if (elapsedSeconds >= cooldownSeconds) {
    return { canResend: true };
  }

  return {
    canResend: false,
    secondsRemaining: cooldownSeconds - elapsedSeconds
  };
}

// Staff OTP functions for password change
export async function sendStaffPasswordChangeOTP(
  anyDb: any,
  tables: { staffTokens: any; email_logs?: any },
  staffId: number,
  staffName: string,
  staffEmail: string,
  expiryMinutes: number = 5,
  sendMailFn?: (to: string, subject: string, html: string) => Promise<any>,
  context?: { waitUntil: (promise: Promise<any>) => void }
) {
  const otp = generateOTP();
  const expiredAt = new Date();
  expiredAt.setMinutes(expiredAt.getMinutes() + expiryMinutes);

  // Delete existing OTP tokens for this staff
  await anyDb
    .delete(tables.staffTokens)
    .where(
      and(
        eq(tables.staffTokens.staffId, staffId),
        eq(tables.staffTokens.type, 'otp'),
        isNull(tables.staffTokens.revokedAt)
      )
    );

  // Insert new OTP token
  await anyDb.insert(tables.staffTokens).values({
    staffId,
    type: 'otp',
    token: otp,
    expiredAt: expiredAt.toISOString(),
    createdAt: new Date().toISOString()
  });

  // Log prominent OTP banner in console for local dev convenience
  console.log(`\n===============================================================`);
  console.log(`🔐 [STAFF PASSWORD CHANGE OTP]`);
  console.log(`👤 Nhân viên: ${staffName} (ID: ${staffId})`);
  console.log(`📧 Gửi tới email: ${staffEmail}`);
  console.log(`🔑 MÃ XÁC THỰC OTP: ${otp}`);
  console.log(`⏱️ Thời hạn: ${expiryMinutes} phút`);
  console.log(`===============================================================\n`);

  // Send OTP email
  const html = getStaffPasswordChangeOTPTemplate({
    staffName,
    otp,
    expiryMinutes
  });

  try {
    await mailQueue.add(
      async () => {
        try {
          const mailer = sendMailFn;
          if (mailer) {
            const mailRes = await mailer(staffEmail, '🔐 Mã Xác Thực Thay Đổi Mật Khẩu - CINESPHERE', html);
            console.log(`[Staff OTP] Sent OTP to ${staffEmail}`, mailRes);
          } else {
            console.warn('[Staff OTP] No mailer provided, skipping email (OTP was logged to console)');
          }
        } catch (e: any) {
          console.error(`[Staff OTP] Failed to send OTP to ${staffEmail}:`, e?.message || e);
          throw e;
        }
      },
      {
        db: anyDb,
        recipient: staffEmail,
        subject: '🔐 Mã Xác Thực Thay Đổi Mật Khẩu - CINESPHERE',
        emailType: 'staff_otp',
        recipientType: 'staff',
        staffId: staffId,
        emailLogsTable: tables.email_logs
      },
      context
    );
    return { success: true };
  } catch (error) {
    console.error('[Staff OTP] Error adding to mail queue:', error);
    return { success: false, error };
  }
}

export async function validateStaffOTP(
  anyDb: any,
  tables: { staffTokens: any },
  staffId: number,
  otp: string
): Promise<{ valid: boolean; error?: string }> {
  const tokenRecord = await anyDb.query.staffTokens.findFirst({
    where: and(
      eq(tables.staffTokens.staffId, staffId),
      eq(tables.staffTokens.type, 'otp'),
      eq(tables.staffTokens.token, otp),
      isNull(tables.staffTokens.revokedAt)
    )
  });

  if (!tokenRecord) {
    return { valid: false, error: 'OTP không đúng' };
  }

  // Check expiry
  if (tokenRecord.expiredAt) {
    const expiredAt = new Date(tokenRecord.expiredAt);
    if (expiredAt < new Date()) {
      // Revoke expired OTP
      await anyDb
        .update(tables.staffTokens)
        .set({ revokedAt: new Date().toISOString(), revokeReason: 'expired' })
        .where(eq(tables.staffTokens.id, tokenRecord.id));
      return { valid: false, error: 'OTP đã hết hạn' };
    }
  }

  return { valid: true };
}

export async function deleteStaffOTP(anyDb: any, tables: { staffTokens: any }, staffId: number) {
  await anyDb
    .update(tables.staffTokens)
    .set({ revokedAt: new Date().toISOString(), revokeReason: 'used' })
    .where(
      and(
        eq(tables.staffTokens.staffId, staffId),
        eq(tables.staffTokens.type, 'otp'),
        isNull(tables.staffTokens.revokedAt)
      )
    );
}
