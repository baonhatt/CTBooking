import { eq, desc, asc, and, or, like, sql, inArray } from 'drizzle-orm';
import { formatDateForDb } from '../../lib/date-utils';
import { logAuditAction } from '../../lib/audit-logger';
import { sanitizePostHtml } from '../../lib/sanitize-html';
import { buildAuditPayload } from '../../lib/audit-utils';
import { parseBranchIds, serializeBranchIds } from '../../lib/branch-ids';

// Turns text into a url slug (no accents, lowercase, dashes)
function make_slug(text: string): string {
  return String(text || '')
    .toLowerCase()
    .replace(/[đĐ]/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 255);
}

// A publish date typed by staff: accepted only when it is a valid date that is not in the future
function parse_publish_date(value: unknown): Date | null {
  if (!value) return null;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime()) || parsed.getTime() > Date.now()) return null;
  return parsed;
}

/**
 * The branches a post is meant for, as sent by the screen: undefined (not sent: keep as it is), null (all branches) or a
 * list of branch ids. An empty list is refused: "no branch" would hide the post from every branch.
 */
export function readPostBranchIds(value: unknown): number[] | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!Array.isArray(value)) throw Object.assign(new Error('Danh sách chi nhánh không hợp lệ'), { statusCode: 400 });
  const ids = Array.from(new Set(value.map((id) => Number(id))));
  if (ids.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw Object.assign(new Error('Danh sách chi nhánh không hợp lệ'), { statusCode: 400 });
  }
  if (ids.length === 0) {
    throw Object.assign(new Error('Chọn ít nhất một chi nhánh hoặc chọn tất cả chi nhánh'), { statusCode: 400 });
  }
  return ids;
}

// The post as sent to screens: branch_ids is a list (or null for all branches), not the JSON text of the column
function withBranchList(post: any) {
  return { ...post, branch_ids: parseBranchIds(post?.branch_ids) };
}

/**
 * Who created and who last changed each post, read from the audit log (the posts table has no staff columns).
 * Only for the admin list: staff names are never part of the public post list.
 */
export async function loadPostStaffNames(anyDb: any, tables: { auditLogs: any }, postIds: number[]) {
  const names = new Map<number, { created_by_staff_name: string | null; updated_by_staff_name: string | null }>();
  if (postIds.length === 0) return names;

  const logs = await anyDb
    .select({
      entityId: tables.auditLogs.entityId,
      action: tables.auditLogs.action,
      staffFullname: tables.auditLogs.staffFullname
    })
    .from(tables.auditLogs)
    .where(
      and(
        eq(tables.auditLogs.entityType, 'post'),
        inArray(tables.auditLogs.entityId, postIds.map(String)),
        inArray(tables.auditLogs.action, ['create', 'update'])
      )
    )
    .orderBy(asc(tables.auditLogs.createdAt));

  for (const log of logs) {
    const postId = Number(log.entityId);
    const entry = names.get(postId) || { created_by_staff_name: null, updated_by_staff_name: null };
    // The first "create" is the author; the last "update" is the person who changed it last
    if (log.action === 'create' && !entry.created_by_staff_name) entry.created_by_staff_name = log.staffFullname || null;
    if (log.action === 'update') entry.updated_by_staff_name = log.staffFullname || null;
    names.set(postId, entry);
  }
  return names;
}

export async function listPostsImpl(
  anyDb: any,
  tables: { posts: any; auditLogs: any },
  options: {
    page?: number;
    pageSize?: number;
    q?: string;
    status?: string;
    // Adds created_by_staff_name / updated_by_staff_name to each item (admin list only)
    withStaffNames?: boolean;
  } = {}
) {
  const { page = 1, pageSize = 10, q, status, withStaffNames = false } = options;

  let whereCondition: any = undefined;
  const conditions: any[] = [];

  if (q) {
    conditions.push(or(like(tables.posts.title, `%${q}%`), like(tables.posts.content, `%${q}%`)));
  }

  if (status && status !== 'all') {
    conditions.push(eq(tables.posts.status, status));
  }

  if (conditions.length > 0) {
    whereCondition = and(...conditions);
  }

  const total = await anyDb
    .select({ count: sql<number>`count(*)` })
    .from(tables.posts)
    .where(whereCondition)
    .then((rows: any[]) => Number(rows[0]?.count || 0));

  const items = await anyDb.query.posts.findMany({
    where: whereCondition,
    orderBy: [
      // Sort by status priority: published (1) > draft (2) > archived (3)
      sql`CASE 
                                WHEN ${tables.posts.status} = 'published' THEN 1
                                WHEN ${tables.posts.status} = 'draft' THEN 2
                                WHEN ${tables.posts.status} = 'archived' THEN 3
                                ELSE 4
                        END`,
      // Then sort by published_at DESC (if published) or created_at DESC
      desc(tables.posts.published_at),
      desc(tables.posts.created_at)
    ],
    limit: pageSize,
    offset: (page - 1) * pageSize
  });

  const staffNames = withStaffNames
    ? await loadPostStaffNames(
        anyDb,
        tables,
        items.map((post: any) => post.id)
      )
    : null;

  return {
    items: items.map((post: any) => ({
      ...withBranchList(post),
      ...(staffNames
        ? staffNames.get(post.id) || { created_by_staff_name: null, updated_by_staff_name: null }
        : {})
    })),
    page,
    pageSize,
    total
  };
}

