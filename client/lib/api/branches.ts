import { request } from './http';

export async function getBranches(options?: {
  page?: number;
  pageSize?: number;
  q?: string;
  includeInactive?: boolean;
  signal?: AbortSignal;
}) {
  const params = new URLSearchParams();
  if (options?.page) params.set('page', String(options.page));
  if (options?.pageSize) params.set('pageSize', String(options.pageSize));
  if (options?.q) params.set('q', options.q);
  if (options?.includeInactive) params.set('includeInactive', 'true');

  return request<{ items: any[]; page: number; pageSize: number; total: number; totalPages: number }>(
    `/api/admin/branches?${params.toString()}`,
    {
      signal: options?.signal
    }
  );
}

export async function getAdminBranchOptions(options?: {
  includeInactive?: boolean;
  onlyOpen?: boolean;
  signal?: AbortSignal;
}) {
  const params = new URLSearchParams();
  if (options?.includeInactive) params.set('includeInactive', 'true');
  if (options?.onlyOpen) params.set('onlyOpen', 'true');
  return request<{
    items: Array<{
      id: number;
      name: string;
      code: string;
      address: string | null;
      is_default: boolean;
      is_open: boolean;
      is_active: boolean;
    }>;
  }>(`/api/admin/branches/options?${params.toString()}`, { signal: options?.signal });
}

/** Booking codes of paid tickets of one branch that were never used (at most 50), and how many there are in all. */
export async function getBranchUnusedCodes(id: number, options?: { signal?: AbortSignal }) {
  return request<{ codes: string[]; total: number }>(`/api/admin/branches/${id}/unused-codes`, {
    signal: options?.signal
  });
}

export async function getBranchById(
  id: number | string,
  options?: {
    signal?: AbortSignal;
  }
) {
  return request<{ branch: any }>(`/api/admin/branches/${id}`, {
    signal: options?.signal
  });
}

export async function createBranchApi(body: {
  name: string;
  code: string;
  address?: string;
  phone?: string;
  email?: string;
  is_default?: boolean;
  is_active?: boolean;
}) {
  return request<{ branch: any }>('/api/admin/branches', {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

export async function updateBranchApi(
  id: number,
  body: {
    name?: string;
    code?: string;
    address?: string;
    phone?: string;
    email?: string;
    is_default?: boolean;
    is_active?: boolean;
  }
) {
  return request<{ branch: any }>(`/api/admin/branches/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body)
  });
}

export async function deleteBranchApi(id: number) {
  return request<any>(`/api/admin/branches/${id}`, {
    method: 'DELETE'
  });
}

export async function toggleBranchOpenApi(id: number) {
  return request<{ ok: boolean; is_open: boolean }>(`/api/admin/branches/${id}/toggle-open`, {
    method: 'POST'
  });
}

export async function toggleBranchStatusApi(id: number) {
  return request<{ ok: boolean; is_active: boolean }>(`/api/admin/branches/${id}/toggle-status`, {
    method: 'POST'
  });
}
