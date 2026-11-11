import { describe, it, expect } from 'vitest';
import * as schema from '../../../shared/schema';
import { setUserActiveImpl } from './users';

const tables = { users: schema.users, accounts: schema.accounts, tokens: schema.tokens, auditLogs: schema.auditLogs };
const staff = { id: 7, email: 'staff@example.com', fullname: 'Staff' };

/** Fake drizzle db: findFirst returns `user`; update/delete/insert calls are recorded. */
function makeDb(user: any) {
  const calls = { updates: [] as any[], deletes: [] as any[], inserts: [] as any[] };
  const db: any = {
    query: { users: { findFirst: async () => user } },
    update: (table: any) => ({
      set: (values: any) => ({
        where: async () => {
          calls.updates.push({ table, values });
        }
      })
    }),
    delete: (table: any) => ({
      where: async () => {
        calls.deletes.push({ table });
      }
    }),
    insert: (table: any) => ({
      values: async (values: any) => {
        calls.inserts.push({ table, values });
      }
    })
  };
  return { db, calls };
}

const customer = (isActive: boolean) => ({
  id: 3,
  fullname: 'An',
  accounts: [
    { id: 11, email: 'an@example.com', is_active: isActive },
    { id: 12, email: 'an2@example.com', is_active: isActive }
  ]
});

describe('setUserActiveImpl', () => {
  it('throws 404 when the user is missing or has no accounts', async () => {
    for (const user of [undefined, { id: 3, fullname: 'An', accounts: [] }]) {
      const { db, calls } = makeDb(user);
      await expect(setUserActiveImpl(db, tables, 3, false, '', staff)).rejects.toMatchObject({ statusCode: 404 });
      expect(calls.updates).toHaveLength(0);
      expect(calls.inserts).toHaveLength(0);
    }
  });

  it('lock: sets is_active=false, deletes the tokens and writes an audit log with the reason', async () => {
    const { db, calls } = makeDb(customer(true));
    const result = await setUserActiveImpl(db, tables, 3, false, '  spam bookings  ', staff);

    expect(result).toMatchObject({ status: 'success', is_active: false });
    expect(calls.updates).toHaveLength(1);
    expect(calls.updates[0].table).toBe(schema.accounts);
    expect(calls.updates[0].values.is_active).toBe(false);
    expect(calls.deletes).toHaveLength(1);
    expect(calls.deletes[0].table).toBe(schema.tokens);

    expect(calls.inserts).toHaveLength(1);
    const log = calls.inserts[0].values;
    expect(calls.inserts[0].table).toBe(schema.auditLogs);
    expect(log).toMatchObject({ action: 'lock', entityType: 'user', entityId: '3', staffId: 7 });
    expect(JSON.parse(log.newValues)).toMatchObject({ is_active: false, reason: 'spam bookings' });
  });

  it('unlock: sets is_active=true, keeps the tokens and logs action unlock', async () => {
    const { db, calls } = makeDb(customer(false));
    const result = await setUserActiveImpl(db, tables, 3, true, '', staff);

    expect(result).toMatchObject({ status: 'success', is_active: true });
    expect(calls.updates[0].values.is_active).toBe(true);
    expect(calls.deletes).toHaveLength(0);
    expect(calls.inserts[0].values).toMatchObject({ action: 'unlock', entityType: 'user' });
    expect(JSON.parse(calls.inserts[0].values.newValues).reason).toBeUndefined();
  });
});
