// Posts for the public site (news list, article page). Published posts only, with named columns: never the author
// id, never staff names from the audit log. The admin screens use server/routes/admin/posts.ts.

import { and, desc, eq, like, or, sql } from 'drizzle-orm';
import { sqlLinkedToSomeBranch, withBranchScope } from '../../lib/catalog-scope';
import { postIdentifierCondition } from '../admin/posts';

/**
 * The columns of a post card in the public lists (news page, related posts, sitemap). No article text and no SEO
 * fields. updated_at stays: the sitemap's lastModified and the article's dateModified use it.
 */
export const PUBLIC_POST_LIST_COLUMNS = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  featured_image: true,
  status: true,
  is_featured: true,
  published_at: true,
  created_at: true,
  updated_at: true,
  all_branches: true
} as const;

/** The columns of one article page: the card fields plus the text, the SEO fields and the view count. */
export const PUBLIC_POST_DETAIL_COLUMNS = {
  ...PUBLIC_POST_LIST_COLUMNS,
  content: true,
  meta_description: true,
  meta_keywords: true,
  seo_title: true,
  og_image: true,
  canonical_url: true,
  schema_type: true,
  view_count: true
} as const;


/** One page of published posts, newest first. `q` searches the title and the text. */
export async function listPublicPosts(
  anyDb: any,
  tables: { posts: any },
  options: { page: number; pageSize: number; q?: string }
) {
  const { page, pageSize, q } = options;
  const posts = tables.posts;
  // Published and shown at some branch (a post not linked to any branch is shown nowhere, so it is not counted either)
  const conditions: any[] = [eq(posts.status, 'published'), sqlLinkedToSomeBranch('post')];
  if (q) conditions.push(or(like(posts.title, `%${q}%`), like(posts.content, `%${q}%`)));
  const whereCondition = and(...conditions);

  const total = await anyDb
    .select({ count: sql<number>`count(*)` })
    .from(posts)
    .where(whereCondition)
    .then((rows: any[]) => Number(rows[0]?.count || 0));

  const items = await anyDb.query.posts.findMany({
    where: whereCondition,
    columns: PUBLIC_POST_LIST_COLUMNS,
    orderBy: [desc(posts.published_at), desc(posts.created_at)],
    limit: pageSize,
    offset: (page - 1) * pageSize
  });

  // all_branches and branch_ids tell the site at which branches each post is shown
  return { items: await withBranchScope(anyDb, 'post', items), page, pageSize, total };
}

/** One published post by id, slug-id or slug. Null when it does not exist or is not published. */
export async function getPublicPost(anyDb: any, tables: { posts: any }, identifier: number | string) {
  const post = await anyDb.query.posts.findFirst({
    where: and(postIdentifierCondition(tables, identifier), eq(tables.posts.status, 'published'), sqlLinkedToSomeBranch('post')),
    columns: PUBLIC_POST_DETAIL_COLUMNS
  });
  return post ? (await withBranchScope(anyDb, 'post', [post]))[0] : null;
}
