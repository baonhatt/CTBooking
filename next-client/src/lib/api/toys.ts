import { request } from '@/lib/api/http';

export async function getToys(options?: {
        page?: number;
        pageSize?: number;
        q?: string;
        status?: string;
        signal?: AbortSignal;
}) {
        const params = new URLSearchParams();
        if (options?.page) params.set('page', String(options.page));
        if (options?.pageSize) params.set('pageSize', String(options.pageSize));
        if (options?.q) params.set('q', options.q);
        if (options?.status) params.set('status', options.status);
        const path = `/api/toys${params.toString() ? `?${params.toString()}` : ''}`;
        return request<{
                items: any[];
                page: number;
                pageSize: number;
                total: number;
        }>(path, { signal: options?.signal });
}

export async function getActiveToys(options?: { signal?: AbortSignal }) {
        return request<{ items: any[] }>('/api/toys-active', {
                signal: options?.signal
        });
}

export async function getToyById(id: number) {
        return request<{ toy: any }>(`/api/toys/${id}`);
}

export async function createToyApi(body: {
        name: string;
        category?: string;
        price: number;
        stock?: number;
        status?: string;
        image_url?: string;
        image_base64?: string;
}) {
        return request<{ toy: any }>('/api/toys', {
                method: 'POST',
                body: JSON.stringify(body)
        });
}

export async function updateToyApi(
        id: number,
        body: {
                name?: string;
                category?: string;
                price?: number;
                stock?: number;
                status?: string;
                image_url?: string;
                image_base64?: string;
        }
) {
        return request<{ toy: any }>(`/api/toys/${id}`, {
                method: 'PUT',
                body: JSON.stringify(body)
        });
}

export async function deleteToyApi(id: number) {
        return request<{ ok: boolean }>(`/api/toys/${id}`, { method: 'DELETE' });
}
