import type { Movie, MoviesResponse, Login, Register, ActiveMoviesTodayResponse } from "@shared/api";

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

// ----------------- API GET ACTIVE MOVIES TODAY -----------------
export async function getAllActiveMoviesToday(options?: { signal?: AbortSignal }) {
  return request<{ activeMovies: ActiveMoviesTodayResponse[] }>("/api/getActiveMovies", {
    method: "POST",
    signal: options?.signal,
  });
}
// ----------------- API CREATE MOMO PAYMENT -----------------
export async function createMomoPaymentApi(body: {
  partnerCode: string;
  partnerName: string;
  storeId: string;
  requestId: string;
  amount: number;
  orderId: string;
  orderInfo: string;
  redirectUrl: string;
  ipnUrl: string;
  lang?: any;
  extraData?: any;
  requestType: string;
  signature: string;
}) {
  return request<{ payUrl: string }>("/api/momo/create-payment", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
// ----------------- API CREATE VNPAY PAYMENT -----------------
export async function createVnpayPaymentApi(body: {
  amount: number;
  orderId: string;
  orderInfo: string;
  locale?: string;
  tmnCode?: string;
  hashSecret?: string;
  returnUrl?: string;
}) {
  return request<{ payUrl: string }>("/api/vnpay/create-payment", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
// ----------------- API CREATE BOOKING -----------------
export async function createBookingApi(body: {
  email: string;
  showtimeId: number;
  ticketCount: number;
  paymentMethod: "cash" | "momo" | "vnpay";
  totalPrice: number;
}) {
  return request<{ message: string; booking: any }>("/api/create-booking", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
// ----------------- API CONFIRM BOOKING -----------------
export async function confirmBookingApi(body: {
  user_id: number;
  payment_id: number;
  payment_status: string;
  transaction_id?: string;
  paid_at?: string;
}) {
  return request<{ message: string; booking: any }>("/api/confirm-booking", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
// ----------------- API ADMIN LOGIN -----------------
export async function adminLoginApi(body: { email: string; password: string }) {
  return request<{ token: string; exp: number; user: { email: string } }>("/api/admin/login", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
// ----------------- API TOYS CRUD -----------------
export async function getToys(options?: { page?: number; pageSize?: number; q?: string; signal?: AbortSignal }) {
  const params = new URLSearchParams()
  if (options?.page) params.set("page", String(options.page))
  if (options?.pageSize) params.set("pageSize", String(options.pageSize))
  if (options?.q) params.set("q", options.q)
  const path = `/api/toys${params.toString() ? `?${params.toString()}` : ""}`
  return request<{ items: any[]; page: number; pageSize: number; total: number }>(path, { signal: options?.signal })
}

export async function getActiveToys(options?: { signal?: AbortSignal }) {
  return request<{ items: any[] }>("/api/toys/active", { signal: options?.signal })
}

export async function getToyById(id: number) {
  return request<{ toy: any }>(`/api/toys/${id}`)
}

export async function createToyApi(body: { name: string; category?: string; price: number; stock?: number; status?: string; image_url?: string; image_base64?: string }) {
  return request<{ toy: any }>("/api/toys", { method: "POST", body: JSON.stringify(body) })
}

export async function updateToyApi(id: number, body: { name?: string; category?: string; price?: number; stock?: number; status?: string; image_url?: string; image_base64?: string }) {
  return request<{ toy: any }>(`/api/toys/${id}`, { method: "PUT", body: JSON.stringify(body) })
}

export async function deleteToyApi(id: number) {
  return request<{ ok: boolean }>(`/api/toys/${id}`, { method: "DELETE" })
}
// ----------------- API MOVIES CRUD -----------------
export async function createMovieApi(body: {
  title: string;
  description?: string;
  cover_image?: string;
  cover_image_base64?: string;
  detail_images?: any;
  genres?: any;
  rating?: number;
  duration_min?: number;
  price: number;
  is_active?: boolean;
  release_date?: string;
}) {
  return request<{ movie: any }>("/api/movies", { method: "POST", body: JSON.stringify(body) })
}
export async function getMoviesAdmin(options?: { page?: number; pageSize?: number; q?: string; signal?: AbortSignal }) {
  const params = new URLSearchParams()
  if (options?.page) params.set("page", String(options.page))
  if (options?.pageSize) params.set("pageSize", String(options.pageSize))
  if (options?.q) params.set("q", options.q)
  const path = `/api/movies${params.toString() ? `?${params.toString()}` : ""}`
  return request<{ items: any[]; page: number; pageSize: number; total: number }>(path, { signal: options?.signal })
}
export async function updateMovieApi(id: number, body: { title?: string; description?: string; cover_image?: string; cover_image_base64?: string; detail_images?: any; genres?: any; rating?: number; duration_min?: number; price?: number; is_active?: boolean; release_date?: string }) {
  return request<{ movie: any }>(`/api/movies/${id}`, { method: "PUT", body: JSON.stringify(body) })
}
export async function deleteMovieApi(id: number) {
  return request<{ ok: boolean }>(`/api/movies/${id}`, { method: "DELETE" })
}
// ----------------- API ADMIN REVENUE -----------------
export async function getAdminRevenue(options?: { from?: string; to?: string; signal?: AbortSignal }) {
  const params = new URLSearchParams()
  if (options?.from) params.set("from", options.from)
  if (options?.to) params.set("to", options.to)
  const path = `/api/admin/revenue${params.toString() ? `?${params.toString()}` : ""}`
  return request<{ total: number; count: number }>(path, { signal: options?.signal })
}

// ----------------- API SHOWTIMES CRUD -----------------
export async function getShowtimes(options?: { page?: number; pageSize?: number; from?: string; to?: string; signal?: AbortSignal }) {
  const params = new URLSearchParams()
  if (options?.page) params.set("page", String(options.page))
  if (options?.pageSize) params.set("pageSize", String(options.pageSize))
  if (options?.from) params.set("from", options.from)
  if (options?.to) params.set("to", options.to)
  const path = `/api/showtimes${params.toString() ? `?${params.toString()}` : ""}`
  return request<{ items: any[]; page: number; pageSize: number; total: number }>(path, { signal: options?.signal })
}
export async function createShowtimeApi(body: { movie_id: number; start_time: string; price: number }) {
  return request<{ showtime: any }>(`/api/showtimes`, { method: "POST", body: JSON.stringify(body) })
}
export async function updateShowtimeApi(id: number, body: { movie_id?: number; start_time?: string; price?: number }) {
  return request<{ showtime: any }>(`/api/showtimes/${id}`, { method: "PUT", body: JSON.stringify(body) })
}
export async function deleteShowtimeApi(id: number) {
  return request<{ ok: boolean }>(`/api/showtimes/${id}`, { method: "DELETE" })
}
export const getAdminUsers = async ({ page, pageSize, query }: { page: number, pageSize: number, query: string }) => {
  // Logic fetch API...
  return { items: [], total: 0 }; // Trả về cấu trúc phù hợp
}
export const getTransactions = async ({ page, pageSize, query }: { page: number, pageSize: number, query: string }) => {
  // Logic fetch API...
  return { items: [], total: 0 }; // Trả về cấu trúc phù hợp
}
// ----------------- DECLARE TYPE -----------------
export type { Movie, MoviesResponse, Login, Register };
