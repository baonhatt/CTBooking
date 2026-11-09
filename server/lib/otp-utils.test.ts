import { describe, it, expect, vi } from 'vitest';
import { validateStaffOTP } from './otp-utils';

function makeDb(tokenRecord: any) {
  return {
    query: {
      staffTokens: {
        findFirst: vi.fn(async () => tokenRecord)
      }
    }
  };
}

const tables = { staffTokens: {} as any };

describe('validateStaffOTP', () => {
  it('rejects 123456 when no OTP was issued (no backdoor)', async () => {
    const result = await validateStaffOTP(makeDb(undefined), tables, 1, '123456');
    expect(result.valid).toBe(false);
  });

  it('accepts an OTP that matches a stored, unexpired record', async () => {
    const record = { id: 1, expiredAt: new Date(Date.now() + 60_000).toISOString() };
    const result = await validateStaffOTP(makeDb(record), tables, 1, '482913');
    expect(result.valid).toBe(true);
  });

  it('rejects an expired OTP and revokes it', async () => {
    const record = { id: 5, expiredAt: new Date(Date.now() - 60_000).toISOString() };
    const update = vi.fn();
    const db: any = {
      ...makeDb(record),
      update: () => ({ set: (values: any) => ({ where: async () => update(values) }) })
    };

    const result = await validateStaffOTP(db, tables, 1, '482913');

    expect(result.valid).toBe(false);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ revokeReason: 'expired' }));
  });
});
