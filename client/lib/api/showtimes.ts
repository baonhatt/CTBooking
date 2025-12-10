import { request } from "./http";

export async function getShowtimes(options?: {
  page?: number;
  pageSize?: number;
  from?: string;
  to?: string;
  sort?: "start_time" | "created_at" | "movie_title";
  dir?: "asc" | "desc";
  today?: boolean;
  q?: string;
  void?: boolean;
  id?: number;
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
  if (options?.q) params.set("q", options.q);
  if (options?.void) params.set("void", options.void ? "1" : "0");
  if (options?.id) params.set("id", String(options.id));
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
}) {
  return request<{ showtime: any }>(`/api/showtimes`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function createShowtimesBatchApi(body: {
  movie_id: number;
  start_times: Array<string | { start_time: string }>;
}) {
  return request<{ created: any[]; skipped: any[] }>(`/api/showtimes/batch`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateShowtimeApi(
  id: number,
  body: { movie_id?: number; start_time?: string; is_active?: boolean },
) {
  return request<{ showtime: any }>(`/api/showtimes/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function deleteShowtimeApi(id: number) {
  return request<{ ok: boolean }>(`/api/showtimes/${id}`, { method: "DELETE" });
}

export async function getShowtimeById(id: number) {
  return request<{
    id: number;
    movie: any;
    start_time: string;
    end_time: string | null;
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

