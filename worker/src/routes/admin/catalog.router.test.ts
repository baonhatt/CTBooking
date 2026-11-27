import { describe, it, expect, vi, beforeEach } from 'vitest';
import moviesRouter from './movies.router';
import vouchersRouter from './vouchers.router';
import branchesRouter from './branches.router';
import sitemediaRouter from './site-media.router';
import { listAdminMoviesImpl, updateMovieStatusImpl } from '../../../../server/routes/admin/movies';
import { listVoucherPackageOptionsImpl, getVoucherImpl } from '../../../../server/routes/admin/vouchers';
import { getBranchImpl, listBranchUnusedCodesImpl, toggleBranchOpenImpl } from '../../../../server/routes/admin/branches';
import {
  findSiteMediaBranchIdsImpl,
  updateSiteMediaImpl,
  deleteSiteMediaImpl,
  createSiteMediaImpl
} from '../../../../server/routes/admin/site-media';

// Test headers: x-test-permissions "module:action,...", x-test-branches "1,2" (none = Super Admin).
// requirePermission really checks the permissions; the staff permissions are also set for in-route checks.
vi.mock('../../middleware', () => ({
  requireStaffAuth: async (c: any, next: any) => {
    const branches = c.req.header('x-test-branches');
    const granted = (c.req.header('x-test-permissions') || '').split(',').filter(Boolean);
    c.set('staffId', 1);
    c.set('isSuperAdmin', branches === undefined);
    c.set('staffBranchIds', branches === undefined ? [] : branches.split(',').filter(Boolean).map(Number));
    c.set('staffPermissions', granted.map((item: string) => ({ module: item.split(':')[0], action: item.split(':')[1] })));
    await next();
  },
  requirePermission: (module: string, action: string) => async (c: any, next: any) => {
    const allowed =
      c.get('isSuperAdmin') || (c.get('staffPermissions') as any[]).some((p) => p.module === module && p.action === action);
    if (!allowed) return c.json({ message: 'Forbidden' }, 403);
    await next();
  }
}));

vi.mock('../../../../server/routes/admin/movies', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  listAdminMoviesImpl: vi.fn(async () => ({ items: [], page: 1, pageSize: 20, total: 0 })),
  updateMovieStatusImpl: vi.fn(async () => ({ status: 200, message: 'Đã thay đổi', item: { id: 1, title: 'x' } }))
}));

vi.mock('../../../../server/routes/admin/vouchers', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  listVoucherPackageOptionsImpl: vi.fn(async () => ({ items: [], total: 0 })),
  getVoucherImpl: vi.fn(async () => null)
}));

vi.mock('../../../../server/routes/admin/branches', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  getBranchImpl: vi.fn(async () => ({ id: 2, name: 'SG' })),
  listBranchUnusedCodesImpl: vi.fn(async () => ({ codes: ['A'], total: 1 })),
  toggleBranchOpenImpl: vi.fn(async () => ({ ok: true }))
}));

vi.mock('../../../../server/routes/admin/site-media', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  findSiteMediaBranchIdsImpl: vi.fn(async () => ({ all_branches: true, branch_ids: [] as number[] })),
  updateSiteMediaImpl: vi.fn(async () => ({ item: { id: 1 }, success: true })),
  deleteSiteMediaImpl: vi.fn(async () => ({ ok: true, item: { id: 1, url: 'u', public_id: null, type: 'image' } })),
  createSiteMediaImpl: vi.fn(async () => ({ item: { id: 1 } }))
}));

const env = { cinema_db: {}, CLOUDINARY_CLOUD_NAME: 'cloud', CLOUDINARY_API_KEY: 'key', CLOUDINARY_API_SECRET: 'secret' };
const executionContext: any = { waitUntil: () => undefined, passThroughOnException: () => undefined };

function call(router: any, path: string, options: { method?: string; permissions?: string; branches?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'x-test-permissions': options.permissions || '' };
  if (options.branches !== undefined) headers['x-test-branches'] = options.branches;
  return router.request(
    path,
    { method: options.method || 'GET', headers, body: options.body === undefined ? undefined : JSON.stringify(options.body) },
    env,
    executionContext
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/admin/movies', () => {
  it('the Movies screen needs movies.view', async () => {
    expect((await call(moviesRouter, '/api/admin/movies', { branches: '1', permissions: 'showtimes:view' })).status).toBe(403);
    expect(listAdminMoviesImpl).not.toHaveBeenCalled();
    expect((await call(moviesRouter, '/api/admin/movies', { branches: '1', permissions: 'movies:view' })).status).toBe(200);
  });

  it('picker mode is open to showtime and ticket package staff, not to others', async () => {
    expect((await call(moviesRouter, '/api/admin/movies?picker=1', { branches: '1', permissions: 'showtimes:view' })).status).toBe(200);
    expect((await call(moviesRouter, '/api/admin/movies?picker=1', { branches: '1', permissions: 'tickets:view' })).status).toBe(200);
    expect((await call(moviesRouter, '/api/admin/movies?picker=1', { branches: '1', permissions: 'vouchers:view' })).status).toBe(403);
  });

  it('clamps the page size (100, or 500 in picker mode), scopes to the staff branches and reads the filters', async () => {
    await call(moviesRouter, '/api/admin/movies?pageSize=1000&status=inactive&branch_id=2&q=abc', { branches: '1,2', permissions: 'movies:view' });
    let options = (listAdminMoviesImpl as any).mock.calls[0][2];
    expect(options).toMatchObject({ page: 1, pageSize: 100, status: 'inactive', branch_id: 2, q: 'abc', restrictToBranchIds: [1, 2] });

    await call(moviesRouter, '/api/admin/movies?picker=1&pageSize=1000&status=weird&branch_id=all');
    options = (listAdminMoviesImpl as any).mock.calls[1][2];
    expect(options).toMatchObject({ pageSize: 500, status: 'all', branch_id: null, restrictToBranchIds: null });
  });
});

