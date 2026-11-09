import { describe, it, expect, vi, beforeEach } from 'vitest';
import publicRouter from './publicRouter';
import { getPostImpl } from '../../../server/routes/admin/posts';

vi.mock('drizzle-orm/d1', () => ({ drizzle: () => ({}) }));
vi.mock('../../../server/routes/admin/posts', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  getPostImpl: vi.fn()
}));

const env = { cinema_db: {} };
const executionContext: any = { waitUntil: () => undefined, passThroughOnException: () => undefined };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/posts/:identifier', () => {
  it('cleans the HTML of a post that was saved before the cleaning existed', async () => {
    (getPostImpl as any).mockResolvedValue({
      id: 7,
      title: 'Bài viết',
      status: 'published',
      cover_image: null,
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
    (getPostImpl as any).mockResolvedValue({ id: 7, title: 'T', status: 'published', cover_image: null, content: null });

    const body: any = await (await publicRouter.request('/api/posts/7', {}, env, executionContext)).json();

    expect(body.post.content).toBe('');
  });

  it('answers 404 for an unknown post', async () => {
    (getPostImpl as any).mockResolvedValue(null);
    expect((await publicRouter.request('/api/posts/7', {}, env, executionContext)).status).toBe(404);
  });
});
