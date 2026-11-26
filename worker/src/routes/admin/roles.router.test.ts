import { describe, it, expect, vi, beforeEach } from 'vitest';
import rolesRouter from './roles.router';
import { listRolesImpl, listDeletedRolesImpl, restoreRoleImpl } from '../../../../server/routes/admin/roles';

// The guards are tested elsewhere. Here they let every request through as a Super Admin.
vi.mock('../../middleware', () => ({
  requireStaffAuth: async (c: any, next: any) => {
    c.set('staffId', 1);
    c.set('isSuperAdmin', true);
    await next();
  },
  requirePermission: () => async (_c: any, next: any) => next()
}));

vi.mock('../../../../server/routes/admin/roles', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  listRolesImpl: vi.fn(async () => ({ items: [], total: 0 })),
  listDeletedRolesImpl: vi.fn(async () => ({ status: 'success', items: [] })),
  restoreRoleImpl: vi.fn()
}));

const env = { cinema_db: {} };

const call = (method: string, path: string) => rolesRouter.request(path, { method }, env);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('roles lists: page size is capped', () => {
  it('the roles list caps 100000 at 100 and defaults to 100', async () => {
    await call('GET', '/api/admin/roles?pageSize=100000');
    expect((listRolesImpl as any).mock.calls[0][2]).toMatchObject({ page: 1, pageSize: 100 });
    await call('GET', '/api/admin/roles');
    expect((listRolesImpl as any).mock.calls[1][2]).toMatchObject({ pageSize: 100 });
  });

  it('the deleted roles list caps 100000 at 100 and defaults to 10', async () => {
    await call('GET', '/api/admin/deleted/roles?pageSize=100000&page=-2');
    expect((listDeletedRolesImpl as any).mock.calls[0][2]).toMatchObject({ page: 1, pageSize: 100 });
    await call('GET', '/api/admin/deleted/roles');
    expect((listDeletedRolesImpl as any).mock.calls[1][2]).toMatchObject({ pageSize: 10 });
  });
});

describe('POST /api/admin/roles/:id/restore', () => {
  it.each([
    ['forbidden', 403],
    ['not_found', 404],
    ['conflict', 409]
  ])('answers a %s refusal with HTTP %i', async (code, status) => {
    (restoreRoleImpl as any).mockResolvedValue({ status: 'error', code, message: 'Không được' });
    const response = await call('POST', '/api/admin/roles/5/restore');
    expect(response.status).toBe(status);
  });

  it('answers 200 when the role is restored', async () => {
    (restoreRoleImpl as any).mockResolvedValue({ status: 'success', message: 'ok' });
    const response = await call('POST', '/api/admin/roles/5/restore');
    expect(response.status).toBe(200);
  });
});
