import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import * as schema from '../../shared/schema';
import { makeSqliteDb, insertRows } from '../test-utils/sqlite-db';
import {
  assertStaffMayAssign,
  branchUsage,
  customerBranchId,
  movieServesBranch,
  packageAtBranch,
  packagesAtBranch,
  readBranchScope,
  readPackageMoviesChange,
  readPackageMoviesInput,
  readScopeChange,
  readScopeInput,
  readVoucherPackagesChange,
  readVoucherPackagesInput,
  readVoucherScope,
  setBranchScope,
  sqlInStaffBranches,
  staffMayModify,
  voucherCoversPackage,
  voucherServesBranch,
  packageMoviesStatements,
  runBatch,
  voucherPackagesStatements
} from './catalog-scope';

// The branch rules run on a real in-memory SQLite database, so the SQL of each rule is really exercised.

const TABLES = [
  'branches',
  'movies',
  'ticket_packages',
  'movie_branches',
  'package_branches',
  'package_movies',
  'vouchers',
  'voucher_branches',
  'voucher_packages',
  'posts',
  'post_branches',
  'site_media',
  'site_media_branches',
  'bookings',
  'staffs'
];

const NOW = '2026-11-27T03:00:00.000Z';
let db: any;
let raw: any;

function movie(id: number, overrides: Record<string, unknown> = {}) {
  return { id, title: `Movie ${id}`, is_active: 1, all_branches: 0, created_at: NOW, updated_at: NOW, ...overrides };
}

function pkg(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: `Package ${id}`,
    price: 100000,
    display_order: id,
    is_active: 1,
    all_branches: 0,
    movie_scope: 'selected',
    type: 'movie',
    created_at: NOW,
    updated_at: NOW,
    ...overrides
  };
}

/** Asserts that a call is refused with this HTTP status. */
function expectStatus(call: () => unknown, status: number) {
  try {
    call();
  } catch (error: any) {
    expect(error.statusCode).toBe(status);
    return;
  }
  throw new Error(`expected a ${status} error`);
}

beforeEach(() => {
  ({ db, raw } = makeSqliteDb(TABLES));
  insertRows(raw, 'branches', [
    { id: 1, name: 'HN', code: 'HN', is_default: 0, created_at: NOW, updated_at: NOW },
    { id: 2, name: 'Vạn Hạnh', code: 'VH', is_default: 1, created_at: NOW, updated_at: NOW },
    { id: 3, name: 'BD', code: 'BD', is_default: 0, created_at: NOW, updated_at: NOW }
  ]);
  insertRows(raw, 'movies', [
    movie(10, { all_branches: 1 }), // every branch
    movie(11), // HN and Vạn Hạnh
    movie(12), // Vạn Hạnh only
    movie(13, { is_active: 0 }), // hidden
    movie(14, { deleted_at: NOW }) // deleted
  ]);
  insertRows(raw, 'movie_branches', [
    { movie_id: 11, branch_id: 1 },
    { movie_id: 11, branch_id: 2 },
    { movie_id: 12, branch_id: 2 },
    { movie_id: 13, branch_id: 2 },
    { movie_id: 14, branch_id: 2 }
  ]);
  insertRows(raw, 'ticket_packages', [
    pkg(20, { all_branches: 1, movie_scope: 'all_at_branch' }),
    pkg(21, { price: 90000 }), // HN + VH, selected movies 11 and 12
    pkg(22, { type: 'vr' }), // VR at HN
    pkg(23, { is_active: 0 })
  ]);
  insertRows(raw, 'package_branches', [
    { package_id: 21, branch_id: 1 },
    { package_id: 21, branch_id: 2 },
    { package_id: 22, branch_id: 1 },
    { package_id: 23, branch_id: 1 }
  ]);
  insertRows(raw, 'package_movies', [
    { package_id: 21, movie_id: 11 },
    { package_id: 21, movie_id: 12 }
  ]);
});

