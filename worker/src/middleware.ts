import { Context, Next } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { validateSessionTokenImpl } from '../../server/routes/user/auth';
import { loadStaffPermissions } from '../../server/lib/staff-auth';
import { eq, and, isNull, gt } from 'drizzle-orm';
import * as schema from './schema';

/**
 * Middleware requireAuth - Check session token
 * Sử dụng cho các routes cần login (client và admin)
 */
export async function requireAuth(c: Context, next: any) {
        try {
                const token = c.req.header('cookie')?.match(/session_token=([^;]+)/)?.[1] ||
                        c.req.header('Authorization')?.replace('Bearer ', '');

                if (!token) {
                        return c.json({ status: 'error', message: 'Unauthorized' }, 401);
                }

                const db = drizzle(c.env.cinema_db, { schema });

                const validation = await validateSessionTokenImpl(db, { tokens: schema.tokens }, token);

                if (!validation.valid) {
                        return c.json({ status: 'error', message: 'Unauthorized' }, 401);
                }

                c.set('userId', validation.userId);
                c.set('accountId', validation.accountId);

                await next();
        } catch (error) {
                return c.json({ status: 'error', message: 'Internal server error' }, 500);
        }
}

/**
 * Middleware requireStaffAuth - Check staff session token
 * Sử dụng cho các admin routes cần staff authentication
 */
export async function requireStaffAuth(c: Context, next: Next) {
        try {
                const token = c.req.header('cookie')?.match(/staff_session=([^;]+)/)?.[1] ||
                        c.req.header('Authorization')?.replace('Bearer ', '');

                if (!token) {
                        return c.json({ status: 'error', message: 'Unauthorized' }, 401);
                }

                const db = drizzle(c.env.cinema_db, { schema });
                const { staffTokens, staffs } = schema;

                const now = new Date().toISOString();

                // Validate token: not revoked, not expired, staff is active
                const [tokenRecord] = await db
                        .select({
                                token: staffTokens.token,
                                staffId: staffTokens.staffId,
                                staff: {
                                        id: staffs.id,
                                        email: staffs.email,
                                        fullname: staffs.fullname,
                                        isSuperAdmin: staffs.isSuperAdmin,
                                        isActive: staffs.isActive,
                                },
                        })
                        .from(staffTokens)
                        .innerJoin(staffs, eq(staffTokens.staffId, staffs.id))
                        .where(
                                and(
                                        eq(staffTokens.token, token),
                                        isNull(staffTokens.revokedAt),
                                        gt(staffTokens.expiredAt, now),
                                        eq(staffs.isActive, true)
                                )
                        )
                        .limit(1);

                if (!tokenRecord) {
                        return c.json({ status: 'error', message: 'Unauthorized' }, 401);
                }

                // Load permissions and branch assignments
                const { permissions, branchIds, isSuperAdmin } = await loadStaffPermissions(
                        db,
                        schema,
                        c.env.KV_BINDING,
                        tokenRecord.staff.id
                );

                // Set context values
                c.set('staffId', tokenRecord.staff.id);
                c.set('staffEmail', tokenRecord.staff.email);
                c.set('staffFullname', tokenRecord.staff.fullname);
                c.set('isSuperAdmin', isSuperAdmin);
                c.set('staffPermissions', permissions);
                c.set('staffBranchIds', branchIds);

                await next();
        } catch (error) {
                return c.json({ status: 'error', message: 'Internal server error' }, 500);
        }
}

/**
 * Middleware requirePermission - Check specific permission
 * Factory function that returns middleware
 */
export function requirePermission(module: string, action: string) {
        return async (c: Context, next: Next) => {
                const isSuperAdmin = c.get('isSuperAdmin');
                const permissions = c.get('staffPermissions') || [];

                // Super admin bypasses all permission checks
                if (isSuperAdmin) {
                        await next();
                        return;
                }

                // Check if staff has the required permission
                const hasPermission = permissions.some(
                        (p: { module: string; action: string }) => p.module === module && p.action === action
                );

                if (!hasPermission) {
                        return c.json(
                                { status: 'error', message: 'Không có quyền thực hiện thao tác này' },
                                403
                        );
                }

                await next();
        };
}
