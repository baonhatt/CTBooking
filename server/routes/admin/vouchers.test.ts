import { describe, it, expect } from 'vitest';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import * as schema from '../../../shared/schema';
import { makeSqliteDb, insertRows } from '../../test-utils/sqlite-db';
import {
  createVoucherImpl,
  updateVoucherImpl,
  toggleVoucherStatusImpl,
  deleteVoucherImpl,
  restoreVoucherImpl,
  getVoucherImpl,
  clampRedemptionLimit,
  voucherStatusCondition,
  buildVoucherOrderBy
} from './vouchers';

const tables: any = { vouchers: (schema as any).vouchers, auditLogs: (schema as any).auditLogs };
const staffInfo = { id: 20, email: 'staff@example.com', fullname: 'Staff' };

const NOW = '2026-11-01T00:00:00.000Z';

// Where a voucher applies: every branch (all_branches = 1), or the listed branches (voucher_branches rows; none = nowhere)
type Scope = { all: boolean; branches: number[] };
const ALL: Scope = { all: true, branches: [] };
const only = (...branches: number[]): Scope => ({ all: false, branches });

function voucherRow(overrides: Record<string, any> = {}) {
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
    used_count: 0,
    is_active: 1,
    valid_from: null,
    valid_until: null,
    all_packages: 1,
    created_at: NOW,
    updated_at: NOW,
    deleted_at: '2026-11-01T00:00:00Z',
    ...overrides
  };
}

const TABLES = ['branches', 'vouchers', 'voucher_branches', 'voucher_packages', 'ticket_packages', 'staffs', 'auditLogs'];

/**
 * A real in-memory SQLite database with branches 1-3, VR packages 4 and 5 (6 is deleted), the staff rows and, when
 * given, voucher 7 with its scope. The
 * vouchers table gets an INTEGER PRIMARY KEY so a created voucher receives an id.
 */
function makeDb(row: Record<string, any> | null, scope: Scope = ALL, staffRows: Array<Record<string, any>> = []) {
  const { db, raw } = makeSqliteDb(TABLES);
  const config = getTableConfig(schema.vouchers);
  const columns = config.columns
    .map((column: any) => '"' + column.name + '" ' + (column.name === 'id' ? 'INTEGER PRIMARY KEY' : column.getSQLType()))
    .join(', ');
  raw.exec('DROP TABLE "vouchers"');
  raw.exec('CREATE TABLE "vouchers" (' + columns + ')');
  insertRows(raw, 'branches', [1, 2, 3].map((id) => ({ id, name: `Branch ${id}`, code: `B${id}`, created_at: NOW, updated_at: NOW })));
  insertRows(raw, 'staffs', staffRows);
  insertRows(
    raw,
    'ticket_packages',
    [4, 5, 6].map((id) => ({
      id,
      name: `VR ${id}`,
      price: 1,
      type: 'vr',
      all_branches: 1,
      movie_scope: 'selected',
      created_at: NOW,
      updated_at: NOW,
      deleted_at: id === 6 ? NOW : null
    }))
  );
  if (row) {
    insertRows(raw, 'vouchers', [{ ...row, all_branches: scope.all ? 1 : 0 }]);
    insertRows(raw, 'voucher_branches', scope.branches.map((branchId) => ({ voucher_id: row.id, branch_id: branchId })));
  }
  return { db, raw, state: () => voucherState(raw) };
}

/** Every voucher with its branch and package links, to see what was written. */
function voucherState(raw: any) {
  const plain = (rows: any[]) => rows.map((item) => ({ ...item }));
  return {
    vouchers: plain(raw.prepare('SELECT * FROM vouchers ORDER BY id').all()),
    branches: plain(raw.prepare('SELECT voucher_id, branch_id FROM voucher_branches ORDER BY voucher_id, branch_id').all()),
    packages: plain(raw.prepare('SELECT voucher_id, package_id FROM voucher_packages ORDER BY voucher_id, package_id').all())
  };
}

/** The one voucher of the database with its branch ids. */
function savedVoucher(raw: any) {
  const state = voucherState(raw);
  expect(state.vouchers).toHaveLength(1);
  const voucher = state.vouchers[0];
  return { ...voucher, branch_ids: state.branches.filter((link) => link.voucher_id === voucher.id).map((link) => link.branch_id) };
}

