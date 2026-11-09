import { describe, it, expect, vi, beforeEach } from 'vitest';
import dashboardRouter from './dashboard.router';
import { getDashboardMetricsImpl } from '../../../../server/routes/admin/dashboard';

// The guards are tested elsewhere. Here they copy the staff member from test headers into the context.
vi.mock('../../middleware', () => ({
  requireStaffAuth: async (c: any, next: any) => {
    c.set('isSuperAdmin', c.req.header('x-test-super') === '1');
    c.set(
      'staffPermissions',
      (c.req.header('x-test-permissions') || '')
        .split(',')
        .filter(Boolean)
        .map((entry: string) => {
          const [module, action] = entry.split(':');
          return { module, action };
        })
    );
    c.set('staffBranchIds', []);
    await next();
  },
  requirePermission: () => async (_c: any, next: any) => next()
}));

vi.mock('../../../../server/routes/admin/dashboard', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  getDashboardMetricsImpl: vi.fn(async () => ({ ok: true }))
}));

const env = { cinema_db: {} };
const executionContext: any = { waitUntil: () => undefined, passThroughOnException: () => undefined };

function metrics(headers: Record<string, string>) {
  return dashboardRouter.request('/api/admin/dashboard/metrics?year=2026', { method: 'GET', headers }, env, executionContext);
}

const canViewRevenueSentToImpl = () => (getDashboardMetricsImpl as any).mock.calls[0][5];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/admin/dashboard/metrics: who gets the money fields', () => {
  it('the Super Admin does', async () => {
    await metrics({ 'x-test-super': '1' });
    expect(canViewRevenueSentToImpl()).toEqual({ canViewRevenue: true });
  });

  it('staff with dashboard.view_revenue do', async () => {
    await metrics({ 'x-test-permissions': 'dashboard:view,dashboard:view_revenue' });
    expect(canViewRevenueSentToImpl()).toEqual({ canViewRevenue: true });
  });

  it('staff with only dashboard.view do not', async () => {
    await metrics({ 'x-test-permissions': 'dashboard:view' });
    expect(canViewRevenueSentToImpl()).toEqual({ canViewRevenue: false });
  });

  it('staff with a revenue right in another module do not', async () => {
    await metrics({ 'x-test-permissions': 'dashboard:view,transactions:view_revenue,vouchers:view_revenue' });
    expect(canViewRevenueSentToImpl()).toEqual({ canViewRevenue: false });
  });

  it('staff with no permissions do not', async () => {
    await metrics({});
    expect(canViewRevenueSentToImpl()).toEqual({ canViewRevenue: false });
  });
});
