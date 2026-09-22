import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { validateVoucherForVRImpl } from './vouchers';

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
    const dummyVoucher = {
      id: 1,
      code: 'TEST',
      is_active: true,
      valid_until: '2026-09-21T16:59:59.000Z', 
      scope: 'vr' 
    };

    const mockDb = {
      query: {
        vouchers: {
          findFirst: vi.fn().mockResolvedValue(dummyVoucher)
        }
      }
    };

    const mockTables = {
      vouchers: { code: 'code', deleted_at: 'col' }
    };

    const result = await validateVoucherForVRImpl(mockDb as any, mockTables as any, { code: 'TEST' });

    expect(result.valid).toBe(false);
    expect(result.error_code).toBe('VOUCHER_EXPIRED');
  });

  it('Case 6: Backend API duyệt voucher khi gọi lúc 23:58 VN (chưa hết hạn)', async () => {
    // Thời điểm 23:58 VN ngày 21/09 -> Bản chất UTC là 16:58 21/09
    vi.setSystemTime(new Date('2026-09-21T16:58:00.000Z'));

    const dummyVoucher = {
      id: 1,
      code: 'TEST2',
      is_active: true,
      valid_until: '2026-09-21T16:59:59.000Z', 
      scope: 'vr',
      applicable_ticket_package_ids: '[]' // Không block package nào
    };

    const mockDb = {
      query: {
        vouchers: {
          findFirst: vi.fn().mockResolvedValue(dummyVoucher)
        }
      }
    };

    const mockTables = {
      vouchers: { code: 'code', deleted_at: 'col' }
    };

    const result = await validateVoucherForVRImpl(mockDb as any, mockTables as any, { 
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
