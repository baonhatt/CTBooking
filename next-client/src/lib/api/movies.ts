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

/** A movie of the "showing now" list (GET /api/getActiveMovies). */
export type ActiveMovieToday = {
  id: number;
  title: string;
  cover_image?: string;
  genres?: { id: number; name: string }[];
  release_date?: string;
};

/** Lấy danh sách phim đang chiếu hôm nay – ISR 5 phút */
export async function getActiveMoviesToday(branchId?: number): Promise<ActiveMovieToday[]> {
  let urlStr = `${API}/api/getActiveMovies`;

  // 1. Kiểm tra chặt chẽ, chấp nhận cả branchId = 0 và tránh nuốt giá trị
  if (branchId !== undefined && branchId !== null) {
    urlStr += `?branch_id=${branchId}`;
  }

  // Vô hiệu hóa cache: luôn lấy dữ liệu phim mới nhất từ server
  const res = await fetch(urlStr, {
    cache: 'no-store',
    headers: {
      // Chỉ gửi User-Agent khi chạy server-side (SSR) để tránh lỗi CORS trên browser
      ...(typeof window === 'undefined' && {
        'User-Agent': `Mozilla/5.0 (compatible; CinesphereBot/1.0; +${siteConfig.domain})`
      })
    }
  });

  if (!res.ok) return [];
  const data = (await res.json()) as { activeMovies?: ActiveMovieToday[] };
  return data.activeMovies ?? [];
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
