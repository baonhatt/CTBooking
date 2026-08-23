import { eq, and, desc, count, isNull, isNotNull, like } from 'drizzle-orm';
import { logAuditAction } from '../../lib/audit-logger';
import { buildAuditPayload } from '../../lib/audit-utils';

export async function listRolesImpl(db: any, tables: any, params?: { page?: number; pageSize?: number }) {
        const { roles, rolePermissions, permissions } = tables;
        const { page = 1, pageSize = 100 } = params || {};
        const offset = (page - 1) * pageSize;

        const roleList = await db
                .select()
                .from(roles)
                .where(isNull(roles.deleted_at))
                .orderBy(desc(roles.level))
                .limit(pageSize)
                .offset(offset);

        // Get permissions for each role
        const rolesWithPerms = await Promise.all(
                roleList.map(async (role: any) => {
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
                                permissionIds: permData.map((p: any) => p.permissionId),
                                permissions: permData.map((p: any) => ({
                                        id: p.permissionId,
                                        module: p.module,
                                        action: p.action
                                }))
                        };
                })
        );

        // Get total count
        const [countResult] = await db
                .select({ count: count() })
                .from(roles)
                .where(isNull(roles.deleted_at));

        return {
                items: rolesWithPerms,
                total: countResult?.count || 0,
                page,
                pageSize
        };
}

export async function listDeletedRolesImpl(
        db: any,
        tables: { roles: any; staffs: any },
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

export async function getRoleByIdImpl(db: any, tables: any, id: number) {
        const { roles, rolePermissions, permissions, auditLogs } = tables;

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

        // Get tracking data from audit logs
        const [createLog] = await db
                .select()
                .from(auditLogs)
                .where(and(eq(auditLogs.entityType, 'role'), eq(auditLogs.entityId, String(id)), eq(auditLogs.action, 'create')))
                .orderBy(auditLogs.createdAt)
                .limit(1);

        const [updateLog] = await db
                .select()
                .from(auditLogs)
                .where(and(eq(auditLogs.entityType, 'role'), eq(auditLogs.entityId, String(id)), eq(auditLogs.action, 'update')))
                .orderBy(desc(auditLogs.createdAt))
                .limit(1);

        return {
                status: 'success',
                role: {
                        ...role,
                        created_by_staff_name: createLog?.staffFullname || null,
                        updated_by_staff_name: updateLog?.staffFullname || null,
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

        const auditNew = buildAuditPayload({ ...newRole, permissionIds });

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
                        staffInfo.fullname,
                        undefined,
                        auditNew
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
        staffInfo?: { id: number; email: string; fullname: string; isSuperAdmin?: boolean }
) {
        const { roles, rolePermissions } = tables;
        const { name, description, level, permissionIds } = body;
        const now = new Date().toISOString();

        // Check if role exists
        const [existing] = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
        if (!existing) {
                return { status: 'error', message: 'Role not found' };
        }

        // Cannot modify system roles unless SuperAdmin
        if (existing.isSystem && !staffInfo?.isSuperAdmin) {
                return { status: 'error', message: 'Không thể sửa system role (Chỉ Super Admin mới có quyền)' };
        }

        // Check name uniqueness if changing name
        if (name && name !== existing.name) {
                const [nameCheck] = await db.select().from(roles).where(eq(roles.name, name)).limit(1);
                if (nameCheck) {
                        return { status: 'error', message: 'Role name đã tồn tại' };
                }
        }

        const existingPerms = await db
                .select({ permissionId: rolePermissions.permissionId })
                .from(rolePermissions)
                .where(eq(rolePermissions.roleId, id));

        const auditOld = buildAuditPayload({ ...existing, permissionIds: existingPerms.map((p) => p.permissionId) });

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

        const [updatedRole] = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
        const newPerms = await db
                .select({ permissionId: rolePermissions.permissionId })
                .from(rolePermissions)
                .where(eq(rolePermissions.roleId, id));

        const auditNew = buildAuditPayload({ ...updatedRole, permissionIds: newPerms.map((p) => p.permissionId) });

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
                        staffInfo.fullname,
                        auditOld,
                        auditNew
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

        const deletionTimestamp = new Date().toISOString();

        // Soft delete role by setting deleted_at
        await db.update(roles).set({ deleted_at: deletionTimestamp, deleted_by_staff_id: staffInfo?.id }).where(eq(roles.id, id));

        const auditOld = buildAuditPayload(existing);
        const auditNew = buildAuditPayload({ ...existing, deleted_at: deletionTimestamp, deleted_by_staff_id: staffInfo?.id });

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
                        staffInfo.fullname,
                        auditOld,
                        auditNew
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

        const auditOld = buildAuditPayload(existing);
        const auditNew = buildAuditPayload({ ...existing, deleted_at: null });

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
                        staffInfo.fullname,
                        auditOld,
                        auditNew
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

