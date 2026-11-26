/**
 * The rule for a NEW password (registration, change, reset). The server checks it too: before, only the forms did,
 * so a direct API call could set a 1-character password. Signing in never uses this rule, so older shorter
 * passwords still work until their owner changes them.
 * Keep in step with next-client/src/components/constants.ts (PASSWORD_PATTERN, PASSWORD_RULE_TEXT).
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72; // bcrypt reads only the first 72 bytes
export const PASSWORD_RULE_MESSAGE = 'Mật khẩu cần ít nhất 8 ký tự, gồm cả chữ và số';

export function isStrongPassword(password: unknown): boolean {
  if (typeof password !== 'string') return false;
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) return false;
  return /[A-Za-z]/.test(password) && /\d/.test(password);
}
