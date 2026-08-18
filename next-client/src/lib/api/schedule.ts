import { siteConfig } from '@/config/site';
import { buildUrl } from './http';

export type PublicShowtime = {
  id: number;
  movie_id: number;
  start_time: string;
  end_time: string;
  movie_title: string;
  movie_duration_min: number;
  movie_cover_image?: string | null;
};

export type PublicScheduleResponse = {
  items: PublicShowtime[];
  opens_at: string | null;
  closes_at: string | null;
};

export async function getPublicSchedule(branchId?: number): Promise<PublicScheduleResponse> {
  const empty: PublicScheduleResponse = { items: [], opens_at: null, closes_at: null };
  if (!branchId) return empty;

  const res = await fetch(buildUrl(`/api/schedule?branch_id=${branchId}`), {
    cache: 'no-store',
    credentials: 'include',
    headers: {
      ...(typeof window === 'undefined' && {
        'User-Agent': `Mozilla/5.0 (compatible; CinesphereBot/1.0; +${siteConfig.domain})`
      })
    }
  });

  if (!res.ok) return empty;
  const data = (await res.json()) as PublicScheduleResponse;
  return {
    items: Array.isArray(data.items) ? data.items : [],
    opens_at: data.opens_at ?? null,
    closes_at: data.closes_at ?? null
  };
}
