import { describe, it, expect, vi, beforeEach } from 'vitest';
import postsRouter from './posts.router';
import { deletePostImpl } from '../../../../server/routes/admin/posts';

// The guards are tested elsewhere. Here they copy the staff member from test headers into the context.
vi.mock('../../middleware', () => ({
  requireStaffAuth: async (c: any, next: any) => {
    c.set('staffId', 1);
    c.set('isSuperAdmin', c.req.header('x-test-super') === '1');
    c.set('staffBranchIds', [1]);
    await next();
  },
  requirePermission: () => async (_c: any, next: any) => next()
}));

vi.mock('../../../../server/routes/admin/posts', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  deletePostImpl: vi.fn(async () => ({ id: 7 }))
}));

// The post being changed is offered at postScope: all_branches = 1, or post_branches rows for the listed branches
type PostScope = { all_branches: boolean; branch_ids: number[] };
let postScope: PostScope = { all_branches: false, branch_ids: [1] };
vi.mock('drizzle-orm/d1', () => ({
  drizzle: () => ({
    query: { posts: { findFirst: async () => ({ id: 7 }) } },
    // readBranchScope reads the post row (…limit) and then its post_branches rows (…orderBy)
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [{ id: 7, all_branches: postScope.all_branches ? 1 : 0 }],
          orderBy: async () => postScope.branch_ids.map((branchId) => ({ record_id: 7, branch_id: branchId }))
        })
      })
    })
  })
}));

const env = { cinema_db: {} };
const executionContext: any = { waitUntil: () => undefined, passThroughOnException: () => undefined };

function del(path: string, superAdmin: boolean) {
  return postsRouter.request(path, { method: 'DELETE', headers: { 'x-test-super': superAdmin ? '1' : '0' } }, env, executionContext);
}

beforeEach(() => {
  vi.clearAllMocks();
  postScope = { all_branches: false, branch_ids: [1] };
});

describe('posts of other branches', () => {
  it('branch staff cannot archive a post of another branch, or one for all branches', async () => {
    const otherScopes: PostScope[] = [
      { all_branches: false, branch_ids: [2] },
      { all_branches: false, branch_ids: [1, 2] },
      { all_branches: true, branch_ids: [] }
    ];
    for (const scope of otherScopes) {
      postScope = scope;
      const response = await del('/api/admin/posts/7', false);
      expect(response.status).toBe(403);
    }
    expect(deletePostImpl).not.toHaveBeenCalled();
  });

  const createAsStaff = (scope: Record<string, unknown>) =>
    postsRouter.request(
      '/api/admin/posts',
      { method: 'POST', headers: { 'x-test-super': '0', 'content-type': 'application/json' }, body: JSON.stringify({ title: 'A', ...scope }) },
      env,
      executionContext
    );

  it('branch staff cannot create a post for all branches, for another branch or for no branch', async () => {
    const scopes = [
      { all_branches: true },
      { all_branches: false, branch_ids: [2] },
      { all_branches: false, branch_ids: [1, 2] },
      { all_branches: false, branch_ids: [] }
    ];
    for (const scope of scopes) {
      expect((await createAsStaff(scope)).status).toBe(403);
    }
  });

  it('a create without a branch choice is refused with 400', async () => {
    expect((await createAsStaff({})).status).toBe(400);
    expect((await createAsStaff({ branch_ids: [1] })).status).toBe(400);
  });
});

describe('DELETE /api/admin/posts/:id', () => {
  it('without hardDelete it archives, even for the Super Admin', async () => {
    const response = await del('/api/admin/posts/7', true);
    const body: any = await response.json();

    const call = (deletePostImpl as any).mock.calls[0];
    expect(call[5]).toBe(true); // isSuperAdmin
    expect(call[6]).toBe(false); // hardDelete
    expect(body.message).toBe('Đã lưu trữ bài viết');
  });

  it('with hardDelete=true the Super Admin deletes for good', async () => {
    const body: any = await (await del('/api/admin/posts/7?hardDelete=true', true)).json();

    expect((deletePostImpl as any).mock.calls[0][6]).toBe(true);
    expect(body.message).toBe('Đã xóa vĩnh viễn');
  });

  it('with hardDelete=true staff still only archive, and the answer says so', async () => {
    const body: any = await (await del('/api/admin/posts/7?hardDelete=true', false)).json();

    expect((deletePostImpl as any).mock.calls[0][5]).toBe(false);
    expect(body.message).toBe('Đã lưu trữ bài viết');
  });

  it('only the exact text "true" counts as hardDelete', async () => {
    for (const value of ['1', 'yes', 'TRUE', 'false', '']) {
      (deletePostImpl as any).mockClear();
      await del('/api/admin/posts/7?hardDelete=' + value, true);
      expect((deletePostImpl as any).mock.calls[0][6]).toBe(false);
    }
  });

  it('answers 404 for a post that does not exist', async () => {
    (deletePostImpl as any).mockResolvedValueOnce(null);
    expect((await del('/api/admin/posts/7', true)).status).toBe(404);
  });
});
