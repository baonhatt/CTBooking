import { request } from "./http";

export async function adminLoginApi(body: { email: string; password: string }) {
  return request<{ token: string; exp: number; user: { email: string } }>(
    "/api/admin/login",
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

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

export async function getTransactions(options?: {
  page?: number;
  pageSize?: number;
  searchText?: string;
  status?: "all" | "paid" | "failed" | "pending";
  payment_method?: string;
  from?: string;
  to?: string;
  sort?: "created_at" | "paid_at";
  dir?: "asc" | "desc";
  signal?: AbortSignal;
}) {
  const params = new URLSearchParams();
  if (options?.page) params.set("page", String(options.page));
  if (options?.pageSize) params.set("pageSize", String(options.pageSize));
  if (options?.searchText) params.set("searchText", options.searchText);
  if (options?.status) params.set("status", options.status);
  if (options?.payment_method)
    params.set("payment_method", options.payment_method);
  if (options?.from) params.set("from", options.from);
  if (options?.to) params.set("to", options.to);
  if (options?.sort) params.set("sort", options.sort);
  if (options?.dir) params.set("dir", options.dir);
  const path = `/api/admin/transactions${params.toString() ? `?${params.toString()}` : ""}`;
  return request<{
    items: any[];
    page: number;
    pageSize: number;
    total: number;
  }>(path, { signal: options?.signal });
}

export async function getDashboardMetrics() {
  return request<{
    totalMovies: number;
    totalToys: number;
    totalUsers: number;
    totalTransactions: number;
    revenueTotal: number;
    revenueByMethod: { cash: number; momo: number; vnpay: number };
    topMoviesWeek: Array<{ id: number; title: string; revenue: number }>;
  }>("/api/admin/dashboard/metrics");
}

export async function getRevenueByDate(date?: string, status?: "all" | "paid") {
  const params = new URLSearchParams();
  if (date) params.append("date", date);
  if (status) params.append("status", status);
  return request<{
    date: string;
    total: number;
    count: number;
    revenueByMethod: { cash: number; momo: number; vnpay: number };
  }>(`/api/admin/dashboard/revenue-date?${params.toString()}`);
}

export async function getRevenue7Days() {
  return request<{
    data: Array<{ day: string; revenue: number }>;
  }>("/api/admin/dashboard/revenue-7days");
}

export async function getRevenueByMonth(
  year?: number,
  month?: number,
  status?: "all" | "paid",
) {
  const params = new URLSearchParams();
  if (year) params.append("year", String(year));
  if (month) params.append("month", String(month));
  if (status) params.append("status", status);

  if (month) {
    return request<{
      total: number;
      count: number;
      revenueByMethod: { cash: number; momo: number; vnpay: number };
    }>(`/api/admin/dashboard/revenue-month?${params.toString()}`);
  }

  return request<{
    year: number;
    data: Array<{ month: number; revenue: number }>;
  }>(`/api/admin/dashboard/revenue-month?${params.toString()}`);
}

export async function getTransactionById(id: number) {
  return request<{
    id: number;
    user: {
      email_auth: string;
      fullname: string;
      email: string;
      phone: string | null;
      is_active: boolean;
    };
    ticket_package: {
      name: string;
      ticket_unit_price: number;
      movies: string;
    };
    booking_details: {
      ticket_count: number;
      total_price: number;
      combo: string;
      pay_txt_code: string | null;
      booking_code: string | null;
      is_used: boolean;
      checked_in_at: string;
      created_at: string;
    };
    payment_info: {
      payment_method: string | null;
      payment_status: string | null;
      transaction_id: string | null;
      paid_at: string | null;
      expiry_date: string | null;
      expired: boolean;
      days_left: number | null;
    };
  }>(`/api/admin/transactions/${id}`);
}
