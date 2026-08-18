import { request } from './http';

export type ShowtimeItem = {
        id: number;
        branch_id: number;
        movie_id: number;
        start_time: string;
        end_time: string;
        created_at?: string;
        updated_at?: string;
        movie_title?: string | null;
        movie_duration_min?: number;
        movie_cover_image?: string | null;
        movie_deleted?: boolean;
};

export async function getShowtimesAdmin(branchId: number) {
        return request<{ items: ShowtimeItem[] }>(`/api/showtimes?branch_id=${branchId}`);
}

export async function createShowtimeApi(body: {
        branch_id: number;
        movie_id: number;
        start_time: string;
        end_time: string;
}) {
        return request<{ status: string; item?: ShowtimeItem; message?: string }>('/api/showtimes', {
                method: 'POST',
                body: JSON.stringify(body)
        });
}

export async function updateShowtimeApi(
        id: number,
        body: { movie_id?: number; start_time?: string; end_time?: string }
) {
        return request<{ status: string; item?: ShowtimeItem; message?: string }>(`/api/showtimes/${id}`, {
                method: 'PUT',
                body: JSON.stringify(body)
        });
}

export async function deleteShowtimeApi(id: number) {
        return request<{ status: string; message?: string }>(`/api/showtimes/${id}`, {
                method: 'DELETE'
        });
}

export async function copyShowtimesApi(body: { from_branch_id: number; to_branch_id: number }) {
        return request<{ status: string; copied?: number; message?: string }>('/api/showtimes/copy', {
                method: 'POST',
                body: JSON.stringify(body)
        });
}
