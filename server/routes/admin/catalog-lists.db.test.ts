import { describe, it, expect, beforeEach } from 'vitest';
import * as schema from '../../../shared/schema';
import { makeSqliteDb, insertRows } from '../../test-utils/sqlite-db';
import { listAdminMoviesImpl, listDeletedMoviesImpl, getMovieByIdImpl } from './movies';
import { listDeletedTicketPackagesImpl } from './tickets';
import { listVouchersImpl, listDeletedVouchersImpl, listVoucherPackageOptionsImpl, getVoucherImpl } from './vouchers';
import {
  listBranchesImpl,
  listAdminBranchOptionsImpl,
  listBranchUnusedCodesImpl,
  listDeletedBranchesImpl,
  listBranchOptionsImpl
} from './branches';
import { listToysImpl } from './toys';
import { listSiteMediaImpl, isAllowedUploadFolder, staffCanModifySiteMedia } from './site-media';

// The admin list queries run on a real in-memory SQLite database, so the WHERE clauses (deleted rows, branch scope,
// filters) are really exercised.

const TABLES = [
  'movies',
  'ticket_packages',
  'bookings',
  'branches',
  'staffs',
  'vouchers',
  'voucher_redemption_logs',
  'toys',
  'site_media',
  'auditLogs'
];

const S: any = schema;
let db: any;
let raw: any;

const NOW = '2026-11-20T03:00:00.000Z';

function movie(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    title: `Movie ${id}`,
    description: 'desc',
    genres: '["Action","Drama"]',
    rating: 8,
    duration_min: 100,
    cover_image: `https://img/${id}.jpg`,
    detail_images: '[]',
    branch_id: null,
    branch_ids: null,
    created_at: NOW,
    updated_at: NOW,
    is_active: 1,
    release_date: '2026-01-01',
    deleted_at: null,
    ...overrides
  };
}

beforeEach(() => {
  ({ db, raw } = makeSqliteDb(TABLES));
  insertRows(raw, 'branches', [
    { id: 1, name: 'CN Hà Nội', code: 'HN', address: 'HN street', phone: '1', email: 'a@x', is_default: 1, is_active: 1, is_open: 1, settings: '{}', banner_images: '[]', created_at: NOW, updated_at: NOW },
    { id: 2, name: 'CN Sài Gòn', code: 'SG', address: 'SG street', phone: '2', email: 'b@x', is_default: 0, is_active: 1, is_open: 1, created_at: NOW, updated_at: NOW },
    { id: 3, name: 'CN Đà Nẵng', code: 'DN', address: 'DN street', is_default: 0, is_active: 0, is_open: 1, created_at: NOW, updated_at: NOW },
    { id: 4, name: 'CN Cũ', code: 'OLD', is_default: 0, is_active: 0, is_open: 0, created_at: NOW, updated_at: NOW, deleted_at: NOW },
    { id: 5, name: 'CN Cũ 2', code: 'OLD2', is_default: 0, is_active: 0, is_open: 0, created_at: NOW, updated_at: NOW, deleted_at: NOW }
  ]);
});

