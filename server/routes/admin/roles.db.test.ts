import { describe, it, expect, beforeEach } from 'vitest';
import * as schema from '../../../shared/schema';
import { makeSqliteDb, insertRows } from '../../test-utils/sqlite-db';
import { listRolesImpl, restoreRoleImpl } from './roles';

// The roles list on a real in-memory SQLite database.

const tables: any = {
  roles: (schema as any).roles,
  rolePermissions: (schema as any).rolePermissions,
  permissions: (schema as any).permissions,
  staffRoles: (schema as any).staffRoles,
  staffs: (schema as any).staffs,
  auditLogs: (schema as any).auditLogs
};

let db: any;
let raw: any;

beforeEach(() => {
  ({ db, raw } = makeSqliteDb(['roles', 'rolePermissions', 'permissions', 'staffRoles', 'staffs', 'auditLogs']));
  insertRows(raw, 'permissions', [
    { id: 1, module: 'movies', action: 'view' },
    { id: 2, module: 'movies', action: 'edit' },
    // An old permission the role screens no longer show
    { id: 3, module: 'movies', action: 'publish' }
  ]);
  insertRows(raw, 'roles', [
    { id: 1, name: 'Thu ngân', description: 'Bán vé', is_system: 0, level: 0, created_at: '2026-01-01', updated_at: '2026-01-02' },
    { id: 2, name: 'Cũ', is_system: 0, level: 0, created_at: 'x', updated_at: 'x', deleted_at: '2026-02-01' }
  ]);
  insertRows(raw, 'rolePermissions', [
    { role_id: 1, permission_id: 1 },
    { role_id: 1, permission_id: 2 },
    { role_id: 1, permission_id: 3 }
  ]);
});

describe('roles list', () => {
  it('sends the number of grantable permissions, not the permission rows', async () => {
    const result: any = await listRolesImpl(db, tables, { page: 1, pageSize: 100 });

    expect(result.items).toEqual([
      {
        id: 1,
        name: 'Thu ngân',
        description: 'Bán vé',
        isSystem: false,
        level: 0,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-02',
        staffCount: 0,
        permissionCount: 2
      }
    ]);
  });
});

describe('role restore', () => {
  const superAdmin = { id: 1, email: 'root@example.com', fullname: 'Root', isSuperAdmin: true };

  it('says why it refused, so the router can answer the right status', async () => {
    expect(await restoreRoleImpl(db, tables, 2, { ...superAdmin, isSuperAdmin: false })).toMatchObject({ code: 'forbidden' });
    expect(await restoreRoleImpl(db, tables, 99, superAdmin)).toMatchObject({ code: 'not_found' });
    insertRows(raw, 'roles', [{ id: 3, name: 'Cũ', is_system: 0, level: 0, created_at: 'x', updated_at: 'x' }]);
    expect(await restoreRoleImpl(db, tables, 2, superAdmin)).toMatchObject({ code: 'conflict' });
  });
});
