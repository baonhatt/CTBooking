import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import * as schema from '../../../shared/schema';
import { startRegistrationImpl, verifyRegistrationImpl, resendRegistrationImpl } from './register-otp';
import { registerImpl, checkEmailAvailableImpl } from './auth';
import { makeRegisterChallenge, readRegisterChallenge, makeOtpChallenge, readOtpChallenge } from '../../lib/otp-challenge';

// The code that is mailed is captured here, so a test can "read the email"
let lastCode = '';
vi.mock('../../lib/otp-utils', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  sendOTPEmail: vi.fn(async (_db: any, _tables: any, _to: string, _name: string, code: string) => {
    lastCode = code;
  })
}));
vi.mock('./auth', () => ({
  checkEmailAvailableImpl: vi.fn(async () => ({ available: true })),
  registerImpl: vi.fn(async () => ({ status: 200, account_id: 77, user: { id: 5 } }))
}));

// A real SQLite database in memory (node:sqlite) behind drizzle, so UPDATE ... RETURNING and the counters really run
function makeDb() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE register_pending (email TEXT PRIMARY KEY NOT NULL, registration_id TEXT NOT NULL, name TEXT NOT NULL,
      phone TEXT, gender TEXT, dob TEXT, password_hash TEXT NOT NULL, code_hash TEXT NOT NULL,
      code_expires_at INTEGER NOT NULL, sent_at INTEGER NOT NULL, fails INTEGER DEFAULT 0 NOT NULL, expires_at INTEGER NOT NULL);
    CREATE TABLE tokens (id INTEGER PRIMARY KEY AUTOINCREMENT, account_id INTEGER NOT NULL, type TEXT NOT NULL,
      token TEXT NOT NULL, expired_at TEXT, created_at TEXT NOT NULL);
  `);
  const db = drizzle(
    async (sql, params, method) => {
      const statement = sqlite.prepare(sql);
      if (method === 'run') {
        statement.run(...(params as any[]));
        return { rows: [] };
      }
      const rows = statement.all(...(params as any[])).map((row: any) => Object.values(row));
      return { rows: method === 'get' ? (rows[0] as any) : rows };
    },
    { schema }
  );
  return { db, sqlite };
}

const tables: any = {
  accounts: schema.accounts,
  users: schema.users,
  tokens: schema.tokens,
  register_pending: schema.register_pending
};
const form = { email: 'Lan@Example.com', password: 'abc12345', name: 'Lan' };
const pendingRow = (sqlite: DatabaseSync) => sqlite.prepare('select * from register_pending').get() as any;
const verify = (db: any, registrationId: string, otp: string) =>
  verifyRegistrationImpl(db, tables, undefined, { email: form.email, registration_id: registrationId, otp }, async () => 'session-token', () => '2099-01-01');
const wrongCode = () => (lastCode === '000000' ? '111111' : '000000');

beforeEach(() => {
  vi.clearAllMocks();
  lastCode = '';
});

describe('registration with an email code', () => {
  it('step 1 creates no account, keeps no plain password or code, and mails a code', async () => {
    const { db, sqlite } = makeDb();
    const result: any = await startRegistrationImpl(db, tables, undefined, form);

    expect(result).toMatchObject({ status: 200, requires_otp: true, email: 'lan@example.com' });
    expect(result.registration_id).toMatch(/^[0-9a-f]{32}$/);
    expect(registerImpl).not.toHaveBeenCalled();
    const saved = JSON.stringify(pendingRow(sqlite));
    expect(saved).not.toContain('abc12345');
    expect(saved).not.toContain(`"${lastCode}"`);
  });

  it('a taken email is refused before any code is sent', async () => {
    vi.mocked(checkEmailAvailableImpl).mockResolvedValueOnce({ available: false, message: 'Email đã được sử dụng' } as any);
    const { db } = makeDb();
    expect(((await startRegistrationImpl(db, tables, undefined, form)) as any).status).toBe(400);
  });

  it('pressing Đăng ký again within 30 seconds is refused (the newer form is not silently dropped)', async () => {
    const { db } = makeDb();
    await startRegistrationImpl(db, tables, undefined, form);
    const again: any = await startRegistrationImpl(db, tables, undefined, { ...form, password: 'other12345' });
    expect(again.status).toBe(429);
  });

  it('a wrong code creates nothing; the right code creates the account with the hashed password and signs in', async () => {
    const { db, sqlite } = makeDb();
    const started: any = await startRegistrationImpl(db, tables, undefined, form);

    expect(((await verify(db, started.registration_id, wrongCode())) as any).status).toBe(400);
    expect(registerImpl).not.toHaveBeenCalled();

    const right: any = await verify(db, started.registration_id, lastCode);
    expect(right).toMatchObject({ status: 200, token: 'session-token' });
    const created = vi.mocked(registerImpl).mock.calls[0][2] as any;
    expect(created).toMatchObject({ email: 'lan@example.com', password_hash: expect.any(String) });
    expect(created.password).toBeUndefined();
    expect(pendingRow(sqlite)).toBeUndefined();
  });

  it('a newer registration for the same email makes the older challenge useless (no takeover)', async () => {
    const { db, sqlite } = makeDb();
    const victim: any = await startRegistrationImpl(db, tables, undefined, form);
    // 31 seconds later someone else registers the same email with their own password
    sqlite.prepare('update register_pending set sent_at = sent_at - 31000').run();
    await startRegistrationImpl(db, tables, undefined, { ...form, password: 'attacker123' });

    // The email's owner types the newest code into the dialog that still holds the first challenge
    const result: any = await verify(db, victim.registration_id, lastCode);
    expect(result.status).toBe(410);
    expect(registerImpl).not.toHaveBeenCalled();
  });

  it('wrong codes are counted in the database; after the limit even the right code is refused', async () => {
    const { db } = makeDb();
    const started: any = await startRegistrationImpl(db, tables, undefined, form);
    const attempts = await Promise.all(Array.from({ length: 8 }, () => verify(db, started.registration_id, wrongCode())));
    expect(attempts.filter((attempt: any) => attempt.status === 429).length).toBe(3);

    const locked: any = await verify(db, started.registration_id, lastCode);
    expect(locked.status).toBe(429);
    expect(registerImpl).not.toHaveBeenCalled();
  });

  it('a database error while creating the account never reaches the browser as raw text', async () => {
    vi.mocked(registerImpl).mockResolvedValueOnce({ status: 500, message: 'Server error: UNIQUE constraint failed' } as any);
    const { db } = makeDb();
    const started: any = await startRegistrationImpl(db, tables, undefined, form);
    const result: any = await verify(db, started.registration_id, lastCode);
    expect(result).toEqual({ status: 500, message: 'Không tạo được tài khoản, vui lòng thử lại' });
  });

  it('resend waits for the cooldown and needs the current registration id', async () => {
    const { db } = makeDb();
    const started: any = await startRegistrationImpl(db, tables, undefined, form);
    expect(((await resendRegistrationImpl(db, tables, undefined, { email: form.email, registration_id: started.registration_id })) as any).status).toBe(429);
    expect(((await resendRegistrationImpl(db, tables, undefined, { email: form.email, registration_id: 'f'.repeat(32) })) as any).status).toBe(410);
  });
});

describe('registration challenge', () => {
  it('carries email + registration id, and cannot be swapped with a login challenge', async () => {
    const id = 'a'.repeat(32);
    const registerChallenge = await makeRegisterChallenge('secret', 'lan@example.com', id, 1000);
    expect(await readRegisterChallenge('secret', registerChallenge, 2000)).toEqual({ email: 'lan@example.com', registrationId: id });
    expect(await readOtpChallenge('secret', registerChallenge, 2000)).toBeNull();

    const loginChallenge = await makeOtpChallenge('secret', 57, 1000);
    expect(await readRegisterChallenge('secret', loginChallenge, 2000)).toBeNull();
    expect(await readRegisterChallenge('other-secret', registerChallenge, 2000)).toBeNull();
  });
});