describe('GET /api/admin/movies (listAdminMoviesImpl)', () => {
  beforeEach(() => {
    insertRows(raw, 'movies', [
      movie(1),
      movie(2, { branch_ids: '[1]', branch_id: 1 }),
      movie(3, { branch_ids: '[2]', branch_id: 2 }),
      movie(4, { is_active: 0 }),
      movie(5, { deleted_at: NOW, is_active: 0 }),
      movie(6, { deleted_at: NOW })
    ]);
  });

  const list = (options: Record<string, unknown> = {}) =>
    listAdminMoviesImpl(db, { movies: S.movies }, { page: 1, pageSize: 50, sort: 'title', dir: 'asc', ...options });

  it('never returns deleted movies, for any status', async () => {
    for (const status of ['all', 'active', 'inactive'] as const) {
      const r = await list({ status });
      expect(r.items.map((m: any) => m.id)).not.toContain(5);
      expect(r.items.map((m: any) => m.id)).not.toContain(6);
    }
    expect((await list()).total).toBe(4);
  });

  it('filters by status', async () => {
    expect((await list({ status: 'active' })).items.map((m: any) => m.id)).toEqual([1, 2, 3]);
    expect((await list({ status: 'inactive' })).items.map((m: any) => m.id)).toEqual([4]);
  });

  it('branch staff see global movies and their own branches only', async () => {
    const r = await list({ restrictToBranchIds: [1] });
    expect(r.items.map((m: any) => m.id)).toEqual([1, 2, 4]);
    expect(r.total).toBe(3);
  });

  it('a staff member with no branch sees nothing', async () => {
    expect((await list({ restrictToBranchIds: [] })).items).toEqual([]);
  });

  it('filters by the chosen branch (global movies included)', async () => {
    expect((await list({ branch_id: 2 })).items.map((m: any) => m.id)).toEqual([1, 3, 4]);
  });

  it('searches the title and pages', async () => {
    const r = await list({ q: 'movie 3' });
    expect(r.items.map((m: any) => m.id)).toEqual([3]);
    const page2 = await list({ page: 2, pageSize: 2 });
    expect(page2.items.map((m: any) => m.id)).toEqual([3, 4]);
    expect(page2.total).toBe(4);
  });

  it('returns only the columns the screens read, genres and branch ids parsed', async () => {
    const r = await list({ q: 'movie 2' });
    expect(Object.keys(r.items[0]).sort()).toEqual(
      [
        'id',
        'title',
        'release_date',
        'duration_min',
        'genres',
        'cover_image',
        'updated_at',
        'rating',
        'is_active',
        'branch_id',
        'branch_ids'
      ].sort()
    );
    expect(r.items[0].genres).toEqual(['Action', 'Drama']);
    expect(r.items[0].branch_ids).toEqual([1]);
    expect(r.items[0]).not.toHaveProperty('branch');
    expect(r.items[0]).not.toHaveProperty('description');
  });
});

describe('movie detail and deleted movies', () => {
  beforeEach(() => {
    insertRows(raw, 'movies', [movie(1), movie(7, { deleted_at: NOW, genres: '["Horror"]' })]);
    insertRows(raw, 'ticket_packages', [
      { id: 10, name: 'VIP', code: 'VIP1', price: 90000, combo: '[1]', is_active: 1, branch_ids: '[1]', branch_id: 1, description: 'x', features: '[]', created_at: NOW, updated_at: NOW },
      { id: 11, name: 'Thường', code: 'STD', price: 50000, combo: '1|2', is_active: 1, created_at: NOW, updated_at: NOW },
      { id: 12, name: 'Khác', code: 'OTH', price: 1, combo: '[2]', is_active: 1, created_at: NOW, updated_at: NOW }
    ]);
    insertRows(raw, 'bookings', [{ id: 1, movie_id: 1, payment_status: 'paid', total_price: 100, ticket_count: 1, created_at: NOW, updated_at: NOW }]);
  });

  it('detail has no stats and its packages carry id, name, code, price and branches only', async () => {
    const r: any = await getMovieByIdImpl(db, { movies: S.movies, ticket_packages: S.ticket_packages, auditLogs: S.auditLogs }, 1);
    expect(r).not.toHaveProperty('stats');
    expect(r).not.toHaveProperty('branch');
    expect(r.applicable_packages).toEqual([
      { id: 10, name: 'VIP', code: 'VIP1', price: 90000, branch_id: 1, branch_ids: [1] },
      { id: 11, name: 'Thường', code: 'STD', price: 50000, branch_id: null, branch_ids: null }
    ]);
  });

  it('deleted movies list: only the shown fields, genres as an array', async () => {
    const r = await listDeletedMoviesImpl(db, { movies: S.movies, staffs: S.staffs }, { page: 1, pageSize: 10 });
    expect(r.items).toHaveLength(1);
    expect(Object.keys(r.items[0]).sort()).toEqual(
      ['id', 'title', 'cover_image', 'genres', 'rating', 'duration_min', 'release_date', 'deleted_at', 'deleted_by_staff_name'].sort()
    );
    expect(r.items[0].genres).toEqual(['Horror']);
  });
});

