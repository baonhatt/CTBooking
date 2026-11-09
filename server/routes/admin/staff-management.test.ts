import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { SQLiteSyncDialect } from 'drizzle-orm/sqlite-core';
import * as schema from '../../../shared/schema';
import {
  createStaffImpl,
  deleteStaffImpl,
  getStaffByIdImpl,
  listStaffImpl,
  resetStaffPasswordImpl,
  restoreStaffImpl,
  updateStaffImpl
} from './staff-management';
import { logAuditAction } from '../../lib/audit-logger';

vi.mock('../../lib/audit-logger', () => ({
  logAuditAction: vi.fn(async () => undefined)
}));

const { staffs, staffRoles, staffBranches, staffTokens, accounts, auditLogs, roles, branches } = schema as any;
const tables = { staffs, staffRoles, staffBranches, staffTokens, auditLogs, roles, branches };

/** Rows returned for each table. A query ends with `await` or `limit()`; both read the rows of the `from()` table. */
function makeDb(rowsByTable: Map<any, any[]>) {
  const updated: Array<{ table: any; values: any }> = [];
  const inserted: Array<{ table: any; values: any }> = [];
  const deleted: any[] = [];
  const whereArguments: any[] = [];

  const selectFrom = (table: any) => {
    const rows = () => rowsByTable.get(table) ?? [];
    const chain: any = {
      where: (condition: any) => {
        whereArguments.push(condition);
        return chain;
      },
      limit: () => chain,
      offset: () => chain,
      innerJoin: () => chain,
      leftJoin: () => chain,
      groupBy: () => chain,
      orderBy: () => chain,
      then: (resolve: any, reject: any) => Promise.resolve(rows()).then(resolve, reject)
    };
    return chain;
  };

  const db: any = {
    select: () => ({ from: selectFrom }),
    insert: (table: any) => ({
      values: (values: any) => {
        inserted.push({ table, values });
        const result: any = {
          returning: async () => [{ id: 500, ...values }],
          then: (resolve: any, reject: any) => Promise.resolve(undefined).then(resolve, reject)
        };
        return result;
      }
    }),
    update: (table: any) => ({
      set: (values: any) => ({
        where: async () => {
          updated.push({ table, values });
        }
      })
    }),
    delete: (table: any) => ({
      where: async () => {
        deleted.push(table);
      }
    })
  };
  return { db, updated, inserted, deleted, whereArguments };
}

const SUPER_ADMIN = { id: 1, email: 'root@example.com', fullname: 'Root', isSuperAdmin: true, branchIds: [] as number[] };
const MANAGER_A = { id: 20, email: 'manager-a@example.com', fullname: 'Manager A', isSuperAdmin: false, branchIds: [1] };

