import { eq, and, isNull } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import {
        hashPassword,
        verifyPassword,
        generateToken,
        getStaffSessionExpiry,
        invalidateStaffPermissionCache
} from '../../lib/staff-auth';
import { logAuditAction } from '../../lib/audit-logger';
import { buildStaffAuditPayload } from './staff-audit-utils';
import { sendStaffPasswordChangeOTP, validateStaffOTP, deleteStaffOTP } from '../../lib/otp-utils';

export async function staffLoginImpl(db: any, tables: any, kv: any, body: { email: string; password: string }) {
        const { staffs, staffTokens } = tables;
        const { email, password } = body;

        // Find staff by email
        const [staff] = await db.select().from(staffs).where(eq(staffs.email, email)).limit(1);
        if (!staff) {
                return { status: 'error', message: 'Email hoặc mật khẩu không đúng' };
        }

        // Check if staff is active
        if (!staff.isActive) {
                return { status: 'error', message: 'Tài khoản đã bị vô hiệu hóa' };
        }

        // Verify password
        const isValid = await verifyPassword(password, staff.password);
        if (!isValid) {
                return { status: 'error', message: 'Email hoặc mật khẩu không đúng' };
        }

        // Generate token
        const token = generateToken();
        const expiredAt = getStaffSessionExpiry();
        const now = new Date().toISOString();

        // Insert token
        await db.insert(staffTokens).values({
                staffId: staff.id,
                token,
                type: 'session',
                expiredAt,
                createdAt: now
        });

        // Update last login
        await db.update(staffs).set({ lastLoginAt: now }).where(eq(staffs.id, staff.id));

        // Log audit action
        await logAuditAction(
                db,
                tables.auditLogs,
                'login',
                'staff',
                staff.id,
                'Staff đăng nhập thành công',
                staff.id,
                staff.email,
                staff.fullname
        );

        // Load permissions and branches
        const { loadStaffPermissions } = await import('../../lib/staff-auth');
        const { permissions, branchIds, isSuperAdmin } = await loadStaffPermissions(db, tables, kv, staff.id);

        return {
                status: 'success',
                staff: {
                        id: staff.id,
                        email: staff.email,
                        fullname: staff.fullname,
                        isSuperAdmin: staff.isSuperAdmin,
                        forcePasswordChange: staff.forcePasswordChange
                },
                permissions,
                branchIds,
                token
        };
}

export async function staffLogoutImpl(db: any, tables: any, token: string) {
        const { staffTokens } = tables;
        const now = new Date().toISOString();

        // Soft revoke token
        await db.update(staffTokens).set({ revokedAt: now, revokeReason: 'logout' }).where(eq(staffTokens.token, token));

        return { status: 'success', message: 'Đăng xuất thành công' };
}

export async function staffGetMeImpl(db: any, tables: any, kv: any, staffId: number) {
        const { staffs } = tables;

        const [staff] = await db.select().from(staffs).where(eq(staffs.id, staffId)).limit(1);
        if (!staff) {
                return { status: 'error', message: 'Staff not found' };
        }

        // Load permissions and branches
        const { loadStaffPermissions } = await import('../../lib/staff-auth');
        const { permissions, branchIds, isSuperAdmin } = await loadStaffPermissions(db, tables, kv, staff.id);

        return {
                status: 'success',
                staff: {
                        id: staff.id,
                        email: staff.email,
                        fullname: staff.fullname,
                        phone: staff.phone,
                        avatar: staff.avatar,
                        isSuperAdmin: staff.isSuperAdmin,
                        forcePasswordChange: staff.forcePasswordChange,
                        lastLoginAt: staff.lastLoginAt
                },
                permissions,
                branchIds
        };
}

