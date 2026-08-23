import type { Movie, MoviesResponse, ActiveMoviesTodayResponse } from '@shared/api';
import { request } from './http';

export async function getMovies2025(options?: { signal?: AbortSignal }) {
<<<<<<< HEAD
  return request<MoviesResponse>('/api/movies/2025', {
    signal: options?.signal
  });
}

export async function getAllActiveMoviesToday(options?: { signal?: AbortSignal }) {
  return request<{ activeMovies: ActiveMoviesTodayResponse[] }>('/api/getActiveMovies', {
    method: 'GET',
    signal: options?.signal
  });
}

export async function getMoviesAdmin(options?: {
  page?: number;
  pageSize?: number;
  q?: string;
  sort?: 'updated_at' | 'release_date' | 'title' | 'rating';
  dir?: 'asc' | 'desc';
  status?: 'all' | 'active' | 'inactive';
  signal?: AbortSignal;
}) {
  const params = new URLSearchParams();
  if (options?.page) params.set('page', String(options.page));
  if (options?.pageSize) params.set('pageSize', String(options.pageSize));
  if (options?.q) params.set('q', options.q);
  if (options?.sort) params.set('sort', options.sort);
  if (options?.dir) params.set('dir', options.dir);
  if (options?.status) params.set('status', options.status);
  const path = `/api/movies${params.toString() ? `?${params.toString()}` : ''}`;
  return request<{
    items: any[];
    page: number;
    pageSize: number;
    total: number;
  }>(path, { signal: options?.signal });
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
}) {
  return request<{ movie: any }>('/api/movies', {
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
  }
) {
  return request<{ movie: any }>(`/api/movies/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body)
  });
}

export async function deleteMovieApi(id: number) {
  return request<{ ok: boolean }>(`/api/movies/${id}`, { method: 'DELETE' });
}

export async function getMovieById(id: number) {
  return request<{
    id: number;
    title: string;
    description: string;
    cover_image: string | null;
    genres: any[];
    rating: number;
    duration_min: number;
    price: number;
    is_active: boolean;
    release_date: string | null;
    created_at: string;
    updated_at: string;
    stats: {
      totalTicketsSold: number;
      totalRevenue: number;
      successfulBookings: number;
    };
  }>(`/api/movies-detail/${id}`);
=======
        return request<MoviesResponse>('/api/movies/2025', {
                signal: options?.signal
        });
}

export async function getAllActiveMoviesToday(options?: { signal?: AbortSignal }) {
        return request<{ activeMovies: ActiveMoviesTodayResponse[] }>('/api/getActiveMovies', {
                method: 'GET',
                signal: options?.signal
        });
}

export async function getMoviesAdmin(options?: {
        page?: number;
        pageSize?: number;
        q?: string;
        sort?: 'updated_at' | 'release_date' | 'title' | 'rating';
        dir?: 'asc' | 'desc';
        status?: 'all' | 'active' | 'inactive';
        branch_id?: number | 'all' | null;
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
        const path = `/api/movies${params.toString() ? `?${params.toString()}` : ''}`;
        return request<{
                items: any[];
                page: number;
                pageSize: number;
                total: number;
        }>(path, { signal: options?.signal });
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
        return request<{ movie: any }>('/api/movies', {
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
        return request<{ movie: any }>(`/api/movies/${id}`, {
                method: 'PUT',
                body: JSON.stringify(body)
        });
}

export async function deleteMovieApi(id: number) {
        return request<{ ok: boolean }>(`/api/movies/${id}`, { method: 'DELETE' });
}

export async function getMovieById(id: number) {
        return request<{
                id: number;
                title: string;
                description: string;
                cover_image: string | null;
                genres: any[];
                rating: number;
                duration_min: number;
                price: number;
                is_active: boolean;
                branch_id: number | null;
                branch_ids?: number[] | null;
                branch?: any;
                release_date: string | null;
                created_at: string;
                updated_at: string;
                stats: {
                        totalTicketsSold: number;
                        totalRevenue: number;
                        successfulBookings: number;
                };
        }>(`/api/movies-detail/${id}`);
>>>>>>> preview
}

// In client/lib/api/movies.ts

export async function updateMovieStatus(id: number, isActive: boolean) {
<<<<<<< HEAD
  return request<{
    status: string;
    message: string;
    item: any;
  }>(`/api/movies-status/${id}`, {
    method: 'POST',
    body: JSON.stringify({ is_active: isActive })
  });
=======
        return request<{
                status: string;
                message: string;
                item: any;
        }>(`/api/movies-status/${id}`, {
                method: 'POST',
                body: JSON.stringify({ is_active: isActive })
        });
>>>>>>> preview
}

export type { Movie, MoviesResponse, ActiveMoviesTodayResponse };
