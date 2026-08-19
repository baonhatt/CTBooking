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

export async function getAdminBranchOptions(options?: { includeInactive?: boolean; onlyOpen?: boolean; signal?: AbortSignal }) {
        const params = new URLSearchParams();
        if (options?.includeInactive) params.set('includeInactive', 'true');
        if (options?.onlyOpen) params.set('onlyOpen', 'true');
        return request<{ items: Array<{ branch_id: number; id: number; name: string; code: string; is_default: boolean; is_open: boolean; is_active: boolean }> }>(
                `/api/admin/branches/options?${params.toString()}`,
                { signal: options?.signal }
        );
}

export async function getDefaultBranch(options?: { signal?: AbortSignal }) {
        return request<{ branch: any }>('/api/branches/default', {
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