describe('customer catalog', () => {
  it('a package of every branch with every movie of the branch shows the movies of that branch only', async () => {
    const atHn = await packagesAtBranch(db, 1, 'movie');
    const everyBranch = atHn.find((row: any) => row.id === 20);
    expect(everyBranch.movies.map((m: any) => m.id)).toEqual([10, 11]);
    const atVh = await packagesAtBranch(db, 2, 'movie');
    expect(atVh.find((row: any) => row.id === 20).movies.map((m: any) => m.id)).toEqual([10, 11, 12]);
  });

  it('a package of selected movies shows, at each branch, the selected movies that branch shows (old bug L1/L2)', async () => {
    const atHn = await packagesAtBranch(db, 1, 'movie');
    expect(atHn.find((row: any) => row.id === 21).movies.map((m: any) => m.id)).toEqual([11]);
    const atVh = await packagesAtBranch(db, 2, 'movie');
    expect(atVh.find((row: any) => row.id === 21).movies.map((m: any) => m.id)).toEqual([11, 12]);
  });

  it('the price is the package price at every branch', async () => {
    expect((await packageAtBranch(db, 21, 1))?.price).toBe(90000);
    expect((await packageAtBranch(db, 21, 2))?.price).toBe(90000);
  });

  it('packages not sold at a branch, hidden ones and VR are kept apart', async () => {
    const atBd = await packagesAtBranch(db, 3, 'movie');
    expect(atBd.map((row: any) => row.id)).toEqual([20]);
    expect((await packagesAtBranch(db, 1, 'vr')).map((row: any) => row.id)).toEqual([22]);
    expect(await packageAtBranch(db, 23, 1)).toBeNull();
    expect(await packageAtBranch(db, 21, 3)).toBeNull();
  });

  it('a branch opened later gets the records of every branch at once', async () => {
    insertRows(raw, 'branches', [{ id: 4, name: 'Tân Phú', code: 'TP', created_at: NOW, updated_at: NOW }]);
    expect(await movieServesBranch(db, 10, 4)).toBe(true);
    expect(await movieServesBranch(db, 11, 4)).toBe(false);
    expect((await packagesAtBranch(db, 4, 'movie')).map((row: any) => row.id)).toEqual([20]);
  });

  it('hidden and deleted movies never show', async () => {
    expect(await movieServesBranch(db, 13, 2)).toBe(false);
    expect(await movieServesBranch(db, 14, 2)).toBe(false);
  });

  it('a request without a branch is answered for the default branch', async () => {
    expect(await customerBranchId(db, undefined)).toBe(2);
    expect(await customerBranchId(db, '3')).toBe(3);
  });
});

