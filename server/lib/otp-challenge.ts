import { constantTimeEqual } from './order-token';

/**
 * The login OTP "challenge": a short-lived signed ticket handed out only after the right email + password.
 * /api/resend-otp and /api/validate-otp accept the challenge, never a bare account id, so nobody can ask for or try
 * OTP codes for an account whose password they do not know.
 *
 * challenge = "<account id>.<expiry in ms>.<HMAC-SHA256(secret, 'otp-challenge:<account id>.<expiry>') as hex>"
 * Nothing is stored: the server recomputes the signature. It is signed with the ORDER_TOKEN_SECRET
 * (resolveOrderTokenSecret), so no new secret has to be configured.
 */

/** How long a challenge stays usable: long enough for the OTP expiry plus a few resends. */
export const OTP_CHALLENGE_LIFETIME_MS = 15 * 60 * 1000;

const textEncoder = new TextEncoder();

async function sign(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', textEncoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign'
  ]);
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(`otp-challenge:${payload}`));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function makeOtpChallenge(secret: string, accountId: number, now: number = Date.now()): Promise<string> {
  const payload = `${accountId}.${now + OTP_CHALLENGE_LIFETIME_MS}`;
  return `${payload}.${await sign(secret, payload)}`;
}

/** Returns the account id the challenge was issued for, or null when it is missing, forged or expired. */
export async function readOtpChallenge(secret: string, challenge: unknown, now: number = Date.now()): Promise<number | null> {
  if (typeof challenge !== 'string') return null;
  const parts = challenge.split('.');
  if (parts.length !== 3) return null;
  const [accountIdText, expiresAtText, signature] = parts;
  const accountId = Number(accountIdText);
  const expiresAt = Number(expiresAtText);
  if (!Number.isInteger(accountId) || accountId <= 0 || !Number.isFinite(expiresAt)) return null;
  const expected = await sign(secret, `${accountIdText}.${expiresAtText}`);
  if (!constantTimeEqual(expected, signature)) return null;
  if (expiresAt < now) return null;
  return accountId;
}

/**
 * Same idea for registration, where no account exists yet: the challenge carries the email being registered and the
 * registration_id of that attempt (register-otp.ts). A newer registration for the same email gets a new id, so this
 * challenge stops working for it.
 * challenge = "<email as base64url>.<registration id>.<expiry in ms>.<HMAC-SHA256(secret, 'otp-challenge:register:...')>"
 * The "register:" prefix keeps a login challenge and a registration challenge from ever being swapped.
 */
const toBase64Url = (text: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(text)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const fromBase64Url = (value: string) => {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
  return new TextDecoder().decode(Uint8Array.from(atob(padded), (char) => char.charCodeAt(0)));
};

export async function makeRegisterChallenge(
  secret: string,
  email: string,
  registrationId: string,
  now: number = Date.now()
): Promise<string> {
  const payload = `${toBase64Url(email.toLowerCase())}.${registrationId}.${now + OTP_CHALLENGE_LIFETIME_MS}`;
  return `${payload}.${await sign(secret, `register:${payload}`)}`;
}

/** Returns the email and registration id the challenge was issued for, or null when missing, forged or expired. */
export async function readRegisterChallenge(
  secret: string,
  challenge: unknown,
  now: number = Date.now()
): Promise<{ email: string; registrationId: string } | null> {
  if (typeof challenge !== 'string') return null;
  const parts = challenge.split('.');
  if (parts.length !== 4) return null;
  const [emailPart, registrationId, expiresAtText, signature] = parts;
  const expiresAt = Number(expiresAtText);
  if (!emailPart || !/^[0-9a-f]{32}$/.test(registrationId) || !Number.isFinite(expiresAt)) return null;
  const expected = await sign(secret, `register:${emailPart}.${registrationId}.${expiresAtText}`);
  if (!constantTimeEqual(expected, signature)) return null;
  if (expiresAt < now) return null;
  try {
    return { email: fromBase64Url(emailPart), registrationId };
  } catch {
    return null;
  }
}

/**
 * Staff login 2FA: same shape as the customer login challenge, signed with a "staff:" prefix so a customer challenge
 * can never be used for a staff member (or the other way round).
 * challenge = "<staff id>.<expiry in ms>.<HMAC-SHA256(secret, 'otp-challenge:staff:<staff id>.<expiry>')>"
 */
export async function makeStaffOtpChallenge(secret: string, staffId: number, now: number = Date.now()): Promise<string> {
  const payload = `${staffId}.${now + OTP_CHALLENGE_LIFETIME_MS}`;
  return `${payload}.${await sign(secret, `staff:${payload}`)}`;
}

/** Returns the staff id the challenge was issued for, or null when it is missing, forged or expired. */
export async function readStaffOtpChallenge(secret: string, challenge: unknown, now: number = Date.now()): Promise<number | null> {
  if (typeof challenge !== 'string') return null;
  const parts = challenge.split('.');
  if (parts.length !== 3) return null;
  const [staffIdText, expiresAtText, signature] = parts;
  const staffId = Number(staffIdText);
  const expiresAt = Number(expiresAtText);
  if (!Number.isInteger(staffId) || staffId <= 0 || !Number.isFinite(expiresAt)) return null;
  const expected = await sign(secret, `staff:${staffIdText}.${expiresAtText}`);
  if (!constantTimeEqual(expected, signature)) return null;
  if (expiresAt < now) return null;
  return staffId;
}
