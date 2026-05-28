import type { MetadataRoute } from 'next';
import { getPublicPosts } from '@/lib/api/posts';
import { buildPostHref } from '@/lib/utils';

export const runtime = 'edge';

import { siteConfig } from '@/config/site';

const SITE_URL = siteConfig.domain;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0
    },
    {
      url: `${SITE_URL}/bai-viet`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9
    },
    {
      url: `${SITE_URL}/booking`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8
    }
  ];

  let postPages: MetadataRoute.Sitemap = [];
  try {
    const res = await getPublicPosts({ page: 1, pageSize: 200 });
    const posts = (res.items ?? []).filter((p) => p.status === 'published');
    postPages = posts.map((post) => ({
      url: `${SITE_URL}${buildPostHref(post)}`,
      lastModified: new Date(post.updated_at ?? post.published_at ?? post.created_at ?? Date.now()),
      changeFrequency: 'weekly' as const,
      priority: post.is_featured ? 0.85 : 0.7
    }));
  } catch {
    // silently fail - không có posts thì chỉ trả về static pages
  }

  return [...staticPages, ...postPages];
}
