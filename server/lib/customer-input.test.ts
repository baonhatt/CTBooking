import { describe, it, expect } from 'vitest';
import { isValidCustomerName, isValidCustomerEmail, NAME_MAX_LENGTH, EMAIL_MAX_LENGTH } from './customer-input';

describe('isValidCustomerName', () => {
  it('accepts ordinary names, Vietnamese included', () => {
    expect(isValidCustomerName('Nguyễn Văn A')).toBe(true);
    expect(isValidCustomerName("O'Brien-Smith Jr.")).toBe(true);
  });

  it('refuses angle brackets', () => {
    expect(isValidCustomerName('<a href="x">click</a>')).toBe(false);
    expect(isValidCustomerName('a > b')).toBe(false);
  });

  it('refuses empty, blank, too long and non-text values', () => {
    expect(isValidCustomerName('')).toBe(false);
    expect(isValidCustomerName('   ')).toBe(false);
    expect(isValidCustomerName('a'.repeat(NAME_MAX_LENGTH + 1))).toBe(false);
    expect(isValidCustomerName('a'.repeat(NAME_MAX_LENGTH))).toBe(true);
    for (const bad of [undefined, null, 12, {}, ['a']]) expect(isValidCustomerName(bad)).toBe(false);
  });
});

describe('isValidCustomerEmail', () => {
  it('accepts ordinary addresses', () => {
    for (const ok of ['a@b.co', 'first.last+tag@example.com', 'x_y@sub.domain.vn']) expect(isValidCustomerEmail(ok)).toBe(true);
  });

  it('refuses missing parts, spaces, quotes, commas and brackets', () => {
    for (const bad of ['a', 'a@b', '@b.co', 'a@.co', 'a b@c.co', 'a@b .co', '"a"@b.co', 'a@b.co,c@d.co', '<a@b.co>', 'a@b.co;c@d.co']) {
      expect(isValidCustomerEmail(bad)).toBe(false);
    }
  });

  it('refuses an address longer than 254 characters', () => {
    const local = 'a'.repeat(EMAIL_MAX_LENGTH);
    expect(isValidCustomerEmail(`${local}@b.co`)).toBe(false);
    expect(isValidCustomerEmail(`${'a'.repeat(64)}@${'b'.repeat(60)}.com`)).toBe(true);
  });

  it('refuses non-text values', () => {
    for (const bad of [undefined, null, 12, {}, '']) expect(isValidCustomerEmail(bad)).toBe(false);
  });
});