describe('deleted ticket packages', () => {
  it('returns the branch names the screen shows, and only the shown fields', async () => {
    insertRows(raw, 'ticket_packages', [
      { id: 1, name: 'A', code: 'A', price: 1, type: 'movie', is_member_only: 0, branch_ids: '[1,2]', created_at: NOW, updated_at: NOW, deleted_at: '2026-11-02' },
      { id: 2, name: 'B', code: 'B', price: 2, type: 'vr', is_member_only: 1, branch_ids: null, created_at: NOW, updated_at: NOW, deleted_at: '2026-11-01' },
      { id: 3, name: 'C', code: 'C', price: 3, created_at: NOW, updated_at: NOW }
    ]);
    const r = await listDeletedTicketPackagesImpl(
      db,
      { ticket_packages: S.ticket_packages, staffs: S.staffs, branches: S.branches },
      { page: 1, pageSize: 10 }
    );
    expect(r.items.map((item: any) => [item.id, item.branch_name])).toEqual([
      [1, 'CN Hà Nội, CN Sài Gòn'],
      [2, 'Tất cả chi nhánh']
    ]);
    expect(Object.keys(r.items[0]).sort()).toEqual(
      ['id', 'name', 'code', 'price', 'type', 'is_member_only', 'deleted_at', 'deleted_by_staff_name', 'branch_name'].sort()
    );
  });
});

