import { siteConfig } from '@/config/site';

const API = process.env.NEXT_PUBLIC_API_URL ?? '';

export async function getActiveTickets(options?: { signal?: AbortSignal }) {
  const res = await fetch(`${API}/api/tickets`, {
    next: { revalidate: 3600 },
    headers: {
      // Thêm headers để giúp SEO bot nhận diện request server-side
      ...(typeof window === 'undefined' && {
        'User-Agent': `Mozilla/5.0 (compatible; CinesphereBot/1.0; +${siteConfig.domain})`
      })
    }
  });
  if (!res.ok) {
    return { items: [], total: 0 };
  }
  return await res.json();
}

export async function getActiveToys(options?: { signal?: AbortSignal }) {
  const res = await fetch(`${API}/api/toys?status=active`, {
    next: { revalidate: 3600 },
    headers: {
      // Thêm headers để giúp SEO bot nhận diện request server-side
      ...(typeof window === 'undefined' && {
        'User-Agent': `Mozilla/5.0 (compatible; CinesphereBot/1.0; +${siteConfig.domain})`
      })
    }
  });
  if (!res.ok) {
    return { items: [], total: 0 };
  }
  return await res.json();
}
