import type {
  Movie,
  MoviesResponse,
  Login,
  Register,
  ActiveMoviesTodayResponse,
} from "@shared/api";

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
    } catch { }
    throw new Error(errorMessage);
  }
  return (await res.json()) as T;
}
// ----------------- API GET MOVIES 2025 -----------------
export async function getMovies2025(options?: { signal?: AbortSignal }) {
  return request<MoviesResponse>("/api/movies/2025", {
    signal: options?.signal,
  });
}
// ----------------- API LOGIN -----------------
export async function loginApi(body: { email: string; password: string }) {
  return request<{ status: string; message: string; user: any }>("/api/login", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
// ----------------- API REGISTER -----------------
export async function registerApi(body: {
  email: string;
  password: string;
  name?: string;
}) {
  return request<{ status: string; message: string; user: any }>(
    "/api/register",
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}
// ----------------- API FORGET PASS -----------------
export async function forgetPassApi(body: { email: string }) {
  return request<{ status: string; message: string }>("/api/forget-password", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
// ----------------- API RESET PASS -----------------
export async function resetPasswordApi(body: {
  token: string;
  newPassword: string;
}) {
  return request<{ status: string; message: string }>("/api/reset-password", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ----------------- API GET ACTIVE MOVIES TODAY -----------------
export async function getAllActiveMoviesToday(options?: {
  signal?: AbortSignal;
}) {
  return request<{ activeMovies: ActiveMoviesTodayResponse[] }>(
    "/api/getActiveMovies",
    {
      method: "POST",
      signal: options?.signal,
    },
  );
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
  return request<{ token: string; exp: number; user: { email: string } }>(
    "/api/admin/login",
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}
// ----------------- API TOYS CRUD -----------------
export async function getToys(options?: {
  page?: number;
  pageSize?: number;
  q?: string;
  signal?: AbortSignal;
}) {
  const params = new URLSearchParams();
  if (options?.page) params.set("page", String(options.page));
  if (options?.pageSize) params.set("pageSize", String(options.pageSize));
  if (options?.q) params.set("q", options.q);
  const path = `/api/toys${params.toString() ? `?${params.toString()}` : ""}`;
  return request<{
    items: any[];
    page: number;
    pageSize: number;
    total: number;
  }>(path, { signal: options?.signal });
}

export async function getActiveToys(options?: { signal?: AbortSignal }) {
  return request<{ items: any[] }>("/api/toys/active", {
    signal: options?.signal,
  });
}

export async function getToyById(id: number) {
  return request<{ toy: any }>(`/api/toys/${id}`);
}

export async function createToyApi(body: {
  name: string;
  category?: string;
  price: number;
  stock?: number;
  status?: string;
  image_url?: string;
  image_base64?: string;
}) {
  return request<{ toy: any }>("/api/toys", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateToyApi(
  id: number,
  body: {
    name?: string;
    category?: string;
    price?: number;
    stock?: number;
    status?: string;
    image_url?: string;
    image_base64?: string;
  },
) {
  return request<{ toy: any }>(`/api/toys/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function deleteToyApi(id: number) {
  return request<{ ok: boolean }>(`/api/toys/${id}`, { method: "DELETE" });
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
  return request<{ movie: any }>("/api/movies", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
export async function getMoviesAdmin(options?: {
  page?: number;
  pageSize?: number;
  q?: string;
  signal?: AbortSignal;
}) {
  const params = new URLSearchParams();
  if (options?.page) params.set("page", String(options.page));
  if (options?.pageSize) params.set("pageSize", String(options.pageSize));
  if (options?.q) params.set("q", options.q);
  const path = `/api/movies${params.toString() ? `?${params.toString()}` : ""}`;
  return request<{
    items: any[];
    page: number;
    pageSize: number;
    total: number;
  }>(path, { signal: options?.signal });
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
    price?: number;
    is_active?: boolean;
    release_date?: string;
  },
) {
  return request<{ movie: any }>(`/api/movies/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}
export async function deleteMovieApi(id: number) {
  return request<{ ok: boolean }>(`/api/movies/${id}`, { method: "DELETE" });
}
// ----------------- API ADMIN REVENUE -----------------
export async function getAdminRevenue(options?: {
  from?: string;
  to?: string;
  status?: "all" | "paid";
  signal?: AbortSignal;
}) {
  const params = new URLSearchParams();
  if (options?.from) params.set("from", options.from);
  if (options?.to) params.set("to", options.to);
  if (options?.status) params.set("status", options.status);
  const path = `/api/admin/revenue${params.toString() ? `?${params.toString()}` : ""}`;
  return request<{ total: number; count: number }>(path, {
    signal: options?.signal,
  });
}

// ----------------- API ADMIN TRANSACTIONS -----------------
export async function getTransactions(options?: {
  page?: number;
  pageSize?: number;
  email?: string;
  signal?: AbortSignal;
}) {
  const params = new URLSearchParams();
  if (options?.page) params.set("page", String(options.page));
  if (options?.pageSize) params.set("pageSize", String(options.pageSize));
  if (options?.email) params.set("email", options.email);
  const path = `/api/admin/transactions${params.toString() ? `?${params.toString()}` : ""}`;
  return request<{
    items: any[];
    page: number;
    pageSize: number;
    total: number;
  }>(path, { signal: options?.signal });
}

// ----------------- API SHOWTIMES CRUD -----------------
export async function getShowtimes(options?: {
  page?: number;
  pageSize?: number;
  from?: string;
  to?: string;
  sort?: "start_time" | "created_at" | "movie_title";
  dir?: "asc" | "desc";
  today?: boolean;
  signal?: AbortSignal;
}) {
  const params = new URLSearchParams();
  if (options?.page) params.set("page", String(options.page));
  if (options?.pageSize) params.set("pageSize", String(options.pageSize));
  if (options?.from) params.set("from", options.from);
  if (options?.to) params.set("to", options.to);
  if (options?.sort) params.set("sort", options.sort);
  if (options?.dir) params.set("dir", options.dir);
  if (options?.today) params.set("today", options.today ? "1" : "0");
  const path = `/api/showtimes${params.toString() ? `?${params.toString()}` : ""}`;
  return request<{
    items: any[];
    page: number;
    pageSize: number;
    total: number;
  }>(path, { signal: options?.signal });
}
export async function createShowtimeApi(body: {
  movie_id: number;
  start_time: string;
  price: number;
}) {
  return request<{ showtime: any }>(`/api/showtimes`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
export async function createShowtimesBatchApi(body: {
  movie_id: number;
  start_times: Array<string | { start_time: string; price?: number }>;
  price?: number;
}) {
  return request<{ created: any[]; skipped: any[] }>(`/api/showtimes/batch`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
export async function updateShowtimeApi(
  id: number,
  body: { movie_id?: number; start_time?: string; price?: number },
) {
  return request<{ showtime: any }>(`/api/showtimes/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}
export async function deleteShowtimeApi(id: number) {
  return request<{ ok: boolean }>(`/api/showtimes/${id}`, { method: "DELETE" });
}

// ----------------- API DASHBOARD -----------------
export async function getDashboardMetrics() {
  return request<{
    totalMovies: number;
    totalShowtimes: number;
    totalToys: number;
    totalUsers: number;
    totalTransactions: number;
    revenueTotal: number;
  }>("/api/admin/dashboard/metrics");
}

export async function getRevenueByDate(date?: string, status?: "all" | "paid") {
  const params = new URLSearchParams();
  if (date) params.append("date", date);
  if (status) params.append("status", status);
  return request<{ date: string; total: number; count: number }>(
    `/api/admin/dashboard/revenue-date?${params.toString()}`
  );
}

export async function getRevenue7Days() {
  return request<{
    data: Array<{ day: string; revenue: number }>;
  }>("/api/admin/dashboard/revenue-7days");
}

export async function getRevenueByMonth(year?: number, month?: number, status?: "all" | "paid") {
  const params = new URLSearchParams();
  if (year) params.append("year", String(year));
  if (month) params.append("month", String(month));
  if (status) params.append("status", status);

  if (month) {
    // When filtering by specific month, return total and count
    return request<{
      total: number;
      count: number;
    }>(`/api/admin/dashboard/revenue-month?${params.toString()}`);
  } else {
    // When getting 12-month data, return year and data array
    return request<{
      year: number;
      data: Array<{ month: number; revenue: number }>;
    }>(`/api/admin/dashboard/revenue-month?${params.toString()}`);
  }
}

// ----------------- API USERS -----------------
export async function getUsers(options?: {
  page?: number;
  pageSize?: number;
  q?: string;
  signal?: AbortSignal;
}) {
  const params = new URLSearchParams();
  if (options?.page) params.set("page", String(options.page));
  if (options?.pageSize) params.set("pageSize", String(options.pageSize));
  if (options?.q) params.set("q", options.q);
  const path = `/api/users${params.toString() ? `?${params.toString()}` : ""}`;
  return request<{
    items: any[];
    page: number;
    pageSize: number;
    total: number;
  }>(path, { signal: options?.signal });
}

export async function getUserById(id: number) {
  return request<{
    id: number;
    fullname: string;
    phone: string;
    email: string;
    avatar: string | null;
    is_active: boolean;
    login_type: string;
    account_created_at: string;
    user_created_at: string;
    user_updated_at: string;
    recent_bookings: Array<{
      id: number;
      movie_title: string;
      ticket_count: number;
      total_price: number;
      payment_method: string;
      payment_status: string;
      created_at: string;
    }>;
    total_bookings: number;
  }>(`/api/users/${id}`);
}

// ----------------- API MOVIE DETAILS -----------------
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
      totalShowtimes: number;
      totalTicketsSold: number;
      totalRevenue: number;
      successfulBookings: number;
    };
  }>(`/api/movies/detail/${id}`);
}

// ----------------- API SHOWTIME DETAILS -----------------
export async function getShowtimeById(id: number) {
  return request<{
    id: number;
    movie: any;
    start_time: string;
    end_time: string | null;
    price: number;
    total_sold: number;
    created_at: string;
    updated_at: string;
    stats: {
      totalBookings: number;
      successfulBookings: number;
      failedBookings: number;
      totalRevenue: number;
      totalTickets: number;
      averageTicketsPerBooking: number;
    };
    recent_bookings: Array<{
      id: number;
      user: {
        id: number;
        fullname: string;
        email: string;
        phone: string | null;
      };
      ticket_count: number;
      total_price: number;
      payment_method: string;
      payment_status: string;
      created_at: string;
    }>;
  }>(`/api/showtimes/detail/${id}`);
}

// ----------------- API TRANSACTION DETAILS -----------------
export async function getTransactionById(id: number) {
  return request<{
    id: number;
    user: {
      id: number;
      fullname: string;
      email: string;
      phone: string | null;
      is_active: boolean;
      account_created_at: string;
    };
    showtime: {
      id: number;
      start_time: string;
      end_time: string | null;
      price: number;
      movie: {
        id: number;
        title: string;
        cover_image: string | null;
        genres: any[];
        rating: number;
        duration_min: number;
      };
    };
    booking_details: {
      ticket_count: number;
      total_price: number;
      price_per_ticket: number;
    };
    payment_info: {
      payment_method: string;
      payment_status: string;
      transaction_id: string;
      created_at: string;
      paid_at: string | null;
    };
  }>(`/api/admin/transactions/${id}`);
}

// ----------------- DECLARE TYPE -----------------
export type { Movie, MoviesResponse, Login, Register };
// ----------------- API TICKET PACKAGES -----------------
export async function getTickets(options?: {
  page?: number;
  pageSize?: number;
  q?: string;
  signal?: AbortSignal;
}) {
  const params = new URLSearchParams();
  if (options?.page) params.set("page", String(options.page));
  if (options?.pageSize) params.set("pageSize", String(options.pageSize));
  if (options?.q) params.set("q", options.q);
  const path = `/api/tickets${params.toString() ? `?${params.toString()}` : ""}`;
  return request<{
    items: any[];
    page: number;
    pageSize: number;
    total: number;
  }>(path, { signal: options?.signal });
}

export async function getActiveTickets(options?: { signal?: AbortSignal }) {
  return request<{ items: any[] }>(`/api/tickets/active`, {
    signal: options?.signal,
  });
}

export async function getTicketById(id: number) {
  return request<{ item: any }>(`/api/tickets/${id}`);
}

export async function createTicketApi(body: {
  name: string;
  code?: string;
  description?: string;
  price: number;
  features?: string[];
  type?: string;
  min_group_size?: number;
  max_group_size?: number;
  is_member_only?: boolean;
  is_active?: boolean;
  display_order?: number;
}) {
  return request<{ item: any }>(`/api/tickets`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateTicketApi(
  id: number,
  body: {
    name?: string;
    code?: string;
    description?: string;
    price?: number;
    features?: string[] | string;
    type?: string;
    min_group_size?: number;
    max_group_size?: number;
    is_member_only?: boolean;
    is_active?: boolean;
    display_order?: number;
  },
) {
  return request<{ item: any }>(`/api/tickets/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function deleteTicketApi(id: number) {
  return request<{ ok: boolean }>(`/api/tickets/${id}`, { method: "DELETE" });
}
