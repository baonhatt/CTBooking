import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import {
  staffChangePasswordImpl,
  staffChangePasswordWithOTP,
  staffForceChangePasswordImpl,
  staffVerifyLoginOtpImpl
} from './staff-auth';
import { LOCKED_MESSAGE } from '../../lib/login-throttle';

vi.mock('../../lib/audit-logger', () => ({
  logAuditAction: vi.fn(async () => undefined)
}));

vi.mock('../../lib/staff-auth', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    loadStaffPermissions: vi.fn(async () => ({ permissions: [], branchIds: [1], isSuperAdmin: false }))
  };
});

const tables = { staffs: {} as any, staffTokens: {} as any, auditLogs: {} as any };

const STAFF_ID = 7;
const futureIso = () => new Date(Date.now() + 5 * 60_000).toISOString();

function makeKv(globalSettings?: object) {
  const store = new Map<string, string>();
  if (globalSettings) store.set('global_settings', JSON.stringify(globalSettings));
  return {
    store,
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

const twoFactorOn = { admin_otp_settings: { enable_2fa: true, max_otp_attempts: 5 } };
const twoFactorOff = { admin_otp_settings: { enable_2fa: false } };

function makeDb(options: { staff?: any; otpRecord?: any }) {
  const inserted: any[] = [];
  const updated: any[] = [];
  const selectChain: any = {
    from: () => selectChain,
    where: () => selectChain,
    limit: async () => (options.staff ? [options.staff] : [])
  };
  const db: any = {
    select: () => selectChain,
    query: { staffTokens: { findFirst: vi.fn(async () => options.otpRecord) } },
    insert: () => ({ values: async (values: any) => void inserted.push(values) }),
    update: () => ({ set: (values: any) => ({ where: async () => void updated.push(values) }) })
  };
  return { db, inserted, updated };
}

const activeStaff = { id: STAFF_ID, email: 'staff@example.com', fullname: 'Staff', isActive: true, isSuperAdmin: false };
const validOtpRecord = { id: 1, expiredAt: futureIso() };
const rejectedMessage = 'OTP không hợp lệ hoặc đã hết hạn';

describe('staffVerifyLoginOtpImpl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects 123456 when no OTP was issued, and does not create a session', async () => {
    const { db, inserted } = makeDb({ staff: activeStaff, otpRecord: undefined });
    const kv = makeKv(twoFactorOn);

    const result: any = await staffVerifyLoginOtpImpl(db, tables, kv, { staffId: STAFF_ID, otp: '123456' });

    expect(result.status).toBe('error');
    expect(result.message).toBe(rejectedMessage);
    expect(inserted).toHaveLength(0);
  });

  it('rejects every call while 2FA is switched off, even with a matching OTP record', async () => {
    const { db, inserted } = makeDb({ staff: activeStaff, otpRecord: validOtpRecord });
    const kv = makeKv(twoFactorOff);

    const result: any = await staffVerifyLoginOtpImpl(db, tables, kv, { staffId: STAFF_ID, otp: '482913' });

    expect(result.status).toBe('error');
    expect(inserted).toHaveLength(0);
  });

  it('rejects the Super Admin, who skips 2FA at login', async () => {
    const superAdmin = { ...activeStaff, isSuperAdmin: true };
    const { db, inserted } = makeDb({ staff: superAdmin, otpRecord: validOtpRecord });

    const result: any = await staffVerifyLoginOtpImpl(db, tables, makeKv(twoFactorOn), {
      staffId: STAFF_ID,
      otp: '123456'
    });

    expect(result.status).toBe('error');
    expect(inserted).toHaveLength(0);
  });

  it('rejects a deactivated staff member and an unknown staff id with the same message', async () => {
    const inactive = makeDb({ staff: { ...activeStaff, isActive: false }, otpRecord: validOtpRecord });
    const unknown = makeDb({ staff: undefined, otpRecord: validOtpRecord });
    const kv = makeKv(twoFactorOn);

    const inactiveResult: any = await staffVerifyLoginOtpImpl(inactive.db, tables, kv, {
      staffId: STAFF_ID,
      otp: '482913'
    });
    const unknownResult: any = await staffVerifyLoginOtpImpl(unknown.db, tables, kv, {
      staffId: 999,
      otp: '482913'
    });

    expect(inactiveResult.message).toBe(rejectedMessage);
    expect(unknownResult.message).toBe(rejectedMessage);
  });

  it('rejects malformed input without querying the database', async () => {
    const { db } = makeDb({ staff: activeStaff, otpRecord: validOtpRecord });
    const kv = makeKv(twoFactorOn);
    const selectSpy = vi.spyOn(db, 'select');

    for (const badInput of [
      { staffId: STAFF_ID, otp: '12ab56' },
      { staffId: STAFF_ID, otp: '123' },
      { staffId: STAFF_ID, otp: 123456 as any },
      { staffId: '7' as any, otp: '482913' },
      { staffId: -1, otp: '482913' },
      { staffId: undefined as any, otp: '482913' }
    ]) {
      const result: any = await staffVerifyLoginOtpImpl(db, tables, kv, badInput);
      expect(result.status).toBe('error');
    }
    expect(selectSpy).not.toHaveBeenCalled();
  });

  it('issues a session for a correct OTP when 2FA is on', async () => {
    const { db, inserted } = makeDb({ staff: activeStaff, otpRecord: validOtpRecord });
    const kv = makeKv(twoFactorOn);

    const result: any = await staffVerifyLoginOtpImpl(db, tables, kv, { staffId: STAFF_ID, otp: '482913' });

    expect(result.status).toBe('success');
    expect(typeof result.token).toBe('string');
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ staffId: STAFF_ID, type: 'session' });
  });

  it('locks the staff member after too many wrong OTPs, even for the right one afterwards', async () => {
    const kv = makeKv(twoFactorOn);
    const wrong = makeDb({ staff: activeStaff, otpRecord: undefined });

    for (let attempt = 0; attempt < 5; attempt++) {
      const result: any = await staffVerifyLoginOtpImpl(wrong.db, tables, kv, { staffId: STAFF_ID, otp: '111111' });
      expect(result.message).toBe(rejectedMessage);
    }

    const right = makeDb({ staff: activeStaff, otpRecord: validOtpRecord });
    const locked: any = await staffVerifyLoginOtpImpl(right.db, tables, kv, { staffId: STAFF_ID, otp: '482913' });

    expect(locked.status).toBe('error');
    expect(locked.message).toBe(LOCKED_MESSAGE);
    expect(right.inserted).toHaveLength(0);
  });

  it('uses max_otp_attempts from settings', async () => {
    const kv = makeKv({ admin_otp_settings: { enable_2fa: true, max_otp_attempts: 2 } });
    const wrong = makeDb({ staff: activeStaff, otpRecord: undefined });

    await staffVerifyLoginOtpImpl(wrong.db, tables, kv, { staffId: STAFF_ID, otp: '111111' });
    await staffVerifyLoginOtpImpl(wrong.db, tables, kv, { staffId: STAFF_ID, otp: '111111' });
    const third: any = await staffVerifyLoginOtpImpl(wrong.db, tables, kv, { staffId: STAFF_ID, otp: '111111' });

    expect(third.message).toBe(LOCKED_MESSAGE);
  });
});

