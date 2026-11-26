import { describe, it, expect, beforeEach } from 'vitest';
import * as schema from '../../../shared/schema';
import { makeSqliteDb, insertRows } from '../../test-utils/sqlite-db';
import { listStaffImpl, listDeletedStaffImpl } from './staff-management';
import { staffGetMeImpl } from './staff-auth';

// The staff lists on a real in-memory SQLite database, so the role filter and the columns are really run.

const tables: any = {
  staffs: (schema as any).staffs,
  staffRoles: (schema as any).staffRoles,
  roles: (schema as any).roles,
  staffBranches: (schema as any).staffBranches,
  branches: (schema as any).branches
};

let db: any;
let raw: any;

function staff(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    email: 'staff' + id + '@example.com',
    password: 'hash',
    fullname: 'Staff ' + id,
    avatar: 'data:image/png;base64,AAAA',
    is_super_admin: 0,
    is_active: 1,
    force_password_change: 0,
    created_at: '2026-01-0' + id,
    updated_at: '2026-01-0' + id,
    ...overrides
  };
}

beforeEach(() => {
  ({ db, raw } = makeSqliteDb(['staffs', 'staffRoles', 'roles', 'staffBranches', 'branches', 'rolePermissions', 'permissions']));
  insertRows(raw, 'roles', [
    { id: 1, name: 'Thu ngân', is_system: 0, level: 1, created_at: 'x', updated_at: 'x' },
    { id: 2, name: 'Quản lý', is_system: 0, level: 2, created_at: 'x', updated_at: 'x' }
  ]);
  insertRows(raw, 'branches', [{ id: 1, name: 'CN 1', code: 'CN1', created_at: 'x', updated_at: 'x' }]);
});

describe('staff list', () => {
  it('lists a staff member with two roles once, and counts them once', async () => {
    insertRows(raw, 'staffs', [staff(1), staff(2)]);
    insertRows(raw, 'staffRoles', [
      { staff_id: 1, role_id: 1 },
      { staff_id: 1, role_id: 2 },
      { staff_id: 2, role_id: 1 }
    ]);
    insertRows(raw, 'staffBranches', [{ staff_id: 1, branch_id: 1 }]);

    const result: any = await listStaffImpl(db, tables, { page: 1, pageSize: 20, roleId: 1 });

    expect(result.total).toBe(2);
    expect(result.items.map((item: any) => item.id).sort()).toEqual([1, 2]);
    const first = result.items.find((item: any) => item.id === 1);
    expect(first).toMatchObject({ roleIds: [1, 2], roles: ['Thu ngân', 'Quản lý'], branchIds: [1], branchNames: ['CN 1'] });
    for (const dropped of ['avatar', 'roleCount', 'branches', 'password']) expect(first).not.toHaveProperty(dropped);
  });

  it('filters by role', async () => {
    insertRows(raw, 'staffs', [staff(1), staff(2)]);
    insertRows(raw, 'staffRoles', [
      { staff_id: 1, role_id: 2 },
      { staff_id: 2, role_id: 1 }
    ]);

    const result: any = await listStaffImpl(db, tables, { page: 1, pageSize: 20, roleId: 2 });

    expect(result.total).toBe(1);
    expect(result.items.map((item: any) => item.id)).toEqual([1]);
  });
});

describe('deleted staff list', () => {
  it('sends deleted_at and the role names the screen reads', async () => {
    insertRows(raw, 'staffs', [staff(1), staff(2, { deleted_at: '2026-02-01T00:00:00.000Z', deleted_by_staff_id: 1, is_active: 0 })]);
    insertRows(raw, 'staffRoles', [
      { staff_id: 2, role_id: 1 },
      { staff_id: 2, role_id: 2 }
    ]);

    const result: any = await listDeletedStaffImpl(db, tables, { page: 1, pageSize: 10 });

    expect(result.items).toEqual([
      {
        id: 2,
        email: 'staff2@example.com',
        fullname: 'Staff 2',
        phone: null,
        deleted_at: '2026-02-01T00:00:00.000Z',
        deleted_by_staff_name: 'Staff 1',
        role: 'Thu ngân, Quản lý'
      }
    ]);
  });

  it('gives no role text to a staff member without roles', async () => {
    insertRows(raw, 'staffs', [staff(3, { deleted_at: '2026-02-01T00:00:00.000Z' })]);
    const result: any = await listDeletedStaffImpl(db, tables, { page: 1, pageSize: 10 });
    expect(result.items[0].role).toBeNull();
  });
});

describe('GET /api/admin/auth/me (profile)', () => {
  const meTables = { ...tables, rolePermissions: (schema as any).rolePermissions, permissions: (schema as any).permissions };

  it('returns the branch and role names and only what the profile reads', async () => {
    insertRows(raw, 'branches', [{ id: 2, name: 'CN 2', code: 'CN2', created_at: 'x', updated_at: 'x' }]);
    insertRows(raw, 'staffs', [staff(1)]);
    insertRows(raw, 'staffRoles', [{ staff_id: 1, role_id: 1 }]);
    insertRows(raw, 'staffBranches', [
      { staff_id: 1, branch_id: 1 },
      { staff_id: 1, branch_id: 2 }
    ]);

    const result: any = await staffGetMeImpl(db, meTables, null, 1);

    expect(result).toEqual({
      status: 'success',
      roleNames: ['Thu ngân'],
      branchNames: ['CN 1', 'CN 2'],
      staff: { createdAt: '2026-01-01' }
    });
  });
});
