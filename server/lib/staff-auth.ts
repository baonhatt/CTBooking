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
	kv: any,
	staffId: number
): Promise<{ permissions: Array<{ module: string; action: string }>; branchIds: number[]; isSuperAdmin: boolean }> {
	const { staffs, staffRoles, staffBranches, roles, rolePermissions, permissions } = tables;

	// Check cache first
	const cacheKey = `staff_perms:${staffId}`;
	try {
		const cached = await kv.get(cacheKey, 'json');
		if (cached) {
			return cached;
		}
	} catch (e) {
		// KV might not be available, continue to DB
	}

	// Get staff info
	const [staff] = await db.select().from(staffs).where(eq(staffs.id, staffId)).limit(1);
	if (!staff) {
		throw new Error('Staff not found');
	}

	// If super admin, return empty permissions (bypass all checks)
	if (staff.isSuperAdmin) {
		const result = { permissions: [], branchIds: [], isSuperAdmin: true };
		try {
			await kv.put(cacheKey, result, { expirationTtl: 300 });
		} catch (e) {
			// Ignore KV errors
		}
		return result;
	}

	// Get permissions through roles
	const staffPerms = await db
		.select({
			module: permissions.module,
			action: permissions.action,
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
		isSuperAdmin: false,
	};

	// Cache for 5 minutes
	try {
		await kv.put(cacheKey, result, { expirationTtl: 300 });
	} catch (e) {
		// Ignore KV errors
	}

	return result;
}

export async function invalidateStaffPermissionCache(kv: any, staffId: number): Promise<void> {
	const cacheKey = `staff_perms:${staffId}`;
	try {
		await kv.delete(cacheKey);
	} catch (e) {
		// Ignore KV errors
	}
}
