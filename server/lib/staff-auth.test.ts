import { describe, it, expect } from 'vitest';
import { generateStrongPassword, validateStaffPasswordStrength } from './staff-auth';

describe('generateStrongPassword', () => {
  it('meets the staff password policy every time', () => {
    for (let attempt = 0; attempt < 200; attempt++) {
      expect(validateStaffPasswordStrength(generateStrongPassword())).toBeNull();
    }
  });

  it('contains a lower case letter, an upper case letter, a digit and a symbol', () => {
    for (let attempt = 0; attempt < 200; attempt++) {
      const password = generateStrongPassword();
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[0-9]/);
      expect(password).toMatch(/[!@#$%^&*\-_=+]/);
    }
  });

  it('avoids characters that look alike', () => {
    for (let attempt = 0; attempt < 200; attempt++) {
      expect(generateStrongPassword()).not.toMatch(/[0O1lI]/);
    }
  });

  it('is never shorter than the staff minimum, even if a shorter length is asked for', () => {
    expect(generateStrongPassword(4).length).toBeGreaterThanOrEqual(12);
    expect(generateStrongPassword(20)).toHaveLength(20);
  });

  it('does not repeat', () => {
    const passwords = new Set(Array.from({ length: 200 }, () => generateStrongPassword()));
    expect(passwords.size).toBe(200);
  });
});

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
