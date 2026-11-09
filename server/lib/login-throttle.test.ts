import { describe, it, expect } from 'vitest';
import {
  LOGIN_MAX_FAILS_PER_IP,
  LOGIN_MAX_FAILS_PER_PAIR,
  clearStaffLoginFailures,
  clearStaffOtpFailures,
  isStaffLoginLocked,
  isStaffOtpLocked,
  recordStaffLoginFailure,
  recordStaffOtpFailure,
  type ThrottleKv
} from './login-throttle';

/** In-memory stand-in for a KV namespace. Expiry is not simulated. */
function makeKv(): ThrottleKv & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    async get(key) {
      return store.has(key) ? (store.get(key) as string) : null;
    },
    async put(key, value) {
      store.set(key, value);
    },
    async delete(key) {
      store.delete(key);
    }
  };
}

describe('staff login throttle', () => {
  it('does not lock before the pair limit is reached', async () => {
    const kv = makeKv();
    for (let attempt = 0; attempt < LOGIN_MAX_FAILS_PER_PAIR - 1; attempt++) {
      await recordStaffLoginFailure(kv, 'admin@example.com', '1.1.1.1');
    }
    expect(await isStaffLoginLocked(kv, 'admin@example.com', '1.1.1.1')).toBe(false);
  });

  it('locks the (email, IP) pair at the limit', async () => {
    const kv = makeKv();
    for (let attempt = 0; attempt < LOGIN_MAX_FAILS_PER_PAIR; attempt++) {
      await recordStaffLoginFailure(kv, 'admin@example.com', '1.1.1.1');
    }
    expect(await isStaffLoginLocked(kv, 'admin@example.com', '1.1.1.1')).toBe(true);
  });

  it('treats email case and surrounding spaces as the same account', async () => {
    const kv = makeKv();
    for (let attempt = 0; attempt < LOGIN_MAX_FAILS_PER_PAIR; attempt++) {
      await recordStaffLoginFailure(kv, '  Admin@Example.COM ', '1.1.1.1');
    }
    expect(await isStaffLoginLocked(kv, 'admin@example.com', '1.1.1.1')).toBe(true);
  });

  it('does not lock the same account when the failures came from another IP', async () => {
    const kv = makeKv();
    for (let attempt = 0; attempt < LOGIN_MAX_FAILS_PER_PAIR; attempt++) {
      await recordStaffLoginFailure(kv, 'admin@example.com', '9.9.9.9');
    }
    expect(await isStaffLoginLocked(kv, 'admin@example.com', '1.1.1.1')).toBe(false);
  });

  it('locks an IP that fails against many different emails', async () => {
    const kv = makeKv();
    for (let attempt = 0; attempt < LOGIN_MAX_FAILS_PER_IP; attempt++) {
      await recordStaffLoginFailure(kv, `user${attempt}@example.com`, '2.2.2.2');
    }
    expect(await isStaffLoginLocked(kv, 'someone-new@example.com', '2.2.2.2')).toBe(true);
  });

  it('clears the pair on success but keeps the per-IP count', async () => {
    const kv = makeKv();
    for (let attempt = 0; attempt < LOGIN_MAX_FAILS_PER_PAIR; attempt++) {
      await recordStaffLoginFailure(kv, 'admin@example.com', '1.1.1.1');
    }
    await clearStaffLoginFailures(kv, 'admin@example.com', '1.1.1.1');

    expect(await isStaffLoginLocked(kv, 'admin@example.com', '1.1.1.1')).toBe(false);
    expect(kv.store.get('login_fail:ip:1.1.1.1')).toBe(String(LOGIN_MAX_FAILS_PER_PAIR));
  });

  it('never locks when there is no KV binding', async () => {
    await recordStaffLoginFailure(undefined, 'admin@example.com', '1.1.1.1');
    expect(await isStaffLoginLocked(undefined, 'admin@example.com', '1.1.1.1')).toBe(false);
  });

  it('ignores a corrupted counter value', async () => {
    const kv = makeKv();
    kv.store.set('login_fail:pair:admin@example.com|1.1.1.1', 'not-a-number');
    expect(await isStaffLoginLocked(kv, 'admin@example.com', '1.1.1.1')).toBe(false);
  });
});

describe('staff OTP throttle', () => {
  it('locks a staff member after the allowed number of wrong OTPs', async () => {
    const kv = makeKv();
    for (let attempt = 0; attempt < 3; attempt++) {
      await recordStaffOtpFailure(kv, 7);
    }
    expect(await isStaffOtpLocked(kv, 7, 3)).toBe(true);
    expect(await isStaffOtpLocked(kv, 7, 4)).toBe(false);
  });

  it('keeps counters separate per staff member', async () => {
    const kv = makeKv();
    for (let attempt = 0; attempt < 5; attempt++) {
      await recordStaffOtpFailure(kv, 7);
    }
    expect(await isStaffOtpLocked(kv, 8, 5)).toBe(false);
  });

  it('clears the counter', async () => {
    const kv = makeKv();
    for (let attempt = 0; attempt < 5; attempt++) {
      await recordStaffOtpFailure(kv, 7);
    }
    await clearStaffOtpFailures(kv, 7);
    expect(await isStaffOtpLocked(kv, 7, 5)).toBe(false);
  });
});
