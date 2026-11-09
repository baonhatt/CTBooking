import { describe, it, expect, vi } from 'vitest';
import * as schema from '../../../shared/schema';
import { deletePostImpl, createPostImpl, updatePostImpl } from './posts';

const tables: any = { posts: (schema as any).posts, auditLogs: (schema as any).auditLogs };
const staff = { id: 5, email: 'staff@example.com', fullname: 'Staff' };

function postRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    title: 'Bài viết',
    slug: 'bai-viet',
    content: '<p>x</p>',
    status: 'draft',
    featured_image: null,
    published_at: null,
    ...overrides
  };
}

/** Fake database: one post row; records what is deleted, updated and inserted. */
function makeDb(row: any) {
  const writes: Array<{ kind: 'delete' | 'update' | 'insert'; table: any; values?: any }> = [];
  const db: any = {
    query: { posts: { findFirst: vi.fn(async () => row) } },
    delete: (table: any) => ({
      where: async () => {
        writes.push({ kind: 'delete', table });
      }
    }),
    update: (table: any) => ({
      set: (values: any) => ({
        where: () => {
          writes.push({ kind: 'update', table, values });
          const rows = [{ ...row, ...values }];
          return { returning: async () => rows, then: (resolve: any) => Promise.resolve(rows).then(resolve) };
        }
      })
    }),
    insert: (table: any) => ({
      values: (values: any) => {
        writes.push({ kind: 'insert', table, values });
        const rows = [{ id: 99, ...values }];
        return { returning: async () => rows, then: (resolve: any) => Promise.resolve(rows).then(resolve) };
      }
    }),
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [], orderBy: async () => [] }) }) })
  };
  return { db, writes };
}

type Write = { kind: 'delete' | 'update' | 'insert'; table: any; values?: any };
const postWrites = (writes: Write[]) => writes.filter((entry) => entry.table === tables.posts);

describe('deletePostImpl: "Lưu trữ" is a soft delete', () => {
  it('the Super Admin archiving (no hardDelete) keeps the post with status archived', async () => {
    const { db, writes } = makeDb(postRow({ status: 'draft' }));

    await deletePostImpl(db, tables, 7, undefined, staff, true, false);

    expect(postWrites(writes).some((entry) => entry.kind === 'delete')).toBe(false);
    const update = postWrites(writes).find((entry) => entry.kind === 'update');
    expect(update?.values.status).toBe('archived');
    expect(update?.values.published_at).toBeNull();
  });

  it('the Super Admin archiving when hardDelete is left out also keeps the post', async () => {
    const { db, writes } = makeDb(postRow());
    await deletePostImpl(db, tables, 7, undefined, staff, true);
    expect(postWrites(writes).some((entry) => entry.kind === 'delete')).toBe(false);
  });

  it('only the Super Admin with hardDelete = true deletes for good', async () => {
    const { db, writes } = makeDb(postRow({ status: 'archived' }));

    await deletePostImpl(db, tables, 7, undefined, staff, true, true);

    expect(postWrites(writes).some((entry) => entry.kind === 'delete')).toBe(true);
  });

  it('staff cannot delete for good, even with hardDelete = true: the post is archived', async () => {
    const { db, writes } = makeDb(postRow());

    await deletePostImpl(db, tables, 7, undefined, staff, false, true);

    expect(postWrites(writes).some((entry) => entry.kind === 'delete')).toBe(false);
    expect(postWrites(writes).find((entry) => entry.kind === 'update')?.values.status).toBe('archived');
  });

  it('a hardDelete that is not exactly true is not a permanent delete', async () => {
    for (const value of [undefined, false, 'true', 1] as any[]) {
      const { db, writes } = makeDb(postRow());
      await deletePostImpl(db, tables, 7, undefined, staff, true, value);
      expect(postWrites(writes).some((entry) => entry.kind === 'delete')).toBe(false);
    }
  });

  it('a published post: staff must unpublish first, the Super Admin can archive but not delete it for good', async () => {
    const staffAttempt = makeDb(postRow({ status: 'published' }));
    await expect(deletePostImpl(staffAttempt.db, tables, 7, undefined, staff, false, false)).rejects.toThrow(/xuất bản/);
    expect(postWrites(staffAttempt.writes)).toHaveLength(0);

    const adminArchive = makeDb(postRow({ status: 'published' }));
    await deletePostImpl(adminArchive.db, tables, 7, undefined, staff, true, false);
    expect(postWrites(adminArchive.writes).find((entry) => entry.kind === 'update')?.values.status).toBe('archived');

    const adminHard = makeDb(postRow({ status: 'published' }));
    await expect(deletePostImpl(adminHard.db, tables, 7, undefined, staff, true, true)).rejects.toThrow(/xuất bản/);
    expect(postWrites(adminHard.writes)).toHaveLength(0);
  });

  it('writes "archive" or "delete" in the audit log to match what happened', async () => {
    const archived = makeDb(postRow());
    await deletePostImpl(archived.db, tables, 7, undefined, staff, true, false);
    expect(archived.writes.find((entry) => entry.table === tables.auditLogs)?.values.action).toBe('archive');

    const deleted = makeDb(postRow({ status: 'archived' }));
    await deletePostImpl(deleted.db, tables, 7, undefined, staff, true, true);
    expect(deleted.writes.find((entry) => entry.table === tables.auditLogs)?.values.action).toBe('delete');
  });

  it('answers null for a post that does not exist', async () => {
    const { db } = makeDb(undefined);
    expect(await deletePostImpl(db, tables, 7, undefined, staff, true, true)).toBeNull();
  });
});

describe('post content is cleaned when it is saved', () => {
  const EVIL = '<p style="text-align:center;">ok</p><script>alert(1)</script><img src=x onerror=alert(1)>';

  it('create: scripts and event handlers are removed, the rest stays', async () => {
    const { db, writes } = makeDb(undefined);

    await createPostImpl(db, tables, { title: 'T', content: EVIL } as any, undefined, undefined, staff);

    const saved = postWrites(writes).find((entry) => entry.kind === 'insert')!.values.content;
    expect(saved).toContain('text-align:center');
    expect(saved).toContain('ok');
    expect(saved).not.toMatch(/<script|onerror/i);
  });

  it('update: the same cleaning', async () => {
    const { db, writes } = makeDb(postRow());

    await updatePostImpl(db, tables, 7, { content: EVIL } as any, undefined, undefined, undefined, staff);

    const saved = postWrites(writes).find((entry) => entry.kind === 'update')!.values.content;
    expect(saved).not.toMatch(/<script|onerror/i);
    expect(saved).toContain('ok');
  });

  it('update without content leaves the content alone', async () => {
    const { db, writes } = makeDb(postRow());

    await updatePostImpl(db, tables, 7, { title: 'New' } as any, undefined, undefined, undefined, staff);

    expect(postWrites(writes).find((entry) => entry.kind === 'update')!.values).not.toHaveProperty('content');
  });
});
