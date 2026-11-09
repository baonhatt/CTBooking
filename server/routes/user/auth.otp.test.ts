import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateOTPImpl } from './auth';
import { validateOTP, deleteOTP } from '../../lib/otp-utils';
import { LOCKED_MESSAGE } from '../../lib/login-throttle';

vi.mock('../../lib/otp-utils', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  validateOTP: vi.fn(),
  deleteOTP: vi.fn(async () => undefined)
}));

function fakeKv(settings?: unknown) {
  const store = new Map<string, string>();
  if (settings !== undefined) store.set('global_settings', JSON.stringify(settings));
  return {
    store,
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => {
      store.set(key, value);
    },
    delete: async (key: string) => {
      store.delete(key);
    }
  };
}

const db: any = {
  query: {
    accounts: { findFirst: async () => ({ id: 9, user_id: 3, email: 'a@b.co' }) },
    users: { findFirst: async () => ({ fullname: 'An', phone: '0900000000' }) }
  },
  insert: () => ({ values: async () => undefined })
};
const tables: any = { accounts: {}, users: {}, tokens: {} };
const run = (otp: string, kv: any) =>
  validateOTPImpl(db, tables, { temp_account_id: 9, otp }, async () => 'token', () => '2026-12-01T00:00:00.000Z', kv);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('customer OTP: wrong codes are limited', () => {
  it('locks the account after max_otp_attempts wrong codes, and then even the right code is refused', async () => {
    const kv = fakeKv({ otp_settings: { max_otp_attempts: 3 } });
    (validateOTP as any).mockResolvedValue({ valid: false, error: 'Sai OTP' });

    for (let attempt = 0; attempt < 3; attempt++) {
      expect(((await run('000000', kv)) as any).status).toBe(400);
    }

    (validateOTP as any).mockResolvedValue({ valid: true });
    const locked: any = await run('123456', kv);
    expect(locked.status).toBe(429);
    expect(locked.message).toBe(LOCKED_MESSAGE);
    expect(validateOTP).toHaveBeenCalledTimes(3); // the locked attempt did not even check the code
  });

  it('uses the default of 5 when the setting is missing', async () => {
    const kv = fakeKv();
    (validateOTP as any).mockResolvedValue({ valid: false, error: 'Sai OTP' });
    for (let attempt = 0; attempt < 5; attempt++) await run('000000', kv);

    expect(((await run('000000', kv)) as any).status).toBe(429);
  });

  it('a right code before the limit logs in and clears the count', async () => {
    const kv = fakeKv({ otp_settings: { max_otp_attempts: 3 } });
    (validateOTP as any).mockResolvedValue({ valid: false, error: 'Sai OTP' });
    await run('000000', kv);
    await run('000000', kv);

    (validateOTP as any).mockResolvedValue({ valid: true });
    const ok: any = await run('123456', kv);

    expect(ok.status).toBe(200);
    expect(deleteOTP).toHaveBeenCalledTimes(1);
    expect([...kv.store.keys()].some((key) => key.startsWith('otp_fail:customer:'))).toBe(false);
  });

  it('counts each account on its own', async () => {
    const kv = fakeKv({ otp_settings: { max_otp_attempts: 3 } });
    (validateOTP as any).mockResolvedValue({ valid: false, error: 'Sai OTP' });
    for (let attempt = 0; attempt < 3; attempt++) await run('000000', kv);

    const otherDb: any = {
      ...db,
      query: { ...db.query, accounts: { findFirst: async () => ({ id: 10, user_id: 4, email: 'c@d.co' }) } }
    };
    const other: any = await validateOTPImpl(otherDb, tables, { temp_account_id: 10, otp: '000000' }, async () => 't', () => 'x', kv);

    expect(other.status).toBe(400); // not locked
  });

  it('still works without a KV store (local development)', async () => {
    (validateOTP as any).mockResolvedValue({ valid: false, error: 'Sai OTP' });
    expect(((await run('000000', undefined)) as any).status).toBe(400);
  });
});
