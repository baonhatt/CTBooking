import { request } from '@/lib/api/http';

export async function adminLoginApi(body: { email: string; password: string }) {
  const res = await request<any>('/api/admin/auth/login', {
    method: 'POST',
    body: JSON.stringify(body)
  });

  if (res.status === 'success' && res.staff && !res.user) {
    res.user = {
      ...res.staff,
      username: res.staff.fullname
    };
  }

  return res;
}

export async function getAdminRevenue(options?: {
  from?: string;
  to?: string;
  status?: 'all' | 'paid';
  signal?: AbortSignal;
}) {
  const params = new URLSearchParams();
  if (options?.from) params.set('from', options.from);
  if (options?.to) params.set('to', options.to);
  if (options?.status) params.set('status', options.status);
  const path = `/api/admin/revenue${params.toString() ? `?${params.toString()}` : ''}`;
  return request<{ total: number; count: number }>(path, {
    signal: options?.signal
  });
}

export async function getTransactions(options?: {
  page?: number;
  pageSize?: number;
  searchText?: string;
  status?: 'all' | 'paid' | 'failed' | 'pending';
  payment_method?: string;
  from?: string;
  to?: string;
  sort?: 'created_at' | 'paid_at';
  dir?: 'asc' | 'desc';
  signal?: AbortSignal;
}) {
  const params = new URLSearchParams();
  if (options?.page) params.set('page', String(options.page));
  if (options?.pageSize) params.set('pageSize', String(options.pageSize));
  if (options?.searchText) params.set('searchText', options.searchText);
  if (options?.status) params.set('status', options.status);
  if (options?.payment_method) params.set('payment_method', options.payment_method);
  if (options?.from) params.set('from', options.from);
  if (options?.to) params.set('to', options.to);
  if (options?.sort) params.set('sort', options.sort);
  if (options?.dir) params.set('dir', options.dir);
  const path = `/api/admin/transactions${params.toString() ? `?${params.toString()}` : ''}`;
  return request<{
    items: any[];
    page: number;
    pageSize: number;
    total: number;
  }>(path, { signal: options?.signal });
}

export async function getDashboardMetrics(period: string = 'week', year?: number) {
  const params = new URLSearchParams();
  params.append('period', period);
  if (year) params.append('year', String(year));
  return request<{
    totalMovies: number;
    totalToys: number;
    totalUsers: number;
    totalTransactions: number;
    revenueTotal: number;
    revenueByMethod: { cash: number; momo: number; vnpay: number; vietqr: number };
    topTicketsWeek: Array<{ id: number; title: string; revenue: number; count: number }>;
    paymentStats: Array<{ method: string; revenue: number; count: number }>;
    topVipUsers: Array<{ userId: number; email: string; totalSpent: number; bookingCount: number }>;
    ticketUsage: { used: number; total: number };
    paymentHealth: { paid: number; pending: number; failed: number };
    bookingHours: number[];
  }>(`/api/admin/dashboard/metrics?${params.toString()}`);
}

export async function getRevenueByDate(date?: string, status?: 'all' | 'paid', year?: number) {
  const params = new URLSearchParams();
  if (date) params.append('date', date);
  if (status) params.append('status', status);
  if (year) params.append('year', String(year));
  return request<{
    date: string;
    total: number;
    count: number;
    revenueByMethod: { cash: number; momo: number; vnpay: number; vietqr: number };
  }>(`/api/admin/dashboard/revenue-date?${params.toString()}`);
}

export async function getRevenue7Days(year?: number) {
  const params = new URLSearchParams();
  if (year) params.append('year', String(year));
  return request<{
    data: Array<{ day: string; revenue: number }>;
  }>(`/api/admin/dashboard/revenue-7days?${params.toString()}`);
}

export async function getRevenueByMonth(year?: number, month?: number, status?: 'all' | 'paid') {
  const params = new URLSearchParams();
  if (year) params.append('year', String(year));
  if (month) params.append('month', String(month));
  if (status) params.append('status', status);

  if (month) {
    return request<{
      total: number;
      count: number;
      revenueByMethod: { cash: number; momo: number; vnpay: number; vietqr: number };
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
export async function getEmailLogsApi(options?: {
  page?: number;
  limit?: number;
  status?: string;
  email_type?: string;
  search?: string;
  signal?: AbortSignal;
}) {
  const params = new URLSearchParams();
  if (options?.page) params.set('page', String(options.page));
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.status) params.set('status', options.status);
  if (options?.email_type) params.set('email_type', options.email_type);
  if (options?.search) params.set('search', options.search);

  const path = `/api/admin/email-logs?${params.toString()}`;
  return request<{
    data: any[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }>(path, { signal: options?.signal });
}

export async function requestStaffPasswordChangeOTP(body: { oldPassword: string }) {
  return request<{ status: string; message: string }>('/api/admin/auth/request-password-change-otp', {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

export async function changeStaffPasswordWithOTP(body: { oldPassword: string; newPassword: string; otp: string }) {
  return request<{ status: string; message: string }>('/api/admin/auth/change-password-with-otp', {
    method: 'POST',
    body: JSON.stringify(body)
  });
}
