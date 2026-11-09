import { describe, it, expect } from 'vitest';
import * as schema from '../../../shared/schema';
import {
  createVoucherImpl,
  updateVoucherImpl,
  toggleVoucherStatusImpl,
  deleteVoucherImpl,
  restoreVoucherImpl
} from './vouchers';

const tables: any = { vouchers: (schema as any).vouchers, auditLogs: (schema as any).auditLogs };
const staffInfo = { id: 20, email: 'staff@example.com', fullname: 'Staff' };

function voucherRow(branchIds: string | null, overrides: Record<string, any> = {}) {
  return {
    id: 7,
    code: 'SALE10',
    name: 'Sale',
    description: null,
    scope: 'all',
    discount_type: 'percent',
    discount_value: 10,
    min_order_value: 0,
    max_discount: null,
    usage_limit: null,
    per_user_limit: 1,
    is_active: 1,
    valid_from: null,
    valid_until: null,
    applicable_ticket_package_ids: null,
    applicable_user_ids: '[5]',
    branch_ids: branchIds,
    deleted_at: '2026-11-01T00:00:00Z',
    ...overrides
  };
}

/** Fake database: one voucher row; records what is written to the vouchers table. */
function makeDb(row: any) {
  const voucherWrites: Array<{ kind: 'insert' | 'update'; values: any }> = [];
  const db: any = {
    query: { vouchers: { findFirst: async () => row } },
    insert: (table: any) => ({
      values: (values: any) => {
        if (table === tables.vouchers) voucherWrites.push({ kind: 'insert', values });
        const rows = table === tables.vouchers ? [{ id: 99, ...values }] : [];
        return { returning: async () => rows, then: (resolve: any) => Promise.resolve(rows).then(resolve) };
      }
    }),
    update: (table: any) => ({
      set: (values: any) => ({
        where: () => {
          if (table === tables.vouchers) voucherWrites.push({ kind: 'update', values });
          const rows = [{ ...row, ...values }];
          return { returning: async () => rows, then: (resolve: any) => Promise.resolve(rows).then(resolve) };
        }
      })
    })
  };
  return { db, voucherWrites };
}

// Voucher kinds by the branches they are for, and the staff scopes (null = Super Admin, no limit)
const KINDS: Record<string, string | null> = {
  'all branches (null)': null,
  'branch 1 only': '[1]',
  'branches 1 and 2': '[1,2]',
  'branch 3 only': '[3]',
  'no branch ([])': '[]'
};

// Who may change which kind of voucher
const CAN_CHANGE: Record<string, Record<string, boolean>> = {
  'Super Admin': { 'all branches (null)': true, 'branch 1 only': true, 'branches 1 and 2': true, 'branch 3 only': true, 'no branch ([])': true },
  'staff of branch 1': { 'all branches (null)': false, 'branch 1 only': true, 'branches 1 and 2': false, 'branch 3 only': false, 'no branch ([])': false },
  'staff of branches 1 and 2': { 'all branches (null)': false, 'branch 1 only': true, 'branches 1 and 2': true, 'branch 3 only': false, 'no branch ([])': false },
  'staff with no branch': { 'all branches (null)': false, 'branch 1 only': false, 'branches 1 and 2': false, 'branch 3 only': false, 'no branch ([])': false }
};
const SCOPES: Record<string, number[] | null> = {
  'Super Admin': null,
  'staff of branch 1': [1],
  'staff of branches 1 and 2': [1, 2],
  'staff with no branch': []
};

const OPERATIONS: Record<string, (db: any, scope: number[] | null) => Promise<any>> = {
  edit: (db, scope) => updateVoucherImpl(db, tables, 7, { name: 'New name' }, staffInfo, scope),
  toggle: (db, scope) => toggleVoucherStatusImpl(db, tables, 7, staffInfo, scope),
  delete: (db, scope) => deleteVoucherImpl(db, tables, 7, staffInfo, scope),
  restore: (db, scope) => restoreVoucherImpl(db, tables, 7, staffInfo, scope)
};

describe('voucher change rights: staff x voucher kind x operation', () => {
  for (const [operation, run] of Object.entries(OPERATIONS)) {
    for (const [staffName, scope] of Object.entries(SCOPES)) {
      for (const [kindName, branchIds] of Object.entries(KINDS)) {
        const allowed = CAN_CHANGE[staffName][kindName];
        it(`${operation}: ${staffName} ${allowed ? 'can' : 'cannot'} change a voucher for ${kindName}`, async () => {
          const { db, voucherWrites } = makeDb(voucherRow(branchIds));

          const attempt = run(db, scope);

          if (allowed) {
            await expect(attempt).resolves.toBeTruthy();
            expect(voucherWrites.length).toBeGreaterThan(0);
          } else {
            await expect(attempt).rejects.toMatchObject({ statusCode: 403 });
            expect(voucherWrites).toHaveLength(0);
          }
        });
      }
    }
  }
});

const NEW_VOUCHER = { code: 'new10', name: 'New', discount_type: 'percent', discount_value: 10, scope: 'all' };

