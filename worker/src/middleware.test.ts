import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { PUBLIC_ADMIN_PATHS, isPublicAdminPath, requireStaffAuth } from './middleware';

// requireStaffAuth reads the token row through drizzle. The fake returns what a test sets in `tokenRows`.
let tokenRows: any[] = [];

vi.mock('drizzle-orm/d1', () => {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    limit: async () => tokenRows
  };
  return { drizzle: () => ({ select: () => chain }) };
});

vi.mock('../../server/lib/staff-auth', () => ({
  loadStaffPermissions: vi.fn(async () => ({
    permissions: [{ module: 'staff', action: 'view' }],
    branchIds: [1],
    isSuperAdmin: false
  }))
}));

const validRow = () => ({
  token: 'good-token',
  staffId: 5,
  staff: { id: 5, email: 'staff@example.com', fullname: 'Staff', isSuperAdmin: false, isActive: true }
});

/** The same wiring as worker/src/index.ts: a global guard on /api/admin/*, then each route's own guard. */
function makeApp() {
  const app = new Hono<any>();
  app.use('/api/admin/*', async (c, next) => {
    if (isPublicAdminPath(new URL(c.req.url).pathname)) return next();
    return requireStaffAuth(c, next);
  });
  app.get('/api/admin/auth/me', requireStaffAuth, (c) => c.json({ staffId: (c as any).get('staffId') }));
  app.post('/api/admin/auth/change-password', requireStaffAuth, (c) => c.json({ staffId: (c as any).get('staffId') }));
  app.post('/api/admin/auth/logout', requireStaffAuth, (c) => c.json({ staffId: (c as any).get('staffId') }));
  app.post('/api/admin/auth/login', (c) => c.json({ public: true }));
  app.post('/api/admin/auth/verify-login-otp', (c) => c.json({ public: true }));
  app.get('/api/admin/staff', requireStaffAuth, (c) => c.json({ staffId: (c as any).get('staffId') }));
  return app;
}

const env = { cinema_db: {} };
const bearer = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } });

beforeEach(() => {
  tokenRows = [];
});

describe('public admin paths', () => {
  it('lists only the routes that must work without a session', () => {
    expect(PUBLIC_ADMIN_PATHS).toEqual([
      '/api/admin/setup/super-admin',
      '/api/admin/login',
      '/api/admin/auth/login',
      '/api/admin/auth/verify-login-otp',
      '/api/admin/auth/forgot-password',
      '/api/admin/auth/reset-password'
    ]);
  });

  it.each([
    '/api/admin/auth/me',
    '/api/admin/auth/logout',
    '/api/admin/auth/extend-session',
    '/api/admin/auth/change-password',
    '/api/admin/auth/force-change-password',
    '/api/admin/auth/request-password-change-otp',
    '/api/admin/auth/change-password-with-otp',
    '/api/admin/setup/seed-roles',
    '/api/admin/staff'
  ])('%s is not public', (path) => {
    expect(isPublicAdminPath(path)).toBe(false);
  });
});

describe('requireStaffAuth on /api/admin/auth/* routes', () => {
  it.each([
    ['GET', '/api/admin/auth/me'],
    ['POST', '/api/admin/auth/change-password'],
    ['POST', '/api/admin/auth/logout']
  ])('%s %s needs a token', async (method, path) => {
    const response = await makeApp().request(path, { method }, env);
    expect(response.status).toBe(401);
  });

  it('gives these routes the signed-in staff id (it used to be undefined)', async () => {
    tokenRows = [validRow()];

    const me = await makeApp().request('/api/admin/auth/me', bearer('good-token'), env);
    const changePassword = await makeApp().request(
      '/api/admin/auth/change-password',
      { method: 'POST', ...bearer('good-token') },
      env
    );

    expect(me.status).toBe(200);
    expect(await me.json()).toEqual({ staffId: 5 });
    expect(await changePassword.json()).toEqual({ staffId: 5 });
  });

  it('refuses a token that is not found, expired, revoked or belongs to an inactive staff member', async () => {
    tokenRows = [];
    const response = await makeApp().request('/api/admin/auth/me', bearer('stale-token'), env);
    expect(response.status).toBe(401);
  });

  it('also accepts the staff_session cookie', async () => {
    tokenRows = [validRow()];
    const response = await makeApp().request(
      '/api/admin/auth/me',
      { headers: { Cookie: 'staff_session=good-token' } },
      env
    );
    expect(response.status).toBe(200);
  });
});

describe('public routes stay public', () => {
  it('login and verify-login-otp work without a token', async () => {
    const login = await makeApp().request('/api/admin/auth/login', { method: 'POST' }, env);
    const verify = await makeApp().request('/api/admin/auth/verify-login-otp', { method: 'POST' }, env);

    expect(login.status).toBe(200);
    expect(verify.status).toBe(200);
  });
});

describe('other admin routes', () => {
  it('still need a token', async () => {
    expect((await makeApp().request('/api/admin/staff', {}, env)).status).toBe(401);
  });
});