export async function getPostImpl(
  anyDb: any,
  tables: { posts: any; auditLogs: any },
  identifier: number | string,
  publicOnly: boolean = false
) {
  let condition;
  const rawId = Number(identifier);

  if (!isNaN(rawId)) {
    // Trường hợp là numbers thuần (VD: 123)
    condition = eq(tables.posts.id, rawId);
  } else {
    // Trường hợp là string (slug hoặc slug-id)
    const strId = String(identifier);
    const parts = strId.split('-');
    const potentialId = Number(parts[parts.length - 1]);

    if (parts.length > 1 && !isNaN(potentialId)) {
      // Định dạng slug-id (VD: tieu-de-bai-viet-123)
      condition = eq(tables.posts.id, potentialId);
    } else {
      // Định dạng slug thuần (VD: tieu-de-bai-viet)
      condition = eq(tables.posts.slug, strId);
    }
  }

  if (publicOnly) {
    condition = and(condition, eq(tables.posts.status, 'published'));
  }

  const post = await anyDb.query.posts.findFirst({
    where: condition
  });
  if (!post) return null;

  // Get tracking data from audit logs
  const [createLog] = await anyDb
    .select()
    .from(tables.auditLogs)
    .where(
      and(
        eq(tables.auditLogs.entityType, 'post'),
        eq(tables.auditLogs.entityId, String(post.id)),
        eq(tables.auditLogs.action, 'create')
      )
    )
    .orderBy(tables.auditLogs.createdAt)
    .limit(1);

  const [updateLog] = await anyDb
    .select()
    .from(tables.auditLogs)
    .where(
      and(
        eq(tables.auditLogs.entityType, 'post'),
        eq(tables.auditLogs.entityId, String(post.id)),
        eq(tables.auditLogs.action, 'update')
      )
    )
    .orderBy(desc(tables.auditLogs.createdAt))
    .limit(1);

  return {
    ...withBranchList(post),
    created_by_staff_name: createLog?.staffFullname || null,
    updated_by_staff_name: updateLog?.staffFullname || null
  };
}

