import { describe, it, expect } from 'vitest';
import { isStrongPassword } from './password-rule';

describe('new password rule', () => {
  it('needs 8+ characters with a letter and a digit', () => {
    expect(isStrongPassword('abc12345')).toBe(true);
    expect(isStrongPassword('new-pass-123')).toBe(true);
    for (const weak of ['abc1234', '12345678', 'abcdefgh', '', '1', undefined, 'a1'.repeat(40)]) {
      expect(isStrongPassword(weak)).toBe(false);
    }
  });
});