describe('writing the scope of a record', () => {
  it('replaces the links in one go', async () => {
    await setBranchScope(db, 'package', 21, { all_branches: false, branch_ids: [1, 3] });
    expect(await readBranchScope(db, 'package', 21)).toEqual({ all_branches: false, branch_ids: [1, 3] });
  });

  it('"every branch" removes the links', async () => {
    await setBranchScope(db, 'movie', 11, { all_branches: true, branch_ids: [] });
    expect(await readBranchScope(db, 'movie', 11)).toEqual({ all_branches: true, branch_ids: [] });
    const links = await db.select().from(schema.movie_branches).where(eq(schema.movie_branches.movie_id, 11));
    expect(links).toHaveLength(0);
  });

  it('an empty list is kept as "no branch": not every branch, and shown nowhere', async () => {
    await setBranchScope(db, 'movie', 11, { all_branches: false, branch_ids: [] });
    expect(await readBranchScope(db, 'movie', 11)).toEqual({ all_branches: false, branch_ids: [] });
    expect(await movieServesBranch(db, 11, 1)).toBe(false);
    expect(await movieServesBranch(db, 11, 2)).toBe(false);
  });

  it('package movies: switching to every movie of the branch drops the selection', async () => {
    await runBatch(db, await packageMoviesStatements(db, 21, { movie_scope: 'all_at_branch', movie_ids: [] }));
    expect((await packageAtBranch(db, 21, 2))?.movies.map((m: any) => m.id)).toEqual([10, 11, 12]);
    const rows = await db.select().from(schema.package_movies).where(eq(schema.package_movies.package_id, 21));
    expect(rows).toHaveLength(0);
  });

  it('reads the form input: the scope must be explicit', () => {
    expect(readScopeInput({ all_branches: true, branch_ids: [1] })).toEqual({ all_branches: true, branch_ids: [] });
    expect(readScopeInput({ all_branches: false, branch_ids: ['2', 2, 3] })).toEqual({ all_branches: false, branch_ids: [2, 3] });
    // An empty list is allowed: not assigned anywhere yet
    expect(readScopeInput({ all_branches: false, branch_ids: [] })).toEqual({ all_branches: false, branch_ids: [] });
    // A missing scope is never read as every branch
    expectStatus(() => readScopeInput({}), 400);
    expectStatus(() => readScopeInput({ branch_ids: [1] }), 400);
    expectStatus(() => readScopeInput({ all_branches: false }), 400);
    expectStatus(() => readScopeInput({ all_branches: false, branch_ids: [1, 'x'] }), 400);
    expectStatus(() => readScopeInput({ all_branches: false, branch_ids: [0] }), 400);
  });

  it('an edit that sends no scope leaves it alone', () => {
    expect(readScopeChange({})).toBeUndefined();
    expect(readScopeChange({ all_branches: true })).toEqual({ all_branches: true, branch_ids: [] });
    expectStatus(() => readScopeChange({ branch_ids: [1] }), 400);
  });

  it('package movies must be explicit too', () => {
    expect(readPackageMoviesInput({ movie_scope: 'all_at_branch', movie_ids: [1] })).toEqual({ movie_scope: 'all_at_branch', movie_ids: [] });
    expect(readPackageMoviesInput({ movie_scope: 'selected', movie_ids: [11, 12] })).toEqual({ movie_scope: 'selected', movie_ids: [11, 12] });
    expectStatus(() => readPackageMoviesInput({}), 400);
    expectStatus(() => readPackageMoviesInput({ movie_ids: [11] }), 400);
    expect(readPackageMoviesChange({})).toBeUndefined();
  });

  it('a movie package of selected movies needs at least one movie', () => {
    expectStatus(() => readPackageMoviesInput({ movie_scope: 'selected', movie_ids: [] }), 400);
    expectStatus(() => readPackageMoviesInput({ movie_scope: 'selected' }), 400);
    expectStatus(() => readPackageMoviesInput({ movie_scope: 'selected', movie_ids: [0, 'x'] }), 400);
    expectStatus(() => readPackageMoviesChange({ movie_scope: 'selected', movie_ids: [] }), 400);
  });
});

describe('staff of some branches', () => {
  it('may give only their own branches, at least one, never every branch', () => {
    expect(() => assertStaffMayAssign({ all_branches: true, branch_ids: [] }, [1], 'phim')).toThrow(/Super Admin/);
    expectStatus(() => assertStaffMayAssign({ all_branches: true, branch_ids: [] }, [1], 'phim'), 403);
    expectStatus(() => assertStaffMayAssign({ all_branches: false, branch_ids: [] }, [1], 'phim'), 403);
    expect(() => assertStaffMayAssign({ all_branches: false, branch_ids: [1, 2] }, [1], 'phim')).toThrow(/ngoài phạm vi/);
    expect(() => assertStaffMayAssign({ all_branches: false, branch_ids: [1] }, [1], 'phim')).not.toThrow();
  });

  it('the Super Admin may give anything, also no branch', () => {
    expect(() => assertStaffMayAssign({ all_branches: true, branch_ids: [] }, null, 'phim')).not.toThrow();
    expect(() => assertStaffMayAssign({ all_branches: false, branch_ids: [] }, null, 'phim')).not.toThrow();
  });

  it('may change a record only when every branch of it is theirs', () => {
    expect(staffMayModify({ all_branches: false, branch_ids: [1] }, [1, 2])).toBe(true);
    expect(staffMayModify({ all_branches: false, branch_ids: [1, 3] }, [1, 2])).toBe(false);
    expect(staffMayModify({ all_branches: true, branch_ids: [] }, [1, 2])).toBe(false);
    expect(staffMayModify({ all_branches: true, branch_ids: [] }, null)).toBe(true);
  });

  it('a record of no branch can only be changed by the Super Admin', () => {
    expect(staffMayModify({ all_branches: false, branch_ids: [] }, [1, 2])).toBe(false);
    expect(staffMayModify({ all_branches: false, branch_ids: [] }, null)).toBe(true);
  });

  it('see records of every branch and of their branches', async () => {
    const rows = await db
      .select({ id: schema.movies.id })
      .from(schema.movies)
      .where(sqlInStaffBranches('movie', [1]));
    expect(rows.map((row: any) => row.id).sort()).toEqual([10, 11]);
  });

  it('the filters also work inside a relational query (findMany)', async () => {
    const rows = await db.query.movies.findMany({ where: sqlInStaffBranches('movie', [1]), columns: { id: true } });
    expect(rows.map((row: any) => row.id).sort()).toEqual([10, 11]);
  });
});

