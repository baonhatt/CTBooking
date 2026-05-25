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

// Admin branch management APIs
export async function getBranches(params?: {
        page?: number;
        pageSize?: number;
        q?: string;
        includeInactive?: boolean;
        signal?: AbortSignal;
}) {
        const { page = 1, pageSize = 10, q = '', includeInactive = false, signal } = params || {};
        return request<{ items: any[]; page: number; pageSize: number; total: number; totalPages: number }>(
                `/api/admin/branches?page=${page}&pageSize=${pageSize}&q=${encodeURIComponent(q)}&includeInactive=${includeInactive}`,
                { signal }
        );
}

export async function getBranchById(id: number, options?: {
        signal?: AbortSignal;
}) {
        return request<{ branch: any }>(`/api/admin/branches/${id}`, {
                signal: options?.signal
        });
}

export async function createBranch(data: {
        name: string;
        code: string;
        address?: string;
        phone?: string;
        email?: string;
        is_default?: boolean;
        is_active?: boolean;
}, options?: {
        signal?: AbortSignal;
}) {
        return request<{ status: string; branch: any }>('/api/admin/branches', {
                method: 'POST',
                body: JSON.stringify(data),
                signal: options?.signal
        });
}

export async function updateBranch(id: number, data: {
        name?: string;
        code?: string;
        address?: string;
        phone?: string;
        email?: string;
        is_default?: boolean;
        is_active?: boolean;
}, options?: {
        signal?: AbortSignal;
}) {
        return request<{ status: string; branch: any }>(`/api/admin/branches/${id}`, {
                method: 'PUT',
                body: JSON.stringify(data),
                signal: options?.signal
        });
}

export async function deleteBranch(id: number, options?: {
        signal?: AbortSignal;
}) {
        return request<{ status: string; message: string }>(`/api/admin/branches/${id}`, {
                method: 'DELETE',
                signal: options?.signal
        });
}