describe('POST /api/admin/movies-status/:id', () => {
  it('returns only the outcome and the message, not the movie row', async () => {
    const response = await call(moviesRouter, '/api/admin/movies-status/1', { method: 'POST', body: { is_active: false } });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'success', message: 'Đã thay đổi' });
    expect(updateMovieStatusImpl).toHaveBeenCalled();
  });
});

describe('GET /api/admin/vouchers/package-options', () => {
  it('is reached before /vouchers/:id, needs vouchers.view and passes the staff branches', async () => {
    expect((await call(vouchersRouter, '/api/admin/vouchers/package-options?type=vr', { branches: '1' })).status).toBe(403);
    const response = await call(vouchersRouter, '/api/admin/vouchers/package-options?type=vr&branch_id=2', {
      branches: '1,2',
      permissions: 'vouchers:view'
    });
    expect(response.status).toBe(200);
    expect(getVoucherImpl).not.toHaveBeenCalled();
    expect((listVoucherPackageOptionsImpl as any).mock.calls[0][2]).toEqual({ type: 'vr', branch_id: 2, restrictToBranchIds: [1, 2] });
  });
});

describe('branch routes are scoped to the staff branches', () => {
  it('another branch reads as not found; the own branch is returned', async () => {
    expect((await call(branchesRouter, '/api/admin/branches/2', { branches: '1', permissions: 'branches:view' })).status).toBe(404);
    expect(getBranchImpl).not.toHaveBeenCalled();
    expect((await call(branchesRouter, '/api/admin/branches/2', { branches: '2', permissions: 'branches:view' })).status).toBe(200);
  });

  it('unused codes: own branch only', async () => {
    expect((await call(branchesRouter, '/api/admin/branches/2/unused-codes', { branches: '1', permissions: 'branches:view' })).status).toBe(403);
    const response = await call(branchesRouter, '/api/admin/branches/2/unused-codes', { branches: '2', permissions: 'branches:view' });
    expect(await response.json()).toEqual({ codes: ['A'], total: 1 });
    expect((listBranchUnusedCodesImpl as any).mock.calls[0][2]).toBe(2);
  });

  it('opening or closing another branch is refused', async () => {
    const response = await call(branchesRouter, '/api/admin/branches/2/toggle-open', {
      method: 'POST',
      branches: '1',
      permissions: 'branches:edit'
    });
    expect(response.status).toBe(403);
    expect(toggleBranchOpenImpl).not.toHaveBeenCalled();
  });
});

