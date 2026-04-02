import { eq, desc, and, or, like, sql } from 'drizzle-orm';

function formatDateForDb(date: Date, runtime?: string): any {
  if (runtime === 'cloudflare-workers') return date.toISOString();
  return date;
}

export async function listPostsImpl(
  anyDb: any,
  tables: { posts: any },
  options: {
    page?: number;
    pageSize?: number;
    q?: string;
    status?: string;
  } = {}
) {
  const { page = 1, pageSize = 10, q, status } = options;

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
    orderBy: [desc(tables.posts.created_at)],
    limit: pageSize,
    offset: (page - 1) * pageSize
  });

  return { items, page, pageSize, total };
}

export async function getPostImpl(anyDb: any, tables: { posts: any }, id: number, incrementView = false) {
  const post = await anyDb.query.posts.findFirst({
    where: eq(tables.posts.id, id)
  });
  if (!post) return null;
  if (incrementView) {
    anyDb
      .update(tables.posts)
      .set({ view_count: sql`${tables.posts.view_count} + 1` })
      .where(eq(tables.posts.id, id))
      .catch(() => {});
    return { ...post, view_count: (post.view_count ?? 0) + 1 };
  }
  return post;
}

export async function createPostImpl(
  anyDb: any,
  tables: { posts: any },
  args: {
    title: string;
    content: string;
    excerpt?: string;
    featured_image?: string;
    image_base64?: string;
    author_id?: number;
    status?: string;
    is_featured?: boolean;
  },
  RUN_ENV?: any,
  uploader?: (base64: string, folder: string) => Promise<{ url: string }>
) {
  const { title, content, excerpt, featured_image, image_base64, author_id, status, is_featured } = args;

  let savedImage = featured_image;

  if (image_base64 && typeof image_base64 === 'string' && uploader) {
    try {
      const uploadResult = await uploader(image_base64, 'ctbooking/images/posts');
      savedImage = uploadResult.url;
    } catch (e) {
      console.error('Upload post image failed', e);
    }
  }

  const slug = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 255);

  const nowIso = new Date();
  const published_at = status === 'published' ? nowIso : null;

  const inserted = await anyDb
    .insert(tables.posts)
    .values({
      title,
      slug,
      content,
      excerpt,
      featured_image: savedImage,
      author_id,
      status: status || 'draft',
      is_featured: is_featured || false,
      published_at: published_at ? formatDateForDb(published_at, RUN_ENV?.RUNTIME_ENV) : null,
      created_at: formatDateForDb(nowIso, RUN_ENV?.RUNTIME_ENV),
      updated_at: formatDateForDb(nowIso, RUN_ENV?.RUNTIME_ENV)
    })
    .returning();

  let post: any = Array.isArray(inserted) ? inserted[0] : inserted;
  return post || null;
}

export async function updatePostImpl(
  anyDb: any,
  tables: { posts: any },
  id: number,
  args: {
    title?: string;
    content?: string;
    excerpt?: string;
    featured_image?: string;
    image_base64?: string;
    status?: string;
    is_featured?: boolean;
  },
  RUN_ENV?: any,
  uploader?: (base64: string, folder: string) => Promise<{ url: string }>,
  deleter?: (url: string) => Promise<void>
) {
  const existing = await anyDb.query.posts.findFirst({
    where: eq(tables.posts.id, id)
  });
  if (!existing) return null;

  const { title, content, excerpt, featured_image, image_base64, status, is_featured } = args;

  const data: any = {
    updated_at: formatDateForDb(new Date(), RUN_ENV?.RUNTIME_ENV)
  };

  if (title !== undefined) {
    data.title = title;
    data.slug = title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 255);
  }
  if (content !== undefined) data.content = content;
  if (excerpt !== undefined) data.excerpt = excerpt;
  if (featured_image !== undefined) data.featured_image = featured_image;
  if (status !== undefined) {
    data.status = status;
    if (status === 'published' && !existing.published_at) {
      data.published_at = formatDateForDb(new Date(), RUN_ENV?.RUNTIME_ENV);
    }
    if (status !== 'published') {
      // "Gỡ bài" / lưu trữ: không còn public
      data.published_at = null;
    }
  }
  if (is_featured !== undefined) data.is_featured = is_featured;

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

  if (
    existing &&
    data.featured_image &&
    existing.featured_image &&
    existing.featured_image !== data.featured_image &&
    deleter
  ) {
    deleter(existing.featured_image).catch((e) => console.error('Failed to delete old post image:', e));
  }

  return post || null;
}

export async function deletePostImpl(
  anyDb: any,
  tables: { posts: any },
  id: number,
  deleter?: (url: string) => Promise<void>
) {
  const existing = await anyDb.query.posts.findFirst({
    where: eq(tables.posts.id, id)
  });
  if (!existing) return null;

  if (existing.featured_image && deleter) {
    deleter(existing.featured_image).catch((e) => console.error('Failed to delete post image:', e));
  }

  await anyDb.delete(tables.posts).where(eq(tables.posts.id, id));
  return existing;
}
