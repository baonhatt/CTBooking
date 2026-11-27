import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import * as schema from '../../../shared/schema';
import { makeSqliteDb, insertRows } from '../../test-utils/sqlite-db';
import { validateVoucherForVRImpl, voucherInvoicePackageIds } from './vouchers';
import { allocateVoucherDiscountToVrItems, isLineDiscounted } from '../../../shared/booking-invoice';

// The voucher check runs on a real in-memory SQLite database: the voucher, where it applies (all_branches /
// voucher_branches), on what (all_packages / voucher_packages), the default branch and the Sales person.
const TABLES = ['branches', 'vouchers', 'voucher_branches', 'voucher_packages', 'staffs', 'ticket_packages', 'voucher_redemption_logs', 'bookings'];
const NOW = '2026-09-01T00:00:00.000Z';
const voucherTables: any = {
  vouchers: schema.vouchers,
  voucher_redemption_logs: schema.voucher_redemption_logs,
  ticket_packages: schema.ticket_packages,
  bookings: schema.bookings
};

/** A database with one default branch, the voucher (every branch, every package unless overridden) and the staff rows. */
function makeVoucherDb(voucher: Record<string, unknown>, staffRows: Array<Record<string, unknown>> = []) {
  const { db, raw } = makeSqliteDb(TABLES);
  insertRows(raw, 'branches', [{ id: 1, name: 'HN', code: 'HN', is_default: 1, created_at: NOW, updated_at: NOW }]);
  insertRows(raw, 'vouchers', [
    {
      name: String(voucher.code),
      used_count: 0,
      all_branches: 1,
      all_packages: 1,
      created_at: NOW,
      updated_at: NOW,
      ...voucher
    }
  ]);
  insertRows(raw, 'staffs', staffRows);
  return db;
}