describe('createVoucherImpl', () => {
  it('Super Admin: all branches when none are sent, or the branches chosen', async () => {
    const all = makeDb(null);
    await createVoucherImpl(all.db, tables, NEW_VOUCHER, staffInfo, null);
    expect(all.voucherWrites[0].values.branch_ids).toBeNull();

    const some = makeDb(null);
    await createVoucherImpl(some.db, tables, { ...NEW_VOUCHER, branch_ids: [1, 2] }, staffInfo, null);
    expect(some.voucherWrites[0].values.branch_ids).toBe('[1,2]');
  });

  it('Super Admin: refuses an empty branch list', async () => {
    const { db, voucherWrites } = makeDb(null);
    await expect(createVoucherImpl(db, tables, { ...NEW_VOUCHER, branch_ids: [] }, staffInfo, null)).rejects.toMatchObject({ statusCode: 400 });
    expect(voucherWrites).toHaveLength(0);
  });

  it('limited staff: saves only for their own branches', async () => {
    const { db, voucherWrites } = makeDb(null);
    await createVoucherImpl(db, tables, { ...NEW_VOUCHER, branch_ids: [2] }, staffInfo, [1, 2]);
    expect(voucherWrites[0].values.branch_ids).toBe('[2]');
  });

  it.each([
    ['no branches sent', undefined, 400],
    ['all branches', null, 403],
    ['an empty list', [], 400],
    ['a branch that is not theirs', [3], 403],
    ['their branch and another', [1, 3], 403]
  ])('limited staff: refuses %s', async (_label, branchIds, status) => {
    const { db, voucherWrites } = makeDb(null);
    await expect(createVoucherImpl(db, tables, { ...NEW_VOUCHER, branch_ids: branchIds }, staffInfo, [1, 2])).rejects.toMatchObject({
      statusCode: status
    });
    expect(voucherWrites).toHaveLength(0);
  });

  it.each([
    ['a negative discount', { discount_value: -10 }],
    ['a zero discount', { discount_value: 0 }],
    ['a text discount', { discount_value: 'abc' }],
    ['a percentage over 100', { discount_value: 150 }],
    ['an unknown discount type', { discount_type: 'bogus' }],
    ['an unknown scope', { scope: 'bogus' }],
    ['a negative usage limit', { usage_limit: -1 }],
    ['a negative minimum order', { min_order_value: -5 }],
    ['an end date before the start date', { valid_from: '2026-12-01', valid_until: '2026-11-01' }],
    ['no code', { code: '  ' }]
  ])('refuses %s with a 400 and saves nothing', async (_label, override) => {
    const { db, voucherWrites } = makeDb(null);
    await expect(createVoucherImpl(db, tables, { ...NEW_VOUCHER, ...override } as any, staffInfo, null)).rejects.toMatchObject({
      statusCode: 400
    });
    expect(voucherWrites).toHaveLength(0);
  });

  it('does not save applicable_user_ids even when it is sent', async () => {
    const { db, voucherWrites } = makeDb(null);
    await createVoucherImpl(db, tables, { ...NEW_VOUCHER, applicable_user_ids: [1, 2] } as any, staffInfo, null);
    expect(voucherWrites[0].values).not.toHaveProperty('applicable_user_ids');
  });
});

describe('updateVoucherImpl', () => {
  it('refuses a change that makes the saved voucher invalid, with the same rules as create', async () => {
    for (const override of [
      { discount_value: -1 },
      { discount_value: NaN },
      { discount_type: 'percent', discount_value: 200 },
      { scope: 'bogus' },
      { usage_limit: -3 },
      { valid_from: '2026-12-01', valid_until: '2026-11-01' }
    ]) {
      const { db, voucherWrites } = makeDb(voucherRow('[1]'));
      await expect(updateVoucherImpl(db, tables, 7, override as any, staffInfo, null)).rejects.toMatchObject({ statusCode: 400 });
      expect(voucherWrites).toHaveLength(0);
    }
  });

  it('checks the result of a partial change: switching to percent with a fixed-sized value is refused', async () => {
    const { db } = makeDb(voucherRow('[1]', { discount_type: 'fixed', discount_value: 50000 }));
    await expect(updateVoucherImpl(db, tables, 7, { discount_type: 'percent' }, staffInfo, null)).rejects.toMatchObject({
      statusCode: 400
    });
  });

  it('accepts a good change and leaves branch_ids alone when it is not sent', async () => {
    const { db, voucherWrites } = makeDb(voucherRow('[1]'));
    await updateVoucherImpl(db, tables, 7, { discount_value: 15 }, staffInfo, [1]);
    expect(voucherWrites[0].values.discount_value).toBe('15');
    expect(voucherWrites[0].values).not.toHaveProperty('branch_ids');
  });

  it('limited staff cannot move a voucher to a branch that is not theirs, or to all branches', async () => {
    for (const branchIds of [[3], null, []]) {
      const { db, voucherWrites } = makeDb(voucherRow('[1]'));
      await expect(updateVoucherImpl(db, tables, 7, { branch_ids: branchIds }, staffInfo, [1])).rejects.toBeTruthy();
      expect(voucherWrites).toHaveLength(0);
    }
  });

  it('the Super Admin can move a voucher to all branches', async () => {
    const { db, voucherWrites } = makeDb(voucherRow('[1]'));
    await updateVoucherImpl(db, tables, 7, { branch_ids: null }, staffInfo, null);
    expect(voucherWrites[0].values.branch_ids).toBeNull();
  });

  it('does not write applicable_user_ids even when it is sent', async () => {
    const { db, voucherWrites } = makeDb(voucherRow('[1]'));
    await updateVoucherImpl(db, tables, 7, { name: 'x', applicable_user_ids: [1] } as any, staffInfo, null);
    expect(voucherWrites[0].values).not.toHaveProperty('applicable_user_ids');
  });
});
