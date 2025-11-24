import type { Movie, MoviesResponse } from "@shared/api";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

function buildUrl(path: string) {
  return API_BASE_URL ? `${API_BASE_URL}${path}` : path;
}

async function request<T>(path: string, init: RequestInit = {}) {
  const url = buildUrl(path);
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

export async function getMovies2025(options?: { signal?: AbortSignal }) {
  return request<MoviesResponse>("/api/movies/2025", { signal: options?.signal });
}

export type { Movie, MoviesResponse };