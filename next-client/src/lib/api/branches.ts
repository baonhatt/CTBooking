import { request } from './http';

/**
 * The branches a customer can choose (active and open), default branch first. Each one has id, name, address, phone,
 * email, banner_images and settings (a JSON text: hotline, map, bank account...).
 */
export async function getPublicBranches(options?: { signal?: AbortSignal }) {
  return request<{ items: any[] }>('/api/branches', {
    signal: options?.signal
  });
}

export async function getDefaultBranch(options?: { signal?: AbortSignal }) {
  return request<{ branch: any }>('/api/branches/default', {
    signal: options?.signal
  });
}