describe('vouchers', () => {
  beforeEach(() => {
    insertRows(raw, 'vouchers', [
      { id: 1, code: 'ALL', name: 'All', description: '{"note":"hello","sale_staff_id":9,"sale_name":"Lan","sale_email":"l@x"}', scope: 'all', discount_type: 'percent', discount_value: 10, used_count: 0, is_active: 1, branch_ids: null, excluded_ticket_package_ids: '[3]', applicable_user_ids: '[5]', created_at: '2026-11-03', updated_at: NOW },
      { id: 2, code: 'HN', name: 'Hn', description: 'plain note', scope: 'vr', discount_type: 'fixed', discount_value: 5000, used_count: 0, is_active: 0, branch_ids: '[1]', created_at: '2026-11-02', updated_at: NOW },
      { id: 3, code: 'SG', name: 'Sg', scope: 'vr', discount_type: 'fixed', discount_value: 5000, used_count: 0, is_active: 1, branch_ids: '[2]', created_at: '2026-11-01', updated_at: NOW },
      { id: 4, code: 'DEL1', name: 'Del', scope: 'vr', discount_type: 'fixed', discount_value: 1, used_count: 0, is_active: 1, branch_ids: '[2]', created_at: NOW, updated_at: NOW, deleted_at: NOW },
      { id: 5, code: 'DEL2', name: 'Del2', scope: 'vr', discount_type: 'fixed', discount_value: 1, used_count: 0, is_active: 0, branch_ids: '[1]', created_at: NOW, updated_at: NOW, deleted_at: NOW }
    ]);
    insertRows(raw, 'bookings', [
      { id: 1, branch_id: 1, total_price: 100, created_at: NOW, updated_at: NOW },
      { id: 2, branch_id: 2, total_price: 200, created_at: NOW, updated_at: NOW }
    ]);
    insertRows(raw, 'voucher_redemption_logs', [
      { id: 1, voucher_id: 1, booking_id: 1, redeemed_at: NOW, discount_amount_applied: 10, order_total_before_discount: 110, order_total_after_discount: 100 },
      { id: 2, voucher_id: 1, booking_id: 2, redeemed_at: NOW, discount_amount_applied: 20, order_total_before_discount: 220, order_total_after_discount: 200 }
    ]);
  });

  const tables = { vouchers: S.vouchers, voucher_redemption_logs: S.voucher_redemption_logs, bookings: S.bookings };
  const list = (args: Record<string, unknown> = {}) => listVouchersImpl(db, tables, { page: 1, pageSize: 20, q: '', ...args });

  it('honours the branch filter (global vouchers included)', async () => {
    expect((await list({ branch_id: 1 })).items.map((v: any) => v.id)).toEqual([1, 2]);
    expect((await list({ branch_id: 2 })).items.map((v: any) => v.id)).toEqual([1, 3]);
    expect((await list()).items.map((v: any) => v.id)).toEqual([1, 2, 3]);
  });

  it('revenue counts only the orders of the staff member branches; the Super Admin sees all', async () => {
    const all = await list();
    expect(all.items.find((v: any) => v.id === 1).total_revenue).toBe(300);
    const hanoi = await list({ restrictToBranchIds: [1] });
    expect(hanoi.items.find((v: any) => v.id === 1).total_revenue).toBe(100);
  });

  it('sends the parsed note and Sales person, not the raw description or unused id lists', async () => {
    const r = await list();
    const first = r.items.find((v: any) => v.id === 1);
    expect(first).not.toHaveProperty('description');
    expect(first).not.toHaveProperty('excluded_ticket_package_ids');
    expect(first).not.toHaveProperty('applicable_user_ids');
    expect(first).toMatchObject({ note: 'hello', sale_staff_id: 9, sale_name: 'Lan', sale_email: 'l@x' });
    expect(r.items.find((v: any) => v.id === 2).note).toBe('plain note');
  });

  it('deleted list honours branch_id and is_active, and sends the parsed note', async () => {
    const deletedTables = { vouchers: S.vouchers };
    const byBranch = await listDeletedVouchersImpl(db, deletedTables, { branch_id: 1 });
    expect(byBranch.items.map((v: any) => v.id)).toEqual([5]);
    const active = await listDeletedVouchersImpl(db, deletedTables, { is_active: 'true' });
    expect(active.items.map((v: any) => v.id)).toEqual([4]);
    expect(active.items[0]).not.toHaveProperty('description');
    expect(active.items[0]).toHaveProperty('note', '');
  });

  it('voucher detail: branch staff see and count only the uses at their branches; the Super Admin sees all', async () => {
    insertRows(raw, 'bookings', [{ id: 3, branch_id: 1, booking_code: 'HN000003', total_price: 50, created_at: NOW, updated_at: NOW }]);
    raw.prepare("update bookings set booking_code = 'SG000002' where id = 2").run();
    insertRows(raw, 'voucher_redemption_logs', [
      { id: 3, voucher_id: 1, booking_id: 3, redeemed_at: NOW, discount_amount_applied: 5, order_total_before_discount: 55, order_total_after_discount: 50 }
    ]);
    const detailTables = { vouchers: S.vouchers, auditLogs: S.auditLogs, voucher_redemption_logs: S.voucher_redemption_logs };

    const all: any = await getVoucherImpl(db, detailTables, 1, null);
    expect(all.redemption_total_count).toBe(3);
    expect(all.recent_redemptions.map((row: any) => row.id).sort()).toEqual([1, 2, 3]);

    const hanoi: any = await getVoucherImpl(db, detailTables, 1, [1]);
    expect(hanoi.redemption_total_count).toBe(2);
    expect(hanoi.recent_redemptions.map((row: any) => row.id).sort()).toEqual([1, 3]);
    expect(hanoi.recent_redemptions.map((row: any) => row.booking_code)).not.toContain('SG000002');
  });

  it('package options: active and inactive, not deleted, scoped to the staff branches, only the form fields', async () => {
    insertRows(raw, 'ticket_packages', [
      { id: 1, name: 'VR all', price: 1, type: 'vr', is_active: 1, branch_ids: null, description: 'x', combo: '[]', created_at: NOW, updated_at: NOW },
      { id: 2, name: 'VR HN off', price: 2, type: 'vr', is_active: 0, branch_ids: '[1]', branch_id: 1, created_at: NOW, updated_at: NOW },
      { id: 3, name: 'VR SG', price: 3, type: 'vr', is_active: 1, branch_ids: '[2]', branch_id: 2, created_at: NOW, updated_at: NOW },
      { id: 4, name: 'Movie', price: 4, type: 'movie', is_active: 1, created_at: NOW, updated_at: NOW },
      { id: 5, name: 'VR deleted', price: 5, type: 'vr', is_active: 1, created_at: NOW, updated_at: NOW, deleted_at: NOW }
    ]);
    const options = (args: Record<string, unknown>) => listVoucherPackageOptionsImpl(db, { ticket_packages: S.ticket_packages }, args);
    expect((await options({ type: 'vr' })).items.map((p: any) => p.id).sort()).toEqual([1, 2, 3]);
    expect((await options({ type: 'movie' })).items.map((p: any) => p.id)).toEqual([4]);
    expect((await options({ type: 'all' })).items.map((p: any) => p.id).sort()).toEqual([1, 2, 3, 4]);
    const hanoi = await options({ type: 'vr', restrictToBranchIds: [1] });
    expect(hanoi.items.map((p: any) => p.id).sort()).toEqual([1, 2]);
    const off = hanoi.items.find((p: any) => p.id === 2);
    expect(off).toEqual({ id: 2, name: 'VR HN off', price: 2, type: 'vr', branch_id: 1, branch_ids: [1], is_active: false });
  });
});

