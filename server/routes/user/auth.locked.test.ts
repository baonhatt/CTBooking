import { describe, it, expect } from 'vitest';
import bcrypt from 'bcryptjs';
import { loginImpl, validateSessionTokenImpl, ACCOUNT_LOCKED_MESSAGE } from './auth';
import { resetPasswordImpl, forgetPassImpl } from './password';

const tables: any = { accounts: {}, users: {}, tokens: {} };
const hash = bcrypt.hashSync('right-pass', 4);

function makeDb(parts: { account?: any; token?: any }) {
  const inserted: any[] = [];
  const updated: any[] = [];
  const db: any = {
    query: {
      accounts: { findFirst: async () => parts.account },
      users: { findFirst: async () => ({ fullname: 'An', phone: '0900000000' }) },
      tokens: { findFirst: async () => parts.token }
    },
    insert: () => ({ values: async (values: any) => void inserted.push(values) }),
    update: () => ({ set: (values: any) => ({ where: async () => void updated.push(values) }) }),
    delete: () => ({ where: async () => undefined })
  };
  return { db, inserted, updated };
}

const account = (isActive: boolean | undefined) => ({
  id: 9,
  user_id: 3,
  email: 'a@b.co',
  password: hash,
  is_active: isActive
});

describe('loginImpl with a locked account', () => {
  it('right password: 403 with the lock message', async () => {
    const { db } = makeDb({ account: account(false) });
    const result: any = await loginImpl(db, tables, { email: 'a@b.co', password: 'right-pass' });
    expect(result).toEqual({ status: 403, message: ACCOUNT_LOCKED_MESSAGE });
  });

  it('wrong password: a normal failed login, the lock is not revealed', async () => {
    const { db } = makeDb({ account: account(false) });
    const result: any = await loginImpl(db, tables, { email: 'a@b.co', password: 'wrong' });
    expect(result.status).toBe(400);
    expect(result.message).not.toBe(ACCOUNT_LOCKED_MESSAGE);
  });

  it('an active account (true or never set) still logs in', async () => {
    for (const flag of [true, undefined]) {
      const { db } = makeDb({ account: account(flag) });
      expect(((await loginImpl(db, tables, { email: 'a@b.co', password: 'right-pass' })) as any).status).toBe(200);
    }
  });
});

describe('validateSessionTokenImpl with a locked account', () => {
  const tokenFor = (isActive: boolean) => ({
    id: 1,
    account_id: 9,
    expired_at: null,
    account: { user_id: 3, is_active: isActive }
  });

  it('returns valid:false, locked:true', async () => {
    const { db } = makeDb({ token: tokenFor(false) });
    expect(await validateSessionTokenImpl(db, tables, 'tok')).toEqual({ valid: false, locked: true });
  });

  it('an active account is valid', async () => {
    const { db } = makeDb({ token: tokenFor(true) });
    expect(await validateSessionTokenImpl(db, tables, 'tok')).toMatchObject({ valid: true, accountId: 9, userId: 3 });
  });
});

describe('password reset with a locked account', () => {
  const resetToken = { id: 5, account_id: 9 };

  it('a valid reset token on a locked account: 403 and the password is not changed', async () => {
    const { db, updated } = makeDb({ account: account(false), token: resetToken });
    const result: any = await resetPasswordImpl(db, tables, { token: 'good', newPassword: 'new-pass-123' });
    expect(result).toEqual({ status: 403, message: ACCOUNT_LOCKED_MESSAGE });
    expect(updated).toHaveLength(0);
  });

  it('an invalid token on a locked account still looks like any invalid token (400)', async () => {
    const { db } = makeDb({ account: account(false), token: undefined });
    expect(((await resetPasswordImpl(db, tables, { token: 'bad', newPassword: 'x' })) as any).status).toBe(400);
  });

  it('an active account can reset', async () => {
    const { db, updated } = makeDb({ account: account(true), token: resetToken });
    const result: any = await resetPasswordImpl(db, tables, { token: 'good', newPassword: 'new-pass-123' });
    expect(result.status).toBe(200);
    expect(updated).toHaveLength(1);
  });

  it('the request step answers a locked account exactly like an active one (no lock leak)', async () => {
    const locked = makeDb({ account: account(false) });
    const active = makeDb({ account: account(true) });
    const lockedResult = await forgetPassImpl(locked.db, tables, 'a@b.co');
    const activeResult = await forgetPassImpl(active.db, tables, 'a@b.co');
    expect(lockedResult).toEqual(activeResult);
  });
});
