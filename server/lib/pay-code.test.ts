import { describe, it, expect } from 'vitest';
import { PAY_CODE_PATTERN, generatePayTxtCode, isPayCodeCollision } from './pay-code';

describe('generatePayTxtCode', () => {
  it('is CS followed by exactly 12 digits, the shape the SePay webhook looks for', () => {
    for (let attempt = 0; attempt < 500; attempt++) {
      expect(generatePayTxtCode()).toMatch(PAY_CODE_PATTERN);
    }
  });

  it('is found by the same pattern the webhook uses on the bank transfer text', () => {
    const code = generatePayTxtCode();
    const transferText = `MBVCB.123 ${code} thanh toan`;
    expect(transferText.match(/CS\d+/)?.[0]).toBe(code);
    expect(code.match(/CS\d{12}/)?.[0]).toBe(code);
  });

  it('does not repeat in practice', () => {
    const codes = new Set(Array.from({ length: 2000 }, () => generatePayTxtCode()));
    expect(codes.size).toBe(2000);
  });

  it('is not built from the clock, so it cannot be guessed from the time of the order', () => {
    // Codes made at the same moment must differ in the digits, not only in the last two
    const codes = Array.from({ length: 50 }, () => generatePayTxtCode());
    const prefixes = new Set(codes.map((code) => code.slice(0, 10)));
    expect(prefixes.size).toBeGreaterThan(40);
  });

  it('uses every digit value', () => {
    const seen = new Set<string>();
    for (let attempt = 0; attempt < 200; attempt++) {
      for (const digit of generatePayTxtCode().slice(2)) seen.add(digit);
    }
    expect(seen.size).toBe(10);
  });
});

describe('isPayCodeCollision', () => {
  it('recognises the D1 unique-constraint error on pay_txt_code', () => {
    expect(isPayCodeCollision(new Error('D1_ERROR: UNIQUE constraint failed: bookings.pay_txt_code'))).toBe(true);
    expect(isPayCodeCollision('UNIQUE constraint failed: bookings.pay_txt_code: SQLITE_CONSTRAINT')).toBe(true);
  });

  it('does not treat other errors as a collision', () => {
    expect(isPayCodeCollision(new Error('UNIQUE constraint failed: bookings.booking_code'))).toBe(false);
    expect(isPayCodeCollision(new Error('NOT NULL constraint failed: bookings.total_price'))).toBe(false);
    expect(isPayCodeCollision(new Error('network down'))).toBe(false);
    expect(isPayCodeCollision(null)).toBe(false);
    expect(isPayCodeCollision(undefined)).toBe(false);
  });
});
