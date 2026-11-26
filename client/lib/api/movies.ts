import type { Movie, MoviesResponse } from '@shared/api';
import { request } from './http';

/** A row of the admin movie list (GET /api/admin/movies). */
export type AdminMovieListItem = {
  id: number;
  title: string;
  release_date: string | null;
  duration_min: number | null;
  genres: string[];
  cover_image: string | null;
  updated_at: string | null;
  rating: number | null;
  is_active: boolean;
  branch_id: number | null;
  branch_ids: number[] | null;
};

export async function getMoviesAdmin(options?: {
  page?: number;
  pageSize?: number;
  q?: string;
  sort?: 'updated_at' | 'release_date' | 'title' | 'rating';
  dir?: 'asc' | 'desc';
  status?: 'all' | 'active' | 'inactive';
  branch_id?: number | 'all' | null;
  /** Picker mode: also open to showtime and ticket package staff, and allows bigger pages. */
  picker?: boolean;
  signal?: AbortSignal;
}) {
  const params = new URLSearchParams();
  if (options?.page) params.set('page', String(options.page));
  if (options?.pageSize) params.set('pageSize', String(options.pageSize));
  if (options?.q) params.set('q', options.q);
  if (options?.sort) params.set('sort', options.sort);
  if (options?.dir) params.set('dir', options.dir);
  if (options?.status) params.set('status', options.status);
  if (options?.branch_id) params.set('branch_id', String(options.branch_id));
  if (options?.picker) params.set('picker', '1');
  const path = `/api/admin/movies${params.toString() ? `?${params.toString()}` : ''}`;
  return request<{
    items: AdminMovieListItem[];
    page: number;
    pageSize: number;
    total: number;
  }>(path, { signal: options?.signal });
}

/** One page a picker request may load (the server allows up to 500 in picker mode). */
const MOVIE_PICKER_PAGE_SIZE = 500;

/** The most pages a picker loads, so a broken total can never loop forever. */
const MOVIE_PICKER_MAX_PAGES = 20;

/**
 * Every movie that matches, for a picker (e.g. the showtime form's movie select): loads page after page until the
 * total is reached, so the list is never cut off silently.
 */
export async function getAllMoviesForPicker(options: {
  status?: 'all' | 'active' | 'inactive';
  branch_id?: number | 'all' | null;
  q?: string;
  signal?: AbortSignal;
}) {
  const items: AdminMovieListItem[] = [];
  let total = 0;
  for (let page = 1; page <= MOVIE_PICKER_MAX_PAGES; page++) {
    const res = await getMoviesAdmin({ ...options, page, pageSize: MOVIE_PICKER_PAGE_SIZE, sort: 'title', dir: 'asc', picker: true });
    items.push(...(res.items || []));
    total = Number(res.total || 0);
    if (!res.items?.length || items.length >= total) break;
  }
  return { items, total };
}

export async function createMovieApi(body: {
  title: string;
  description?: string;
  cover_image?: string;
  cover_image_base64?: string;
  detail_images?: any;
  genres?: any;
  rating?: number;
  duration_min?: number;
  is_active?: boolean;
  release_date?: string;
  branch_id?: number | null;
  branch_ids?: number[] | null;
}) {
  return request<{ movie: any }>('/api/admin/movies', {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

export async function updateMovieApi(
  id: number,
  body: {
    title?: string;
    description?: string;
    cover_image?: string;
    cover_image_base64?: string;
    detail_images?: any;
    genres?: any;
    rating?: number;
    duration_min?: number;
    is_active?: boolean;
    release_date?: string;
    branch_id?: number | null;
    branch_ids?: number[] | null;
  }
) {
  return request<{ movie: any }>(`/api/admin/movies/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body)
  });
}

export async function deleteMovieApi(id: number) {
  return request<{ ok: boolean }>(`/api/admin/movies/${id}`, { method: 'DELETE' });
}

export async function getMovieById(id: number) {
  return request<{
    id: number;
    title: string;
    description: string;
    cover_image: string | null;
    genres: any[];
    rating: number | null;
    duration_min: number | null;
    is_active: boolean;
    branch_id: number | null;
    branch_ids?: number[] | null;
    release_date: string | null;
    created_at: string | null;
    updated_at: string | null;
    deleted_at: string | null;
    created_by_staff_name: string | null;
    updated_by_staff_name: string | null;
    detail_images: string[];
    applicable_packages: Array<{
      id: number;
      name: string;
      code: string | null;
      price: number;
      branch_id: number | null;
      branch_ids: number[] | null;
    }>;
  }>(`/api/admin/movies/${id}`);
}

// In client/lib/api/movies.ts

export async function updateMovieStatus(id: number, isActive: boolean) {
  return request<{
    status: string;
    message: string;
  }>(`/api/admin/movies-status/${id}`, {
    method: 'POST',
    body: JSON.stringify({ is_active: isActive })
  });
}

export type { Movie, MoviesResponse };
