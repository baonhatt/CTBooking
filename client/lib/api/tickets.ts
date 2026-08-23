import { request } from './http';

export async function getTickets(options?: {
        page?: number;
        pageSize?: number;
        q?: string;
        type?: 'all' | 'movie' | 'vr';
        includeInactive?: boolean;
        branch_id?: number | 'all';
        signal?: AbortSignal;
}) {
        const params = new URLSearchParams();
        if (options?.page) params.set('page', String(options.page));
        if (options?.pageSize) params.set('pageSize', String(options.pageSize));
        if (options?.q) params.set('q', options.q);
        if (options?.type && options.type !== 'all') params.set('type', options.type);
        if (options?.includeInactive) params.set('includeInactive', 'true');
        if (options?.branch_id) params.set('branch_id', String(options.branch_id));
        const path = `/api/tickets${params.toString() ? `?${params.toString()}` : ''}`;
        return request<{
                items: any[];
                page: number;
                pageSize: number;
                total: number;
        }>(path, { signal: options?.signal });
}

export async function getActiveTickets(options?: { signal?: AbortSignal }) {
        return request<{ items: any[] }>(`/api/tickets-active`, {
                signal: options?.signal
        });
}

export async function getTicketById(id: number) {
        return request<{ item: any }>(`/api/tickets/${id}`);
}

export async function createTicketApi(body: {
        name: string;
        code?: string;
        description?: string;
        price: number;
        features?: string[];
        type?: string;
        combo?: string[] | number[];
        min_group_size?: number;
        max_group_size?: number;
        is_member_only?: boolean;
        is_active?: boolean;
        display_order?: number;
        branch_id?: number;
        branch_ids?: number[] | null;
        cover_image?: string;
        duration_min?: number;
        vr_genre?: string;
        min_players?: number;
        max_players?: number;
}) {
        return request<{ item: any }>(`/api/tickets`, {
                method: 'POST',
                body: JSON.stringify(body)
        });
}

export async function updateTicketApi(
        id: number,
        body: {
                name?: string;
                code?: string;
                description?: string;
                price?: number;
                features?: string[] | string;
                type?: string;
                combo?: string[] | number[];
                min_group_size?: number;
                max_group_size?: number;
                is_member_only?: boolean;
                is_active?: boolean;
                display_order?: number;
                branch_id?: number;
                branch_ids?: number[] | null;
                cover_image?: string;
                duration_min?: number;
                vr_genre?: string;
                min_players?: number;
                max_players?: number;
        }
) {
        return request<{ item: any }>(`/api/tickets/${id}`, {
                method: 'PUT',
                body: JSON.stringify(body)
        });
}

export async function deleteTicketApi(id: number) {
        return request<{ ok: boolean }>(`/api/tickets/${id}`, { method: 'DELETE' });
}

export async function toggleTicketStatusApi(id: number) {
        return request<{ ok: boolean; is_active: boolean }>(`/api/admin/tickets/${id}/toggle-status`, {
                method: 'POST'
        });
}