describe('Voucher Backend Validation', () => {
  beforeAll(() => {
    vi.useFakeTimers();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it('Case 7: Backend API reject voucher khi gọi lúc 00:01 VN (hết hạn)', async () => {
    // Thời điểm 00:01 VN ngày 22/09 -> Bản chất UTC là 17:01 21/09
    vi.setSystemTime(new Date('2026-09-21T17:01:00.000Z'));

    // Giả lập DB trả về voucher có valid_until = 23:59 21/09 VN -> UTC là 16:59:59 21/09
    const db = makeVoucherDb({
      id: 1,
      code: 'TEST',
      is_active: true,
      valid_until: '2026-09-21T16:59:59.000Z',
      scope: 'vr'
    });

    const result = await validateVoucherForVRImpl(db, voucherTables, { code: 'TEST' });

    expect(result.valid).toBe(false);
    expect(result.error_code).toBe('VOUCHER_EXPIRED');
  });

  it('Case 6: Backend API duyệt voucher khi gọi lúc 23:58 VN (chưa hết hạn)', async () => {
    // Thời điểm 23:58 VN ngày 21/09 -> Bản chất UTC là 16:58 21/09
    vi.setSystemTime(new Date('2026-09-21T16:58:00.000Z'));

    const db = makeVoucherDb({
      id: 1,
      code: 'TEST2',
      is_active: true,
      valid_until: '2026-09-21T16:59:59.000Z',
      scope: 'vr',
      all_packages: 1 // Không block package nào
    });

    const result = await validateVoucherForVRImpl(db, voucherTables, {
      code: 'TEST2', 
      vr_subtotal: 100, 
      vr_items: [{ vr_package_id: 1, quantity: 1 }],
      vr_price_map: new Map([[1, 100]]) // Bỏ qua DB call
    });

    // Test chủ yếu là voucher KHÔNG BỊ BÁO VOUCHER_EXPIRED.
    // Kết quả sau cùng có thể valid: true hoặc lỗi khác tuỳ mock, quan trọng nhất vòng lặp datetime pass an toàn.
    expect(result.valid).toBe(true);
    expect(result.error_code).not.toBe('VOUCHER_EXPIRED');
  });
});

describe('Pro-rata Discount Allocation to VR Items', () => {
  it('1. Scope "movie": Gói VR giữ nguyên 100% giá gốc, discount = 0', () => {
    const vrItems = [
      { vr_package_id: 10, quantity: 2, unit_price: 100000, package_name: 'VR Gói 1' },
      { vr_package_id: 20, quantity: 1, unit_price: 150000, package_name: 'VR Gói 2' }
    ];
    const movieItems = [{ package_id: 1, quantity: 2, price: 80000 }];

    const result = allocateVoucherDiscountToVrItems({
      vrItems,
      movieItems,
      voucherScope: 'movie',
      voucherDiscountAmount: 50000
    });

    expect(result[0].voucher_discount_amount).toBe(0);
    expect(result[0].line_total).toBe(200000);
    expect(result[0].discounted_unit_price).toBe(100000);

    expect(result[1].voucher_discount_amount).toBe(0);
    expect(result[1].line_total).toBe(150000);
    expect(result[1].discounted_unit_price).toBe(150000);
  });

  it('2. Scope "vr" (All): Phân bổ pro-rata cho toàn bộ các gói VR', () => {
    const vrItems = [
      { vr_package_id: 10, quantity: 1, unit_price: 100000, package_name: 'VR Gói 1' },
      { vr_package_id: 20, quantity: 1, unit_price: 200000, package_name: 'VR Gói 2' }
    ];
    // Tổng VR = 300k, voucher giảm 60k -> gói 1 giảm 20k, gói 2 giảm 40k
    const result = allocateVoucherDiscountToVrItems({
      vrItems,
      voucherScope: 'vr',
      voucherDiscountAmount: 60000
    });

    expect(result[0].voucher_discount_amount).toBe(20000);
    expect(result[0].line_total).toBe(80000);
    expect(result[0].discounted_unit_price).toBe(80000);

    expect(result[1].voucher_discount_amount).toBe(40000);
    expect(result[1].line_total).toBe(160000);
    expect(result[1].discounted_unit_price).toBe(160000);
  });

  it('3. Scope "vr" (Specific package): Chỉ gói được tick mới được giảm', () => {
    const vrItems = [
      { vr_package_id: 10, quantity: 1, unit_price: 100000, package_name: 'VR Gói 1' }, // được tick
      { vr_package_id: 20, quantity: 1, unit_price: 200000, package_name: 'VR Gói 2' }  // KHÔNG được tick
    ];
    const result = allocateVoucherDiscountToVrItems({
      vrItems,
      voucherScope: 'vr',
      applicablePackageIds: [10],
      voucherDiscountAmount: 30000
    });

    // Gói 10 hưởng trọn 30k
    expect(result[0].voucher_discount_amount).toBe(30000);
    expect(result[0].line_total).toBe(70000);
    expect(result[0].discounted_unit_price).toBe(70000);

    // Gói 20 không được giảm
    expect(result[1].voucher_discount_amount).toBe(0);
    expect(result[1].line_total).toBe(200000);
    expect(result[1].discounted_unit_price).toBe(200000);
  });

  it('4. Scope "all" (Combo cả phim và VR): Phân bổ đúng tỷ trọng giữa phim và VR', () => {
    const vrItems = [
      { vr_package_id: 10, quantity: 1, unit_price: 100000, package_name: 'VR Gói 1' }
    ];
    const movieItems = [
      { package_id: 1, quantity: 1, price: 100000 }
    ];
    // Tổng đơn = 200k (VR 100k, Phim 100k -> 50% - 50%). Voucher giảm 40k -> VR giảm 20k
    const result = allocateVoucherDiscountToVrItems({
      vrItems,
      movieItems,
      voucherScope: 'all',
      voucherDiscountAmount: 40000
    });

    expect(result[0].voucher_discount_amount).toBe(20000);
    expect(result[0].line_total).toBe(80000);
    expect(result[0].discounted_unit_price).toBe(80000);
  });

  it('5. Xử lý sai số làm tròn dồn vào dòng cuối (Rounding remainder)', () => {
    // 3 gói mỗi gói 100k, voucher giảm 50.000đ (50000 / 3 = 16666.67đ)
    const vrItems = [
      { vr_package_id: 1, quantity: 1, unit_price: 100000 },
      { vr_package_id: 2, quantity: 1, unit_price: 100000 },
      { vr_package_id: 3, quantity: 1, unit_price: 100000 }
    ];
    const result = allocateVoucherDiscountToVrItems({
      vrItems,
      voucherScope: 'vr',
      voucherDiscountAmount: 50000
    });

    const totalAllocated = result.reduce((s, it) => s + it.voucher_discount_amount, 0);
    expect(totalAllocated).toBe(50000); // Chính xác 100% bằng 50.000đ
  });

  it('6. isLineDiscounted hỗ trợ đúng scope "all"', () => {
    // scope = 'all', applicableIds rỗng -> cả movie và vr đều true
    expect(isLineDiscounted({ discountAmount: 10000, scope: 'all', applicableIds: [], kind: 'movie', packageId: 1 })).toBe(true);
    expect(isLineDiscounted({ discountAmount: 10000, scope: 'all', applicableIds: [], kind: 'vr', packageId: 2 })).toBe(true);

    // scope = 'vr' -> movie false, vr true
    expect(isLineDiscounted({ discountAmount: 10000, scope: 'vr', applicableIds: [], kind: 'movie', packageId: 1 })).toBe(false);
    expect(isLineDiscounted({ discountAmount: 10000, scope: 'vr', applicableIds: [], kind: 'vr', packageId: 2 })).toBe(true);

    // scope = 'movie' -> movie true, vr false
    expect(isLineDiscounted({ discountAmount: 10000, scope: 'movie', applicableIds: [], kind: 'movie', packageId: 1 })).toBe(true);
    expect(isLineDiscounted({ discountAmount: 10000, scope: 'movie', applicableIds: [], kind: 'vr', packageId: 2 })).toBe(false);
  });
});

describe('vouchers that take the whole price off', () => {
  const baseVoucher = { id: 3, code: 'FREE', is_active: true, scope: 'vr', all_packages: 1 };
  const run = (voucher: any, saleStaff: any) =>
    validateVoucherForVRImpl(
      makeVoucherDb(
        voucher,
        saleStaff
          ? [
              {
                id: saleStaff.id,
                email: `staff${saleStaff.id}@example.com`,
                password: 'x',
                fullname: 'Root',
                is_super_admin: saleStaff.isSuperAdmin,
                is_active: saleStaff.isActive,
                created_at: NOW,
                updated_at: NOW
              }
            ]
          : []
      ),
      voucherTables,
      { code: voucher.code, vr_subtotal: 100, vr_items: [{ vr_package_id: 1, quantity: 1 }], vr_price_map: new Map([[1, 100]]) }
    );
  const superAdminSales = JSON.stringify({ note: '', sale_staff_id: 1, sale_name: 'Root' });

  it('a 100% voucher whose Sales person is a Super Admin makes the order 0đ', async () => {
    const result = await run({ ...baseVoucher, discount_type: 'percent', discount_value: 100, description: superAdminSales }, {
      id: 1,
      isSuperAdmin: true,
      isActive: true
    });
    expect(result.valid).toBe(true);
    expect(result.order_total_after).toBe(0);
  });

  it('a 100% voucher whose Sales person is not (or no longer) a Super Admin is refused', async () => {
    const result = await run({ ...baseVoucher, discount_type: 'percent', discount_value: 100, description: superAdminSales }, {
      id: 1,
      isSuperAdmin: false,
      isActive: true
    });
    expect(result.valid).toBe(false);
  });

  it('the description shown to the customer is the note only, never the JSON with the Sales person', async () => {
    const description = JSON.stringify({ sale_staff_id: 9, sale_name: 'Lan', sale_email: 'lan@example.com' });
    const result: any = await run({ ...baseVoucher, discount_type: 'fixed', discount_value: 10, description }, undefined);

    expect(result.valid).toBe(true);
    expect(result.voucher_details.description).toBe('');
    expect(result.message).toContain('Sale Lan');
  });

  it('a plain-text description is still shown as the note', async () => {
    const result: any = await run({ ...baseVoucher, discount_type: 'fixed', discount_value: 10, description: 'Giảm 10đ' }, undefined);

    expect(result.voucher_details.description).toBe('Giảm 10đ');
  });

  it('a fixed voucher larger than the order cannot make it free', async () => {
    const result = await run({ ...baseVoucher, discount_type: 'fixed', discount_value: 500 }, undefined);
    expect(result.valid).toBe(false);
    expect(result.message).toBe('Mã giảm giá này không dùng được vì giảm hết giá trị đơn hàng');
  });
});

describe('the packages a voucher discounts', () => {
  it('voucherInvoicePackageIds: every package -> [], the chosen ones -> their ids, none or unknown -> [0] (never every package)', () => {
    expect(voucherInvoicePackageIds({ all_packages: true, package_ids: [] })).toEqual([]);
    expect(voucherInvoicePackageIds({ all_packages: false, package_ids: [4, 5] })).toEqual([4, 5]);
    expect(voucherInvoicePackageIds({ all_packages: false, package_ids: [] })).toEqual([0]);
    expect(voucherInvoicePackageIds(null)).toEqual([0]);
  });

  it('a voucher with no package chosen discounts no cart', async () => {
    const db = makeVoucherDb({ id: 1, code: 'NOPKG', is_active: true, scope: 'all', discount_type: 'fixed', discount_value: 10, all_packages: 0 });
    for (const cart of [
      { vr_subtotal: 100, vr_items: [{ vr_package_id: 1, quantity: 1 }], vr_price_map: new Map([[1, 100]]) },
      { movie_items: [{ package_id: 2, price: 100, quantity: 1 }] }
    ]) {
      const result = await validateVoucherForVRImpl(db, voucherTables, { code: 'NOPKG', ...cart } as any);
      expect(result.valid).toBe(false);
      expect(result.error_code).toBe('VOUCHER_PACKAGE_NOT_APPLICABLE');
    }
  });

  it('a voucher of chosen packages discounts a cart with one of them only', async () => {
    const db = makeVoucherDb({ id: 1, code: 'PKG4', is_active: true, scope: 'vr', discount_type: 'fixed', discount_value: 10, all_packages: 0 });
    await db.insert(schema.voucher_packages).values({ voucher_id: 1, package_id: 4 });
    const other = await validateVoucherForVRImpl(db, voucherTables, {
      code: 'PKG4', vr_subtotal: 100, vr_items: [{ vr_package_id: 1, quantity: 1 }], vr_price_map: new Map([[1, 100]])
    } as any);
    expect(other.error_code).toBe('VOUCHER_PACKAGE_NOT_APPLICABLE');
    const chosen = await validateVoucherForVRImpl(db, voucherTables, {
      code: 'PKG4', vr_subtotal: 100, vr_items: [{ vr_package_id: 4, quantity: 1 }], vr_price_map: new Map([[4, 100]])
    } as any);
    expect(chosen.valid).toBe(true);
  });
});
