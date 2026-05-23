import { siteConfig } from '@/config/site';

const API = process.env.NEXT_PUBLIC_API_URL ?? '';

export type Movie = {
  id: number;
  title: string;
  description?: string;
  cover_image?: string;
  genres?: { id: number; name: string }[];
  rating?: number;
  duration_min?: number;
  is_active?: boolean;
  release_date?: string;
  price?: number;
};

export type ActiveMovieToday = {
  id: number;
  title: string;
  cover_image?: string;
  genres?: { id: number; name: string }[];
  rating?: number;
  duration_min?: number;
  showtimes?: unknown[];
};

/** Lấy danh sách phim đang chiếu hôm nay – ISR 5 phút */
export async function getActiveMoviesToday(): Promise<ActiveMovieToday[]> {
  const res = await fetch(`${API}/api/getActiveMovies`, {
    next: { revalidate: 300 },
    headers: {
      // Thêm headers để giúp SEO bot nhận diện request server-side
      ...(typeof window === 'undefined' && {
        'User-Agent': `Mozilla/5.0 (compatible; CinesphereBot/1.0; +${siteConfig.domain})`
      })
    }
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { activeMovies?: ActiveMovieToday[] };
  return data.activeMovies ?? [];
}

/** Lấy danh sách phim 2025 – ISR 1h */
export async function getMovies2025(): Promise<Movie[]> {
  const res = await fetch(`${API}/api/movies/2025`, {
    next: { revalidate: 3600 },
    headers: {
      // Thêm headers để giúp SEO bot nhận diện request server-side
      ...(typeof window === 'undefined' && {
        'User-Agent': `Mozilla/5.0 (compatible; CinesphereBot/1.0; +${siteConfig.domain})`
      })
    }
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { items?: Movie[] } | Movie[];
  return (data as any)?.items ?? (data as Movie[]);
}

/** Lấy chi tiết phim bằng ID – ISR 10 phút */
export async function getMovieById(id: number) {
  const res = await fetch(`${API}/api/movies-detail/${id}`, {
    next: { revalidate: 600 },
    headers: {
      // Thêm headers để giúp SEO bot nhận diện request server-side
      ...(typeof window === 'undefined' && {
        'User-Agent': `Mozilla/5.0 (compatible; CinesphereBot/1.0; +${siteConfig.domain})`
      })
    }
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data;
}
