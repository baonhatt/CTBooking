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

