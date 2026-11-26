import bcrypt from 'bcryptjs';
import { and, eq, lt, sql } from 'drizzle-orm';
import { generateOTP, sendOTPEmail } from '../../lib/otp-utils';
import { getGlobalSettingsImpl } from '../../lib/global-settings';
import { formatDateForDb } from '../../lib/date-utils';
import { LOCKED_MESSAGE, OTP_DEFAULT_MAX_FAILS } from '../../lib/login-throttle';
import { checkEmailAvailableImpl, registerImpl } from './auth';

/**
 * Registration with email verification. No account exists until the code mailed to the email is entered.
 *
 *  1. startRegistrationImpl: checks the form, saves it in register_pending (password and code only as hashes)
 *     under a NEW random registration_id, and mails a code. The caller signs {email, registration_id} into the
 *     challenge the browser keeps (otp-challenge.ts).
 *  2. verifyRegistrationImpl: the challenge must name the CURRENT registration_id of that email. One attempt is
 *     counted in a single UPDATE ... RETURNING before the code is compared, so parallel guesses cannot share a count.
 *     The right code creates the account (registerImpl) and signs the customer in.
 *  3. resendRegistrationImpl: a new code for the same registration_id, at most once per RESEND_COOLDOWN_SECONDS.
 *
 * Why the registration_id: if someone else starts a registration for the same email, the row gets a new id and the
 * first challenge stops working. The newcomer never sees the code (it goes to the email), and the email's owner can
 * never finish a registration someone else filled in (their dialog still holds the old id).
 */

/** How long a started registration waits for its code. */
const PENDING_LIFETIME_MS = 15 * 60 * 1000;
/** Wait between two code emails for the same email address (also between two starts). */
const RESEND_COOLDOWN_SECONDS = 30;

type Mailer = (to: string, subject: string, html: string) => Promise<any>;
type Context = { waitUntil: (promise: Promise<any>) => void };
type Tables = { accounts: any; users: any; tokens?: any; email_logs?: any; register_pending: any };

const normalizeEmail = (email: unknown) => String(email || '').trim().toLowerCase();

