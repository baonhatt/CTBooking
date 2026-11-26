import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { loginImpl, resendOTPImpl, LOGIN_FAILED_MESSAGE } from './auth';
import { forgetPassImpl, FORGET_PASSWORD_MESSAGE } from './password';
import { updateUserProfileImpl } from './users';
import { sendOTPEmail } from '../../lib/otp-utils';

vi.mock('../../lib/otp-utils', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  sendOTPEmail: vi.fn(async () => undefined),
  createOTPRecord: vi.fn(async () => undefined),
  canResendOTP: vi.fn(async () => ({ canResend: true }))
}));

vi.mock('../../lib/mail-queue', () => ({ mailQueue: { add: vi.fn() } }));

const tables: any = { accounts: {}, users: {}, tokens: {} };

function makeDb(account: any) {
  return {
    query: {
      accounts: { findFirst: async () => account },
      users: { findFirst: async () => ({ id: 3, fullname: 'An' }) }
    },
    insert: () => ({ values: async () => undefined }),
    update: () => ({ set: () => ({ where: () => ({ returning: async () => [{ id: 3, fullname: 'An' }] }) }) })
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('resend OTP', () => {
  it('sends the code to the email of the account, not to an email given in the request', async () => {
    const db = makeDb({ id: 57, user_id: 3, email: 'owner@example.com' });
    const payload: any = { temp_account_id: 57, email: 'attacker@example.com' };
    const result: any = await resendOTPImpl(db, tables, payload);
    expect(result.status).toBe(200);
    expect(vi.mocked(sendOTPEmail).mock.calls[0][2]).toBe('owner@example.com');
  });
});

describe('login answers', () => {
  it('an unknown email and a wrong password get the same answer', async () => {
    const passwordHash = await bcrypt.hash('right-pass', 4);
    const unknown: any = await loginImpl(makeDb(undefined), tables, { email: 'x@y.z', password: 'right-pass' });
    const wrong: any = await loginImpl(makeDb({ id: 1, user_id: 3, password: passwordHash }), tables, {
      email: 'a@b.co',
      password: 'wrong'
    });
    expect(unknown).toEqual({ status: 400, message: LOGIN_FAILED_MESSAGE });
    expect(wrong).toEqual(unknown);
  });

  it('a password reset request for an unknown email looks like one for a known email', async () => {
    const unknown = await forgetPassImpl(makeDb(undefined), tables, 'x@y.z');
    const known = await forgetPassImpl(makeDb({ id: 1, email: 'a@b.co' }), tables, 'a@b.co');
    expect(unknown).toEqual({ status: 200, message: FORGET_PASSWORD_MESSAGE });
    expect(known).toEqual(unknown);
  });
});

describe('profile name', () => {
  const update = (name: string) => updateUserProfileImpl(makeDb({ id: 1, user_id: 3 }), tables, { accountId: 1, name });

  it('refuses < and >, an empty name and a name over 100 characters', async () => {
    for (const name of ['<script>x</script>', '   ', 'a'.repeat(101)]) {
      expect(((await update(name)) as any).status).toBe(400);
    }
  });

  it('accepts a normal name', async () => {
    expect(((await update('Nguyễn Văn An')) as any).status).toBe(200);
  });
});
