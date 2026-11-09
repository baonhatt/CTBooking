import { describe, it, expect } from 'vitest';
import { validateStaffPasswordStrength } from './staff-auth';

describe('validateStaffPasswordStrength', () => {
  it('accepts a 12 character password with letters and digits', () => {
    expect(validateStaffPasswordStrength('abcdefgh1234')).toBeNull();
  });

  it('accepts symbols as well', () => {
    expect(validateStaffPasswordStrength('Correct-Horse-9-Battery')).toBeNull();
  });

  it('rejects a password shorter than 12 characters', () => {
    expect(validateStaffPasswordStrength('abcdefg1234')).toMatch(/12/);
  });

  it('rejects a password with no digit', () => {
    expect(validateStaffPasswordStrength('abcdefghijklmn')).toMatch(/chữ và số/);
  });

  it('rejects a password with no letter', () => {
    expect(validateStaffPasswordStrength('123456789012')).toMatch(/chữ và số/);
  });

  it('rejects a password longer than 72 characters', () => {
    expect(validateStaffPasswordStrength('a1'.repeat(37))).toMatch(/72/);
  });

  it('rejects empty and non-string values', () => {
    expect(validateStaffPasswordStrength('')).not.toBeNull();
    expect(validateStaffPasswordStrength(undefined)).not.toBeNull();
    expect(validateStaffPasswordStrength(123456789012)).not.toBeNull();
  });
});