function randomId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hashCode(email: string, registrationId: string, code: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${email}:${registrationId}:${code}`));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function codeSettings(kv: any) {
  const settings: any = (await getGlobalSettingsImpl(kv)) || {};
  return {
    length: Number(settings.otp_settings?.otp_length) || 6,
    expiryMinutes: Number(settings.otp_settings?.otp_expiry_minutes) || 5,
    maxFails: Number(settings.otp_settings?.max_otp_attempts) || OTP_DEFAULT_MAX_FAILS
  };
}

async function readPending(db: any, tables: Tables, email: string) {
  const row = await db.query.register_pending.findFirst({ where: eq(tables.register_pending.email, email) });
  if (!row || Number(row.expires_at) < Date.now()) return null;
  return row;
}

export async function startRegistrationImpl(
  db: any,
  tables: Tables,
  kv: any,
  payload: { email: string; password: string; name?: string; phone?: string; gender?: string; dob?: string },
  sendMailFn?: Mailer,
  context?: Context
) {
  const email = normalizeEmail(payload.email);
  if (!email || !payload.password) return { status: 400, message: 'Email và mật khẩu không được để trống!' };

  const emailCheck: any = await checkEmailAvailableImpl(db, tables, email);
  if (!emailCheck.available) return { status: 400, message: emailCheck.message };

  // One code email per address per cooldown. The newer form is NOT silently dropped: the customer is told to wait.
  const existing = await readPending(db, tables, email);
  const waitSeconds = existing ? Math.ceil((Number(existing.sent_at) + RESEND_COOLDOWN_SECONDS * 1000 - Date.now()) / 1000) : 0;
  if (waitSeconds > 0) {
    return { status: 429, message: `Vui lòng đợi ${waitSeconds} giây rồi bấm Đăng ký lại`, seconds_remaining: waitSeconds };
  }

  // Old rows of anyone are useless once expired
  await db.delete(tables.register_pending).where(lt(tables.register_pending.expires_at, Date.now()));

  const { length, expiryMinutes } = await codeSettings(kv);
  const registrationId = randomId();
  const code = generateOTP(length);
  const now = Date.now();
  const row = {
    email,
    registration_id: registrationId,
    name: String(payload.name || '').trim() || email.split('@')[0],
    phone: payload.phone ?? null,
    gender: payload.gender ?? null,
    dob: payload.dob ?? null,
    password_hash: await bcrypt.hash(payload.password, 10),
    code_hash: await hashCode(email, registrationId, code),
    code_expires_at: now + expiryMinutes * 60 * 1000,
    sent_at: now,
    fails: 0,
    expires_at: now + PENDING_LIFETIME_MS
  };
  // A new start replaces any earlier one for this email (with a new registration_id: older challenges stop working)
  await db
    .insert(tables.register_pending)
    .values(row)
    .onConflictDoUpdate({ target: tables.register_pending.email, set: { ...row, email: undefined } });

  await sendOTPEmail(db, tables, email, row.name, code, expiryMinutes, sendMailFn, context);
  return { status: 200, requires_otp: true, email, registration_id: registrationId, message: 'Mã xác minh đã được gửi tới email của bạn' };
}

export async function verifyRegistrationImpl(
  db: any,
  tables: Tables & { tokens: any },
  kv: any,
  payload: { email: string; registration_id: string; otp: string },
  generateTokenFn: () => Promise<string>,
  calculateExpiryFn: (days: number) => string,
  sendMailFn?: Mailer,
  getWelcomeEmailHtml?: (data: { customerName: string; email: string }) => string,
  context?: Context
) {
  const email = normalizeEmail(payload.email);
  const pending = await readPending(db, tables, email);
  if (!pending || pending.registration_id !== payload.registration_id) {
    return { status: 410, message: 'Phiên đăng ký đã hết hạn, vui lòng đăng ký lại' };
  }

  // Count this attempt first, in one statement: only while under the limit and for this very registration
  const { maxFails } = await codeSettings(kv);
  const counted = await db
    .update(tables.register_pending)
    .set({ fails: sql`${tables.register_pending.fails} + 1` })
    .where(
      and(
        eq(tables.register_pending.email, email),
        eq(tables.register_pending.registration_id, pending.registration_id),
        lt(tables.register_pending.fails, maxFails)
      )
    )
    .returning({ fails: tables.register_pending.fails });
  if (!Array.isArray(counted) || counted.length === 0) return { status: 429, message: LOCKED_MESSAGE };

  if (Date.now() > Number(pending.code_expires_at)) {
    return { status: 400, message: 'Mã xác minh đã hết hạn, vui lòng gửi lại mã' };
  }
  const given = await hashCode(email, pending.registration_id, String(payload.otp || '').trim());
  if (given !== pending.code_hash) return { status: 400, message: 'Mã xác minh không đúng' };

  // Claim the row (only one request can delete it), then create the account as before
  const claimed = await db
    .delete(tables.register_pending)
    .where(and(eq(tables.register_pending.email, email), eq(tables.register_pending.registration_id, pending.registration_id)))
    .returning({ email: tables.register_pending.email });
  if (!Array.isArray(claimed) || claimed.length === 0) {
    return { status: 410, message: 'Phiên đăng ký đã hết hạn, vui lòng đăng ký lại' };
  }

  const created: any = await registerImpl(
    db,
    tables,
    {
      email,
      password_hash: pending.password_hash,
      name: pending.name,
      phone: pending.phone || undefined,
      gender: pending.gender || undefined,
      dob: pending.dob || undefined
    } as any,
    sendMailFn,
    getWelcomeEmailHtml,
    context
  );
  if (created?.status !== 200) {
    // The email was taken in the meantime, or the database refused: never pass raw database text to the browser
    return created?.status === 400
      ? { status: 400, message: created.message }
      : { status: 500, message: 'Không tạo được tài khoản, vui lòng thử lại' };
  }

  const token = await generateTokenFn();
  await db.insert(tables.tokens).values({
    account_id: created.account_id,
    type: 'session',
    token,
    expired_at: calculateExpiryFn(30),
    created_at: formatDateForDb(new Date())
  });
  return {
    status: 200,
    message: 'Đăng ký thành công',
    user: { username: pending.name, email, phone: pending.phone || '' },
    token
  };
}

export async function resendRegistrationImpl(
  db: any,
  tables: Tables,
  kv: any,
  payload: { email: string; registration_id: string },
  sendMailFn?: Mailer,
  context?: Context
) {
  const email = normalizeEmail(payload.email);
  const pending = await readPending(db, tables, email);
  if (!pending || pending.registration_id !== payload.registration_id) {
    return { status: 410, message: 'Phiên đăng ký đã hết hạn, vui lòng đăng ký lại' };
  }
  const waitSeconds = Math.ceil((Number(pending.sent_at) + RESEND_COOLDOWN_SECONDS * 1000 - Date.now()) / 1000);
  if (waitSeconds > 0) {
    return { status: 429, message: `Vui lòng đợi ${waitSeconds} giây trước khi gửi lại mã`, seconds_remaining: waitSeconds };
  }
  const { length, expiryMinutes } = await codeSettings(kv);
  const code = generateOTP(length);
  const now = Date.now();
  // Same registration, new code; the attempt count starts again for the new code
  await db
    .update(tables.register_pending)
    .set({
      code_hash: await hashCode(email, pending.registration_id, code),
      code_expires_at: now + expiryMinutes * 60 * 1000,
      sent_at: now,
      fails: 0
    })
    .where(and(eq(tables.register_pending.email, email), eq(tables.register_pending.registration_id, pending.registration_id)));
  await sendOTPEmail(db, tables, email, pending.name, code, expiryMinutes, sendMailFn, context);
  return { status: 200, message: 'Mã mới đã được gửi tới email của bạn' };
}
