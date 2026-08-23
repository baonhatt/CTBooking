import { eq, and, or, like, isNull, isNotNull, desc, count, sql, aliasedTable } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { hashPassword, invalidateStaffPermissionCache } from '../../lib/staff-auth';
import { getStaffAccountCreatedTemplate, getStaffPasswordResetTemplate } from '../../lib/email-templates';
import { logAuditAction } from '../../lib/audit-logger';
import { buildStaffAuditPayload } from './staff-audit-utils';

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
                        roleCount: sql<number>`count(${staffRoles.roleId})`
                })
                .from(staffs)
                .leftJoin(staffRoles, eq(staffs.id, staffRoles.staffId))
                .groupBy(staffs.id)
                .orderBy(desc(staffs.createdAt))
                .limit(pageSize)
                .offset(offset);

        if (!includeInactive) {
                query = query.where(and(eq(staffs.isActive, true), isNull(staffs.deletedAt)));
        }

        if (q) {
                query = query.where(
                        and(
                                includeInactive ? undefined : and(eq(staffs.isActive, true), isNull(staffs.deletedAt)),
                                sql`${staffs.email} LIKE ${'%' + q + '%'} OR ${staffs.fullname} LIKE ${'%' + q + '%'}`
                        )
                );
        }

        const staffList = await query;

        // Get roles and branches for each staff
        const staffWithDetails = await Promise.all(
                staffList.map(async (staff) => {
                        const roleData = await db
                                .select({ roleId: staffRoles.roleId, roleName: roles.name })
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
                                roleIds: roleData.map((r) => r.roleId),
                                roles: roleData.map((r) => r.roleName),
                                branchIds: branchData.map((b) => b.branchId),
                                branchNames: branchData.map((b) => b.branchName),
                                branches: branchData.map((b) => ({ id: b.branchId, name: b.branchName }))
                        };
                })
        );

        // Get total count
        const [totalResult] = await db
                .select({ count: count() })
                .from(staffs)
                .where(and(
                        includeInactive ? undefined : eq(staffs.isActive, true),
                        isNull(staffs.deletedAt)
                ));

        return {
                items: staffWithDetails,
                total: totalResult?.count || 0,
                page,
                pageSize
        };
}

export async function getStaffByIdImpl(db: any, tables: any, id: number) {
        const { staffs, staffRoles, roles, staffBranches, branches, auditLogs } = tables;

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

        // Get tracking data from audit logs
        const [createLog] = await db
                .select()
                .from(auditLogs)
                .where(and(eq(auditLogs.entityType, 'staff'), eq(auditLogs.entityId, String(id)), eq(auditLogs.action, 'create')))
                .orderBy(auditLogs.createdAt)
                .limit(1);

        const [updateLog] = await db
                .select()
                .from(auditLogs)
                .where(and(eq(auditLogs.entityType, 'staff'), eq(auditLogs.entityId, String(id)), eq(auditLogs.action, 'update')))
                .orderBy(desc(auditLogs.createdAt))
                .limit(1);

        return {
                status: 'success',
                staff: {
                        ...staff,
                        created_by_staff_name: createLog?.staffFullname || null,
                        updated_by_staff_name: updateLog?.staffFullname || null,
                        roles: roleData.map((r) => ({ id: r.roleId, name: r.roleName })),
                        branches: branchData.map((b) => ({ id: b.branchId, name: b.branchName }))
                }
        };
}

