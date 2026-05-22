import { Context } from 'hono';
import { validateSessionTokenImpl } from '../../server/routes/user/auth';
import * as schema from './schema';

/**
 * Middleware requireAuth - Check session token
 * Sử dụng cho các routes cần login (client và admin)
 */
export async function requireAuth(c: Context, next: any) {
        const token = c.req.header('cookie')?.match(/session_token=([^;]+)/)?.[1] ||
                c.req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
                return c.json({ status: 'error', message: 'Unauthorized' }, 401);
        }

        const db = c.env.cinema_db;

        const validation = await validateSessionTokenImpl(db, { tokens: schema.tokens }, token);

        if (!validation.valid) {
                return c.json({ status: 'error', message: 'Unauthorized' }, 401);
        }

        c.set('userId', validation.userId);
        c.set('accountId', validation.accountId);

        await next();
}
