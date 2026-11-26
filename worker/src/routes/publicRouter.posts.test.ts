import { describe, it, expect, vi, beforeEach } from 'vitest';
import publicRouter from './publicRouter';
import { getPublicPost, listPublicPosts } from '../../../server/routes/user/public-posts';

vi.mock('drizzle-orm/d1', () => ({ drizzle: () => ({}) }));
vi.mock('../../../server/routes/user/public-posts', () => ({
  getPublicPost: vi.fn(),
  listPublicPosts: vi.fn()
}));

const env = { cinema_db: {} };
const executionContext: any = { waitUntil: () => undefined, passThroughOnException: () => undefined };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/posts/:identifier', () => {
  it('cleans the HTML of a post that was saved before the cleaning existed', async () => {
    (getPublicPost as any).mockResolvedValue({
      id: 7,
      title: 'Bài viết',
      status: 'published',
      content: '<p style="text-align:center;">Xin chào</p><img src=x onerror=alert(1)><script>alert(2)</script>'
    });

    const response = await publicRouter.request('/api/posts/7', {}, env, executionContext);
    const body: any = await response.json();

    expect(response.status).toBe(200);
    expect(body.post.content).toContain('Xin chào');
    expect(body.post.content).toContain('text-align:center');
    expect(body.post.content).not.toMatch(/onerror|<script/i);
  });

  it('a post with no content gives an empty string', async () => {
    (getPublicPost as any).mockResolvedValue({ id: 7, title: 'T', status: 'published', content: null });

    const body: any = await (await publicRouter.request('/api/posts/7', {}, env, executionContext)).json();

    expect(body.post.content).toBe('');
  });

  it('answers 404 for an unknown post', async () => {
    (getPublicPost as any).mockResolvedValue(null);
    expect((await publicRouter.request('/api/posts/7', {}, env, executionContext)).status).toBe(404);
  });
});

describe('GET /api/posts', () => {
  it('passes a safe page and page size to the public list and returns it as it is', async () => {
    const list = {
      items: [{ id: 7, title: 'T', slug: 't', status: 'published', updated_at: '2026-11-20T00:00:00.000Z' }],
      page: 1,
      pageSize: 100,
      total: 1
    };
    (listPublicPosts as any).mockResolvedValue(list);

    const response = await publicRouter.request('/api/posts?page=-3&pageSize=5000&q=abc', {}, env, executionContext);
    const body: any = await response.json();

    expect((listPublicPosts as any).mock.calls[0][2]).toEqual({ page: 1, pageSize: 100, q: 'abc' });
    expect(body).toEqual(list);
    // updated_at is kept: the sitemap and the article's dateModified use it
    expect(body.items[0].updated_at).toBe('2026-11-20T00:00:00.000Z');
  });
});

describe('GET /sitemap.xml', () => {
  it('is gone from the API (the site map is served by the Next.js site)', async () => {
    const response = await publicRouter.request('/sitemap.xml', {}, env, executionContext);
    expect(response.status).toBe(404);
  });
});