export async function createStaffImpl(
        db: any,
        tables: any,
        kv: any,
        body: {
                email: string;
                password?: string;
                fullname: string;
                phone?: string;
                avatar?: string;
                roleIds?: number[];
                branchIds?: number[];
                forcePasswordChange?: boolean;
        },
        caller?: { isSuperAdmin?: boolean; branchIds?: number[]; id?: number; email?: string; fullname?: string },
        env?: any,
        context?: { waitUntil: (promise: Promise<any>) => void },
        mailer?: (to: string, subject: string, html: string) => Promise<any>
) {
        const { staffs, staffRoles, staffBranches, email_logs } = tables;
        const { email, password, fullname, phone, avatar, roleIds = [], branchIds = [], forcePasswordChange = true } = body;
        const callerBranchIds = caller?.branchIds || [];
        const callerIsSuperAdmin = !!caller?.isSuperAdmin;
        const now = new Date().toISOString();

        console.log('createStaffImpl forcePasswordChange:', forcePasswordChange, 'body:', body);

        // Check if email already exists in staffs
        const [existingStaff] = await db.select().from(staffs).where(eq(staffs.email, email)).limit(1);
        if (existingStaff && !existingStaff.deletedAt) {
                return { status: 'error', message: 'Email đã tồn tại trong danh sách nhân viên đang hoạt động' };
        }

        // Check if email already exists in accounts (Users)
        const { accounts } = await import('../../../worker/src/schema');
        const [existingUser] = await db.select().from(accounts).where(eq(accounts.email, email)).limit(1);
        if (existingUser) {
                return { status: 'error', message: 'Email này đang được sử dụng bởi một tài khoản khách hàng. Vui lòng dùng email khác.' };
        }

        if (!callerIsSuperAdmin) {
                if (roleIds.length > 0) {
                        return { status: 'error', message: 'Chỉ Super Admin mới được gán role cho nhân viên' };
                }

                if (branchIds.length > 0) {
                        const invalidBranch = branchIds.some((branchId) => !callerBranchIds.includes(branchId));
                        if (invalidBranch) {
                                return { status: 'error', message: 'Không được gán nhân viên cho chi nhánh ngoài phạm vi quản lý' };
                        }
                }
        }

        // Auto-generate password if not provided
        const generatedPassword = password || generateRandomPassword();

        // Hash password
        const hashedPassword = await hashPassword(generatedPassword);

        // Log generated password to console for local dev convenience
        console.log(`\n===============================================================`);
        console.log(`🎉 [STAFF CREATED / REACTIVATED]`);
        console.log(`👤 Nhân viên: ${fullname} (${email})`);
        console.log(`🔑 MẬT KHẨU KHỞI TẠO: ${generatedPassword}`);
        console.log(`===============================================================\n`);

        let targetStaffId: number;

        if (existingStaff && existingStaff.deletedAt) {
                // Reactivate soft-deleted staff
                targetStaffId = existingStaff.id;
                await db
                        .update(staffs)
                        .set({
                                password: hashedPassword,
                                fullname,
                                phone: phone || null,
                                avatar: avatar || null,
                                isSuperAdmin: false,
                                isActive: true,
                                deletedAt: null,
                                deleted_by_staff_id: null,
                                forcePasswordChange,
                                updatedAt: now
                        })
                        .where(eq(staffs.id, targetStaffId));

                // Clean old roles and branches
                await db.delete(staffRoles).where(eq(staffRoles.staffId, targetStaffId));
                await db.delete(staffBranches).where(eq(staffBranches.staffId, targetStaffId));
                await invalidateStaffPermissionCache(kv, targetStaffId);
        } else {
                // Create brand new staff
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
                                forcePasswordChange,
                                createdAt: now,
                                updatedAt: now
                        })
                        .returning();
                targetStaffId = newStaff.id;
        }

        // Assign roles
        for (const roleId of roleIds) {
                await db.insert(staffRoles).values({
                        staffId: targetStaffId,
                        roleId
                });
        }

        // Assign branches
        for (const branchId of branchIds) {
                await db.insert(staffBranches).values({
                        staffId: targetStaffId,
                        branchId
                });
        }

        // Send email with password
        const clientBase = String(env?.VITE_CLIENT_BASE_URL || 'https://cinesphere.com.vn').replace(/\/$/, '');
        const loginUrl = `${clientBase}/login`;
        const emailHtml = getStaffAccountCreatedTemplate({
                staffName: fullname,
                email: email,
                password: generatedPassword,
                loginUrl: loginUrl
        });

        if (mailer) {
                const { mailQueue } = await import('../../lib/mail-queue');
                mailQueue.add(
                        async () => {
                                try {
                                        const mailRes = await mailer(email, 'Tài khoản nhân viên CINESPHERE', emailHtml);
                                        console.log(`[Staff] Sent account creation email to ${email}`, mailRes);
                                } catch (e: any) {
                                        console.error(`[Staff] Failed to send email to ${email}:`, e?.message || e);
                                        throw e;
                                }
                        },
                        {
                                db,
                                recipient: email,
                                subject: 'Tài khoản nhân viên CINESPHERE',
                                emailType: 'welcome',
                                recipientType: 'staff',
                                staffId: targetStaffId,
                                emailLogsTable: email_logs
                        },
                        context
                );
        } else {
                console.warn('[Staff] No mailer provided, skipping account creation email (password was logged to console)');
        }

        const [finalStaff] = await db.select().from(staffs).where(eq(staffs.id, targetStaffId)).limit(1);
        const auditNew = buildStaffAuditPayload(finalStaff, { roleIds, branchIds });

        // Log audit action
        await logAuditAction(
                db,
                tables.auditLogs,
                existingStaff?.deletedAt ? 'restore' : 'create',
                'staff',
                targetStaffId,
                `${existingStaff?.deletedAt ? 'Tạo lại (kích hoạt)' : 'Tạo'} nhân viên: ${fullname} (${email})`,
                caller?.id || null,
                caller?.email || email,
                caller?.fullname || fullname,
                undefined,
                auditNew
        );

        return {
                status: 'success',
                message: 'Đã tạo nhân viên thành công',
                staff: {
                        id: targetStaffId,
                        email: email,
                        fullname: fullname
                }
        };
}