export async function staffChangePasswordImpl(
        db: any,
        tables: any,
        kv: any,
        staffId: number,
        body: { oldPassword: string; newPassword: string }
) {
        const { staffs, staffTokens } = tables;
        const { oldPassword, newPassword } = body;

        // Get staff
        const [staff] = await db.select().from(staffs).where(eq(staffs.id, staffId)).limit(1);
        if (!staff) {
                return { status: 'error', message: 'Staff not found' };
        }

        // Verify old password
        const isValid = await verifyPassword(oldPassword, staff.password);
        if (!isValid) {
                return { status: 'error', message: 'Mật khẩu cũ không đúng' };
        }

        // Hash new password
        const hashedPassword = await hashPassword(newPassword);
        const now = new Date().toISOString();

        // Update password
        await db
                .update(staffs)
                .set({
                        password: hashedPassword,
                        forcePasswordChange: false,
                        updatedAt: now
                })
                .where(eq(staffs.id, staffId));

        // Revoke all other sessions (except current one will be handled by client)
        await db
                .update(staffTokens)
                .set({ revokedAt: now, revokeReason: 'password_change' })
                .where(and(eq(staffTokens.staffId, staffId), isNull(staffTokens.revokedAt)));

        const auditOld = buildStaffAuditPayload(staff);
        const auditNew = buildStaffAuditPayload({ ...staff, forcePasswordChange: false, updatedAt: now });

        // Log audit action
        await logAuditAction(
                db,
                tables.auditLogs,
                'change_password',
                'staff',
                staffId,
                'Staff đổi mật khẩu',
                staffId,
                staff.email,
                staff.fullname,
                auditOld,
                auditNew
        );

        return { status: 'success', message: 'Đổi mật khẩu thành công' };
}

export async function staffForgotPasswordImpl(db: any, tables: any, body: { email: string }) {
        const { staffs, staffTokens } = tables;
        const { email } = body;

        // Find staff by email
        const [staff] = await db.select().from(staffs).where(eq(staffs.email, email)).limit(1);
        if (!staff) {
                return { status: 'error', message: 'Email không tồn tại' };
        }

        // Generate reset token
        const token = generateToken();
        const expiredAt = new Date();
        expiredAt.setHours(expiredAt.getHours() + 1); // 1 hour expiry
        const now = new Date().toISOString();

        // Insert reset token
        await db.insert(staffTokens).values({
                staffId: staff.id,
                token,
                type: 'reset',
                expiredAt: expiredAt.toISOString(),
                createdAt: now
        });

        // TODO: Send email with reset link
        // For now, return the token (in production, send via email)
        return {
                status: 'success',
                message: 'Đã gửi email reset mật khẩu'
                // token, // Only for development
        };
}

export async function staffResetPasswordImpl(
        db: any,
        tables: any,
        kv: any,
        body: { token: string; newPassword: string }
) {
        const { staffs, staffTokens } = tables;
        const { token, newPassword } = body;
        const now = new Date().toISOString();

        // Validate reset token
        const [tokenRecord] = await db
                .select({ staffId: staffTokens.staffId })
                .from(staffTokens)
                .where(and(eq(staffTokens.token, token), eq(staffTokens.type, 'reset'), isNull(staffTokens.revokedAt)))
                .limit(1);

        if (!tokenRecord) {
                return { status: 'error', message: 'Token không hợp lệ hoặc đã hết hạn' };
        }

        const [staff] = await db.select().from(staffs).where(eq(staffs.id, tokenRecord.staffId)).limit(1);
        if (!staff) {
                return { status: 'error', message: 'Staff not found' };
        }

        const auditOld = buildStaffAuditPayload(staff);

        // Hash new password
        const hashedPassword = await hashPassword(newPassword);

        // Update password
        await db
                .update(staffs)
                .set({
                        password: hashedPassword,
                        forcePasswordChange: true,
                        updatedAt: now
                })
                .where(eq(staffs.id, tokenRecord.staffId));

        // Revoke reset token
        await db
                .update(staffTokens)
                .set({ revokedAt: now, revokeReason: 'password_reset' })
                .where(eq(staffTokens.token, token));

        // Revoke all sessions
        await db
                .update(staffTokens)
                .set({ revokedAt: now, revokeReason: 'password_reset' })
                .where(and(eq(staffTokens.staffId, tokenRecord.staffId), isNull(staffTokens.revokedAt)));

        // Invalidate permission cache
        await invalidateStaffPermissionCache(kv, tokenRecord.staffId);

        const auditNew = buildStaffAuditPayload({ ...staff, forcePasswordChange: true, updatedAt: now });

        // Log audit action
        await logAuditAction(
                db,
                tables.auditLogs,
                'reset_password',
                'staff',
                tokenRecord.staffId,
                'Staff reset mật khẩu (qua forgot password)',
                staff.id,
                staff.email,
                staff.fullname,
                auditOld,
                auditNew
        );

        return { status: 'success', message: 'Đặt lại mật khẩu thành công' };
}

