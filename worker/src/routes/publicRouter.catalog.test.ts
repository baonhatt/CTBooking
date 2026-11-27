import { describe, it, expect, vi, beforeEach } from 'vitest';
import publicRouter from './publicRouter';
import {
  listPublicBranches,
  getPublicDefaultBranch,
  getPublicBranchPaymentInfo,
  getPublicMovieDetail,
  listPublicSiteMedia
} from '../../../server/routes/user/public-catalog';
import { listActiveTicketPackages } from '../../../server/routes/user/tickets';
import { listActiveVRPackagesImpl, validateVRBookingImpl } from '../../../server/routes/user/vr-bookings';
import { validateVoucherForVRImpl } from '../../../server/routes/user/vouchers';
import { getAllActiveMoviesToday } from '../../../server/routes/user/movies';

vi.mock('drizzle-orm/d1', () => ({ drizzle: () => ({}) }));
vi.mock('../middleware', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  hasStaffSession: vi.fn().mockResolvedValue(false)
}));
vi.mock('../../../server/routes/user/auth', () => ({ validateSessionTokenImpl: vi.fn().mockResolvedValue({ valid: false }) }));
vi.mock('../../../server/routes/user/public-catalog', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  listPublicBranches: vi.fn(),
  getPublicDefaultBranch: vi.fn(),
  getPublicBranchPaymentInfo: vi.fn(),
  getPublicMovieDetail: vi.fn(),
  listPublicSiteMedia: vi.fn()
}));
vi.mock('../../../server/routes/user/tickets', () => ({ listActiveTicketPackages: vi.fn() }));
vi.mock('../../../server/routes/user/movies', () => ({ getAllActiveMoviesToday: vi.fn() }));
vi.mock('../../../server/routes/user/vr-bookings', () => ({
  listActiveVRPackagesImpl: vi.fn(),
  validateVRBookingImpl: vi.fn(),
  createVRBookingImpl: vi.fn()
}));
vi.mock('../../../server/routes/user/vouchers', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  validateVoucherForVRImpl: vi.fn()
}));

const env = { cinema_db: {} };
const executionContext: any = { waitUntil: () => undefined, passThroughOnException: () => undefined };

function get(path: string) {
  return publicRouter.request(`https://api.example.com${path}`, {}, env, executionContext);
}