function generateRandomPassword(length: number = 12): string {
        const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
        let password = '';
        for (let i = 0; i < length; i++) {
                password += charset.charAt(Math.floor(Math.random() * charset.length));
        }
        return password;
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
                forcePasswordChange?: boolean;
        },
        caller?: { isSuperAdmin?: boolean; branchIds?: number[]; id?: number; email?: string; fullname?: string },
        env?: any,
        context?: { waitUntil: (promise: Promise<any>) => void }
) {
        const { staffs, staffRoles, staffBranches } = tables;
        const { email, fullname, phone, avatar, isActive, roleIds, branchIds, forcePasswordChange } = body;
        const callerBranchIds = caller?.branchIds || [];
        const callerIsSuperAdmin = !!caller?.isSuperAdmin;
        const now = new Date().toISOString();

        console.log('updateStaffImpl body:', body);

        // Check if staff exists
        const [existing] = await db.select().from(staffs).where(eq(staffs.id, id)).limit(1);
        if (!existing) {
                return { status: 'error', message: 'Staff not found' };
        }

        // Cannot modify super admin
        if (existing.isSuperAdmin) {
                return { status: 'error', message: 'Không thể sửa super admin' };
        }

        if (!callerIsSuperAdmin) {
                if (roleIds !== undefined) {
                        return { status: 'error', message: 'Chỉ Super Admin mới được thay đổi role của nhân viên' };
                }

                if (branchIds !== undefined) {
                        const invalidBranch = branchIds.some((branchId) => !callerBranchIds.includes(branchId));
                        if (invalidBranch) {
                                return { status: 'error', message: 'Không được gán nhân viên cho chi nhánh ngoài phạm vi quản lý' };
                        }
                }
        }

        // Check email uniqueness if changing email
        if (email && email !== existing.email) {
                const [emailCheck] = await db.select().from(staffs).where(eq(staffs.email, email)).limit(1);
                if (emailCheck) {
                        return { status: 'error', message: 'Email đã tồn tại trong danh sách nhân viên' };
                }

                // Check in accounts table
                const { accounts } = await import('../../../worker/src/schema');
                const [userCheck] = await db.select().from(accounts).where(eq(accounts.email, email)).limit(1);
                if (userCheck) {
                        return { status: 'error', message: 'Email này đang được sử dụng bởi một tài khoản khách hàng.' };
                }
        }

        const oldRoles = await db.select({ roleId: staffRoles.roleId }).from(staffRoles).where(eq(staffRoles.staffId, id));
        const oldBranches = await db.select({ branchId: staffBranches.branchId }).from(staffBranches).where(eq(staffBranches.staffId, id));

        const auditOld = buildStaffAuditPayload(existing, {
                roleIds: oldRoles.map((r) => r.roleId),
                branchIds: oldBranches.map((b) => b.branchId)
        });

        // Update staff
        const updateData: any = { updatedAt: now };
        if (email) updateData.email = email;
        if (fullname) updateData.fullname = fullname;
        if (phone !== undefined) updateData.phone = phone;
        if (avatar !== undefined) updateData.avatar = avatar;
        if (isActive !== undefined) updateData.isActive = isActive;
        if (forcePasswordChange !== undefined) updateData.forcePasswordChange = forcePasswordChange;

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

        const [updatedStaff] = await db.select().from(staffs).where(eq(staffs.id, id)).limit(1);
        const newRoles = await db.select({ roleId: staffRoles.roleId }).from(staffRoles).where(eq(staffRoles.staffId, id));
        const newBranches = await db.select({ branchId: staffBranches.branchId }).from(staffBranches).where(eq(staffBranches.staffId, id));

        const auditNew = buildStaffAuditPayload(updatedStaff, {
                roleIds: newRoles.map((r) => r.roleId),
                branchIds: newBranches.map((b) => b.branchId)
        });

        // Log audit action
        await logAuditAction(
                db,
                tables.auditLogs,
                'update',
                'staff',
                id,
                `Cập nhật nhân viên: ${existing.fullname} (${existing.email})`,
                caller?.id || null,
                caller?.email || existing.email,
                caller?.fullname || existing.fullname,
                auditOld,
                auditNew
        );

        return {
                status: 'success',
                message: 'Đã cập nhật nhân viên thành công'
        };
}