export async function staffRequestPasswordChangeOTP(
        db: any,
        tables: any,
        staffId: number,
        body: { oldPassword: string },
        context?: { waitUntil: (promise: Promise<any>) => void }
) {
        const { staffs } = tables;
        const { oldPassword } = body;

        // Get staff
        const [staff] = await db.select().from(staffs).where(eq(staffs.id, staffId)).limit(1);
        if (!staff) {
                return { status: 'error', message: 'Staff not found' };
        }

        // Verify old password
        const isValid = await verifyPassword(oldPassword, staff.password);
        if (!isValid) {
                return { status: 'error', message: 'Mật khẩu cũ không đúng' };
        }

        // Send OTP
        const result = await sendStaffPasswordChangeOTP(
                db,
                { staffTokens: tables.staffTokens, email_logs: tables.email_logs },
                staffId,
                staff.fullname,
                staff.email,
                5, // 5 minutes expiry
                context
        );

        if (!result.success) {
                return { status: 'error', message: 'Không thể gửi OTP, vui lòng thử lại sau' };
        }

        return { status: 'success', message: 'Đã gửi OTP đến email của bạn' };
}

export async function staffChangePasswordWithOTP(
        db: any,
        tables: any,
        kv: any,
        staffId: number,
        body: { oldPassword: string; newPassword: string; otp: string }
) {
        const { staffs, staffTokens } = tables;
        const { oldPassword, newPassword, otp } = body;

        // Get staff
        const [staff] = await db.select().from(staffs).where(eq(staffs.id, staffId)).limit(1);
        if (!staff) {
                return { status: 'error', message: 'Staff not found' };
        }

        // Verify old password
        const isValid = await verifyPassword(oldPassword, staff.password);
        if (!isValid) {
                return { status: 'error', message: 'Mật khẩu cũ không đúng' };
        }

        // Validate OTP
        const otpValidation = await validateStaffOTP(db, { staffTokens }, staffId, otp);
        if (!otpValidation.valid) {
                return { status: 'error', message: otpValidation.error || 'OTP không hợp lệ' };
        }

        // Hash new password
        const hashedPassword = await hashPassword(newPassword);
        const now = new Date().toISOString();

        // Update password
        await db
                .update(staffs)
                .set({
                        password: hashedPassword,
                        forcePasswordChange: false,
                        updatedAt: now
                })
                .where(eq(staffs.id, staffId));

        // Delete used OTP
        await deleteStaffOTP(db, { staffTokens }, staffId);

        // Revoke all other sessions
        await db
                .update(staffTokens)
                .set({ revokedAt: now, revokeReason: 'password_change' })
                .where(and(eq(staffTokens.staffId, staffId), isNull(staffTokens.revokedAt)));

        // Invalidate permission cache
        await invalidateStaffPermissionCache(kv, staffId);

        const auditOld = buildStaffAuditPayload(staff);
        const auditNew = buildStaffAuditPayload({ ...staff, forcePasswordChange: false, updatedAt: now });

        // Log audit action
        await logAuditAction(
                db,
                tables.auditLogs,
                'change_password',
                'staff',
                staffId,
                'Staff đổi mật khẩu với OTP',
                staffId,
                staff.email,
                staff.fullname,
                auditOld,
                auditNew
        );

        return { status: 'success', message: 'Đổi mật khẩu thành công' };
}
