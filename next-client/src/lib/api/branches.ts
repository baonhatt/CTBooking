import { request } from './http';

export async function getPublicBranches(options?: {
        signal?: AbortSignal;
}) {
        return request<{ items: any[]; page: number; pageSize: number; total: number; totalPages: number }>('/api/branches', {
                signal: options?.signal
        });
}

export async function getDefaultBranch(options?: {
        signal?: AbortSignal;
}) {
        return request<{ branch: any }>('/api/branches/default', {
                signal: options?.signal
        });
}