// Voucher kinds by the branches they are for, and the staff scopes (null = Super Admin, no limit)
const KINDS: Record<string, Scope> = {
  'all branches (null)': ALL,
  'branch 1 only': only(1),
  'branches 1 and 2': only(1, 2),
  'branch 3 only': only(3),
  'no branch ([])': only()
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
      for (const [kindName, kind] of Object.entries(KINDS)) {
        const allowed = CAN_CHANGE[staffName][kindName];
        it(`${operation}: ${staffName} ${allowed ? 'can' : 'cannot'} change a voucher for ${kindName}`, async () => {
          const { db, state } = makeDb(voucherRow(), kind);
          const before = state();

          const attempt = run(db, scope);

          if (allowed) {
            await expect(attempt).resolves.toBeTruthy();
            expect(state()).not.toEqual(before);
          } else {
            await expect(attempt).rejects.toMatchObject({ statusCode: 403 });
            expect(state()).toEqual(before);
          }
        });
      }
    }
  }
});

const NEW_VOUCHER = { code: 'new10', name: 'New', discount_type: 'percent', discount_value: 10, scope: 'all', all_branches: true };

describe('createVoucherImpl', () => {
  it('Super Admin: all branches when chosen, or the branches chosen', async () => {
    const all = makeDb(null);
    await createVoucherImpl(all.db, tables, NEW_VOUCHER, staffInfo, null);
    expect(savedVoucher(all.raw)).toMatchObject({ all_branches: 1, branch_ids: [] });

    const some = makeDb(null);
    await createVoucherImpl(some.db, tables, { ...NEW_VOUCHER, all_branches: false, branch_ids: [1, 2] }, staffInfo, null);
    expect(savedVoucher(some.raw)).toMatchObject({ all_branches: 0, branch_ids: [1, 2] });
  });

  it('Super Admin: an empty branch list saves a voucher offered nowhere (not every branch)', async () => {
    const { db, raw } = makeDb(null);
    await createVoucherImpl(db, tables, { ...NEW_VOUCHER, all_branches: false, branch_ids: [] }, staffInfo, null);
    expect(savedVoucher(raw)).toMatchObject({ all_branches: 0, branch_ids: [] });
  });

  it('Super Admin: refuses a branch that does not exist', async () => {
    const { db, state } = makeDb(null);
    await expect(
      createVoucherImpl(db, tables, { ...NEW_VOUCHER, all_branches: false, branch_ids: [9] }, staffInfo, null)
    ).rejects.toMatchObject({
      statusCode: 400
    });
    expect(state().vouchers).toHaveLength(0);
  });

  it('limited staff: saves only for their own branches', async () => {
    const { db, raw } = makeDb(null);
    await createVoucherImpl(db, tables, { ...NEW_VOUCHER, all_branches: false, branch_ids: [2] }, staffInfo, [1, 2]);
    expect(savedVoucher(raw)).toMatchObject({ all_branches: 0, branch_ids: [2] });
  });

  it.each([
    [null],
    [[1, 2]]
  ])('anyone (restricted to %j): no branch choice sent is refused with 400', async (restrict) => {
    const { db, state } = makeDb(null);
    const { all_branches: _dropped, ...withoutScope } = NEW_VOUCHER;
    await expect(createVoucherImpl(db, tables, withoutScope, staffInfo, restrict)).rejects.toMatchObject({ statusCode: 400 });
    await expect(createVoucherImpl(db, tables, { ...withoutScope, branch_ids: [1] }, staffInfo, restrict)).rejects.toMatchObject({
      statusCode: 400
    });
    expect(state().vouchers).toHaveLength(0);
  });

  it.each([
    ['all branches', { all_branches: true }, 403],
    ['an empty list', { all_branches: false, branch_ids: [] }, 403],
    ['a branch that is not theirs', { all_branches: false, branch_ids: [3] }, 403],
    ['their branch and another', { all_branches: false, branch_ids: [1, 3] }, 403]
  ])('limited staff: refuses %s', async (_label, branchInput, status) => {
    const { db, state } = makeDb(null);
    await expect(createVoucherImpl(db, tables, { ...NEW_VOUCHER, ...branchInput }, staffInfo, [1, 2])).rejects.toMatchObject({
      statusCode: status
    });
    expect(state().vouchers).toHaveLength(0);
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
    const { db, state } = makeDb(null);
    await expect(createVoucherImpl(db, tables, { ...NEW_VOUCHER, ...override } as any, staffInfo, null)).rejects.toMatchObject({
      statusCode: 400
    });
    expect(state().vouchers).toHaveLength(0);
  });

  it('a voucher of one type covers the packages chosen; an empty list is refused; scope "all" covers every package', async () => {
    const chosen = makeDb(null);
    await createVoucherImpl(chosen.db, tables, { ...NEW_VOUCHER, scope: 'vr', all_packages: false, package_ids: [4, 5] } as any, staffInfo, null);
    expect(savedVoucher(chosen.raw).all_packages).toBe(0);
    expect(chosen.state().packages.map((link) => link.package_id)).toEqual([4, 5]);

    const emptyList = makeDb(null);
    await expect(
      createVoucherImpl(emptyList.db, tables, { ...NEW_VOUCHER, scope: 'vr', all_packages: false, package_ids: [] } as any, staffInfo, null)
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(emptyList.state().vouchers).toHaveLength(0);

    const everyPackage = makeDb(null);
    await createVoucherImpl(everyPackage.db, tables, { ...NEW_VOUCHER, scope: 'vr', all_packages: true } as any, staffInfo, null);
    expect(savedVoucher(everyPackage.raw).all_packages).toBe(1);

    const allTypes = makeDb(null);
    await createVoucherImpl(allTypes.db, tables, { ...NEW_VOUCHER, scope: 'all', all_packages: false, package_ids: [4] } as any, staffInfo, null);
    expect(savedVoucher(allTypes.raw).all_packages).toBe(1);
    expect(allTypes.state().packages).toEqual([]);
  });

  it.each([
    ['a package that does not exist', [4, 9]],
    ['a deleted package', [6]]
  ])('refuses %s with a 400 (not a 500) and saves nothing', async (_label, packageIds) => {
    const { db, state } = makeDb(null);
    await expect(
      createVoucherImpl(db, tables, { ...NEW_VOUCHER, scope: 'vr', all_packages: false, package_ids: packageIds } as any, staffInfo, null)
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(state().vouchers).toHaveLength(0);
    expect(state().packages).toHaveLength(0);
  });

  it('a voucher of one type without a package choice is refused with 400', async () => {
    const { db, state } = makeDb(null);
    await expect(createVoucherImpl(db, tables, { ...NEW_VOUCHER, scope: 'vr' } as any, staffInfo, null)).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      createVoucherImpl(db, tables, { ...NEW_VOUCHER, scope: 'vr', package_ids: [] } as any, staffInfo, null)
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(state().vouchers).toHaveLength(0);
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
      const { db, state } = makeDb(voucherRow(), only(1));
      const before = state();
      await expect(updateVoucherImpl(db, tables, 7, override as any, staffInfo, null)).rejects.toMatchObject({ statusCode: 400 });
      expect(state()).toEqual(before);
    }
  });

  it('checks the result of a partial change: switching to percent with a fixed-sized value is refused', async () => {
    const { db } = makeDb(voucherRow({ discount_type: 'fixed', discount_value: 50000 }), only(1));
    await expect(updateVoucherImpl(db, tables, 7, { discount_type: 'percent' }, staffInfo, null)).rejects.toMatchObject({
      statusCode: 400
    });
  });

  it('accepts a good change and leaves the branches alone when they are not sent', async () => {
    const { db, raw } = makeDb(voucherRow(), only(1));
    await updateVoucherImpl(db, tables, 7, { discount_value: 15 }, staffInfo, [1]);
    expect(savedVoucher(raw)).toMatchObject({ discount_value: 15, all_branches: 0, branch_ids: [1] });
  });

  it('limited staff cannot move a voucher to a branch that is not theirs, to all branches, or to no branch', async () => {
    for (const branchInput of [{ all_branches: false, branch_ids: [3] }, { all_branches: true }, { all_branches: false, branch_ids: [] }]) {
      const { db, state } = makeDb(voucherRow(), only(1));
      const before = state();
      await expect(updateVoucherImpl(db, tables, 7, branchInput, staffInfo, [1])).rejects.toBeTruthy();
      expect(state()).toEqual(before);
    }
  });

  it('the Super Admin can move a voucher to all branches', async () => {
    const { db, raw } = makeDb(voucherRow(), only(1));
    await updateVoucherImpl(db, tables, 7, { all_branches: true }, staffInfo, null);
    expect(savedVoucher(raw)).toMatchObject({ all_branches: 1, branch_ids: [] });
  });

  it('a change to a package that does not exist or is deleted is refused with 400 and changes nothing', async () => {
    // [] = a voucher limited to packages with no package at all (QĐ 16): refused too
    for (const packageIds of [[9], [4, 6], []]) {
      const { db, state } = makeDb(voucherRow({ scope: 'vr', all_packages: 0 }), only(1));
      const before = state();
      await expect(
        updateVoucherImpl(db, tables, 7, { all_packages: false, package_ids: packageIds } as any, staffInfo, null)
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(state()).toEqual(before);
    }
  });

  it('a change of packages replaces the old ones', async () => {
    const { db, raw, state } = makeDb(voucherRow({ scope: 'vr', all_packages: 1 }), only(1));
    await updateVoucherImpl(db, tables, 7, { all_packages: false, package_ids: [5, 4] } as any, staffInfo, null);
    expect(state().packages).toEqual([
      { voucher_id: 7, package_id: 4 },
      { voucher_id: 7, package_id: 5 }
    ]);
    expect(savedVoucher(raw).all_packages).toBe(0);
  });

  it('a list of branches replaces the old one', async () => {
    const { db, raw } = makeDb(voucherRow(), only(1, 3));
    await updateVoucherImpl(db, tables, 7, { all_branches: false, branch_ids: [2, 3] }, staffInfo, null);
    expect(savedVoucher(raw)).toMatchObject({ all_branches: 0, branch_ids: [2, 3] });
  });
});

describe('max_discount: empty means no cap', () => {
  it.each([
    ['null', null],
    ['an empty text', ''],
    ['not sent', undefined]
  ])('create with %s saves null, not "0"', async (_label, maxDiscount) => {
    const { db, raw } = makeDb(null);
    await createVoucherImpl(db, tables, { ...NEW_VOUCHER, max_discount: maxDiscount as any }, staffInfo, null);
    expect(savedVoucher(raw).max_discount).toBeNull();
  });

  it('create with a number keeps it, update with null clears it', async () => {
    const created = makeDb(null);
    await createVoucherImpl(created.db, tables, { ...NEW_VOUCHER, max_discount: 50000 }, staffInfo, null);
    expect(savedVoucher(created.raw).max_discount).toBe(50000);

    const updated = makeDb(voucherRow({ max_discount: 50000 }), only(1));
    await updateVoucherImpl(updated.db, tables, 7, { max_discount: null }, staffInfo, null);
    expect(savedVoucher(updated.raw).max_discount).toBeNull();
  });
});

describe('voucher list filters and order', () => {
  it('knows the four status filters and ignores anything else', () => {
    const vouchers = (schema as any).vouchers;
    for (const status of ['expired', 'upcoming', 'out_of_quota', 'low_quota']) {
      expect(voucherStatusCondition(vouchers, status)).not.toBeNull();
    }
    expect(voucherStatusCondition(vouchers, 'all')).toBeNull();
    expect(voucherStatusCondition(vouchers, "x'; DROP TABLE vouchers;--")).toBeNull();
    expect(voucherStatusCondition(vouchers, undefined)).toBeNull();
  });

  it('sorts by the chosen column, newest first by default, and ignores unknown columns', () => {
    const vouchers = (schema as any).vouchers;
    expect(buildVoucherOrderBy(vouchers)).toHaveLength(2);
    expect(buildVoucherOrderBy(vouchers, 'password', 'asc')).toHaveLength(2);
    const chosen = buildVoucherOrderBy(vouchers, 'used_count', 'asc');
    expect(chosen).toHaveLength(2);
    expect(chosen[0]).not.toBe(buildVoucherOrderBy(vouchers)[0]);
  });
});

describe('voucher detail: redemption history', () => {
  it('limits the redemptions (default 20, at most 200) and gives the booking code instead of the booking relation', async () => {
    expect(clampRedemptionLimit(undefined)).toBe(20);
    expect(clampRedemptionLimit('abc')).toBe(20);
    expect(clampRedemptionLimit(0)).toBe(20);
    expect(clampRedemptionLimit(100)).toBe(100);
    expect(clampRedemptionLimit(5000)).toBe(200);

    let askedLimit = 0;
    let askedColumns: any = null;
    const db: any = {
      query: {
        // A voucher of every branch and every package: its scope needs no link rows
        vouchers: { findFirst: async () => voucherRow({ all_branches: 1, all_packages: 1 }) },
        voucher_redemption_logs: {
          findMany: async (options: any) => {
            askedLimit = options.limit;
            askedColumns = options.columns;
            return [
              { id: 1, redeemed_at: '2026-11-01', discount_amount_applied: 10000, booking: { booking_code: 'CT123' } },
              { id: 2, redeemed_at: '2026-11-02', discount_amount_applied: 5000, booking: null }
            ];
          }
        }
      },
      // The redemption count (awaited right after where) and the audit-log lookups (where -> orderBy -> limit)
      select: () => ({
        from: () => ({
          where: () => Object.assign(Promise.resolve([{ count: 2 }]), { orderBy: () => ({ limit: async () => [] }) })
        })
      })
    };
    const detailTables: any = { ...tables, voucher_redemption_logs: (schema as any).voucher_redemption_logs };

    const detail = await getVoucherImpl(db, detailTables, 7, null, 100);

    expect(askedLimit).toBe(100);
    expect(detail.recent_redemptions.map((row: any) => row.booking_code)).toEqual(['CT123', null]);
    expect(detail.recent_redemptions[0]).not.toHaveProperty('booking');
    // Only what the history table shows: no customer, staff or order totals
    expect(askedColumns).toEqual({ id: true, redeemed_at: true, discount_amount_applied: true });
    expect(detail.recent_redemptions[0]).toEqual({
      id: 1,
      booking_code: 'CT123',
      redeemed_at: '2026-11-01',
      discount_amount_applied: 10000
    });
  });
});

describe('100% vouchers (test vouchers)', () => {
  const FULL = { ...NEW_VOUCHER, discount_type: 'percent', discount_value: 100, all_branches: false, branch_ids: [1] };
  const withStaff = (staff: { id: number; isSuperAdmin: boolean; isActive: boolean } | undefined) =>
    makeDb(
      null,
      ALL,
      staff
        ? [
            {
              id: staff.id,
              email: `staff${staff.id}@example.com`,
              password: 'x',
              fullname: 'Sales',
              is_super_admin: staff.isSuperAdmin,
              is_active: staff.isActive,
              created_at: NOW,
              updated_at: NOW
            }
          ]
        : []
    );

  it('a Super Admin may save one when its Sales person is a Super Admin', async () => {
    const { db, state } = withStaff({ id: 1, isSuperAdmin: true, isActive: true });
    await createVoucherImpl(db, tables, { ...FULL, sale_staff_id: 1 }, staffInfo, null);
    expect(state().vouchers).toHaveLength(1);
  });

  it('refused when the Sales person is not a Super Admin, or nobody is set', async () => {
    for (const [staff, saleId] of [[{ id: 7, isSuperAdmin: false, isActive: true }, 7], [undefined, undefined]] as any) {
      const { db, state } = withStaff(staff);
      await expect(createVoucherImpl(db, tables, { ...FULL, sale_staff_id: saleId }, staffInfo, null)).rejects.toMatchObject({
        statusCode: 403
      });
      expect(state().vouchers).toHaveLength(0);
    }
  });

  it('a branch manager can never save one, even naming a Super Admin as Sales', async () => {
    const { db, state } = withStaff({ id: 1, isSuperAdmin: true, isActive: true });
    await expect(createVoucherImpl(db, tables, { ...FULL, sale_staff_id: 1 }, staffInfo, [1])).rejects.toMatchObject({
      statusCode: 403
    });
    expect(state().vouchers).toHaveLength(0);
  });

  it('a 50% voucher needs nothing special', async () => {
    const { db, state } = withStaff(undefined);
    await createVoucherImpl(db, tables, { ...FULL, discount_value: 50 }, staffInfo, [1]);
    expect(state().vouchers).toHaveLength(1);
  });
});
