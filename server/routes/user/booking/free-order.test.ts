import { describe, it, expect, vi, beforeEach } from 'vitest';
import { payFreeOrderNow } from './free-order';
import { updatePaymentImpl } from './update';
import { packageOfferedAtBranch } from '../../../lib/catalog-scope';
import { makeSqliteDb, insertRows } from '../../../test-utils/sqlite-db';
import { isAssetReplaced } from '../../admin/site-media';

vi.mock('./update', () => ({ updatePaymentImpl: vi.fn() }));
vi.mock('../../../lib/audit-logger', () => ({ logAuditAction: vi.fn(async () => undefined) }));

const tables: any = { bookings: { id: 'id' } };
const dbWith = (booking: any) => ({ query: { bookings: { findFirst: vi.fn(async () => booking) } } });

beforeEach(() => vi.clearAllMocks());

describe('0đ orders are paid at once', () => {
  it('an order of 0đ with a voucher is paid like a SePay payment (only while still open)', async () => {
    (updatePaymentImpl as any).mockResolvedValue({ status: 200, booking: { payment_status: 'paid', booking_code: 'A7K9M2B5' } });

    const result = await payFreeOrderNow(dbWith({ id: 8, total_price: 0, voucher_id: 3, user_id: 5 }), tables, 8);

    expect(result).toEqual({ payment_status: 'paid', booking_code: 'A7K9M2B5' });
    expect((updatePaymentImpl as any).mock.calls[0][1]).toMatchObject({ payment_id: 8, payment_status: 'paid', only_open_pending: true });
  });

  it('an order that costs money, or 0đ without a voucher, keeps the normal QR payment', async () => {
    expect(await payFreeOrderNow(dbWith({ id: 8, total_price: 120000, voucher_id: 3 }), tables, 8)).toBeNull();
    expect(await payFreeOrderNow(dbWith({ id: 8, total_price: 0, voucher_id: null }), tables, 8)).toBeNull();
    expect(updatePaymentImpl).not.toHaveBeenCalled();
  });
});

describe('packages sold at several branches', () => {
  it('a package lists its branches (package_branches); all_branches means every branch', async () => {
    const { db, raw } = makeSqliteDb(['ticket_packages', 'package_branches']);
    insertRows(raw, 'ticket_packages', [
      { id: 1, name: 'Hai chi nhánh', all_branches: 0, movie_scope: 'selected', is_active: 1 },
      { id: 2, name: 'Mọi chi nhánh', all_branches: 1, movie_scope: 'all_at_branch', is_active: 1 }
    ]);
    insertRows(raw, 'package_branches', [
      { package_id: 1, branch_id: 1 },
      { package_id: 1, branch_id: 2 }
    ]);

    expect(await packageOfferedAtBranch(db, 1, 2)).toBe(true);
    expect(await packageOfferedAtBranch(db, 1, 3)).toBe(false);
    expect(await packageOfferedAtBranch(db, 2, 3)).toBe(true);
  });
});

describe('site media: replacing a file', () => {
  it('the same storage id (file overwritten in place, new version in the url) is not a replacement', () => {
    const existing = { public_id: 'site/hero', url: 'https://res.cloudinary.com/x/image/upload/v1/site/hero.jpg' };
    expect(isAssetReplaced(existing, { public_id: 'site/hero', url: 'https://res.cloudinary.com/x/image/upload/v2/site/hero.jpg' })).toBe(false);
    expect(isAssetReplaced(existing, { url: 'https://res.cloudinary.com/x/image/upload/v2/site/hero.jpg' })).toBe(false);
  });

  it('a different storage id or, without one, a different url is a replacement', () => {
    expect(isAssetReplaced({ public_id: 'site/hero', url: 'a' }, { public_id: 'site/hero-2', url: 'b' })).toBe(true);
    expect(isAssetReplaced({ public_id: null, url: '/uploads/videos/video_1.mp4' }, { url: '/uploads/videos/video_2.mp4' })).toBe(true);
  });
});
