import { describe, it, expect } from 'vitest';
import {
  POLL_INTERVAL_MS,
  POLL_MAX_INTERVAL_MS,
  SAFETY_MARGIN_MS,
  classifyPaymentStatus,
  isValidPayCode,
  localDeadlineMs,
  nextPollDelayMs,
  parseServerTime,
  secondsLeft,
  serverClockOffsetMs
} from './payment-flow';

describe('isValidPayCode', () => {
  it('accepts CS followed by exactly 12 digits', () => {
    expect(isValidPayCode('CS179420745818')).toBe(true);
  });

  it.each(['', 'CS12345', 'CS1794207458181', 'cs179420745818', 'XX179420745818', 'CS17942074581A', 123, null, undefined, 'CS179420745818 '])(
    'rejects %p',
    (value) => {
      expect(isValidPayCode(value)).toBe(false);
    }
  );
});

describe('parseServerTime', () => {
  it('reads an ISO time with Z', () => {
    expect(parseServerTime('2026-11-09T10:00:00.000Z')).toBe(Date.UTC(2026, 10, 9, 10, 0, 0));
  });

  it('reads an offset', () => {
    expect(parseServerTime('2026-11-09T17:00:00+07:00')).toBe(Date.UTC(2026, 10, 9, 10, 0, 0));
  });

  it('treats a time without a zone as UTC, like the older database values', () => {
    const expected = Date.UTC(2026, 10, 9, 10, 0, 0);
    expect(parseServerTime('2026-11-09 10:00:00')).toBe(expected);
    expect(parseServerTime('2026-11-09T10:00:00')).toBe(expected);
  });

  it('returns null for empty or unreadable values', () => {
    for (const value of [undefined, null, '', '   ', 'not a date', 123]) {
      expect(parseServerTime(value)).toBeNull();
    }
  });
});

describe('payment deadline on the browser clock', () => {
  const serverNow = '2026-11-09T10:00:00.000Z';
  const expiresAt = '2026-11-09T10:10:00.000Z'; // 10 minutes after the server's "now"

  it('counts down against the server clock even when the browser clock is wrong', () => {
    // Browser clock is 3 minutes fast
    const browserNow = Date.UTC(2026, 10, 9, 10, 3, 0);
    const offset = serverClockOffsetMs(serverNow, browserNow);
    expect(offset).toBe(-3 * 60 * 1000);

    const deadline = localDeadlineMs(expiresAt, offset, 0)!;
    // The customer really has 10 minutes, so on the fast clock the deadline is 10 minutes from the browser's "now"
    expect(secondsLeft(deadline, browserNow)).toBe(600);
  });

  it('is the same when the browser clock is slow', () => {
    const browserNow = Date.UTC(2026, 10, 9, 9, 50, 0);
    const offset = serverClockOffsetMs(serverNow, browserNow);
    const deadline = localDeadlineMs(expiresAt, offset, 0)!;
    expect(secondsLeft(deadline, browserNow)).toBe(600);
  });

  it('ends 15 seconds before the server deadline', () => {
    const browserNow = Date.UTC(2026, 10, 9, 10, 0, 0);
    const deadline = localDeadlineMs(expiresAt, serverClockOffsetMs(serverNow, browserNow))!;
    expect(secondsLeft(deadline, browserNow)).toBe(600 - SAFETY_MARGIN_MS / 1000);
  });

  it('has no offset when the server time cannot be read', () => {
    expect(serverClockOffsetMs('garbage', 1000)).toBe(0);
    expect(serverClockOffsetMs(undefined, 1000)).toBe(0);
  });

  it('has no deadline when the expiry is missing', () => {
    expect(localDeadlineMs(undefined, 0)).toBeNull();
    expect(localDeadlineMs('nope', 0)).toBeNull();
  });

  it('never goes below zero and rounds up to the next second', () => {
    expect(secondsLeft(1000, 5000)).toBe(0);
    expect(secondsLeft(10_001, 10_000)).toBe(1);
    expect(secondsLeft(10_000, 10_000)).toBe(0);
  });
});

describe('classifyPaymentStatus', () => {
  it('reads paid and pending, ignoring case and spaces', () => {
    expect(classifyPaymentStatus('paid')).toBe('paid');
    expect(classifyPaymentStatus(' PAID ')).toBe('paid');
    expect(classifyPaymentStatus('Pending')).toBe('pending');
  });

  it.each(['failed', 'expired', 'cancelled', 'canceled', 'refunded'])('treats %s as closed', (status) => {
    expect(classifyPaymentStatus(status)).toBe('closed');
  });

  it('does not guess about anything else', () => {
    for (const status of ['', undefined, null, 'processing', 'weird']) {
      expect(classifyPaymentStatus(status)).toBe('unknown');
    }
  });
});

describe('nextPollDelayMs', () => {
  it('checks every 5 seconds while things work', () => {
    expect(nextPollDelayMs(0)).toBe(POLL_INTERVAL_MS);
  });

  it('backs off while the server cannot be reached, up to a cap', () => {
    expect(nextPollDelayMs(1)).toBe(10_000);
    expect(nextPollDelayMs(2)).toBe(20_000);
    expect(nextPollDelayMs(3)).toBe(POLL_MAX_INTERVAL_MS);
    expect(nextPollDelayMs(50)).toBe(POLL_MAX_INTERVAL_MS);
  });
});
