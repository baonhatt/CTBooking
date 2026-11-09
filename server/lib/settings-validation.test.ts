import { describe, it, expect } from 'vitest';
import { validateSettingsPatch, describeSettingsChange } from './settings-validation';
import { getGlobalSettingsImpl, updateGlobalSettingsImpl } from './global-settings';
import { updateAdminSettingsImpl } from '../routes/admin/settings';

function fakeKv(initial?: unknown) {
  const store = new Map<string, string>();
  if (initial !== undefined) store.set('global_settings', JSON.stringify(initial));
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

describe('validateSettingsPatch', () => {
  it('accepts a complete, valid change', () => {
    const patch = validateSettingsPatch({
      otp_settings: { enable_2fa: true, otp_length: 6, otp_expiry_minutes: 5, otp_resend_cooldown_seconds: 30, max_otp_attempts: 5 },
      admin_otp_settings: { enable_2fa: false, otp_length: 8, otp_expiry_minutes: 30, otp_resend_cooldown_seconds: 300, max_otp_attempts: 10 }
    });
    expect(patch.admin_otp_settings?.otp_length).toBe(8);
  });

  it('accepts the edges of every range', () => {
    for (const [key, min, max] of [
      ['otp_length', 4, 8],
      ['otp_expiry_minutes', 1, 30],
      ['otp_resend_cooldown_seconds', 10, 300],
      ['max_otp_attempts', 3, 10]
    ] as const) {
      expect(() => validateSettingsPatch({ otp_settings: { [key]: min } })).not.toThrow();
      expect(() => validateSettingsPatch({ otp_settings: { [key]: max } })).not.toThrow();
    }
  });

  it.each([
    ['otp_length', 3],
    ['otp_length', 9],
    ['otp_expiry_minutes', 0],
    ['otp_expiry_minutes', 31],
    ['otp_resend_cooldown_seconds', 9],
    ['otp_resend_cooldown_seconds', 301],
    ['max_otp_attempts', 2],
    ['max_otp_attempts', 11],
    ['max_otp_attempts', 5.5],
    ['max_otp_attempts', NaN],
    ['max_otp_attempts', 'abc'],
    ['max_otp_attempts', ''],
    ['max_otp_attempts', null],
    ['max_otp_attempts', -1]
  ])('refuses %s = %p with a 400', (key, value) => {
    expect(() => validateSettingsPatch({ admin_otp_settings: { [key]: value } })).toThrow(expect.objectContaining({ statusCode: 400 }));
  });

  it('reads a number sent as text', () => {
    expect(validateSettingsPatch({ otp_settings: { otp_length: '6' } }).otp_settings?.otp_length).toBe(6);
  });

  it('enable_2fa must be a real boolean', () => {
    for (const bad of ['true', 1, 0, null, 'yes']) {
      expect(() => validateSettingsPatch({ otp_settings: { enable_2fa: bad } })).toThrow(expect.objectContaining({ statusCode: 400 }));
    }
  });

  it('refuses a key that is not known, in the groups or at the top', () => {
    expect(() => validateSettingsPatch({ otp_settings: { evil: 1 } })).toThrow(/otp_settings.evil/);
    expect(() => validateSettingsPatch({ __proto__x: { a: 1 }, sneaky: 1 })).toThrow(/sneaky|__proto__x/);
    expect(() => validateSettingsPatch({ admin_sidebar_settings: {} })).toThrow(expect.objectContaining({ statusCode: 400 }));
  });

  it('refuses a body or a group that is not an object', () => {
    for (const bad of [null, undefined, 'x', 5, [], [{ otp_settings: {} }]]) {
      expect(() => validateSettingsPatch(bad)).toThrow(expect.objectContaining({ statusCode: 400 }));
    }
    expect(() => validateSettingsPatch({ otp_settings: 'x' })).toThrow(expect.objectContaining({ statusCode: 400 }));
    expect(() => validateSettingsPatch({ otp_settings: [1] })).toThrow(expect.objectContaining({ statusCode: 400 }));
  });

  it('accepts an empty change', () => {
    expect(validateSettingsPatch({})).toEqual({});
  });
});

describe('updateGlobalSettingsImpl merges key by key', () => {
  it('a partial change keeps the other keys of the group', async () => {
    const kv = fakeKv();
    const updated: any = await updateGlobalSettingsImpl(kv, { admin_otp_settings: { max_otp_attempts: 7 } });
    expect(updated.admin_otp_settings.max_otp_attempts).toBe(7);
    expect(updated.admin_otp_settings.otp_length).toBe(6);
    expect(updated.otp_settings.enable_2fa).toBe(false);
    expect((await getGlobalSettingsImpl(kv)).admin_otp_settings.max_otp_attempts).toBe(7);
  });
});

describe('updateAdminSettingsImpl', () => {
  const staff = { id: 1, email: 'root@example.com', fullname: 'Root' };
  const makeAudit = () => {
    const lines: any[] = [];
    const db: any = { insert: () => ({ values: async (values: any) => lines.push(values) }) };
    return { lines, audit: { db, auditLogs: {}, staff } };
  };

  it('refuses to "succeed" when there is no KV store', async () => {
    await expect(updateAdminSettingsImpl(undefined, { otp_settings: { otp_length: 6 } })).rejects.toMatchObject({ statusCode: 503 });
  });

  it('saves a valid change and writes one audit line with old and new values', async () => {
    const kv = fakeKv();
    const { lines, audit } = makeAudit();

    const result: any = await updateAdminSettingsImpl(kv, { admin_otp_settings: { enable_2fa: false, max_otp_attempts: 8 } }, audit);

    expect(result.success).toBe(true);
    expect(result.changed).toBe(2);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ action: 'update', entityType: 'settings', staffId: 1 });
    expect(JSON.parse(lines[0].oldValues).admin_otp_settings).toMatchObject({ enable_2fa: true, max_otp_attempts: 5 });
    expect(JSON.parse(lines[0].newValues).admin_otp_settings).toMatchObject({ enable_2fa: false, max_otp_attempts: 8 });
  });

  it('writes no audit line when nothing changed', async () => {
    const kv = fakeKv();
    const { lines, audit } = makeAudit();
    await updateAdminSettingsImpl(kv, { otp_settings: { otp_length: 6 } }, audit);
    expect(lines).toHaveLength(0);
  });

  it('refuses a bad value and leaves the saved settings alone', async () => {
    const kv = fakeKv();
    const { lines, audit } = makeAudit();

    await expect(updateAdminSettingsImpl(kv, { admin_otp_settings: { max_otp_attempts: 999 } }, audit)).rejects.toMatchObject({ statusCode: 400 });

    expect(kv.store.has('global_settings')).toBe(false);
    expect(lines).toHaveLength(0);
  });

  it('cannot store an unknown key', async () => {
    const kv = fakeKv();
    await expect(updateAdminSettingsImpl(kv, { evil: { a: 1 } })).rejects.toMatchObject({ statusCode: 400 });
    expect(kv.store.has('global_settings')).toBe(false);
  });
});

describe('describeSettingsChange', () => {
  it('lists only what differs', () => {
    const before = { otp_settings: { a: 1, b: 2 }, admin_otp_settings: { c: 3 } };
    const after = { otp_settings: { a: 1, b: 5 }, admin_otp_settings: { c: 3 } };
    expect(describeSettingsChange(before, after)).toEqual(['otp_settings.b: 2 -> 5']);
  });
});
