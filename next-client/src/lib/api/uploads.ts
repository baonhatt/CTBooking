import { siteConfig } from '@/config/site';

const API = process.env.NEXT_PUBLIC_API_URL ?? '';

export async function getSiteMediaApi(options?: {
  section?: 'hero_section' | 'technology_section1' | 'technology_section2';
  type?: 'image' | 'video';
  active?: boolean;
  // The media of this branch; without it the server answers for the default branch
  branchId?: number;
}) {
  const params = new URLSearchParams();
  if (options?.section) params.set('section', options.section);
  if (options?.type) params.set('type', options.type);
  if (typeof options?.active === 'boolean') params.set('active', String(options.active));
  if (options?.branchId !== undefined && options?.branchId !== null) params.set('branch_id', String(options.branchId));

  const path = `${API}/api/site-media${params.toString() ? `?${params.toString()}` : ''}`;

  const res = await fetch(path, {
    next: { revalidate: 3600 }, // Cache for 1 hour by default
    headers: {
      // Thêm headers để giúp SEO bot nhận diện request server-side
      ...(typeof window === 'undefined' && {
        'User-Agent': `Mozilla/5.0 (compatible; CinesphereBot/1.0; +${siteConfig.domain})`
      })
    }
  });

  if (!res.ok) {
    return { items: [] };
  }

  const data = (await res.json()) as { items: any[] };
  return data ?? { items: [] };
}