describe('site media and Cloudinary signing', () => {
  it('signs only the folders the admin screens use', async () => {
    const bad = await call(sitemediaRouter, '/api/admin/cloudinary/sign', {
      method: 'POST',
      permissions: 'uploads:upload',
      branches: '1',
      body: { folder: 'ctbooking/images/../../other', resource_type: 'image' }
    });
    expect(bad.status).toBe(400);
    const good = await call(sitemediaRouter, '/api/admin/cloudinary/sign', {
      method: 'POST',
      body: { folder: 'ctbooking/images/posts', resource_type: 'image' }
    });
    expect(good.status).toBe(200);
    expect(await good.json()).toHaveProperty('signature');
  });

  it('branch staff may add media: the create gets their branches, and its refusals keep their status', async () => {
    const body = { section: 'hero_section', type: 'image', url: 'u', all_branches: false, branch_ids: [1] };
    const create = await call(sitemediaRouter, '/api/admin/site-media', { method: 'POST', permissions: 'uploads:upload', branches: '1', body });
    expect(create.status).toBe(201);
    expect((createSiteMediaImpl as any).mock.calls[0][5]).toEqual([1]);

    const superAdmin = await call(sitemediaRouter, '/api/admin/site-media', { method: 'POST', body: { ...body, all_branches: true } });
    expect(superAdmin.status).toBe(201);
    expect((createSiteMediaImpl as any).mock.calls[1][5]).toBeNull();

    for (const status of [400, 403]) {
      (createSiteMediaImpl as any).mockRejectedValueOnce(Object.assign(new Error('refused'), { statusCode: status }));
      const refused = await call(sitemediaRouter, '/api/admin/site-media', { method: 'POST', permissions: 'uploads:upload', branches: '1', body });
      expect(refused.status).toBe(status);
      expect(await refused.json()).toMatchObject({ status: 'error', message: 'refused' });
    }

    (createSiteMediaImpl as any).mockRejectedValueOnce(new Error('database down'));
    const failed = await call(sitemediaRouter, '/api/admin/site-media', { method: 'POST', permissions: 'uploads:upload', branches: '1', body });
    expect(failed.status).toBe(500);
    expect(JSON.stringify(await failed.json())).not.toContain('database down');
  });

  it('branch staff cannot change or delete global media', async () => {
    const update = await call(sitemediaRouter, '/api/admin/site-media', {
      method: 'PUT',
      permissions: 'uploads:upload',
      branches: '1',
      body: { id: 1, title: 'x' }
    });
    expect(update.status).toBe(403);
    expect(updateSiteMediaImpl).not.toHaveBeenCalled();

    const remove = await call(sitemediaRouter, '/api/admin/site-media/1', { method: 'DELETE', permissions: 'uploads:delete', branches: '1' });
    expect(remove.status).toBe(403);
    expect(deleteSiteMediaImpl).not.toHaveBeenCalled();
  });

  it('branch staff may change media fully inside their branches', async () => {
    (findSiteMediaBranchIdsImpl as any).mockResolvedValueOnce({ all_branches: false, branch_ids: [1] });
    const update = await call(sitemediaRouter, '/api/admin/site-media', {
      method: 'PUT',
      permissions: 'uploads:upload',
      branches: '1,2',
      body: { id: 1, title: 'x' }
    });
    expect(update.status).toBe(200);
  });

  it('a change of branches is checked: 400 when not explicit, 403 outside the staff branches', async () => {
    (findSiteMediaBranchIdsImpl as any).mockResolvedValue({ all_branches: false, branch_ids: [1] });
    const put = (body: Record<string, unknown>) =>
      call(sitemediaRouter, '/api/admin/site-media', { method: 'PUT', permissions: 'uploads:upload', branches: '1', body: { id: 1, ...body } });
    expect((await put({ branch_ids: [1] })).status).toBe(400);
    expect((await put({ all_branches: true })).status).toBe(403);
    expect((await put({ all_branches: false, branch_ids: [2] })).status).toBe(403);
    expect((await put({ all_branches: false, branch_ids: [] })).status).toBe(403);
    expect(updateSiteMediaImpl).not.toHaveBeenCalled();
    expect((await put({ all_branches: false, branch_ids: [1] })).status).toBe(200);
    (findSiteMediaBranchIdsImpl as any).mockReset();
    (findSiteMediaBranchIdsImpl as any).mockResolvedValue({ all_branches: true, branch_ids: [] });
  });

  describe('POST /api/admin/site-media/check (asked before the upload)', () => {
    const check = (body: Record<string, unknown>, branches?: string) =>
      call(sitemediaRouter, '/api/admin/site-media/check', { method: 'POST', permissions: 'uploads:upload', branches, body });

    it('a new media: staff may name their own branches only, at least one', async () => {
      expect((await check({ all_branches: false, branch_ids: [1] }, '1,2')).status).toBe(200);
      expect((await check({ all_branches: true }, '1')).status).toBe(403);
      expect((await check({ all_branches: false, branch_ids: [] }, '1')).status).toBe(403);
      expect((await check({ all_branches: false, branch_ids: [3] }, '1')).status).toBe(403);
      expect((await check({}, '1')).status).toBe(400);
      expect((await check({ branch_ids: [1] }, '1')).status).toBe(400);
    });

    it('the Super Admin may name every branch or none', async () => {
      expect((await check({ all_branches: true })).status).toBe(200);
      expect((await check({ all_branches: false, branch_ids: [] })).status).toBe(200);
    });

    it('replacing the file of a media: 404 when missing, 403 when not fully the staff member', async () => {
      (findSiteMediaBranchIdsImpl as any).mockResolvedValueOnce(null);
      expect((await check({ target_id: 5 }, '1')).status).toBe(404);
      (findSiteMediaBranchIdsImpl as any).mockResolvedValueOnce({ all_branches: true, branch_ids: [] });
      expect((await check({ target_id: 5 }, '1')).status).toBe(403);
      (findSiteMediaBranchIdsImpl as any).mockResolvedValueOnce({ all_branches: false, branch_ids: [1, 3] });
      expect((await check({ target_id: 5 }, '1')).status).toBe(403);
      (findSiteMediaBranchIdsImpl as any).mockResolvedValueOnce({ all_branches: false, branch_ids: [] });
      expect((await check({ target_id: 5 }, '1')).status).toBe(403);
      (findSiteMediaBranchIdsImpl as any).mockResolvedValueOnce({ all_branches: false, branch_ids: [1] });
      expect((await check({ target_id: 5 }, '1')).status).toBe(200);
      expect((findSiteMediaBranchIdsImpl as any).mock.calls.at(-1)[2]).toBe(5);
    });
  });

  it('the delete reply carries no row', async () => {
    const response = await call(sitemediaRouter, '/api/admin/site-media/1', { method: 'DELETE' });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, status: 'success' });
  });
});
