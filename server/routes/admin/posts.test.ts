import { describe, it, expect, vi } from 'vitest';
import * as schema from '../../../shared/schema';
import { deletePostImpl, createPostImpl, updatePostImpl, loadPostStaffNames } from './posts';

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

describe('post branches', () => {
  it('create: no branch list means all branches (null), a list is saved as JSON', async () => {
    const all = makeDb(undefined);
    await createPostImpl(all.db, tables, { title: 'T', content: '<p>x</p>' } as any, undefined, undefined, staff);
    expect(postWrites(all.writes).find((entry) => entry.kind === 'insert')!.values.branch_ids).toBeNull();

    const some = makeDb(undefined);
    await createPostImpl(some.db, tables, { title: 'T', content: '<p>x</p>', branch_ids: [2, 1, 2] } as any, undefined, undefined, staff);
    expect(postWrites(some.writes).find((entry) => entry.kind === 'insert')!.values.branch_ids).toBe('[2,1]');
  });

  it('update: not sent leaves the branches alone, null means all, a list replaces them', async () => {
    const untouched = makeDb(postRow());
    await updatePostImpl(untouched.db, tables, 7, { title: 'New' } as any, undefined, undefined, undefined, staff);
    expect(postWrites(untouched.writes).find((entry) => entry.kind === 'update')!.values).not.toHaveProperty('branch_ids');

    const everyBranch = makeDb(postRow({ branch_ids: '[1]' }));
    await updatePostImpl(everyBranch.db, tables, 7, { branch_ids: null } as any, undefined, undefined, undefined, staff);
    expect(postWrites(everyBranch.writes).find((entry) => entry.kind === 'update')!.values.branch_ids).toBeNull();

    const chosen = makeDb(postRow());
    await updatePostImpl(chosen.db, tables, 7, { branch_ids: [3] } as any, undefined, undefined, undefined, staff);
    expect(postWrites(chosen.writes).find((entry) => entry.kind === 'update')!.values.branch_ids).toBe('[3]');
  });

  it.each([
    ['an empty list', []],
    ['a text', 'abc'],
    ['a branch that is not a number', [1, 'x']],
    ['a negative branch', [-1]]
  ])('refuses %s with a 400 and writes nothing', async (_label, branchIds) => {
    const created = makeDb(undefined);
    await expect(
      createPostImpl(created.db, tables, { title: 'T', content: '<p>x</p>', branch_ids: branchIds } as any, undefined, undefined, staff)
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(postWrites(created.writes)).toHaveLength(0);

    const updated = makeDb(postRow());
    await expect(
      updatePostImpl(updated.db, tables, 7, { branch_ids: branchIds } as any, undefined, undefined, undefined, staff)
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(postWrites(updated.writes)).toHaveLength(0);
  });
});

describe('loadPostStaffNames', () => {
  it('first create is the author, last update is the editor; posts without a log have no names', async () => {
    const logs = [
      { entityId: '7', action: 'create', staffFullname: 'An' },
      { entityId: '7', action: 'update', staffFullname: 'Binh' },
      { entityId: '7', action: 'update', staffFullname: 'Chi' },
      { entityId: '8', action: 'create', staffFullname: 'Dung' }
    ];
    const db: any = { select: () => ({ from: () => ({ where: () => ({ orderBy: async () => logs }) }) }) };

    const names = await loadPostStaffNames(db, tables, [7, 8, 9]);

    expect(names.get(7)).toEqual({ created_by_staff_name: 'An', updated_by_staff_name: 'Chi' });
    expect(names.get(8)).toEqual({ created_by_staff_name: 'Dung', updated_by_staff_name: null });
    expect(names.has(9)).toBe(false);
  });

  it('does not query when there are no posts', async () => {
    const db: any = { select: () => { throw new Error('should not run'); } };
    expect((await loadPostStaffNames(db, tables, [])).size).toBe(0);
  });
});
