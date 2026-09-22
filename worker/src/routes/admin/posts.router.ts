import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../../../../shared/schema';
import { requireStaffAuth, requirePermission } from '../../middleware';
import { getCloudHelpers } from './admin-helpers';
import { parseMediaUrl, pingIndexNow } from '../../utils';

import {
  listPostsImpl,
  getPostImpl,
  createPostImpl,
  updatePostImpl,
  deletePostImpl
} from '../../../../server/routes/admin/posts';

type Variables = { staffId?: number; staffEmail?: string; staffFullname?: string; isSuperAdmin?: boolean; staffPermissions?: Array<{ module: string; action: string }>; staffBranchIds?: number[]; };
const postsRouter = new Hono<{ Bindings: any; Variables: Variables }>();

postsRouter.get('/api/admin/posts', requireStaffAuth, requirePermission('posts', 'view'), async (c) => {
  try {
    const page = Number(c.req.query('page') || 1);
    const pageSize = Number(c.req.query('pageSize') || 10);
    const q = String(c.req.query('q') || '');
    const status = String(c.req.query('status') || 'all');
    const db = drizzle(c.env.cinema_db, { schema });

    const r = await listPostsImpl(
      db,
      { posts: schema.posts, auditLogs: schema.auditLogs },
      { page, pageSize, q, status }
    );

    const parsedItems = (r.items || []).map((p: any) => ({
      ...p,
      cover_image: parseMediaUrl(p.cover_image, c)
    }));

    return c.json({ ...r, items: parsedItems });
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

postsRouter.get('/api/admin/posts/:id', requireStaffAuth, requirePermission('posts', 'view'), async (c) => {
  try {
    const id = c.req.param('id');

    const db = drizzle(c.env.cinema_db, { schema });

    const post = await getPostImpl(db, { posts: schema.posts, auditLogs: schema.auditLogs }, id, false);

    if (!post) return c.json({ message: 'Không tìm thấy bài viết' }, 404);

    const parsed = {
      ...post,

      cover_image: parseMediaUrl(post.cover_image, c)
    };

    return c.json({ post: parsed }, 200);
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

postsRouter.post('/api/admin/posts', requireStaffAuth, requirePermission('posts', 'create'), async (c) => {
  try {
    const db = drizzle(c.env.cinema_db, { schema });

    const body = await c.req.json().catch(() => ({}));

    const staffId = c.get('staffId');
    const staffEmail = c.get('staffEmail');
    const staffFullname = c.get('staffFullname');

    const r = await createPostImpl(
      db,
      { posts: schema.posts, auditLogs: schema.auditLogs },
      body,
      c.env,
      getCloudHelpers(c, c.env).uploader,
      { id: staffId, email: staffEmail, fullname: staffFullname }
    );

    if (r && r.status === 'published') {
      const base = String(c.env.VITE_CLIENT_BASE_URL || 'https://cinesphere.com.vn').replace(/\/$/, '');

      const url = `${base}/bai-viet/${r.slug ? `${r.slug}-` : ''}${r.id}`;
      const sitemapUrl = `${base}/sitemap.xml`;

      c.executionCtx.waitUntil(pingIndexNow(c.env, [url, sitemapUrl]));
    }

    return c.json({ status: 'success', post: r });
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// Admin: Update post

postsRouter.put('/api/admin/posts/:id', requireStaffAuth, requirePermission('posts', 'edit'), async (c) => {
  try {
    const id = Number(c.req.param('id'));

    const db = drizzle(c.env.cinema_db, { schema });

    const body = await c.req.json().catch(() => ({}));

    const helpers = getCloudHelpers(c, c.env);

    const staffId = c.get('staffId');
    const staffEmail = c.get('staffEmail');
    const staffFullname = c.get('staffFullname');

    const r = await updatePostImpl(
      db,
      { posts: schema.posts, auditLogs: schema.auditLogs },
      id,
      body,
      c.env,
      helpers.uploader,
      helpers.deleter,
      { id: staffId, email: staffEmail, fullname: staffFullname }
    );

    if (!r) return c.json({ message: 'Không tìm thấy' }, 404);

    if (r.status === 'published') {
      const base = String(c.env.VITE_CLIENT_BASE_URL || 'https://cinesphere.com.vn').replace(/\/$/, '');

      const url = `${base}/bai-viet/${r.slug ? `${r.slug}-` : ''}${r.id}`;
      const sitemapUrl = `${base}/sitemap.xml`;

      c.executionCtx.waitUntil(pingIndexNow(c.env, [url, sitemapUrl]));
    }

    return c.json({ status: 'success', post: r });
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

// Admin: Delete post

postsRouter.delete('/api/admin/posts/:id', requireStaffAuth, requirePermission('posts', 'delete'), async (c) => {
  try {
    const id = Number(c.req.param('id'));

    const db = drizzle(c.env.cinema_db, { schema });

    const staffId = c.get('staffId');
    const staffEmail = c.get('staffEmail');
    const staffFullname = c.get('staffFullname');
    const isSuperAdmin = c.get('isSuperAdmin');

    const r = await deletePostImpl(
      db,
      { posts: schema.posts, auditLogs: schema.auditLogs },
      id,
      getCloudHelpers(c, c.env).deleter,
      { id: staffId, email: staffEmail, fullname: staffFullname },
      isSuperAdmin
    );

    if (!r) return c.json({ message: 'Không tìm thấy' }, 404);

    return c.json({ status: 'success', message: isSuperAdmin ? 'Đã xóa vĩnh viễn' : 'Đã lưu trữ bài viết' });
  } catch (err: any) {
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, 500);
  }
});

const getD1Tables = (schema: any) => ({
  bookings: schema.bookings,
  users: schema.users,
  accounts: schema.accounts,
  movies: schema.movies,
  ticket_packages: schema.ticket_packages,
  email_logs: schema.email_logs,
  branches: schema.branches,
  booking_vr_items: schema.booking_vr_items,
  vouchers: schema.vouchers,
  voucher_redemption_logs: schema.voucher_redemption_logs
});

// POST /api/admin/confirm-booking

export default postsRouter;