describe('branches', () => {
  const branchTables = { branches: S.branches, movies: S.movies, ticket_packages: S.ticket_packages, bookings: S.bookings };

  it('the admin list shows staff their own branches only, without ticket codes', async () => {
    const all = await listBranchesImpl(db, branchTables, { page: 1, pageSize: 10, q: '', includeInactive: true });
    expect(all.items.map((b: any) => b.id)).toEqual([1, 2, 3]);
    const mine = await listBranchesImpl(db, branchTables, { page: 1, pageSize: 10, q: '', includeInactive: true, restrictToBranchIds: [2] });
    expect(mine.items.map((b: any) => b.id)).toEqual([2]);
    expect(mine.total).toBe(1);
    expect(mine.items[0]).not.toHaveProperty('paid_unused_codes');
  });

  it('unused codes: per branch, newest first, capped, with the full count', async () => {
    const rows = [];
    for (let id = 1; id <= 60; id++) {
      rows.push({ id, branch_id: 1, payment_status: 'paid', is_used: 0, booking_code: `HN${id}`, total_price: 1, created_at: NOW, updated_at: NOW });
    }
    rows.push({ id: 61, branch_id: 2, payment_status: 'paid', is_used: null, booking_code: 'SG1', total_price: 1, created_at: NOW, updated_at: NOW });
    rows.push({ id: 62, branch_id: 2, payment_status: 'paid', is_used: 1, booking_code: 'SG2', total_price: 1, created_at: NOW, updated_at: NOW });
    rows.push({ id: 63, branch_id: 2, payment_status: 'pending', is_used: 0, booking_code: 'SG3', total_price: 1, created_at: NOW, updated_at: NOW });
    insertRows(raw, 'bookings', rows);

    const hanoi = await listBranchUnusedCodesImpl(db, { bookings: S.bookings }, 1);
    expect(hanoi.total).toBe(60);
    expect(hanoi.codes).toHaveLength(50);
    expect(hanoi.codes[0]).toBe('HN60');
    // The other branch is not crowded out by the first one
    expect(await listBranchUnusedCodesImpl(db, { bookings: S.bookings }, 2)).toEqual({ codes: ['SG1'], total: 1 });
  });

  it('admin options: only the picker fields, scoped', async () => {
    const r = await listAdminBranchOptionsImpl(db, { branches: S.branches }, { includeInactive: true, restrictToBranchIds: [1, 3] });
    expect(r.items.map((b: any) => b.id)).toEqual([1, 3]);
    expect(Object.keys(r.items[0]).sort()).toEqual(['address', 'branch_id', 'code', 'id', 'is_active', 'is_default', 'is_open', 'name'].sort());
    expect((await listAdminBranchOptionsImpl(db, { branches: S.branches }, { restrictToBranchIds: [] })).items).toEqual([]);
  });

  it('the public options keep the fields the customer site reads', async () => {
    const r = await listBranchOptionsImpl(db, { branches: S.branches }, { onlyOpen: true });
    expect(r.items[0]).toHaveProperty('phone');
    expect(r.items[0]).toHaveProperty('settings');
    expect(r.items[0]).toHaveProperty('banner_images');
  });

  it('deleted branches: scoped to the staff branches', async () => {
    const all = await listDeletedBranchesImpl(db, { branches: S.branches, staffs: S.staffs }, {});
    expect(all.items.map((b: any) => b.id).sort()).toEqual([4, 5]);
    const mine = await listDeletedBranchesImpl(db, { branches: S.branches, staffs: S.staffs }, { restrictToBranchIds: [5] });
    expect(mine.items.map((b: any) => b.id)).toEqual([5]);
  });
});

