import { request } from './http';

export async function getUsers(options?: { page?: number; pageSize?: number; q?: string }) {
  const params = new URLSearchParams();
  if (options?.page) params.set('page', String(options.page));
  if (options?.pageSize) params.set('pageSize', String(options.pageSize));
  if (options?.q) params.set('q', options.q);

  const path = `/api/admin/users${params.toString() ? `?${params.toString()}` : ''}`;
  return request<{
    data: any[];
    total: number;
  }>(path);
}

export async function getUserById(id: string | number) {
  return request<{
    id: number;
    name: string;
    email: string;
    role: string;
    is_active: boolean;
    permissions: string[];
    permissions_count?: number;
    created_at: string;
  }>(`/api/admin/users/${id}`);
}

export async function createAdminUser(data: {
  name: string;
  email: string;
  password: string;
  role: string;
  permissions: string[];
}) {
  return request('/api/admin/users', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export async function updateAdminUser(
  id: string | number,
  data: {
    name?: string;
    email?: string;
    role?: string;
    is_active?: boolean;
    permissions?: string[];
  }
) {
  return request(`/api/admin/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}
