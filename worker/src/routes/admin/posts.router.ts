import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../../../../shared/schema';
import { requireStaffAuth, requirePermission } from '../../middleware';
import { getCloudHelpers, getRestrictBranchIds } from './admin-helpers';
import { eq } from 'drizzle-orm';
import { staffCanAccessBranchIds, staffCanModifyBranchRecord } from '../../../../server/lib/branch-ids';
import { parseMediaUrl, pingIndexNow } from '../../utils';
import { clampPage } from '../../../../server/lib/paging';

import {
  listPostsImpl,
  getPostImpl,
  createPostImpl,
  updatePostImpl,
  deletePostImpl
} from '../../../../server/routes/admin/posts';

type Variables = { staffId?: number; staffEmail?: string; staffFullname?: string; isSuperAdmin?: boolean; staffPermissions?: Array<{ module: string; action: string }>; staffBranchIds?: number[]; };
const postsRouter = new Hono<{ Bindings: any; Variables: Variables }>();

/**
 * Branch scope of posts, as for movies and vouchers. Branch staff see posts for all branches and for their own
 * branches; they change only posts whose branches are all theirs (a post for all branches is the Super Admin's), and
 * cannot point a post at all branches or at a branch that is not theirs. Returns an error message, or null when allowed.
 */
async function postScopeError(
  c: any,
  db: any,
  action: 'view' | 'modify',
  postId: number | string | null,
  newBranchIds?: unknown
): Promise<string | null> {
  const restrictBranchIds = getRestrictBranchIds(c);
  if (restrictBranchIds === null) return null;

  if (postId !== null) {
    const column = /^\d+$/.test(String(postId)) ? schema.posts.id : schema.posts.slug;
    const value = /^\d+$/.test(String(postId)) ? Number(postId) : String(postId);
    const post = await db.query.posts.findFirst({ where: eq(column as any, value as any), columns: { branch_ids: true } });
    if (post) {
      const allowed =
        action === 'view'
          ? staffCanAccessBranchIds(post.branch_ids, restrictBranchIds, false)
          : staffCanModifyBranchRecord(post.branch_ids, restrictBranchIds, false);
      if (!allowed) return 'Bài viết thuộc chi nhánh khác hoặc tất cả chi nhánh, bạn không có quyền thao tác';
    }
  }

  if (newBranchIds !== undefined) {
    const ids = Array.isArray(newBranchIds) ? newBranchIds.map((id) => Number(id)) : null;
    if (!ids || ids.some((id) => !restrictBranchIds.includes(id))) {
      return 'Chỉ Super Admin được đăng bài cho tất cả chi nhánh hoặc chi nhánh khác';
    }
  }
  return null;
}

postsRouter.get('/api/admin/posts', requireStaffAuth, requirePermission('posts', 'view'), async (c) => {
  try {
    // The page size is capped at 100 and a bad page number becomes 1
    const { page, pageSize } = clampPage(c.req.query('page'), c.req.query('pageSize'), { defaultPageSize: 10 });
    const q = String(c.req.query('q') || '');
    const status = String(c.req.query('status') || 'all');
    const db = drizzle(c.env.cinema_db, { schema });

    const r = await listPostsImpl(
      db,
      { posts: schema.posts, auditLogs: schema.auditLogs },
      { page, pageSize, q, status, withStaffNames: true, restrictToBranchIds: getRestrictBranchIds(c) }
    );

    // The posts table has no cover_image: the picture of a post is featured_image
    const parsedItems = (r.items || []).map((p: any) => ({
      ...p,
      featured_image: p.featured_image ? parseMediaUrl(p.featured_image, c) : p.featured_image
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

    const scopeError = await postScopeError(c, db, 'view', id);
    if (scopeError) return c.json({ status: 'error', message: scopeError }, 403);

    const post = await getPostImpl(db, { posts: schema.posts, auditLogs: schema.auditLogs }, id, false);

    if (!post) return c.json({ message: 'Không tìm thấy bài viết' }, 404);

    const parsed = {
      ...post,

      featured_image: post.featured_image ? parseMediaUrl(post.featured_image, c) : post.featured_image
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

    // A new post always names its branches; leaving them out means "all branches"
    const createScopeError = await postScopeError(c, db, 'modify', null, (body as any)?.branch_ids ?? null);
    if (createScopeError) return c.json({ status: 'error', message: createScopeError }, 403);

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
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, (Number(err?.statusCode) || 500) as any);
  }
});

// Admin: Update post

postsRouter.put('/api/admin/posts/:id', requireStaffAuth, requirePermission('posts', 'edit'), async (c) => {
  try {
    const id = Number(c.req.param('id'));

    const db = drizzle(c.env.cinema_db, { schema });

    const body = await c.req.json().catch(() => ({}));

    const updateScopeError = await postScopeError(c, db, 'modify', id, (body as any)?.branch_ids);
    if (updateScopeError) return c.json({ status: 'error', message: updateScopeError }, 403);

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
    return c.json({ status: 'error', message: String(err?.message || 'Internal error') }, (Number(err?.statusCode) || 500) as any);
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
    // Permanent delete only when asked for on purpose (and only the Super Admin gets it); otherwise the post is archived
    const hardDelete = c.req.query('hardDelete') === 'true';

    const deleteScopeError = await postScopeError(c, db, 'modify', id);
    if (deleteScopeError) return c.json({ status: 'error', message: deleteScopeError }, 403);

    const r = await deletePostImpl(
      db,
      { posts: schema.posts, auditLogs: schema.auditLogs },
      id,
      getCloudHelpers(c, c.env).deleter,
      { id: staffId, email: staffEmail, fullname: staffFullname },
      isSuperAdmin,
      hardDelete
    );

    if (!r) return c.json({ message: 'Không tìm thấy' }, 404);

    const permanent = isSuperAdmin === true && hardDelete;
    return c.json({ status: 'success', message: permanent ? 'Đã xóa vĩnh viễn' : 'Đã lưu trữ bài viết' });
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