function post(path: string, body: unknown) {
  return publicRouter.request(
    `https://api.example.com${path}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    env,
    executionContext
  );
}

const AUDIT_FIELDS = /created_by|updated_by|deleted_at|deleted_by_staff_id|sale_email|sale_staff_id|used_count/;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('removed public routes', () => {
  it.each([
    '/api/movies',
    '/api/tickets',
    '/api/tickets/3',
    '/api/toys',
    '/api/toys-active',
    '/api/toys/3',
    '/api/branches/options'
  ])('%s is not served any more', async (path) => {
    const response = await get(path);
    // /api/branches/options now reaches /api/branches/:id with a bad id, which is "not found" too
    expect(response.status).toBe(404);
  });
});

describe('GET /api/tickets-active', () => {
  const PACKAGE = {
    id: 1,
    name: 'Vé 1 người',
    description: 'Mô tả',
    price: 90000,
    features: '["A"]',
    type: 'movie',
    display_order: 1,
    movie_scope: 'selected',
    code: 'V1',
    all_branches: false,
    branch_ids: [2],
    min_group_size: 1,
    created_at: '2026-01-01',
    updated_at: '2026-01-02',
    deleted_at: null,
    deleted_by_staff_id: null,
    movies: [{ id: 3, title: 'Phim', cover_image: 'x.jpg', duration_min: 90, all_branches: false, branch_ids: [2], description: 'd' }]
  };

  it('hides member-only packages from visitors, then sends only the fields the screens read', async () => {
    (listActiveTicketPackages as any).mockResolvedValue({
      items: [{ ...PACKAGE, is_member_only: false }, { ...PACKAGE, id: 2, is_member_only: true }]
    });

    const body: any = await (await get('/api/tickets-active?branch_id=2')).json();

    expect(body.items).toHaveLength(1);
    expect(Object.keys(body.items[0]).sort()).toEqual(
      ['description', 'display_order', 'features', 'id', 'movies', 'name', 'price', 'type'].sort()
    );
    expect(Object.keys(body.items[0].movies[0]).sort()).toEqual(
      ['cover_image', 'duration_min', 'id', 'title'].sort()
    );
    expect(JSON.stringify(body)).not.toMatch(AUDIT_FIELDS);
  });
});

describe('GET /api/vr/packages', () => {
  it('hides member-only packages from visitors, then sends only the fields the screens read', async () => {
    const vrPackage = {
      id: 5,
      name: 'VR',
      description: 'd',
      price: 50000,
      features: '[]',
      type: 'vr',
      vr_genre: 'Action',
      cover_image: 'v.jpg',
      duration_min: 15,
      min_players: 1,
      max_players: 4,
      display_order: 0,
      branch_ids: [1],
      branch_ids_parsed: [1]
    };
    (listActiveVRPackagesImpl as any).mockResolvedValue({
      items: [{ ...vrPackage, is_member_only: false }, { ...vrPackage, id: 6, is_member_only: true }]
    });

    const body: any = await (await get('/api/vr/packages')).json();

    expect(body.items.map((item: any) => item.id)).toEqual([5]);
    expect(Object.keys(body.items[0]).sort()).toEqual(
      [
        'cover_image',
        'description',
        'display_order',
        'duration_min',
        'features',
        'id',
        'max_players',
        'min_players',
        'name',
        'price',
        'vr_genre'
      ].sort()
    );
  });
});

describe('GET /api/movies-detail/:id', () => {
  it('returns the public movie', async () => {
    (getPublicMovieDetail as any).mockResolvedValue({ id: 3, title: 'Phim', cover_image: 'x.jpg', genres: [], rating: 8 });

    const response = await get('/api/movies-detail/3');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: 3, title: 'Phim', cover_image: 'x.jpg', genres: [], rating: 8 });
    expect((getPublicMovieDetail as any).mock.calls[0][2]).toBe(3);
  });

  it('answers 404 for a movie that is inactive, deleted or missing', async () => {
    (getPublicMovieDetail as any).mockResolvedValue(null);
    expect((await get('/api/movies-detail/3')).status).toBe(404);
  });
});

describe('GET /api/getActiveMovies', () => {
  it('returns the list of the public query', async () => {
    (getAllActiveMoviesToday as any).mockResolvedValue({
      activeMovies: [{ id: 3, title: 'Phim', cover_image: 'x.jpg', genres: [], release_date: '2026-01-01' }]
    });

    const body: any = await (await get('/api/getActiveMovies?branch_id=2')).json();

    expect(body.activeMovies[0]).toEqual({ id: 3, title: 'Phim', cover_image: 'x.jpg', genres: [], release_date: '2026-01-01' });
  });
});

describe('GET /api/site-media', () => {
  it('always asks for active media only, whatever the query says', async () => {
    (listPublicSiteMedia as any).mockResolvedValue([{ id: 1, section: 'hero_section', type: 'video', url: 'u.mp4' }]);

    const body: any = await (await get('/api/site-media?active=false&section=hero_section')).json();

    expect((listPublicSiteMedia as any).mock.calls[0][2]).toEqual({ section: 'hero_section', type: '' });
    expect(body).toEqual({ items: [{ id: 1, section: 'hero_section', type: 'video', url: 'u.mp4' }] });
  });
});

describe('branches', () => {
  it('GET /api/branches returns only the items, without paging fields', async () => {
    (listPublicBranches as any).mockResolvedValue([{ id: 1, name: 'A' }]);

    const body: any = await (await get('/api/branches')).json();

    expect(body).toEqual({ items: [{ id: 1, name: 'A' }] });
  });

  it('GET /api/branches/default answers 404 when there is no open default branch', async () => {
    (getPublicDefaultBranch as any).mockResolvedValue(null);
    expect((await get('/api/branches/default')).status).toBe(404);
  });

  it('GET /api/branches/:id returns the payment info of the branch', async () => {
    (getPublicBranchPaymentInfo as any).mockResolvedValue({ id: 2, name: 'B', settings: '{"payment_config":{}}' });

    const body: any = await (await get('/api/branches/2')).json();

    expect(body).toEqual({ branch: { id: 2, name: 'B', settings: '{"payment_config":{}}' } });
    expect((getPublicBranchPaymentInfo as any).mock.calls[0][2]).toBe(2);
  });
});

describe('POST /api/vr/voucher/validate', () => {
  it('sends only valid, the message, the amount, and the code and note of the voucher', async () => {
    (validateVoucherForVRImpl as any).mockResolvedValue({
      valid: true,
      message: 'Áp dụng mã của Sale Lan thành công: Tiết kiệm 10.000đ',
      discount_amount: 10000,
      discount_type: 'fixed',
      order_total_before: 100000,
      order_total_after: 90000,
      voucher_details: {
        id: 3,
        code: 'SALE10',
        name: 'Sale',
        description: 'Ghi chú',
        sale_staff_id: 9,
        sale_name: 'Lan',
        sale_email: 'lan@example.com',
        usage_limit: 10,
        per_user_limit: 1,
        used_count: 4,
        applicable_ticket_package_ids: '[1]',
        branch_ids: '[2]'
      }
    });

    const body: any = await (await post('/api/vr/voucher/validate', { code: 'SALE10' })).json();

    expect(body).toEqual({
      valid: true,
      message: 'Áp dụng mã của Sale Lan thành công: Tiết kiệm 10.000đ',
      discount_amount: 10000,
      voucher_details: { code: 'SALE10', description: 'Ghi chú' }
    });
  });

  it('an invalid code gives valid false and the reason', async () => {
    (validateVoucherForVRImpl as any).mockResolvedValue({
      valid: false,
      message: 'Mã giảm giá không hợp lệ',
      error_code: 'VOUCHER_INACTIVE'
    });

    const body: any = await (await post('/api/vr/voucher/validate', { code: 'X' })).json();

    expect(body).toEqual({ valid: false, message: 'Mã giảm giá không hợp lệ', error_code: 'VOUCHER_INACTIVE' });
  });
});

describe('POST /api/vr/validate-booking', () => {
  it('passes the HTTP status of the check and leaves it out of the body', async () => {
    (validateVRBookingImpl as any).mockResolvedValue({
      status: 200,
      original_total_price: 100000,
      voucher_discount_amount: 10000,
      total_price: 90000
    });

    const response = await post('/api/vr/validate-booking', { vr_items: [] });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ original_total_price: 100000, voucher_discount_amount: 10000, total_price: 90000 });
  });
});
