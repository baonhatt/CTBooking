import { request } from './http';

export async function getUsers(options?: { page?: number; pageSize?: number; q?: string; status?: string; signal?: AbortSignal }) {
  const params = new URLSearchParams();
  if (options?.page) params.set('page', String(options.page));
  if (options?.pageSize) params.set('pageSize', String(options.pageSize));
  if (options?.q) params.set('q', options.q);
  if (options?.status && options.status !== 'all') params.set('status', options.status);
  const path = `/api/admin/users${params.toString() ? `?${params.toString()}` : ''}`;
  return request<{
    items: any[];
    page: number;
    pageSize: number;
    total: number;
  }>(path, { signal: options?.signal });
}

export interface AdminUserRecentBooking {
  id: number;
  booking_code: string;
  movie_title: string;
  ticket_package_name: string;
  ticket_count: number;
  total_price: number;
  payment_method: string;
  payment_status: string;
  created_at: string;
}

export interface AdminUserDetail {
  id: number;
  fullname: string;
  phone: string;
  email: string;
  avatar: string | null;
  gender: string | null;
  dob: string | null;
  is_active: boolean;
  login_type: string;
  account_created_at?: string | null;
  user_created_at: string;
  user_updated_at: string;
  recent_bookings: AdminUserRecentBooking[];
  total_bookings: number;
  paid_bookings: number;
  total_spent: number;
  last_booking_at: string | null;
  created_by_staff_name: string | null;
  updated_by_staff_name: string | null;
}

export async function getUserById(id: number) {
  return request<AdminUserDetail>(`/api/admin/users/${id}`);
}

// Lock (is_active = false, with a reason) or unlock a customer
export async function setUserActive(id: number, is_active: boolean, reason?: string) {
  return request<{ ok: boolean }>(`/api/admin/users/${id}/active`, {
    method: 'PATCH',
    body: JSON.stringify({ is_active, reason: reason || '' })
  });
}

export async function updateUserProfileApi(body: {
  email: string;
  name?: string;
  phone?: string;
  gender?: string;
  dob?: string;
}) {
  return request<{ ok: boolean; user: any }>(`/api/user/profile`, {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

export async function changePasswordApi(body: { email: string; oldPassword: string; newPassword: string }) {
  return request<{ ok: boolean }>(`/api/user/password`, {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

export async function getUserTransactionsApi(options: { email: string; status?: 'paid'; signal?: AbortSignal }) {
  const params = new URLSearchParams();
  params.set('email', options.email);
  if (options.status) params.set('status', options.status);
  const path = `/api/user/transactions?${params.toString()}`;
  return request<{ items: any[] }>(path, { signal: options.signal });
}

export async function getUserProfileByEmailApi(email: string) {
  const params = new URLSearchParams();
  params.set('email', email);
  return request<{
    id?: number;
    fullname?: string;
    phone?: string;
    gender?: string | null;
    dob?: string | null;
    email: string;
    is_active?: boolean;
    login_type?: string;
    user_created_at?: string | null;
    user_updated_at?: string | null;
    account_created_at?: string | null;
  }>(`/api/user/profile?${params.toString()}`);
}
