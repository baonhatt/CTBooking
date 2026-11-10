import { describe, it, expect } from 'vitest';
import { formatVnDateTime, formatVnDate, formatVnd, activeStatusLabel, paymentMethodLabel, EMPTY_VALUE } from './format';

describe('admin display formats', () => {
  it('shows a date and time in Vietnam time (UTC+7)', () => {
    // 2026-11-10 18:30 UTC is 11 Nov 01:30 in Vietnam
    expect(formatVnDateTime('2026-11-10T18:30:00.000Z')).toBe('11/11/2026 01:30');
  });

  it('shows only the date in Vietnam time', () => {
    expect(formatVnDate('2026-11-10T18:30:00.000Z')).toBe('11/11/2026');
  });

  it('shows a dash for empty or invalid dates', () => {
    expect(formatVnDateTime(null)).toBe(EMPTY_VALUE);
    expect(formatVnDateTime('not a date')).toBe(EMPTY_VALUE);
    expect(formatVnDate(undefined)).toBe(EMPTY_VALUE);
  });

  it('groups money with dots and adds the currency', () => {
    expect(formatVnd(1250000)).toBe('1.250.000 đ');
    expect(formatVnd('90000')).toBe('90.000 đ');
    expect(formatVnd(0)).toBe('0 đ');
  });

  it('shows a dash for money that is missing or not a number', () => {
    expect(formatVnd(null)).toBe(EMPTY_VALUE);
    expect(formatVnd('abc')).toBe(EMPTY_VALUE);
  });

  it('uses one wording for the active flag', () => {
    expect(activeStatusLabel(true)).toBe('Hoạt động');
    expect(activeStatusLabel(false)).toBe('Ngừng hoạt động');
    expect(activeStatusLabel(undefined)).toBe('Hoạt động');
  });

  it('turns payment method codes into labels', () => {
    expect(paymentMethodLabel('CASH')).toBe('Tiền mặt');
    expect(paymentMethodLabel('vietqr')).toBe('VietQR');
    expect(paymentMethodLabel('other')).toBe('other');
    expect(paymentMethodLabel(null)).toBe(EMPTY_VALUE);
  });
});