export async function createPostImpl(
  anyDb: any,
  tables: { posts: any; auditLogs: any },
  args: {
    title: string;
    slug?: string;
    published_at?: string | null;
    // null or missing = all branches
    branch_ids?: number[] | null;
    content: string;
    excerpt?: string;
    featured_image?: string;
    image_base64?: string;
    author_id?: number;
    status?: string;
    is_featured?: boolean;
    meta_description?: string;
    meta_keywords?: string;
    seo_title?: string;
    og_image?: string;
    canonical_url?: string;
    schema_type?: string;
  },
  RUN_ENV?: any,
  uploader?: (base64: string, folder: string) => Promise<{ url: string }>,
  staffInfo?: { id: number; email: string; fullname: string }
) {
  const {
    title,
    content,
    excerpt,
    featured_image,
    image_base64,
    author_id,
    status,
    is_featured,
    meta_description,
    meta_keywords,
    seo_title,
    og_image,
    canonical_url,
    schema_type
  } = args;

  // Checked first, so a refused branch list never leaves an uploaded image behind
  const branchIds = readPostBranchIds(args.branch_ids);

  let savedImage = featured_image;

  if (image_base64 && typeof image_base64 === 'string' && uploader) {
    try {
      const uploadResult = await uploader(image_base64, 'ctbooking/images/posts');
      savedImage = uploadResult.url;
    } catch (e) {
      console.error('Upload post image failed', e);
    }
  }

  // The slug staff typed is used when there is one; a taken slug gets -2, -3 ... so saving never fails on a duplicate
  const baseSlug = make_slug(args.slug || '') || make_slug(title) || 'bai-viet';
  let slug = baseSlug;
  for (let suffix = 2; suffix < 100; suffix++) {
    const taken = await anyDb.query.posts.findFirst({ where: eq(tables.posts.slug, slug) });
    if (!taken) break;
    slug = `${baseSlug}-${suffix}`;
  }

  const nowIso = new Date();
  // A published post can be back-dated by staff; otherwise it is published now
  const published_at = status === 'published' ? (parse_publish_date(args.published_at) ?? nowIso) : null;

  // Build the data object explicitly to avoid issues with undefined values
  // which can cause parameter shifting in some Drizzle version/driver combinations.
  const insertData: any = {
    title,
    slug,
    branch_ids: serializeBranchIds(branchIds ?? null),
    // The HTML is cleaned before it is saved (scripts, event handlers and the like are removed)
    content: sanitizePostHtml(content),
    excerpt: excerpt || null,
    featured_image: savedImage || null,
    status: status || 'draft',
    is_featured: is_featured || false,
    meta_description: meta_description || null,
    meta_keywords: meta_keywords || null,
    seo_title: seo_title || null,
    og_image: og_image || null,
    canonical_url: canonical_url || null,
    schema_type: schema_type || 'Article',
    published_at: published_at ? formatDateForDb(published_at) : null,
    created_at: formatDateForDb(nowIso),
    updated_at: formatDateForDb(nowIso)
  };

  // Only include author_id if it's actually provided as a number
  if (typeof author_id === 'number') {
    insertData.author_id = author_id;
  } else {
    // If not provided, we can either omit it (letting DB default to NULL)
    // or explicitly set to null.
    insertData.author_id = null;
  }

  const inserted = await anyDb.insert(tables.posts).values(insertData).returning();

  let post: any = Array.isArray(inserted) ? inserted[0] : inserted;
  if (!post) return null;

  const auditNew = buildAuditPayload(post);

  // Log audit action
  if (staffInfo) {
    await logAuditAction(
      anyDb,
      tables.auditLogs,
      'create',
      'post',
      post.id,
      `Tạo bài viết: ${title}`,
      staffInfo.id,
      staffInfo.email,
      staffInfo.fullname,
      undefined,
      auditNew
    );
  }

  return post;
}

export async function updatePostImpl(
  anyDb: any,
  tables: { posts: any; auditLogs: any },
  id: number,
  args: {
    title?: string;
    slug?: string;
    published_at?: string | null;
    // undefined = unchanged, null = all branches
    branch_ids?: number[] | null;
    content?: string;
    excerpt?: string;
    featured_image?: string;
    image_base64?: string;
    status?: string;
    is_featured?: boolean;
    meta_description?: string;
    meta_keywords?: string;
    seo_title?: string;
    og_image?: string;
    canonical_url?: string;
    schema_type?: string;
  },
  RUN_ENV?: any,
  uploader?: (base64: string, folder: string) => Promise<{ url: string }>,
  deleter?: (url: string) => Promise<void>,
  staffInfo?: { id: number; email: string; fullname: string }
) {
  const existing = await anyDb.query.posts.findFirst({
    where: eq(tables.posts.id, id)
  });
  if (!existing) return null;

  const branchIds = readPostBranchIds(args.branch_ids);

  const {
    title,
    content,
    excerpt,
    featured_image,
    image_base64,
    status,
    is_featured,
    meta_description,
    meta_keywords,
    seo_title,
    og_image,
    canonical_url,
    schema_type
  } = args;

  const data: any = {
    updated_at: formatDateForDb(new Date())
  };

  if (title !== undefined) {
    data.title = title;
  }
  if (args.slug !== undefined) {
    const newSlug = make_slug(args.slug);
    if (newSlug && newSlug !== existing.slug) {
      const taken = await anyDb.query.posts.findFirst({ where: eq(tables.posts.slug, newSlug) });
      if (taken && taken.id !== id) {
        throw Object.assign(new Error('Slug này đang được bài viết khác sử dụng, hãy đổi slug.'), { statusCode: 409 });
      }
      data.slug = newSlug;
    }
  }
  if (branchIds !== undefined) data.branch_ids = serializeBranchIds(branchIds);
  if (content !== undefined) data.content = sanitizePostHtml(content);
  if (excerpt !== undefined) data.excerpt = excerpt;
  if (featured_image !== undefined) data.featured_image = featured_image;
  if (status !== undefined) {
    data.status = status;
    if (status === 'published') {
      // Staff may back-date the post; otherwise a first-time publish is dated now
      const typedDate = parse_publish_date(args.published_at);
      if (typedDate) data.published_at = formatDateForDb(typedDate);
      else if (!existing.published_at) data.published_at = formatDateForDb(new Date());
    }
    if (status !== 'published') {
      // "Gỡ bài" / lưu trữ: không còn public
      data.published_at = null;
    }
  }
  if (is_featured !== undefined) data.is_featured = is_featured;
  if (meta_description !== undefined) data.meta_description = meta_description;
  if (meta_keywords !== undefined) data.meta_keywords = meta_keywords;
  if (seo_title !== undefined) data.seo_title = seo_title;
  if (og_image !== undefined) data.og_image = og_image;
  if (canonical_url !== undefined) data.canonical_url = canonical_url;
  if (schema_type !== undefined) data.schema_type = schema_type;

  if (image_base64 && typeof image_base64 === 'string' && uploader) {
    try {
      const uploadResult = await uploader(image_base64, 'ctbooking/images/posts');
      data.featured_image = uploadResult.url;
    } catch (e) {
      console.error('Upload post image failed', e);
    }
  }

  const updatedRes = await anyDb.update(tables.posts).set(data).where(eq(tables.posts.id, id)).returning();

  let post: any = Array.isArray(updatedRes) ? updatedRes[0] : updatedRes;
  if (!post) {
    post = await anyDb.query.posts.findFirst({ where: eq(tables.posts.id, id) });
  }

  if (
    existing &&
    data.featured_image &&
    existing.featured_image &&
    existing.featured_image !== data.featured_image &&
    deleter
  ) {
    deleter(existing.featured_image).catch((e) => console.error('Failed to delete old post image:', e));
  }

  if (existing && data.og_image && existing.og_image && existing.og_image !== data.og_image && deleter) {
    deleter(existing.og_image).catch((e) => console.error('Failed to delete old post OG image:', e));
  }

  const auditOld = buildAuditPayload(existing);
  const auditNew = buildAuditPayload(post);

  // Log audit action
  if (staffInfo) {
    await logAuditAction(
      anyDb,
      tables.auditLogs,
      'update',
      'post',
      id,
      `Cập nhật bài viết: ${post?.title || existing.title}`,
      staffInfo.id,
      staffInfo.email,
      staffInfo.fullname,
      auditOld,
      auditNew
    );
  }

  return post || null;
}

