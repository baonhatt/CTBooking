import { describe, it, expect } from 'vitest';
import * as schema from '../../../shared/schema';
import { makeSqliteDb } from '../../test-utils/sqlite-db';
import { seedRolesAndPermissionsImpl } from './setup';

describe('POST /api/admin/setup/seed-roles', () => {
  it('seeds the roles and answers only with the outcome the roles screen reads', async () => {
    const { db, raw } = makeSqliteDb(['permissions', 'roles', 'rolePermissions']);

    const result: any = await seedRolesAndPermissionsImpl(db, {
      permissions: schema.permissions,
      roles: schema.roles,
      rolePermissions: schema.rolePermissions
    });

    expect(result).toEqual({ status: 'success', message: expect.any(String) });
    expect((raw.prepare('SELECT COUNT(*) AS total FROM permissions').get() as any).total).toBeGreaterThan(0);
  });
});
