import { request } from './http';

export async function getPublicBranches(options?: { signal?: AbortSignal }) {
  return request<{ items: any[]; page: number; pageSize: number; total: number; totalPages: number }>('/api/branches', {
    signal: options?.signal
  });
}

export async function getBranchOptions(options?: { signal?: AbortSignal }) {
  return request<{ items: Array<{ branch_id: number; id: number; name: string; code: string; is_default: boolean; is_open: boolean; is_active: boolean }> }>('/api/branches/options', {
    signal: options?.signal
  });
}

export async function getDefaultBranch(options?: { signal?: AbortSignal }) {
  return request<{ branch: any }>('/api/branches/default', {
    signal: options?.signal
  });
}