describe('vouchers', () => {
  beforeEach(() => {
    insertRows(raw, 'vouchers', [
      { id: 30, code: 'A', name: 'A', discount_type: 'fixed', discount_value: 1, all_branches: 0, all_packages: 0, created_at: NOW, updated_at: NOW }
    ]);
    insertRows(raw, 'voucher_branches', [{ voucher_id: 30, branch_id: 2 }]);
    insertRows(raw, 'voucher_packages', [{ voucher_id: 30, package_id: 21 }]);
  });

  it('applies at its branches to its packages', async () => {
    const scope = await readVoucherScope(db, 30);
    expect(scope).toEqual({ all_branches: false, branch_ids: [2], all_packages: false, package_ids: [21] });
    expect(voucherServesBranch(scope!, 2)).toBe(true);
    expect(voucherServesBranch(scope!, 1)).toBe(false);
    expect(voucherCoversPackage(scope!, 21)).toBe(true);
    expect(voucherCoversPackage(scope!, 20)).toBe(false);
  });

  it('a voucher limited to packages needs at least one package (an empty list is refused, never "every package")', async () => {
    expectStatus(() => readVoucherPackagesInput({ all_packages: false, package_ids: [] }), 400);
    expectStatus(() => readVoucherPackagesChange({ all_packages: false, package_ids: [] }), 400);
    const scope = await readVoucherScope(db, 30);
    expect(voucherCoversPackage(scope!, 21)).toBe(true);
    expect(voucherCoversPackage(scope!, 20)).toBe(false);
  });

  it('"every package" must be said explicitly', async () => {
    expectStatus(() => readVoucherPackagesInput({}), 400);
    expectStatus(() => readVoucherPackagesInput({ package_ids: [] }), 400);
    expect(readVoucherPackagesChange({})).toBeUndefined();
    const choice = readVoucherPackagesInput({ all_packages: true });
    await runBatch(db, await voucherPackagesStatements(db, 30, choice));
    expect(await readVoucherScope(db, 30)).toMatchObject({ all_packages: true, package_ids: [] });
  });
});

describe('branch usage', () => {
  it('counts linked records and paid tickets not used yet', async () => {
    insertRows(raw, 'bookings', [
      { id: 1, branch_id: 1, payment_status: 'paid', is_used: 0, total_price: 1, created_at: NOW, updated_at: NOW },
      { id: 2, branch_id: 1, payment_status: 'paid', is_used: 1, total_price: 1, created_at: NOW, updated_at: NOW },
      { id: 3, branch_id: 1, payment_status: 'pending', is_used: 0, total_price: 1, created_at: NOW, updated_at: NOW }
    ]);
    const usage = await branchUsage(db, 1);
    expect(usage).toMatchObject({ movies: 1, packages: 3, unused_tickets: 1 });
  });
});
