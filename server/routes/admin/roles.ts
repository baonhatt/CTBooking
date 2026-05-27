import { eq, and, desc, count } from 'drizzle-orm';
import { logAuditAction } from '../../lib/audit-logger';

export async function listRolesImpl(db: any, tables: any, params?: { page?: number; pageSize?: number }) {
        const { roles, rolePermissions, permissions } = tables;
        const { page = 1, pageSize = 100 } = params || {};
        const offset = (page - 1) * pageSize;

        const roleList = await db.select().from(roles).orderBy(desc(roles.level)).limit(pageSize).offset(offset);

        // Get permissions for each role
        const rolesWithPerms = await Promise.all(
                roleList.map(async (role) => {
                        const permData = await db
                                .select({
                                        permissionId: rolePermissions.permissionId,
                                        module: permissions.module,
                                        action: permissions.action,
                                })
                                .from(rolePermissions)
                                .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
                                .where(eq(rolePermissions.roleId, role.id));

                        return {
                                ...role,
                                permissionIds: permData.map((p) => p.permissionId),
                                permissions: permData.map((p) => ({
                                        id: p.permissionId,
                                        module: p.module,
                                        action: p.action,
                                })),
                        };
                })
        );

        // Get total count
        const [{ count }] = await db.select({ count: { count: roles.id } }).from(roles);

        return {
                items: rolesWithPerms,
                total: count,
                page,
                pageSize,
        };
}

export async function getRoleByIdImpl(db: any, tables: any, id: number) {
        const { roles, rolePermissions, permissions } = tables;

        const [role] = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
        if (!role) {
                return { status: 'error', message: 'Role not found' };
        }

        const permData = await db
                .select({
                        permissionId: rolePermissions.permissionId,
                        module: permissions.module,
                        action: permissions.action,
                })
                .from(rolePermissions)
                .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
                .where(eq(rolePermissions.roleId, id));

        return {
                status: 'success',
                role: {
                        ...role,
                        permissions: permData.map((p) => ({
                                id: p.permissionId,
                                module: p.module,
                                action: p.action,
                        })),
                },
        };
}

export async function createRoleImpl(
        db: any,
        tables: any,
        body: {
                name: string;
                description: string;
                level: number;
                permissionIds: number[];
        },
        staffInfo?: { id: number; email: string; fullname: string }
) {
        const { roles, rolePermissions } = tables;
        const { name, description, level, permissionIds } = body;
        const now = new Date().toISOString();

        // Check if role name already exists
        const [existing] = await db.select().from(roles).where(eq(roles.name, name)).limit(1);
        if (existing) {
                return { status: 'error', message: 'Role name đã tồn tại' };
        }

        // Create role
        const [newRole] = await db
                .insert(roles)
                .values({
                        name,
                        description,
                        isSystem: false,
                        level,
                        createdAt: now,
                        updatedAt: now,
                })
                .returning();

        // Assign permissions
        for (const permissionId of permissionIds) {
                await db.insert(rolePermissions).values({
                        roleId: newRole.id,
                        permissionId,
                });
        }

        // Log audit action
        if (staffInfo) {
                await logAuditAction(
                        db,
                        tables.auditLogs,
                        'create',
                        'role',
                        newRole.id,
                        `Tạo role: ${name}`,
                        staffInfo.id,
                        staffInfo.email,
                        staffInfo.fullname
                );
        }

        return {
                status: 'success',
                message: 'Đã tạo role thành công',
                role: {
                        id: newRole.id,
                        name: newRole.name,
                },
        };
}

export async function updateRoleImpl(
        db: any,
        tables: any,
        id: number,
        body: {
                name?: string;
                description?: string;
                level?: number;
                permissionIds?: number[];
        },
        staffInfo?: { id: number; email: string; fullname: string }
) {
        const { roles, rolePermissions } = tables;
        const { name, description, level, permissionIds } = body;
        const now = new Date().toISOString();

        // Check if role exists
        const [existing] = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
        if (!existing) {
                return { status: 'error', message: 'Role not found' };
        }

        // Cannot modify system roles
        if (existing.isSystem) {
                return { status: 'error', message: 'Không thể sửa system role' };
        }

        // Check name uniqueness if changing name
        if (name && name !== existing.name) {
                const [nameCheck] = await db.select().from(roles).where(eq(roles.name, name)).limit(1);
                if (nameCheck) {
                        return { status: 'error', message: 'Role name đã tồn tại' };
                }
        }

        // Update role
        const updateData: any = { updatedAt: now };
        if (name) updateData.name = name;
        if (description) updateData.description = description;
        if (level !== undefined) updateData.level = level;

        await db.update(roles).set(updateData).where(eq(roles.id, id));

        // Update permissions if provided
        if (permissionIds !== undefined) {
                await db.delete(rolePermissions).where(eq(rolePermissions.roleId, id));
                for (const permissionId of permissionIds) {
                        await db.insert(rolePermissions).values({ roleId: id, permissionId });
                }
        }

        // Log audit action
        if (staffInfo) {
                await logAuditAction(
                        db,
                        tables.auditLogs,
                        'update',
                        'role',
                        id,
                        `Cập nhật role: ${existing.name}`,
                        staffInfo.id,
                        staffInfo.email,
                        staffInfo.fullname
                );
        }

        return {
                status: 'success',
                message: 'Đã cập nhật role thành công',
        };
}

export async function deleteRoleImpl(db: any, tables: any, id: number, staffInfo?: { id: number; email: string; fullname: string }) {
        const { roles, staffRoles } = tables;

        // Check if role exists
        const [existing] = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
        if (!existing) {
                return { status: 'error', message: 'Role not found' };
        }

        // Cannot delete system roles
        if (existing.isSystem) {
                return { status: 'error', message: 'Không thể xóa system role' };
        }

        // Check if role is assigned to any staff
        const [staffCheck] = await db
                .select({ count: staffRoles.staffId })
                .from(staffRoles)
                .where(eq(staffRoles.roleId, id))
                .limit(1);

        if (staffCheck && staffCheck.count > 0) {
                return { status: 'error', message: 'Role đang được gán cho nhân viên, không thể xóa' };
        }

        // Delete role
        await db.delete(roles).where(eq(roles.id, id));

        // Log audit action
        if (staffInfo) {
                await logAuditAction(
                        db,
                        tables.auditLogs,
                        'delete',
                        'role',
                        id,
                        `Xóa role: ${existing.name}`,
                        staffInfo.id,
                        staffInfo.email,
                        staffInfo.fullname
                );
        }

        return {
                status: 'success',
                message: 'Đã xóa role thành công',
        };
}

export async function listPermissionsImpl(db: any, tables: any) {
        const { permissions } = tables;

        const permList = await db.select().from(permissions).orderBy(permissions.module, permissions.action);

        return {
                status: 'success',
                permissions: permList,
        };
}
