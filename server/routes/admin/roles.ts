import { eq, and, desc, count, isNull, isNotNull, like } from 'drizzle-orm';
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
                                        action: permissions.action
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
                                        action: p.action
                                }))
                        };
                })
        );

        // Get total count
        const [{ count }] = await db.select({ count: { count: roles.id } }).from(roles);

        return {
                items: rolesWithPerms,
                total: count,
                page,
                pageSize
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
                        action: permissions.action
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
                                action: p.action
                        }))
                }
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
                        updatedAt: now
                })
                .returning();

        // Assign permissions
        for (const permissionId of permissionIds) {
                await db.insert(rolePermissions).values({
                        roleId: newRole.id,
                        permissionId
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
                        name: newRole.name
                }
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
                message: 'Đã cập nhật role thành công'
        };
}

export async function deleteRoleImpl(
        db: any,
        tables: any,
        id: number,
        staffInfo?: { id: number; email: string; fullname: string }
) {
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

        // Soft delete role by setting deleted_at
        await db.update(roles).set({ deleted_at: new Date().toISOString(), deleted_by_staff_id: staffInfo?.id }).where(eq(roles.id, id));

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
                message: 'Đã xóa role thành công'
        };
}

export async function restoreRoleImpl(
        db: any,
        tables: any,
        id: number,
        staffInfo?: { id: number; email: string; fullname: string }
) {
        const { roles } = tables;

        // Check if role exists and is deleted
        const [existing] = await db.select().from(roles).where(and(eq(roles.id, id), isNotNull(roles.deleted_at))).limit(1);
        if (!existing) {
                return { status: 'error', message: 'Role not found or not deleted' };
        }

        // Check constraint: Active role with same name?
        const [activeRoleWithSameName] = await db
                .select()
                .from(roles)
                .where(and(eq(roles.name, existing.name), isNull(roles.deleted_at)))
                .limit(1);

        if (activeRoleWithSameName) {
                return { status: 'error', message: `Không thể khôi phục: Đã có vai trò "${existing.name}" đang hoạt động` };
        }

        // Restore by setting deleted_at to null
        await db.update(roles).set({ deleted_at: null }).where(eq(roles.id, id));

        // Log audit action
        if (staffInfo) {
                await logAuditAction(
                        db,
                        tables.auditLogs,
                        'restore',
                        'role',
                        id,
                        `Restore role: ${existing.name}`,
                        staffInfo.id,
                        staffInfo.email,
                        staffInfo.fullname
                );
        }

        return {
                status: 'success',
                message: 'Đã restore role thành công'
        };
}

export async function listPermissionsImpl(db: any, tables: any) {
        const { permissions } = tables;

        const permList = await db.select().from(permissions).orderBy(permissions.module, permissions.action);

        return {
                status: 'success',
                permissions: permList
        };
}

export async function listDeletedRolesImpl(
        db: any,
        tables: any,
        options: { page?: number; pageSize?: number; search?: string } = {}
) {
        const { roles, staffs } = tables;
        const { page = 1, pageSize = 10, search = '' } = options;

        const conditions = [];
        if (search) {
                conditions.push(like(roles.name, `%${search}%`));
        }
        conditions.push(isNotNull(roles.deleted_at));

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        const items = await db
                .select({
                        id: roles.id,
                        name: roles.name,
                        description: roles.description,
                        isSystem: roles.isSystem,
                        level: roles.level,
                        deleted_at: roles.deleted_at,
                        deleted_by_staff_id: roles.deleted_by_staff_id,
                        deleted_by_staff_name: staffs.fullname
                })
                .from(roles)
                .leftJoin(staffs, eq(roles.deleted_by_staff_id, staffs.id))
                .where(whereClause)
                .limit(pageSize)
                .offset((page - 1) * pageSize)
                .orderBy(desc(roles.deleted_at));

        const [countResult] = await db
                .select({ count: count() })
                .from(roles)
                .where(whereClause);

        return {
                status: 'success',
                items,
                total: countResult?.count || 0,
                page,
                pageSize
        };
}
