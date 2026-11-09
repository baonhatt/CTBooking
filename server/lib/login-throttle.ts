/**
 * Failed-attempt counters for staff login and staff OTP, stored in Workers KV.
 *
 * KV is eventually consistent and read-modify-write is not atomic, so the counters can
 * drift slightly. That is acceptable here: the goal is to make password and OTP guessing
 * impractical, not to count attempts exactly.
 *
 * When no KV binding is given (for example local dev without KV), every check passes and
 * nothing is recorded.
 */

export interface ThrottleKv {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

/** Wrong passwords allowed per (email, IP) pair inside the window before the pair is locked. */
export const LOGIN_MAX_FAILS_PER_PAIR = 5;

/** Wrong passwords allowed per IP (any email) inside the window before the IP is locked. */
export const LOGIN_MAX_FAILS_PER_IP = 20;

/** Default wrong OTP attempts allowed per staff when settings give no value. */
export const OTP_DEFAULT_MAX_FAILS = 5;

/** Lock window in seconds. The window restarts on each new failure. KV needs at least 60. */
export const LOCK_WINDOW_SECONDS = 15 * 60;

export const LOCKED_MESSAGE = 'Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.';

function readCount(rawValue: string | null): number {
  const parsedCount = Number(rawValue);
  return Number.isFinite(parsedCount) && parsedCount > 0 ? Math.floor(parsedCount) : 0;
}

async function increment(kv: ThrottleKv, key: string): Promise<void> {
  const currentCount = readCount(await kv.get(key));
  await kv.put(key, String(currentCount + 1), { expirationTtl: LOCK_WINDOW_SECONDS });
}

export function normalizeLoginEmail(email: unknown): string {
  return String(email ?? '')
    .trim()
    .toLowerCase();
}

function pairKey(email: unknown, ip: string): string {
  return `login_fail:pair:${normalizeLoginEmail(email)}|${ip}`;
}

function ipKey(ip: string): string {
  return `login_fail:ip:${ip}`;
}

function otpKey(staffId: number): string {
  return `otp_fail:staff:${staffId}`;
}

/** True when this (email, IP) pair or this IP has used up its failed-login allowance. */
export async function isStaffLoginLocked(kv: ThrottleKv | undefined, email: unknown, ip: string): Promise<boolean> {
  if (!kv) return false;
  const pairCount = readCount(await kv.get(pairKey(email, ip)));
  if (pairCount >= LOGIN_MAX_FAILS_PER_PAIR) return true;
  const ipCount = readCount(await kv.get(ipKey(ip)));
  return ipCount >= LOGIN_MAX_FAILS_PER_IP;
}

export async function recordStaffLoginFailure(kv: ThrottleKv | undefined, email: unknown, ip: string): Promise<void> {
  if (!kv) return;
  await increment(kv, pairKey(email, ip));
  await increment(kv, ipKey(ip));
}

/** Clears only the (email, IP) pair. The per-IP counter is kept so one valid account cannot reset it. */
export async function clearStaffLoginFailures(kv: ThrottleKv | undefined, email: unknown, ip: string): Promise<void> {
  if (!kv) return;
  await kv.delete(pairKey(email, ip));
}

function customerOtpKey(accountId: number): string {
  return `otp_fail:customer:${accountId}`;
}

/** True when this customer account has used up its wrong-OTP allowance. */
export async function isCustomerOtpLocked(
  kv: ThrottleKv | undefined,
  accountId: number,
  maxFails: number = OTP_DEFAULT_MAX_FAILS
): Promise<boolean> {
  if (!kv) return false;
  return readCount(await kv.get(customerOtpKey(accountId))) >= maxFails;
}

export async function recordCustomerOtpFailure(kv: ThrottleKv | undefined, accountId: number): Promise<void> {
  if (!kv) return;
  await increment(kv, customerOtpKey(accountId));
}

export async function clearCustomerOtpFailures(kv: ThrottleKv | undefined, accountId: number): Promise<void> {
  if (!kv) return;
  await kv.delete(customerOtpKey(accountId));
}

export async function isStaffOtpLocked(
  kv: ThrottleKv | undefined,
  staffId: number,
  maxFails: number = OTP_DEFAULT_MAX_FAILS
): Promise<boolean> {
  if (!kv) return false;
  return readCount(await kv.get(otpKey(staffId))) >= maxFails;
}

export async function recordStaffOtpFailure(kv: ThrottleKv | undefined, staffId: number): Promise<void> {
  if (!kv) return;
  await increment(kv, otpKey(staffId));
}

export async function clearStaffOtpFailures(kv: ThrottleKv | undefined, staffId: number): Promise<void> {
  if (!kv) return;
  await kv.delete(otpKey(staffId));
}
