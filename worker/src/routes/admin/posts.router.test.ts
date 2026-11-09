import { describe, it, expect, vi, beforeEach } from 'vitest';
import postsRouter from './posts.router';
import { deletePostImpl } from '../../../../server/routes/admin/posts';

// The guards are tested elsewhere. Here they copy the staff member from test headers into the context.
vi.mock('../../middleware', () => ({
  requireStaffAuth: async (c: any, next: any) => {
    c.set('staffId', 1);
    c.set('isSuperAdmin', c.req.header('x-test-super') === '1');
    await next();
  },
  requirePermission: () => async (_c: any, next: any) => next()
}));

vi.mock('../../../../server/routes/admin/posts', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  deletePostImpl: vi.fn(async () => ({ id: 7 }))
}));

const env = { cinema_db: {} };
const executionContext: any = { waitUntil: () => undefined, passThroughOnException: () => undefined };

function del(path: string, superAdmin: boolean) {
  return postsRouter.request(path, { method: 'DELETE', headers: { 'x-test-super': superAdmin ? '1' : '0' } }, env, executionContext);
}

beforeEach(() => {
  vi.clearAllMocks();
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
