import { describe, it, expect } from 'vitest';
import { normalizeQuantity } from './shared';

describe('normalizeQuantity', () => {
  it('treats a missing quantity as 1', () => {
    for (const missing of [undefined, null, '']) {
      expect(normalizeQuantity(missing)).toBe(1);
    }
  });

  it('accepts whole numbers, also sent as text', () => {
    expect(normalizeQuantity(3)).toBe(3);
    expect(normalizeQuantity('4')).toBe(4);
  });

  it.each([0, -1, 1.5, 'abc', NaN, Infinity, '0', '2.5'])('refuses %p with a 400', (bad) => {
    expect(() => normalizeQuantity(bad)).toThrow(expect.objectContaining({ status: 400, message: 'Số lượng không hợp lệ.' }));
  });
});