export async function deleteStaffImpl(db: any, tables: any, id: number, staffInfo?: { id: number; email: string; fullname: string }) {
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

        const deletionTimestamp = new Date().toISOString();

        // Soft delete by setting isActive to false and deleted_at
        await db
                .update(staffs)
                .set({ isActive: false, deletedAt: deletionTimestamp, deleted_by_staff_id: staffInfo?.id })
                .where(eq(staffs.id, id));

        const auditOld = buildStaffAuditPayload(existing);
        const auditNew = buildStaffAuditPayload({
                ...existing,
                isActive: false,
                deletedAt: deletionTimestamp,
                deleted_by_staff_id: staffInfo?.id
        });

        // Log audit action
        await logAuditAction(
                db,
                tables.auditLogs,
                'delete',
                'staff',
                id,
                `Xóa nhân viên: ${existing.fullname} (${existing.email})`,
                staffInfo?.id || null,
                staffInfo?.email || existing.email,
                staffInfo?.fullname || existing.fullname,
                auditOld,
                auditNew
        );

        return {
                status: 'success',
                message: 'Đã xóa nhân viên thành công'
        };
}

export async function restoreStaffImpl(
        db: any,
        tables: any,
        id: number,
        staffInfo?: { id: number; email: string; fullname: string }
) {
        const { staffs } = tables;

        const [existing] = await db.select().from(staffs).where(eq(staffs.id, id)).limit(1);
        if (!existing) {
                return { status: 'error', message: 'Staff not found' };
        }

        // Restore by setting isActive to true and deleted_at to null
        await db.update(staffs).set({ isActive: true, deletedAt: null }).where(eq(staffs.id, id));

        const auditOld = buildStaffAuditPayload(existing);
        const auditNew = buildStaffAuditPayload({ ...existing, isActive: true, deletedAt: null });

        // Log audit action
        await logAuditAction(
                db,
                tables.auditLogs,
                'restore',
                'staff',
                id,
                `Restore nhân viên: ${existing.fullname} (${existing.email})`,
                staffInfo?.id,
                staffInfo?.email,
                staffInfo?.fullname,
                auditOld,
                auditNew
        );

        return {
                status: 'success',
                message: 'Đã restore nhân viên thành công'
        };
}

export async function listDeletedStaffImpl(
        db: any,
        tables: any,
        options: { page?: number; pageSize?: number; search?: string } = {}
) {
        const { staffs } = tables;
        const { page = 1, pageSize = 10, search = '' } = options;

        const conditions = [];
        if (search) {
                conditions.push(
                        or(
                                like(staffs.fullname, `%${search}%`),
                                like(staffs.email, `%${search}%`)
                        )
                );
        }
        conditions.push(isNotNull(staffs.deletedAt));

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        // Self-join to get deleted_by staff info
        const staffsAlias = aliasedTable(staffs, 'deleted_by_staff');
        const query = db
                .select({
                        id: staffs.id,
                        email: staffs.email,
                        fullname: staffs.fullname,
                        phone: staffs.phone,
                        isSuperAdmin: staffs.isSuperAdmin,
                        deletedAt: staffs.deletedAt,
                        deleted_by_staff_id: staffs.deleted_by_staff_id,
                        deleted_by_staff_name: staffsAlias.fullname
                })
                .from(staffs)
                .leftJoin(staffsAlias, eq(staffs.deleted_by_staff_id, staffsAlias.id))
                .where(whereClause)
                .limit(pageSize)
                .offset((page - 1) * pageSize)
                .orderBy(desc(staffs.deletedAt));

        const items = await query;

        const [countResult] = await db
                .select({ count: count() })
                .from(staffs)
                .where(whereClause);

        return {
                status: 'success',
                items,
                total: countResult?.count || 0,
                page,
                pageSize
        };
}

