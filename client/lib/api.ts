import type { Movie, MoviesResponse, Login, Register } from "@shared/api";

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
  if (!res.ok) {
    let errorMessage = `HTTP ${res.status}`;
    try {
      const errorData = await res.json();
      if (errorData?.message) {
        errorMessage = errorData.message;
      }
    } catch {
    }
    throw new Error(errorMessage);
  }
  return (await res.json()) as T;
}
// ----------------- API GET MOVIES 2025 -----------------
export async function getMovies2025(options?: { signal?: AbortSignal }) {
  return request<MoviesResponse>("/api/movies/2025", { signal: options?.signal });
}
// ----------------- API LOGIN -----------------
export async function loginApi(body: { email: string; password: string }) {
  return request<{ status: string; message: string; user: any }>("/api/login", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
// ----------------- API REGISTER -----------------
export async function registerApi(body: { email: string; password: string; name?: string }) {
  return request<{ status: string; message: string; user: any }>("/api/register", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
// ----------------- API FORGET PASS -----------------
export async function forgetPassApi(body: { email: string;}) {
  return request<{ status: string; message: string;}>("/api/forget-password", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
// ----------------- API RESET PASS -----------------
export async function resetPasswordApi(body: { token: string; newPassword : string;}) {
  return request<{ status: string; message: string; }>("/api/reset-password", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
// ----------------- DECLARE TYPE -----------------
export type { Movie, MoviesResponse, Login, Register };