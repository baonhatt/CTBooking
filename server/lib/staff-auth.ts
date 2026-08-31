import bcrypt from 'bcryptjs';
import { eq, and, isNull } from 'drizzle-orm';

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

export function generateToken(): string {
  // Generate a random 64-character hex string
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

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
