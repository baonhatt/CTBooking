import bcrypt from 'bcryptjs';
import { eq, and, isNull } from 'drizzle-orm';

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

/** Minimum length of a staff password chosen by the staff member. */
export const STAFF_PASSWORD_MIN_LENGTH = 12;

/** bcrypt only uses the first 72 bytes, so longer passwords would give a false sense of strength. */
export const STAFF_PASSWORD_MAX_LENGTH = 72;

/**
 * Checks a password a staff member chooses when changing their own password.
 * Returns an error message, or null when the password is acceptable.
 */
export function validateStaffPasswordStrength(password: unknown): string | null {
  if (typeof password !== 'string' || password.length === 0) {
    return 'Vui lòng nhập mật khẩu mới';
  }
  if (password.length < STAFF_PASSWORD_MIN_LENGTH) {
    return `Mật khẩu mới phải có ít nhất ${STAFF_PASSWORD_MIN_LENGTH} ký tự`;
  }
  if (password.length > STAFF_PASSWORD_MAX_LENGTH) {
    return `Mật khẩu mới không được dài quá ${STAFF_PASSWORD_MAX_LENGTH} ký tự`;
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Mật khẩu mới phải có cả chữ và số';
  }
  return null;
}

const PASSWORD_LOWER = 'abcdefghijkmnopqrstuvwxyz';
const PASSWORD_UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const PASSWORD_DIGITS = '23456789';
const PASSWORD_SYMBOLS = '!@#$%^&*-_=+';

/** Picks a uniformly random integer in [0, upperExclusive) with the Web Crypto API (rejection sampling, no modulo bias). */
function pickRandomIndex(upperExclusive: number): number {
  const limit = 256 - (256 % upperExclusive);
  const randomBytes = new Uint8Array(1);
  while (true) {
    crypto.getRandomValues(randomBytes);
    if (randomBytes[0] < limit) return randomBytes[0] % upperExclusive;
  }
}

function pickRandomCharacter(characters: string): string {
  return characters[pickRandomIndex(characters.length)];
}

/**
 * Generates a password for a staff account created or reset by the Super Admin.
 * Always contains a lower case letter, an upper case letter, a digit and a symbol, and avoids look-alike
 * characters (0, O, 1, l, I) so it can be read off the screen. Never less than the staff minimum length.
 */
export function generateStrongPassword(length: number = 14): string {
  const targetLength = Math.max(length, STAFF_PASSWORD_MIN_LENGTH);
  const allCharacters = PASSWORD_LOWER + PASSWORD_UPPER + PASSWORD_DIGITS + PASSWORD_SYMBOLS;

  const characters = [
    pickRandomCharacter(PASSWORD_LOWER),
    pickRandomCharacter(PASSWORD_UPPER),
    pickRandomCharacter(PASSWORD_DIGITS),
    pickRandomCharacter(PASSWORD_SYMBOLS)
  ];
  while (characters.length < targetLength) {
    characters.push(pickRandomCharacter(allCharacters));
  }

  // Fisher-Yates shuffle so the guaranteed characters are not always at the start
  for (let index = characters.length - 1; index > 0; index--) {
    const swapIndex = pickRandomIndex(index + 1);
    [characters[index], characters[swapIndex]] = [characters[swapIndex], characters[index]];
  }
  return characters.join('');
}

export function generateToken(): string {
  // Generate a random 64-character hex string
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** A staff session can be extended only while it is younger than this. After that the staff member signs in again. */
export const STAFF_SESSION_MAX_AGE_DAYS = 7;

export function getStaffSessionExpiry(): string {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 1); // 1 day
  return expiry.toISOString();
}

export async function loadStaffPermissions(
  db: any,
  tables: any,
  arg3: any,
  arg4?: number
): Promise<{ permissions: Array<{ module: string; action: string }>; branchIds: number[]; isSuperAdmin: boolean }> {
  const staffId = typeof arg4 === 'number' ? arg4 : Number(arg3);
  const { staffs, staffRoles, staffBranches, roles, rolePermissions, permissions } = tables;

  // Get staff info
  const [staff] = await db.select().from(staffs).where(eq(staffs.id, staffId)).limit(1);
  if (!staff) {
    throw new Error('Staff not found');
  }

  // If super admin, return empty permissions (bypass all checks)
  if (staff.isSuperAdmin) {
    return { permissions: [], branchIds: [], isSuperAdmin: true };
  }

  // Get permissions through roles
  const staffPerms = await db
    .select({
      module: permissions.module,
      action: permissions.action
    })
    .from(staffRoles)
    .innerJoin(roles, eq(staffRoles.roleId, roles.id))
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(eq(staffRoles.staffId, staffId));

  // Get branch assignments
  const branchAssignments = await db
    .select({ branchId: staffBranches.branchId })
    .from(staffBranches)
    .where(eq(staffBranches.staffId, staffId));

  const branchIds = branchAssignments.map((b) => b.branchId);

  const result = {
    permissions: staffPerms,
    branchIds,
    isSuperAdmin: false
  };

  return result;
}

export async function invalidateStaffPermissionCache(_kv?: any, _staffId?: number): Promise<void> {
  // No-op: KV caching disabled
}