describe('staff password policy', () => {
  it('change password rejects a short new password before touching the database', async () => {
    const { db } = makeDb({ staff: activeStaff });
    const selectSpy = vi.spyOn(db, 'select');

    const result: any = await staffChangePasswordImpl(db, tables, undefined, STAFF_ID, {
      oldPassword: 'old-password-1',
      newPassword: 'short1'
    });

    expect(result.status).toBe('error');
    expect(selectSpy).not.toHaveBeenCalled();
  });

  it('change password rejects a new password equal to the old one', async () => {
    const { db } = makeDb({ staff: activeStaff });

    const result: any = await staffChangePasswordImpl(db, tables, undefined, STAFF_ID, {
      oldPassword: 'same-password-123',
      newPassword: 'same-password-123'
    });

    expect(result.status).toBe('error');
    expect(result.message).toMatch(/khác/);
  });

  it('change with OTP rejects a weak new password', async () => {
    const { db } = makeDb({ staff: activeStaff });

    const result: any = await staffChangePasswordWithOTP(db, tables, undefined, STAFF_ID, {
      oldPassword: 'old-password-123',
      newPassword: 'onlyletterspassword',
      otp: '482913'
    });

    expect(result.status).toBe('error');
    expect(result.message).toMatch(/chữ và số/);
  });

  it('forced change rejects a weak password', async () => {
    const staff = { ...activeStaff, forcePasswordChange: true, password: await bcrypt.hash('Initial-pass-1', 4) };
    const { db, updated } = makeDb({ staff });

    const result: any = await staffForceChangePasswordImpl(db, tables, undefined, STAFF_ID, { newPassword: 'abc123' });

    expect(result.status).toBe('error');
    expect(updated).toHaveLength(0);
  });

  it('forced change rejects reusing the current password', async () => {
    const staff = { ...activeStaff, forcePasswordChange: true, password: await bcrypt.hash('Initial-pass-1234', 4) };
    const { db, updated } = makeDb({ staff });

    const result: any = await staffForceChangePasswordImpl(db, tables, undefined, STAFF_ID, {
      newPassword: 'Initial-pass-1234'
    });

    expect(result.status).toBe('error');
    expect(result.message).toMatch(/khác/);
    expect(updated).toHaveLength(0);
  });

  it('forced change accepts a strong new password', async () => {
    const staff = { ...activeStaff, forcePasswordChange: true, password: await bcrypt.hash('Initial-pass-1234', 4) };
    const { db, updated } = makeDb({ staff });

    const result: any = await staffForceChangePasswordImpl(db, tables, undefined, STAFF_ID, {
      newPassword: 'Brand-new-pass-5678'
    });

    expect(result.status).toBe('success');
    expect(updated.some((values) => values.forcePasswordChange === false)).toBe(true);
  });
});
