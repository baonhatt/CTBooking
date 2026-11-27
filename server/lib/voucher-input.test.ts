import { describe, it, expect } from 'vitest';
import { validateVoucherFields } from './voucher-input';

const GOOD = { discount_type: 'percent', discount_value: 10, scope: 'all' };

describe('validateVoucherFields', () => {
  it('accepts a normal voucher', () => {
    expect(() =>
      validateVoucherFields({
        ...GOOD,
        min_order_value: 0,
        max_discount: 50000,
        usage_limit: 100,
        per_user_limit: 1,
        valid_from: '2026-11-01T00:00:00Z',
        valid_until: '2026-12-01T00:00:00Z'
      })
    ).not.toThrow();
  });

  it.each([-5, 0, NaN, 'abc', undefined, null, '', Infinity])('refuses a discount value of %p', (value) => {
    expect(() => validateVoucherFields({ ...GOOD, discount_value: value })).toThrow(
      expect.objectContaining({ statusCode: 400, message: 'Giá trị giảm giá không hợp lệ' })
    );
  });

  it('refuses a percentage over 100 but allows a fixed amount over 100', () => {
    expect(() => validateVoucherFields({ ...GOOD, discount_value: 101 })).toThrow(/100%/);
    expect(() => validateVoucherFields({ ...GOOD, discount_type: 'fixed', discount_value: 150000 })).not.toThrow();
    expect(() => validateVoucherFields({ ...GOOD, discount_value: 100 })).not.toThrow();
  });

  it('refuses a discount type or scope that is not in the allowed set', () => {
    expect(() => validateVoucherFields({ ...GOOD, discount_type: 'bogus' })).toThrow(/Loại giảm giá/);
    expect(() => validateVoucherFields({ ...GOOD, discount_type: undefined })).toThrow(/Loại giảm giá/);
    expect(() => validateVoucherFields({ ...GOOD, scope: 'bogus' })).toThrow(/Phạm vi/);
    for (const scope of ['vr', 'movie', 'all']) expect(() => validateVoucherFields({ ...GOOD, scope })).not.toThrow();
  });

  it.each([
    ['min_order_value', -1],
    ['min_order_value', NaN],
    ['max_discount', -1],
    ['usage_limit', -1],
    ['usage_limit', 1.5],
    ['per_user_limit', -1],
    ['per_user_limit', 'x']
  ])('refuses %s = %p', (field, value) => {
    expect(() => validateVoucherFields({ ...GOOD, [field]: value })).toThrow(expect.objectContaining({ statusCode: 400 }));
  });

  it('allows the optional numbers to be missing, null or empty', () => {
    expect(() =>
      validateVoucherFields({ ...GOOD, min_order_value: null, max_discount: undefined, usage_limit: '', per_user_limit: null })
    ).not.toThrow();
  });

  it('refuses an end date that is not after the start date, or a date that is not a date', () => {
    expect(() => validateVoucherFields({ ...GOOD, valid_from: '2026-12-01', valid_until: '2026-11-01' })).toThrow(/Ngày kết thúc/);
    expect(() => validateVoucherFields({ ...GOOD, valid_from: '2026-12-01', valid_until: '2026-12-01' })).toThrow(/Ngày kết thúc/);
    expect(() => validateVoucherFields({ ...GOOD, valid_from: 'not a date' })).toThrow(/Ngày bắt đầu/);
    expect(() => validateVoucherFields({ ...GOOD, valid_until: 'nope' })).toThrow(/Ngày kết thúc/);
  });

  it('allows one date alone', () => {
    expect(() => validateVoucherFields({ ...GOOD, valid_from: '2026-12-01' })).not.toThrow();
    expect(() => validateVoucherFields({ ...GOOD, valid_until: '2026-12-01' })).not.toThrow();
  });
});
