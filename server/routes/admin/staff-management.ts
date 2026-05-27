import { eq, and, isNull, desc, count, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { hashPassword, invalidateStaffPermissionCache } from '../../lib/staff-auth';

export async function listStaffImpl(
        db: any,
        tables: any,
        params: { page: number; pageSize: number; q?: string; includeInactive?: boolean }
) {
        const { staffs, staffRoles, roles, staffBranches, branches } = tables;
        const { page = 1, pageSize = 20, q = '', includeInactive = false } = params;
        const offset = (page - 1) * pageSize;

        let query = db
                .select({
                        id: staffs.id,
                        email: staffs.email,
                        fullname: staffs.fullname,
                        phone: staffs.phone,
                        avatar: staffs.avatar,
                        isSuperAdmin: staffs.isSuperAdmin,
                        isActive: staffs.isActive,
                        forcePasswordChange: staffs.forcePasswordChange,
                        lastLoginAt: staffs.lastLoginAt,
                        createdAt: staffs.createdAt,
                        updatedAt: staffs.updatedAt,
                        roleCount: sql<number>`count(${staffRoles.roleId})`,
                })
                .from(staffs)
                .leftJoin(staffRoles, eq(staffs.id, staffRoles.staffId))
                .groupBy(staffs.id)
                .orderBy(desc(staffs.createdAt))
                .limit(pageSize)
                .offset(offset);

        if (!includeInactive) {
                query = query.where(eq(staffs.isActive, true));
        }

        if (q) {
                query = query.where(
                        and(
                                includeInactive ? undefined : eq(staffs.isActive, true),
                                sql`${staffs.email} LIKE ${'%' + q + '%'} OR ${staffs.fullname} LIKE ${'%' + q + '%'}`
                        )
                );
        }

        const staffList = await query;

        // Get roles and branches for each staff
        const staffWithDetails = await Promise.all(
                staffList.map(async (staff) => {
                        const roleData = await db
                                .select({ role: roles.name })
                                .from(staffRoles)
                                .innerJoin(roles, eq(staffRoles.roleId, roles.id))
                                .where(eq(staffRoles.staffId, staff.id));

                        const branchData = await db
                                .select({ branchId: staffBranches.branchId, branchName: branches.name })
                                .from(staffBranches)
                                .innerJoin(branches, eq(staffBranches.branchId, branches.id))
                                .where(eq(staffBranches.staffId, staff.id));

                        return {
                                ...staff,
                                roles: roleData.map((r) => r.role),
                                branches: branchData.map((b) => ({ id: b.branchId, name: b.branchName })),
                        };
                })
        );

        // Get total count
        const [totalResult] = await db
                .select({ count: count() })
                .from(staffs)
                .where(includeInactive ? undefined : eq(staffs.isActive, true));

        return {
                items: staffWithDetails,
                total: totalResult?.count || 0,
                page,
                pageSize,
        };
}

export async function getStaffByIdImpl(db: any, tables: any, id: number) {
        const { staffs, staffRoles, roles, staffBranches, branches } = tables;

        const [staff] = await db.select().from(staffs).where(eq(staffs.id, id)).limit(1);
        if (!staff) {
                return { status: 'error', message: 'Staff not found' };
        }

        const roleData = await db
                .select({ roleId: staffRoles.roleId, roleName: roles.name })
                .from(staffRoles)
                .innerJoin(roles, eq(staffRoles.roleId, roles.id))
                .where(eq(staffRoles.staffId, id));

        const branchData = await db
                .select({ branchId: staffBranches.branchId, branchName: branches.name })
                .from(staffBranches)
                .innerJoin(branches, eq(staffBranches.branchId, branches.id))
                .where(eq(staffBranches.staffId, id));

        return {
                status: 'success',
                staff: {
                        ...staff,
                        roles: roleData.map((r) => ({ id: r.roleId, name: r.roleName })),
                        branches: branchData.map((b) => ({ id: b.branchId, name: b.branchName })),
                },
        };
}

export async function createStaffImpl(
        db: any,
        tables: any,
        kv: any,
        body: {
                email: string;
                password: string;
                fullname: string;
                phone?: string;
                avatar?: string;
                roleIds?: number[];
                branchIds?: number[];
        }
) {
        const { staffs, staffRoles, staffBranches } = tables;
        const { email, password, fullname, phone, avatar, roleIds = [], branchIds = [] } = body;
        const now = new Date().toISOString();

        // Check if email already exists
        const [existing] = await db.select().from(staffs).where(eq(staffs.email, email)).limit(1);
        if (existing) {
                return { status: 'error', message: 'Email đã tồn tại' };
        }

        // Hash password
        const hashedPassword = await hashPassword(password);

        // Create staff
        const [newStaff] = await db
                .insert(staffs)
                .values({
                        email,
                        password: hashedPassword,
                        fullname,
                        phone,
                        avatar,
                        isSuperAdmin: false,
                        isActive: true,
                        forcePasswordChange: true, // Force password change on first login
                        createdAt: now,
                        updatedAt: now,
                })
                .returning();

        // Assign roles
        for (const roleId of roleIds) {
                await db.insert(staffRoles).values({
                        staffId: newStaff.id,
                        roleId,
                });
        }

        // Assign branches
        for (const branchId of branchIds) {
                await db.insert(staffBranches).values({
                        staffId: newStaff.id,
                        branchId,
                });
        }

        return {
                status: 'success',
                message: 'Đã tạo nhân viên thành công',
                staff: {
                        id: newStaff.id,
                        email: newStaff.email,
                        fullname: newStaff.fullname,
                },
        };
}

export async function updateStaffImpl(
        db: any,
        tables: any,
        kv: any,
        id: number,
        body: {
                email?: string;
                fullname?: string;
                phone?: string;
                avatar?: string;
                isActive?: boolean;
                roleIds?: number[];
                branchIds?: number[];
        }
) {
        const { staffs, staffRoles, staffBranches } = tables;
        const { email, fullname, phone, avatar, isActive, roleIds, branchIds } = body;
        const now = new Date().toISOString();

        // Check if staff exists
        const [existing] = await db.select().from(staffs).where(eq(staffs.id, id)).limit(1);
        if (!existing) {
                return { status: 'error', message: 'Staff not found' };
        }

        // Cannot modify super admin
        if (existing.isSuperAdmin) {
                return { status: 'error', message: 'Không thể sửa super admin' };
        }

        // Check email uniqueness if changing email
        if (email && email !== existing.email) {
                const [emailCheck] = await db.select().from(staffs).where(eq(staffs.email, email)).limit(1);
                if (emailCheck) {
                        return { status: 'error', message: 'Email đã tồn tại' };
                }
        }

        // Update staff
        const updateData: any = { updatedAt: now };
        if (email) updateData.email = email;
        if (fullname) updateData.fullname = fullname;
        if (phone !== undefined) updateData.phone = phone;
        if (avatar !== undefined) updateData.avatar = avatar;
        if (isActive !== undefined) updateData.isActive = isActive;

        await db.update(staffs).set(updateData).where(eq(staffs.id, id));

        // Update roles if provided
        if (roleIds !== undefined) {
                await db.delete(staffRoles).where(eq(staffRoles.staffId, id));
                for (const roleId of roleIds) {
                        await db.insert(staffRoles).values({ staffId: id, roleId });
                }
        }

        // Update branches if provided
        if (branchIds !== undefined) {
                await db.delete(staffBranches).where(eq(staffBranches.staffId, id));
                for (const branchId of branchIds) {
                        await db.insert(staffBranches).values({ staffId: id, branchId });
                }
        }

        // Invalidate permission cache
        await invalidateStaffPermissionCache(kv, id);

        return {
                status: 'success',
                message: 'Đã cập nhật nhân viên thành công',
        };
}

export async function deleteStaffImpl(db: any, tables: any, id: number) {
        const { staffs } = tables;

        // Check if staff exists
        const [existing] = await db.select().from(staffs).where(eq(staffs.id, id)).limit(1);
        if (!existing) {
                return { status: 'error', message: 'Staff not found' };
        }

        // Cannot delete super admin
        if (existing.isSuperAdmin) {
                return { status: 'error', message: 'Không thể xóa super admin' };
        }

        // Soft delete by setting isActive to false
        await db.update(staffs).set({ isActive: false }).where(eq(staffs.id, id));

        return {
                status: 'success',
                message: 'Đã xóa nhân viên thành công',
        };
}

export async function resetStaffPasswordImpl(
        db: any,
        tables: any,
        kv: any,
        id: number,
        body: { newPassword: string }
) {
        const { staffs, staffTokens } = tables;
        const { newPassword } = body;
        const now = new Date().toISOString();

        // Check if staff exists
        const [existing] = await db.select().from(staffs).where(eq(staffs.id, id)).limit(1);
        if (!existing) {
                return { status: 'error', message: 'Staff not found' };
        }

        // Hash new password
        const hashedPassword = await hashPassword(newPassword);

        // Update password and force change on next login
        await db
                .update(staffs)
                .set({
                        password: hashedPassword,
                        forcePasswordChange: true,
                        updatedAt: now,
                })
                .where(eq(staffs.id, id));

        // Revoke all sessions
        await db
                .update(staffTokens)
                .set({ revokedAt: now, revokeReason: 'password_reset' })
                .where(and(eq(staffTokens.staffId, id), isNull(staffTokens.revokedAt)));

        // Invalidate permission cache
        await invalidateStaffPermissionCache(kv, id);

        return {
                status: 'success',
                message: 'Đã reset mật khẩu thành công',
        };
}
