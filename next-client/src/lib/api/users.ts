import { request } from '@/lib/api/http';

export async function getUsers(options?: { page?: number; pageSize?: number; q?: string; signal?: AbortSignal }) {
        const params = new URLSearchParams();
        if (options?.page) params.set('page', String(options.page));
        if (options?.pageSize) params.set('pageSize', String(options.pageSize));
        if (options?.q) params.set('q', options.q);
        const path = `/api/admin/users${params.toString() ? `?${params.toString()}` : ''}`;
        return request<{
                items: any[];
                page: number;
                pageSize: number;
                total: number;
        }>(path, { signal: options?.signal });
}

export async function getUserById(id: number) {
        return request<{
                id: number;
                fullname: string;
                phone: string;
                email: string;
                avatar: string | null;
                is_active: boolean;
                login_type: string;
                account_created_at: string;
                user_created_at: string;
                user_updated_at: string;
                recent_bookings: Array<{
                        id: number;
                        movie_title: string;
                        ticket_count: number;
                        total_price: number;
                        payment_method: string;
                        payment_status: string;
                        created_at: string;
                }>;
                total_bookings: number;
        }>(`/api/admin/users/${id}`);
}

export async function updateUserProfileApi(body: {
        email: string;
        name?: string;
        phone?: string;
        gender?: string;
        dob?: string;
}) {
        return request<{ ok: boolean; user: any }>(`/api/users-profile`, {
                method: 'POST',
                body: JSON.stringify(body)
        });
}

export async function changePasswordApi(body: { email: string; oldPassword: string; newPassword: string }) {
        return request<{ ok: boolean }>(`/api/users/password`, {
                method: 'POST',
                body: JSON.stringify(body)
        });
}

export async function getUserTransactionsApi(options: { email: string; status?: 'paid'; signal?: AbortSignal }) {
        const params = new URLSearchParams();
        params.set('email', options.email);
        if (options.status) params.set('status', options.status);
        const path = `/api/usersprofile/transactions?${params.toString()}`;
        return request<{ items: any[] }>(path, { signal: options.signal });
}

export async function getUserProfileByEmailApi(email: string) {
        const params = new URLSearchParams();
        params.set('email', email);
        return request<{
                id?: number;
                fullname?: string;
                phone?: string;
                gender?: string | null;
                dob?: string | null;
                email: string;
                is_active?: boolean;
                login_type?: string;
                user_created_at?: string | null;
                user_updated_at?: string | null;
                account_created_at?: string | null;
        }>(`/api/users-profile?${params.toString()}`);
}