export async function deletePostImpl(
  anyDb: any,
  tables: { posts: any; auditLogs: any },
  id: number,
  deleter?: (url: string) => Promise<void>,
  staffInfo?: { id: number; email: string; fullname: string },
  isSuperAdmin?: boolean,
  hardDelete?: boolean
) {
  const existing = await anyDb.query.posts.findFirst({
    where: eq(tables.posts.id, id)
  });
  if (!existing) return null;

  // Everyone archives by default (a soft delete: the post stays in the database with status "archived").
  // A permanent delete needs BOTH the Super Admin and an explicit hardDelete = true.
  const permanent = isSuperAdmin === true && hardDelete === true;

  // A published post is taken down first by staff. The Super Admin can archive it, but not delete it for good.
  if (existing.status === 'published' && (!isSuperAdmin || permanent)) {
    throw new Error('Bài viết đã xuất bản. Vui lòng gỡ xuất bản hoặc lưu trữ trước khi xóa.');
  }

  if (permanent) {
    // Hard delete: remove from database
    if (existing.featured_image && deleter) {
      deleter(existing.featured_image).catch((e) => console.error('Failed to delete post image:', e));
    }

    await anyDb.delete(tables.posts).where(eq(tables.posts.id, id));
  } else {
    // Soft delete: change status to archived
    await anyDb
      .update(tables.posts)
      .set({
        status: 'archived',
        published_at: null,
        updated_at: formatDateForDb(new Date())
      })
      .where(eq(tables.posts.id, id));
  }

  const auditOld = buildAuditPayload(existing);

  // Log audit action
  if (staffInfo) {
    await logAuditAction(
      anyDb,
      tables.auditLogs,
      permanent ? 'delete' : 'archive',
      'post',
      id,
      permanent ? `Xóa vĩnh viễn bài viết: ${existing.title}` : `Lưu trữ bài viết: ${existing.title}`,
      staffInfo.id,
      staffInfo.email,
      staffInfo.fullname,
      auditOld,
      undefined
    );
  }

  return existing;
}

export async function incrementPostViewImpl(anyDb: any, tables: { posts: any; auditLogs: any }, id: number) {
  return anyDb
    .update(tables.posts)
    .set({
      view_count: sql`${tables.posts.view_count} + 1`
    })
    .where(eq(tables.posts.id, id))
    .returning();
}