describe('toys', () => {
  it('the list leaves deleted toys out', async () => {
    insertRows(raw, 'toys', [
      { id: 1, name: 'Bear', price: 1, stock: 1, status: 'active', created_at: '2026-11-02', updated_at: NOW },
      { id: 2, name: 'Car', price: 1, stock: 1, status: 'inactive', created_at: '2026-11-01', updated_at: NOW, deleted_at: NOW }
    ]);
    const r = await listToysImpl(db, { toys: S.toys }, { page: 1, pageSize: 10, q: '', status: 'all' });
    expect(r.items.map((toy: any) => toy.id)).toEqual([1]);
    expect(r.total).toBe(1);
  });
});

describe('site media', () => {
  it('branch staff list global media and their own branches only', async () => {
    insertRows(raw, 'site_media', [
      { id: 1, section: 'hero_section', type: 'image', url: 'u1', branch_ids: null, display_order: 0, is_active: 1, created_at: NOW, updated_at: NOW },
      { id: 2, section: 'hero_section', type: 'image', url: 'u2', branch_ids: '[1]', display_order: 1, is_active: 1, created_at: NOW, updated_at: NOW },
      { id: 3, section: 'hero_section', type: 'image', url: 'u3', branch_ids: '[2]', display_order: 2, is_active: 1, created_at: NOW, updated_at: NOW }
    ]);
    const all = await listSiteMediaImpl(db, { site_media: S.site_media }, {});
    expect(all.items.map((m: any) => m.id)).toEqual([1, 2, 3]);
    const mine = await listSiteMediaImpl(db, { site_media: S.site_media }, { restrictToBranchIds: [1] });
    expect(mine.items.map((m: any) => m.id)).toEqual([1, 2]);
  });

  it('only the Super Admin changes global media; other staff only media fully inside their branches', () => {
    expect(staffCanModifySiteMedia(null, null)).toBe(true);
    expect(staffCanModifySiteMedia(null, [1])).toBe(false);
    expect(staffCanModifySiteMedia('[1]', [1, 2])).toBe(true);
    expect(staffCanModifySiteMedia('[1,3]', [1, 2])).toBe(false);
    expect(staffCanModifySiteMedia('[3]', [1])).toBe(false);
  });

  it('signs only the folders the admin screens use, under the root of the resource type', () => {
    expect(isAllowedUploadFolder('ctbooking/images/hero_section', 'image')).toBe(true);
    expect(isAllowedUploadFolder('ctbooking/images/posts', 'image')).toBe(true);
    expect(isAllowedUploadFolder('ctbooking/videos/technology_section2', 'video')).toBe(true);
    expect(isAllowedUploadFolder('ctbooking/videos/posts', 'image')).toBe(false);
    expect(isAllowedUploadFolder('ctbooking/images', 'image')).toBe(false);
    expect(isAllowedUploadFolder('ctbooking/images/../secrets', 'image')).toBe(false);
    expect(isAllowedUploadFolder('other/hero_section', 'image')).toBe(false);
    expect(isAllowedUploadFolder('ctbooking/images/hero_section', 'raw')).toBe(false);
  });
});
