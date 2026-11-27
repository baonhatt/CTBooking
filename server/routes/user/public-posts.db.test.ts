import { describe, it, expect, beforeEach } from 'vitest';
import * as schema from '../../../shared/schema';
import { makeSqliteDb, insertRows } from '../../test-utils/sqlite-db';
import { listPublicPosts, getPublicPost } from './public-posts';

// The public post queries run on a real in-memory SQLite database: a post not linked to any branch
// (all_branches = 0 and no post_branches row) is shown nowhere, so neither the list, its total nor the article has it.

const NOW = '2026-11-20T03:00:00.000Z';
const tables = { posts: (schema as any).posts };
let db: any;

function post(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    title: `Post ${id}`,
    slug: `post-${id}`,
    content: '<p>x</p>',
    status: 'published',
    all_branches: 0,
    published_at: `2026-11-${10 + id}T00:00:00.000Z`,
    created_at: NOW,
    updated_at: NOW,
    ...overrides
  };
}

beforeEach(() => {
  const made = makeSqliteDb(['posts', 'post_branches']);
  db = made.db;
  insertRows(made.raw, 'posts', [
    post(1, { all_branches: 1 }), // every branch
    post(2), // branch 2
    post(3), // no branch: shown nowhere
    post(4, { all_branches: 1, status: 'draft' }) // not published
  ]);
  insertRows(made.raw, 'post_branches', [{ post_id: 2, branch_id: 2 }]);
});

describe('public posts', () => {
  it('the list leaves out posts of no branch, and does not count them', async () => {
    const result = await listPublicPosts(db, tables, { page: 1, pageSize: 10 });
    expect(result.items.map((item: any) => item.id)).toEqual([2, 1]);
    expect(result.total).toBe(2);
    expect(result.items.find((item: any) => item.id === 2)).toMatchObject({ all_branches: false, branch_ids: [2] });
    expect(result.items.find((item: any) => item.id === 1)).toMatchObject({ all_branches: true, branch_ids: [] });
  });

  it('the search also leaves them out', async () => {
    const result = await listPublicPosts(db, tables, { page: 1, pageSize: 10, q: 'Post 3' });
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('the article of a post of no branch is not found; the others are', async () => {
    expect(await getPublicPost(db, tables, 3)).toBeNull();
    expect(await getPublicPost(db, tables, 2)).toMatchObject({ id: 2, all_branches: false, branch_ids: [2] });
    expect(await getPublicPost(db, tables, 1)).toMatchObject({ id: 1, all_branches: true });
    expect(await getPublicPost(db, tables, 4)).toBeNull();
  });
});
