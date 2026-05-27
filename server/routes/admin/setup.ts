import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { PERMISSIONS_SEED, ROLES_SEED } from '../../lib/rbac-seed';

export async function checkSuperAdminExists(db: any, tables: any) {
        const { staffs } = tables;

        const existingSuperAdmin = await db
                .select()
                .from(staffs)
                .where(eq(staffs.isSuperAdmin, true))
                .limit(1);

        return existingSuperAdmin.length > 0;
}

export async function setupSuperAdminImpl(
        db: any,
        tables: any,
        body: { email: string; password: string; fullname: string },
        env?: { SUPER_ADMIN_EMAIL?: string; SUPER_ADMIN_PASSWORD?: string; SUPER_ADMIN_FULLNAME?: string }
) {
        const { staffs } = tables;

        // Check if super admin already exists
        const existingSuperAdmin = await db
                .select()
                .from(staffs)
                .where(eq(staffs.isSuperAdmin, true))
                .limit(1);

        if (existingSuperAdmin.length > 0) {
                return { status: 'error', message: 'Super admin đã tồn tại' };
        }

        // Use env vars if provided, otherwise use body
        const email = env?.SUPER_ADMIN_EMAIL || body.email;
        const password = env?.SUPER_ADMIN_PASSWORD || body.password;
        const fullname = env?.SUPER_ADMIN_FULLNAME || body.fullname;

        if (!email || !password || !fullname) {
                return { status: 'error', message: 'Thiếu thông tin email, password hoặc fullname' };
        }

        const now = new Date().toISOString();

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create super admin
        const [newStaff] = await db
                .insert(staffs)
                .values({
                        email,
                        password: hashedPassword,
                        fullname,
                        isSuperAdmin: true,
                        isActive: true,
                        forcePasswordChange: false,
                        createdAt: now,
                        updatedAt: now,
                })
                .returning();

        // Seed permissions and roles
        await seedRolesAndPermissionsImpl(db, tables);

        return {
                status: 'success',
                message: 'Super admin đã được tạo thành công',
                staff: {
                        id: newStaff.id,
                        email: newStaff.email,
                        fullname: newStaff.fullname,
                },
        };
}

export async function seedRolesAndPermissionsImpl(db: any, tables: any) {
        const { permissions, roles, rolePermissions } = tables;
        const now = new Date().toISOString();

        // Seed permissions
        const permissionMap = new Map<string, number>();
        for (const perm of PERMISSIONS_SEED) {
                const [existing] = await db
                        .select()
                        .from(permissions)
                        .where(and(eq(permissions.module, perm.module), eq(permissions.action, perm.action)))
                        .limit(1);

                if (existing) {
                        permissionMap.set(`${perm.module}:${perm.action}`, existing.id);
                } else {
                        const [inserted] = await db
                                .insert(permissions)
                                .values({
                                        module: perm.module,
                                        action: perm.action,
                                        description: perm.description,
                                })
                                .returning();
                        permissionMap.set(`${perm.module}:${perm.action}`, inserted.id);
                }
        }

        // Seed roles
        for (const role of ROLES_SEED) {
                const [existingRole] = await db
                        .select()
                        .from(roles)
                        .where(eq(roles.name, role.name))
                        .limit(1);

                let roleId: number;
                if (existingRole) {
                        roleId = existingRole.id;
                        // Update role if it exists
                        await db
                                .update(roles)
                                .set({
                                        description: role.description,
                                        isSystem: role.isSystem ? 1 : 0,
                                        level: role.level,
                                        updatedAt: now,
                                })
                                .where(eq(roles.id, roleId));
                } else {
                        const [inserted] = await db
                                .insert(roles)
                                .values({
                                        name: role.name,
                                        description: role.description,
                                        isSystem: role.isSystem ? 1 : 0,
                                        level: role.level,
                                        createdAt: now,
                                        updatedAt: now,
                                })
                                .returning();
                        roleId = inserted.id;
                }

                // Clear existing role permissions for this role
                await db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));

                // Insert role permissions
                for (const permKey of role.permissions) {
                        const permId = permissionMap.get(permKey);
                        if (permId) {
                                await db.insert(rolePermissions).values({
                                        roleId,
                                        permissionId: permId,
                                });
                        }
                }
        }

        return {
                status: 'success',
                message: 'Roles và permissions đã được seed thành công',
                permissions: PERMISSIONS_SEED,
                roles: ROLES_SEED,
        };
}
