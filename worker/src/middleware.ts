import { Context } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { validateSessionTokenImpl } from '../../server/routes/user/auth';
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
