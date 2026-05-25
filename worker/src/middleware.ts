import { Context } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { validateSessionTokenImpl } from '../../server/routes/user/auth';
import * as schema from './schema';

/**
 * Middleware requireAuth - Check session token
 * Sử dụng cho các routes cần login (client và admin)
 */
export async function requireAuth(c: Context, next: any) {
  try {
    const token =
      c.req.header('cookie')?.match(/session_token=([^;]+)/)?.[1] ||
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

    const account = validation.accountId
      ? await db.query.accounts.findFirst({
          where: eq(schema.accounts.id, validation.accountId),
          with: {
            user: {
              with: {
                permissions: {
                  with: {
                    permission: true
                  }
                }
              }
            }
          }
        })
      : null;

    const dbUser = (account as any)?.user as any;
    const dbUserPermissions = (dbUser?.permissions ?? []) as any[];
    const permissions = dbUserPermissions
      .map((up: any) => up?.permission?.key)
      .filter((x: any) => typeof x === 'string');

    c.set('adminUser', {
      id: dbUser?.id ?? validation.userId ?? null,
      email: account?.email ?? null,
      name: dbUser?.fullname ?? null,
      role: dbUser?.role ?? 'admin',
      is_active: account?.is_active ?? true,
      permissions
    });

    await next();
  } catch (error) {
    return c.json({ status: 'error', message: 'Internal server error' }, 500);
  }
}

export function superAdminOnly(c: Context, next: any) {
  const user = c.get('adminUser') as any;
  if (!user || user.role !== 'super_admin') {
    return c.json({ status: 'error', message: 'Chỉ Super Admin mới có quyền này' }, 403);
  }
  return next();
}

export function checkPermission(requiredPermission: string) {
  return async (c: Context, next: any) => {
    const user = c.get('adminUser') as any;

    if (!user) {
      return c.json({ status: 'error', message: 'Unauthorized' }, 401);
    }

    if (user.role === 'super_admin') {
      await next();
      return;
    }

    if (user.is_active === false) {
      return c.json({ status: 'error', message: 'Tài khoản đã bị vô hiệu hóa' }, 403);
    }

    const ok = Array.isArray(user.permissions) && user.permissions.includes(requiredPermission);
    if (!ok) {
      return c.json(
        {
          status: 'error',
          message: 'Bạn không có quyền thực hiện thao tác này',
          required: requiredPermission
        },
        403
      );
    }

    await next();
  };
}