function staffRow(overrides: Record<string, any> = {}) {
  return {
    id: 30,
    email: 'staff@example.com',
    fullname: 'Staff',
    password: 'stored-hash',
    isActive: true,
    isSuperAdmin: false,
    deletedAt: null,
    ...overrides
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('resetStaffPasswordImpl', () => {
  it('refuses anyone who is not the Super Admin', async () => {
    const { db, updated } = makeDb(new Map([[staffs, [staffRow()]]]));

    const result: any = await resetStaffPasswordImpl(db, tables, null, 30, MANAGER_A);

    expect(result.status).toBe('error');
    expect(result.code).toBe('forbidden');
    expect(updated).toHaveLength(0);
  });

  it('refuses a call with no caller at all', async () => {
    const { db, updated } = makeDb(new Map([[staffs, [staffRow()]]]));
    const result: any = await resetStaffPasswordImpl(db, tables, null, 30, undefined);
    expect(result.code).toBe('forbidden');
    expect(updated).toHaveLength(0);
  });

  it('does not let the Super Admin reset their own password here', async () => {
    const { db, updated } = makeDb(new Map([[staffs, [staffRow({ id: 1, isSuperAdmin: true })]]]));
    const result: any = await resetStaffPasswordImpl(db, tables, null, 1, SUPER_ADMIN);
    expect(result.status).toBe('error');
    expect(updated).toHaveLength(0);
  });

  it('does not reset a deleted staff member or one that does not exist', async () => {
    const deletedStaff = makeDb(new Map([[staffs, [staffRow({ deletedAt: '2026-01-01T00:00:00.000Z' })]]]));
    const missing = makeDb(new Map());

    expect(((await resetStaffPasswordImpl(deletedStaff.db, tables, null, 30, SUPER_ADMIN)) as any).status).toBe('error');
    expect(((await resetStaffPasswordImpl(missing.db, tables, null, 30, SUPER_ADMIN)) as any).status).toBe('error');
  });

  it('generates the password, stores only its hash, forces a change and revokes sessions', async () => {
    const { db, updated } = makeDb(new Map([[staffs, [staffRow()]]]));

    const result: any = await resetStaffPasswordImpl(db, tables, null, 30, SUPER_ADMIN);

    expect(result.status).toBe('success');
    expect(typeof result.generated_password).toBe('string');
    expect(result.generated_password.length).toBeGreaterThanOrEqual(12);

    const staffUpdate = updated.find((entry) => entry.table === staffs)!;
    expect(staffUpdate.values.forcePasswordChange).toBe(true);
    expect(staffUpdate.values.password).not.toBe(result.generated_password);
    expect(await bcrypt.compare(result.generated_password, staffUpdate.values.password)).toBe(true);

    const tokenUpdate = updated.find((entry) => entry.table === staffTokens)!;
    expect(tokenUpdate.values.revokeReason).toBe('password_reset');
  });

  it('records the Super Admin as the actor and never writes the password to the audit log', async () => {
    const { db } = makeDb(new Map([[staffs, [staffRow()]]]));

    const result: any = await resetStaffPasswordImpl(db, tables, null, 30, SUPER_ADMIN);

    const auditCall = (logAuditAction as any).mock.calls[0];
    expect(auditCall[2]).toBe('reset_password');
    expect(auditCall[6]).toBe(SUPER_ADMIN.id);
    expect(auditCall[7]).toBe(SUPER_ADMIN.email);
    // Argument 1 is the drizzle table (circular), so look at the descriptive arguments only
    expect(JSON.stringify(auditCall.slice(2))).not.toContain(result.generated_password);
  });
});

describe('createStaffImpl', () => {
  it('returns a generated password once and stores only its hash', async () => {
    const { db, inserted } = makeDb(new Map());

    const result: any = await createStaffImpl(
      db,
      tables,
      null,
      { email: 'new@example.com', fullname: 'New', branchIds: [1] },
      MANAGER_A
    );

    expect(result.status).toBe('success');
    const staffInsert = inserted.find((entry) => entry.table === staffs)!;
    expect(staffInsert.values.forcePasswordChange).toBe(true);
    expect(staffInsert.values.password).not.toBe(result.generated_password);
    expect(await bcrypt.compare(result.generated_password, staffInsert.values.password)).toBe(true);
    expect(JSON.stringify((logAuditAction as any).mock.calls[0].slice(2))).not.toContain(result.generated_password);
  });

  it('ignores a password sent by the caller', async () => {
    const { db, inserted } = makeDb(new Map());

    const result: any = await createStaffImpl(
      db,
      tables,
      null,
      { email: 'new@example.com', fullname: 'New', branchIds: [1], password: 'Chosen-by-caller-1', forcePasswordChange: false } as any,
      MANAGER_A
    );

    const staffInsert = inserted.find((entry) => entry.table === staffs)!;
    expect(await bcrypt.compare('Chosen-by-caller-1', staffInsert.values.password)).toBe(false);
    expect(staffInsert.values.forcePasswordChange).toBe(true);
    expect(result.generated_password).not.toBe('Chosen-by-caller-1');
  });

  it('does not let a non-Super Admin assign roles or branches outside their own', async () => {
    const withRole = makeDb(new Map());
    const withOtherBranch = makeDb(new Map());

    const roleResult: any = await createStaffImpl(
      withRole.db,
      tables,
      null,
      { email: 'a@example.com', fullname: 'A', roleIds: [3], branchIds: [1] },
      MANAGER_A
    );
    const branchResult: any = await createStaffImpl(
      withOtherBranch.db,
      tables,
      null,
      { email: 'b@example.com', fullname: 'B', branchIds: [2] },
      MANAGER_A
    );

    expect(roleResult.status).toBe('error');
    expect(branchResult.status).toBe('error');
    expect(withRole.inserted).toHaveLength(0);
    expect(withOtherBranch.inserted).toHaveLength(0);
  });

  it('only lets the Super Admin reactivate a deleted account', async () => {
    const deletedRow = staffRow({ deletedAt: '2026-01-01T00:00:00.000Z', isActive: false });
    const byManager = makeDb(new Map([[staffs, [deletedRow]]]));
    const bySuper = makeDb(new Map([[staffs, [deletedRow]]]));

    const managerResult: any = await createStaffImpl(
      byManager.db,
      tables,
      null,
      { email: 'staff@example.com', fullname: 'Staff', branchIds: [1] },
      MANAGER_A
    );
    const superResult: any = await createStaffImpl(
      bySuper.db,
      tables,
      null,
      { email: 'staff@example.com', fullname: 'Staff', branchIds: [1] },
      SUPER_ADMIN
    );

    expect(managerResult.code).toBe('forbidden');
    expect(byManager.updated).toHaveLength(0);
    expect(superResult.status).toBe('success');
  });
});

describe('updateStaffImpl scope', () => {
  const target = staffRow();

  it('lets a manager edit staff who work only at the manager\'s branch', async () => {
    const { db, updated } = makeDb(new Map<any, any[]>([[staffs, [target]], [staffBranches, [{ branchId: 1 }]]]));

    const result: any = await updateStaffImpl(db, tables, null, 30, { fullname: 'Renamed' }, MANAGER_A);

    expect(result.status).toBe('success');
    expect(updated.some((entry) => entry.table === staffs && entry.values.fullname === 'Renamed')).toBe(true);
  });

  it('refuses staff at another branch', async () => {
    const { db, updated } = makeDb(new Map<any, any[]>([[staffs, [target]], [staffBranches, [{ branchId: 2 }]]]));

    const result: any = await updateStaffImpl(db, tables, null, 30, { fullname: 'Renamed' }, MANAGER_A);

    expect(result.code).toBe('forbidden');
    expect(updated).toHaveLength(0);
  });

  it('refuses staff who also work at a branch the manager does not manage', async () => {
    const { db, updated } = makeDb(
      new Map<any, any[]>([[staffs, [target]], [staffBranches, [{ branchId: 1 }, { branchId: 2 }]]])
    );

    const result: any = await updateStaffImpl(db, tables, null, 30, { fullname: 'Renamed' }, MANAGER_A);

    expect(result.code).toBe('forbidden');
    expect(updated).toHaveLength(0);
  });

  it('lets the Super Admin edit staff who work at several branches', async () => {
    const { db } = makeDb(new Map<any, any[]>([[staffs, [target]], [staffBranches, [{ branchId: 1 }, { branchId: 2 }]]]));

    const result: any = await updateStaffImpl(db, tables, null, 30, { fullname: 'Renamed' }, SUPER_ADMIN);

    expect(result.status).toBe('success');
  });

  it('refuses a manager who has no branch', async () => {
    const { db } = makeDb(new Map<any, any[]>([[staffs, [target]], [staffBranches, [{ branchId: 1 }]]]));

    const result: any = await updateStaffImpl(
      db,
      tables,
      null,
      30,
      { fullname: 'Renamed' },
      { ...MANAGER_A, branchIds: [] }
    );

    expect(result.code).toBe('forbidden');
  });

  it('does not let a non-Super Admin change someone else\'s email, even inside their branch', async () => {
    const { db, updated } = makeDb(new Map<any, any[]>([[staffs, [target]], [staffBranches, [{ branchId: 1 }]]]));

    const result: any = await updateStaffImpl(db, tables, null, 30, { email: 'attacker@example.com' }, MANAGER_A);

    expect(result.status).toBe('error');
    expect(result.message).toMatch(/Super Admin/);
    expect(updated).toHaveLength(0);
  });

  it('accepts an unchanged email, because the edit form always sends it', async () => {
    const { db } = makeDb(new Map<any, any[]>([[staffs, [target]], [staffBranches, [{ branchId: 1 }]]]));

    const result: any = await updateStaffImpl(
      db,
      tables,
      null,
      30,
      { email: target.email, fullname: 'Renamed' },
      MANAGER_A
    );

    expect(result.status).toBe('success');
  });

  it('does not let anyone deactivate their own account', async () => {
    const own = staffRow({ id: 20 });
    const { db, updated } = makeDb(new Map<any, any[]>([[staffs, [own]], [staffBranches, [{ branchId: 1 }]]]));

    const result: any = await updateStaffImpl(db, tables, null, 20, { isActive: false }, MANAGER_A);

    expect(result.status).toBe('error');
    expect(updated).toHaveLength(0);
  });

  it('does not edit a Super Admin or a deleted staff member', async () => {
    const superTarget = makeDb(new Map<any, any[]>([[staffs, [staffRow({ isSuperAdmin: true })]]]));
    const deletedTarget = makeDb(
      new Map<any, any[]>([[staffs, [staffRow({ deletedAt: '2026-01-01T00:00:00.000Z' })]], [staffBranches, [{ branchId: 1 }]]])
    );

    expect(((await updateStaffImpl(superTarget.db, tables, null, 30, { fullname: 'X' }, SUPER_ADMIN)) as any).status).toBe('error');
    expect(((await updateStaffImpl(deletedTarget.db, tables, null, 30, { fullname: 'X' }, SUPER_ADMIN)) as any).status).toBe('error');
  });
});

describe('deleteStaffImpl and restoreStaffImpl', () => {
  it('delete: refuses to delete yourself', async () => {
    const { db, updated } = makeDb(new Map<any, any[]>([[staffs, [staffRow({ id: 20 })]], [staffBranches, [{ branchId: 1 }]]]));
    const result: any = await deleteStaffImpl(db, tables, 20, MANAGER_A);
    expect(result.status).toBe('error');
    expect(updated).toHaveLength(0);
  });

  it('delete: refuses staff outside the manager scope and allows staff inside it', async () => {
    const outside = makeDb(new Map<any, any[]>([[staffs, [staffRow()]], [staffBranches, [{ branchId: 2 }]]]));
    const inside = makeDb(new Map<any, any[]>([[staffs, [staffRow()]], [staffBranches, [{ branchId: 1 }]]]));

    const refused: any = await deleteStaffImpl(outside.db, tables, 30, MANAGER_A);
    const allowed: any = await deleteStaffImpl(inside.db, tables, 30, MANAGER_A);

    expect(refused.code).toBe('forbidden');
    expect(outside.updated).toHaveLength(0);
    expect(allowed.status).toBe('success');
    expect(inside.updated[0].values.isActive).toBe(false);
    expect(inside.updated[0].values.deleted_by_staff_id).toBe(MANAGER_A.id);
  });

  it('delete: refuses a staff member who is already deleted', async () => {
    const { db } = makeDb(
      new Map<any, any[]>([[staffs, [staffRow({ deletedAt: '2026-01-01T00:00:00.000Z' })]], [staffBranches, [{ branchId: 1 }]]])
    );
    const result: any = await deleteStaffImpl(db, tables, 30, SUPER_ADMIN);
    expect(result.status).toBe('error');
  });

  it('restore: only restores a staff member who is actually deleted', async () => {
    const { db, updated } = makeDb(new Map<any, any[]>([[staffs, [staffRow()]], [staffBranches, [{ branchId: 1 }]]]));
    const result: any = await restoreStaffImpl(db, tables, 30, SUPER_ADMIN);
    expect(result.status).toBe('error');
    expect(updated).toHaveLength(0);
  });

  it('restore: applies the branch scope for a manager', async () => {
    const deletedRow = staffRow({ deletedAt: '2026-01-01T00:00:00.000Z', isActive: false });
    const outside = makeDb(new Map<any, any[]>([[staffs, [deletedRow]], [staffBranches, [{ branchId: 2 }]]]));
    const inside = makeDb(new Map<any, any[]>([[staffs, [deletedRow]], [staffBranches, [{ branchId: 1 }]]]));

    const refused: any = await restoreStaffImpl(outside.db, tables, 30, MANAGER_A);
    const allowed: any = await restoreStaffImpl(inside.db, tables, 30, MANAGER_A);

    expect(refused.code).toBe('forbidden');
    expect(allowed.status).toBe('success');
    expect(inside.updated[0].values).toMatchObject({ isActive: true, deletedAt: null });
  });
});

describe('getStaffByIdImpl', () => {
  it('never returns the password hash', async () => {
    const { db } = makeDb(new Map<any, any[]>([[staffs, [staffRow()]]]));

    const result: any = await getStaffByIdImpl(db, tables, 30, SUPER_ADMIN);

    expect(result.status).toBe('success');
    expect(result.staff).not.toHaveProperty('password');
    expect(JSON.stringify(result)).not.toContain('stored-hash');
  });

  it('works when the audit table is not passed', async () => {
    const { db } = makeDb(new Map<any, any[]>([[staffs, [staffRow()]]]));
    const { auditLogs: _omitted, ...tablesWithoutAudit } = tables;

    const result: any = await getStaffByIdImpl(db, tablesWithoutAudit, 30, SUPER_ADMIN);

    expect(result.status).toBe('success');
    expect(result.staff.created_by_staff_name).toBeNull();
  });

  it('answers "not found" for staff outside the caller scope, so their existence is not revealed', async () => {
    const outside = makeDb(new Map<any, any[]>([[staffs, [staffRow()]], [staffBranches, [{ branchId: 2 }]]]));
    const missing = makeDb(new Map());

    const hidden: any = await getStaffByIdImpl(outside.db, tables, 30, MANAGER_A);
    const absent: any = await getStaffByIdImpl(missing.db, tables, 30, MANAGER_A);

    expect(hidden).toEqual(absent);
  });

  it('hides a Super Admin and deleted staff from a manager', async () => {
    const superTarget = makeDb(
      new Map<any, any[]>([[staffs, [staffRow({ isSuperAdmin: true })]], [staffBranches, [{ branchId: 1 }]]])
    );
    const deletedTarget = makeDb(
      new Map<any, any[]>([[staffs, [staffRow({ deletedAt: '2026-01-01T00:00:00.000Z' })]], [staffBranches, [{ branchId: 1 }]]])
    );

    expect(((await getStaffByIdImpl(superTarget.db, tables, 30, MANAGER_A)) as any).status).toBe('error');
    expect(((await getStaffByIdImpl(deletedTarget.db, tables, 30, MANAGER_A)) as any).status).toBe('error');
  });

  it('shows a manager staff who share one of their branches', async () => {
    const { db } = makeDb(new Map<any, any[]>([[staffs, [staffRow()]], [staffBranches, [{ branchId: 1 }, { branchId: 2 }]]]));
    const result: any = await getStaffByIdImpl(db, tables, 30, MANAGER_A);
    expect(result.status).toBe('success');
  });
});

describe('listStaffImpl branch restriction', () => {
  const dialect = new SQLiteSyncDialect();
  const renderedFirstWhere = (whereArguments: any[]) => dialect.sqlToQuery(whereArguments[0]).sql;

  it('shows nobody to a caller who has no branch', async () => {
    const { db, whereArguments } = makeDb(new Map());

    await listStaffImpl(db, tables, { page: 1, pageSize: 20, restrictToBranchIds: [] });

    expect(renderedFirstWhere(whereArguments)).toContain('1 = 0');
  });

  it('adds no restriction for the Super Admin (null)', async () => {
    const { db, whereArguments } = makeDb(new Map());

    await listStaffImpl(db, tables, { page: 1, pageSize: 20, restrictToBranchIds: null });

    expect(renderedFirstWhere(whereArguments)).not.toContain('1 = 0');
  });
});
