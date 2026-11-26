import { describe, it, expect, vi } from 'vitest';
import * as schema from '../../../../shared/schema';
import authRouter from './auth.router';
import { staffGetMeImpl } from '../../../../server/routes/admin/staff-auth';

// The guard is tested elsewhere. Here it signs in staff member 7.
vi.mock('../../middleware', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  requireStaffAuth: async (c: any, next: any) => {
    c.set('staffId', 7);
    await next();
  }
}));

vi.mock('../../../../server/routes/admin/staff-auth', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  staffGetMeImpl: vi.fn(async () => ({ status: 'success', roleNames: [], branchNames: [], staff: { createdAt: 'x' } }))
}));

describe('GET /api/admin/auth/me', () => {
  it('gives the profile the branches table, so the branch names can be read', async () => {
    const response = await authRouter.request('/api/admin/auth/me', { method: 'GET' }, { cinema_db: {}, SETTINGS_KV: {} });

    expect(response.status).toBe(200);
    const [, tables, , staffId] = (staffGetMeImpl as any).mock.calls[0];
    expect(tables.branches).toBe(schema.branches);
    expect(staffId).toBe(7);
  });
});
