import { describe, it, expect } from 'vitest';
import * as schema from '../../../shared/schema';
import { createRoleImpl, updateRoleImpl, deleteRoleImpl, restoreRoleImpl } from './roles';

const tables: any = {
  roles: (schema as any).roles,
  rolePermissions: (schema as any).rolePermissions,
  permissions: (schema as any).permissions,
  staffRoles: (schema as any).staffRoles,
  auditLogs: (schema as any).auditLogs
};

const superAdmin = { id: 1, email: 'root@example.com', fullname: 'Root', isSuperAdmin: true };
const plainAdmin = { id: 2, email: 'admin@example.com', fullname: 'Admin', isSuperAdmin: false };

const PERMISSION_ROWS = [
  { id: 1, module: 'movies', action: 'view' },
  { id: 2, module: 'movies', action: 'edit' },
  { id: 3, module: 'dashboard', action: 'view' }
];

// Minimal drizzle stand-in: reads give the rows prepared for that table, writes are recorded
function makeDb(rowsByTable: Map<any, any[]>) {
  const inserted: { table: any; values: any }[] = [];
  const updated: { table: any; values: any }[] = [];
  const readChain = (table: any) => {
    const chain: any = {
      where: () => chain,
      limit: () => chain,
      orderBy: () => chain,
      then: (resolve: any, reject: any) => Promise.resolve(rowsByTable.get(table) || []).then(resolve, reject)
    };
    return chain;
  };
  const db: any = {
    select: () => ({ from: (table: any) => readChain(table) }),
    insert: (table: any) => ({
      values: (values: any) => {
        inserted.push({ table, values });
        const result = Promise.resolve([{ id: 99, ...values }]);
        return Object.assign(result, { returning: () => result });
      }
    }),
    update: (table: any) => ({
      set: (values: any) => {
        updated.push({ table, values });
        return { where: () => Promise.resolve() };
      }
    }),
    delete: () => ({ where: () => Promise.resolve() })
  };
  return { db, inserted, updated };
}

function permissionsGranted(inserted: { table: any; values: any }[]): number[] {
  return inserted.filter((item) => item.table === tables.rolePermissions).map((item) => item.values.permissionId);
}

describe('only the Super Admin manages roles', () => {
  it('refuses create, update, delete and restore for anyone else', async () => {
    const { db } = makeDb(new Map());
    const created = await createRoleImpl(db, tables, { name: 'X', description: '', level: 0, permissionIds: [] }, plainAdmin);
    const changed = await updateRoleImpl(db, tables, 5, { name: 'Y' }, plainAdmin);
    const deleted = await deleteRoleImpl(db, tables, 5, plainAdmin);
    const restored = await restoreRoleImpl(db, tables, 5, plainAdmin);
    for (const result of [created, changed, deleted, restored]) {
      expect(result.status).toBe('error');
      expect(result.message).toContain('Super Admin');
    }
  });
});

describe('createRoleImpl', () => {
  it('rejects an empty name, a level outside 0-2 and unknown permission ids', async () => {
    const { db } = makeDb(new Map([[tables.permissions, PERMISSION_ROWS]]));
    const emptyName = await createRoleImpl(db, tables, { name: '  ', description: '', level: 0, permissionIds: [] }, superAdmin);
    const badLevel = await createRoleImpl(db, tables, { name: 'A', description: '', level: 10, permissionIds: [] }, superAdmin);
    const unknownId = await createRoleImpl(db, tables, { name: 'A', description: '', level: 0, permissionIds: [404] }, superAdmin);
    expect(emptyName.status).toBe('error');
    expect(badLevel.status).toBe('error');
    expect(unknownId.message).toBe('Có quyền không tồn tại');
  });

  it('adds "view" when only "edit" is posted, and drops duplicates', async () => {
    const { db, inserted } = makeDb(new Map([[tables.permissions, PERMISSION_ROWS]]));
    const result = await createRoleImpl(db, tables, { name: 'Editor', description: '', level: 0, permissionIds: [2, 2] }, superAdmin);
    expect(result.status).toBe('success');
    expect(permissionsGranted(inserted).sort()).toEqual([1, 2]);
  });
});

describe('updateRoleImpl', () => {
  const systemRole = { id: 3, name: 'admin', description: 'x', isSystem: true, level: 2 };
  const oldRole = { id: 8, name: 'T-OLD', description: 'x', isSystem: false, level: 10 };

  it('does not rename a system role', async () => {
    const { db } = makeDb(new Map<any, any[]>([[tables.roles, [systemRole]], [tables.permissions, PERMISSION_ROWS]]));
    const result = await updateRoleImpl(db, tables, 3, { name: 'boss' }, superAdmin);
    expect(result.message).toBe('Không thể đổi tên vai trò hệ thống');
  });

  it('keeps an old level outside 0-2 but refuses to move to one', async () => {
    const keep = makeDb(new Map<any, any[]>([[tables.roles, [oldRole]], [tables.permissions, PERMISSION_ROWS]]));
    expect((await updateRoleImpl(keep.db, tables, 8, { level: 10 }, superAdmin)).status).toBe('success');
    const move = makeDb(new Map<any, any[]>([[tables.roles, [oldRole]], [tables.permissions, PERMISSION_ROWS]]));
    expect((await updateRoleImpl(move.db, tables, 8, { level: 7 }, superAdmin)).status).toBe('error');
  });

  it('clears the description when an empty one is posted', async () => {
    const { db, updated } = makeDb(new Map<any, any[]>([[tables.roles, [oldRole]], [tables.permissions, PERMISSION_ROWS]]));
    await updateRoleImpl(db, tables, 8, { description: '   ' }, superAdmin);
    const roleUpdate = updated.find((item) => item.table === tables.roles);
    expect(roleUpdate?.values.description).toBeNull();
  });

  it('adds "view" to the posted permissions', async () => {
    const { db, inserted } = makeDb(new Map<any, any[]>([[tables.roles, [oldRole]], [tables.permissions, PERMISSION_ROWS]]));
    const result = await updateRoleImpl(db, tables, 8, { permissionIds: [2] }, superAdmin);
    expect(result.status).toBe('success');
    expect(permissionsGranted(inserted).sort()).toEqual([1, 2]);
  });
});
