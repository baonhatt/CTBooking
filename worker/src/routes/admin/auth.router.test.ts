import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import authRouter from './auth.router';
import { staffLoginImpl } from '../../../../server/routes/admin/staff-auth';
import { LOCKED_MESSAGE, LOGIN_MAX_FAILS_PER_PAIR } from '../../../../server/lib/login-throttle';

vi.mock('../../../../server/routes/admin/staff-auth', async (importOriginal) => {
  const actual: any = await importOriginal();
  return { ...actual, staffLoginImpl: vi.fn() };
});

function makeKv() {
  const store = new Map<string, string>();
  return {
    async get(key: string) {
      return store.has(key) ? (store.get(key) as string) : null;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
    async delete(key: string) {
      store.delete(key);
    }
  };
}

function makeEnv() {
  return { cinema_db: {}, SETTINGS_KV: makeKv(), TURNSTILE_SECRET: 'test-secret' };
}

function loginRequest(env: any, email: string, ip = '1.1.1.1') {
  return authRouter.request(
    '/api/admin/auth/login',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
      body: JSON.stringify({ email, password: 'whatever', turnstileToken: 'ok' })
    },
    env
  );
}

describe('admin login throttle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ success: true, action: 'admin_login' }) }) as any)
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('refuses further attempts after too many wrong passwords, without checking credentials', async () => {
    const env = makeEnv();
    (staffLoginImpl as any).mockResolvedValue({
      status: 'error',
      code: 'invalid_credentials',
      message: 'Email hoặc mật khẩu không đúng'
    });

    for (let attempt = 0; attempt < LOGIN_MAX_FAILS_PER_PAIR; attempt++) {
      const response = await loginRequest(env, 'admin@example.com');
      expect(response.status).toBe(400);
    }
    expect(staffLoginImpl).toHaveBeenCalledTimes(LOGIN_MAX_FAILS_PER_PAIR);

    const blocked = await loginRequest(env, 'admin@example.com');
    const body: any = await blocked.json();

    expect(body.message).toBe(LOCKED_MESSAGE);
    expect(staffLoginImpl).toHaveBeenCalledTimes(LOGIN_MAX_FAILS_PER_PAIR);
  });

  it('does not count errors that are not wrong credentials', async () => {
    const env = makeEnv();
    (staffLoginImpl as any).mockResolvedValue({ status: 'error', message: 'Không thể gửi mã OTP, vui lòng thử lại sau.' });

    for (let attempt = 0; attempt < LOGIN_MAX_FAILS_PER_PAIR + 2; attempt++) {
      await loginRequest(env, 'admin@example.com');
    }

    expect(staffLoginImpl).toHaveBeenCalledTimes(LOGIN_MAX_FAILS_PER_PAIR + 2);
  });

  it('a correct password resets the pair counter', async () => {
    const env = makeEnv();
    const wrong = { status: 'error', code: 'invalid_credentials', message: 'Email hoặc mật khẩu không đúng' };
    const correct = { status: 'require_otp', staffId: 3, email: 'admin@example.com', message: 'OTP' };

    (staffLoginImpl as any).mockResolvedValue(wrong);
    for (let attempt = 0; attempt < LOGIN_MAX_FAILS_PER_PAIR - 1; attempt++) {
      await loginRequest(env, 'admin@example.com');
    }

    (staffLoginImpl as any).mockResolvedValue(correct);
    const success = await loginRequest(env, 'admin@example.com');
    expect(success.status).toBe(200);

    (staffLoginImpl as any).mockResolvedValue(wrong);
    for (let attempt = 0; attempt < LOGIN_MAX_FAILS_PER_PAIR - 1; attempt++) {
      const response = await loginRequest(env, 'admin@example.com');
      const body: any = await response.json();
      expect(body.message).not.toBe(LOCKED_MESSAGE);
    }
  });

  it('does not lock the same email when the wrong passwords came from another IP', async () => {
    const env = makeEnv();
    (staffLoginImpl as any).mockResolvedValue({
      status: 'error',
      code: 'invalid_credentials',
      message: 'Email hoặc mật khẩu không đúng'
    });

    for (let attempt = 0; attempt < LOGIN_MAX_FAILS_PER_PAIR; attempt++) {
      await loginRequest(env, 'admin@example.com', '9.9.9.9');
    }
    const fromOwner = await loginRequest(env, 'admin@example.com', '1.1.1.1');
    const body: any = await fromOwner.json();

    expect(body.message).not.toBe(LOCKED_MESSAGE);
  });
});

describe('staff forgot-password and reset-password are switched off', () => {
  it.each(['/api/admin/auth/forgot-password', '/api/admin/auth/reset-password'])('%s returns 404', async (path) => {
    const response = await authRouter.request(
      path,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'a@b.c' }) },
      makeEnv()
    );
    expect(response.status).toBe(404);
  });
});
