/**
 * Small pure helpers for the QR payment flow: the payment deadline against the server's clock, how to read a
 * payment status, and how long to wait between status checks. They have no browser or network dependency,
 * so they can be tested on their own.
 */

/**
 * The countdown ends this long before the server's real deadline. A bank transfer takes a few seconds to arrive,
 * so a customer who pays in the last seconds would otherwise be told "paid in time" and then be too late.
 */
export const SAFETY_MARGIN_MS = 15_000;

/** The payment reference the customer types into the bank transfer. Must match what the SePay webhook looks for. */
export const PAY_CODE_PATTERN = /^CS\d{12}$/;

export function isValidPayCode(value: unknown): value is string {
  return typeof value === 'string' && PAY_CODE_PATTERN.test(value);
}

/**
 * Parses a time the server sent. Times saved by the server carry a Z (UTC). An older value without a zone, such as
 * "2026-11-09 10:00:00", is also UTC, but a browser would read it as local time and be hours off, so mark it UTC here.
 */
export function parseServerTime(value: unknown): number | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const text = value.trim();
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/i.test(text);
  const normalized = hasZone ? text : `${text.replace(' ', 'T')}Z`;
  const parsed = Date.parse(normalized);
  return Number.isNaN(parsed) ? null : parsed;
}

/** Server clock minus this browser's clock, in milliseconds. 0 when the server time cannot be read. */
export function serverClockOffsetMs(serverNowIso: unknown, clientNowMs: number = Date.now()): number {
  const serverNow = parseServerTime(serverNowIso);
  return serverNow === null ? 0 : serverNow - clientNowMs;
}

/**
 * The moment, on this browser's clock, when the countdown should end: the server deadline moved onto this clock,
 * minus the safety margin. Null when the deadline is missing or unreadable.
 */
export function localDeadlineMs(
  expiresAtIso: unknown,
  offsetMs: number,
  safetyMarginMs: number = SAFETY_MARGIN_MS
): number | null {
  const expiresAt = parseServerTime(expiresAtIso);
  if (expiresAt === null) return null;
  return expiresAt - offsetMs - safetyMarginMs;
}

export function secondsLeft(deadlineMs: number, nowMs: number = Date.now()): number {
  return Math.max(0, Math.ceil((deadlineMs - nowMs) / 1000));
}

export type PaymentOutcome = 'paid' | 'pending' | 'closed' | 'unknown';

/**
 * paid      the money was received
 * pending   still waiting for the transfer
 * closed    the order can no longer be paid (cancelled, failed, expired, refunded)
 * unknown   a value this screen does not know
 */
export function classifyPaymentStatus(status: unknown): PaymentOutcome {
  const value = String(status ?? '').trim().toLowerCase();
  if (value === 'paid') return 'paid';
  if (value === 'pending') return 'pending';
  if (['failed', 'expired', 'cancelled', 'canceled', 'refunded'].includes(value)) return 'closed';
  return 'unknown';
}

/** Time between status checks: 5s normally, then 10s, 20s, 30s (the cap) while the server cannot be reached. */
export const POLL_INTERVAL_MS = 5_000;
export const POLL_MAX_INTERVAL_MS = 30_000;

export function nextPollDelayMs(consecutiveFailures: number): number {
  if (consecutiveFailures <= 0) return POLL_INTERVAL_MS;
  return Math.min(POLL_INTERVAL_MS * 2 ** Math.min(consecutiveFailures, 4), POLL_MAX_INTERVAL_MS);
}