export async function resetStaffPasswordImpl(
        db: any,
        tables: any,
        kv: any,
        id: number,
        body: { newPassword?: string },
        env?: any,
        context?: { waitUntil: (promise: Promise<any>) => void },
        mailer?: (to: string, subject: string, html: string) => Promise<any>
) {
        const { staffs, staffTokens, email_logs } = tables;
        const { newPassword: requestedPassword } = body;
        const now = new Date().toISOString();

        // Check if staff exists
        const [existing] = await db.select().from(staffs).where(eq(staffs.id, id)).limit(1);
        if (!existing) {
                return { status: 'error', message: 'Staff not found' };
        }

        // Generate password if not provided
        let newPassword = '';
        if (!requestedPassword) {
                newPassword = Math.random().toString(36).slice(-8);
        } else {
                newPassword = requestedPassword;
        }

        // Hash new password
        const hashedPassword = await hashPassword(newPassword);

        // Update password and force change on next login
        await db
                .update(staffs)
                .set({
                        password: hashedPassword,
                        forcePasswordChange: true,
                        updatedAt: now
                })
                .where(eq(staffs.id, id));

        // Revoke all sessions
        await db
                .update(staffTokens)
                .set({ revokedAt: now, revokeReason: 'password_reset' })
                .where(and(eq(staffTokens.staffId, id), isNull(staffTokens.revokedAt)));

        // Invalidate permission cache
        await invalidateStaffPermissionCache(kv, id);

        // Send email notification about password reset
        const clientBase = String(env?.VITE_CLIENT_BASE_URL || 'https://cinesphere.com.vn').replace(/\/$/, '');
        const loginUrl = `${clientBase}/login`;
        const emailHtml = getStaffPasswordResetTemplate({
                staffName: existing.fullname,
                email: existing.email,
                newPassword: newPassword,
                loginUrl: loginUrl
        });

        // Log prominent reset password banner in console for local dev convenience
        console.log(`\n===============================================================`);
        console.log(`🔑 [ADMIN RESET STAFF PASSWORD]`);
        console.log(`👤 Nhân viên: ${existing.fullname} (${existing.email})`);
        console.log(`🔑 MẬT KHẨU MỚI: ${newPassword}`);
        console.log(`===============================================================\n`);

        if (mailer) {
                const { mailQueue } = await import('../../lib/mail-queue');
                mailQueue.add(
                        async () => {
                                try {
                                        const mailRes = await mailer(existing.email, 'Reset Mật Khẩu Nhân Viên - CINESPHERE', emailHtml);
                                        console.log(`[Staff] Sent password reset email to ${existing.email}`, mailRes);
                                } catch (e: any) {
                                        console.error(`[Staff] Failed to send password reset email to ${existing.email}:`, e?.message || e);
                                        throw e;
                                }
                        },
                        {
                                db,
                                recipient: existing.email,
                                subject: 'Reset Mật Khẩu Nhân Viên - CINESPHERE',
                                emailType: 'reset_password',
                                recipientType: 'staff',
                                staffId: id,
                                emailLogsTable: email_logs
                        },
                        context
                );
        } else {
                console.warn('[Staff] No mailer provided, skipping password reset email (new password was logged to console)');
        }

        const auditOld = buildStaffAuditPayload(existing);
        const auditNew = buildStaffAuditPayload({
                ...existing,
                forcePasswordChange: true,
                updatedAt: now
        });

        // Log audit action
        await logAuditAction(
                db,
                tables.auditLogs,
                'reset_password',
                'staff',
                id,
                `Reset mật khẩu nhân viên: ${existing.fullname} (${existing.email})`,
                null,
                existing.email,
                existing.fullname,
                auditOld,
                auditNew
        );

        return {
                status: 'success',
                message: 'Đã reset mật khẩu thành công và gửi email thông báo cho nhân viên'
        };
}
