import { request } from '@/lib/api/http';

export async function createBookingApi(body: {
        email: string;
        emailBook: string;
        phone: string;
        name: string;
        movieId?: number;
        ticketCount: number;
        paymentMethod: 'vietqr' | 'momo' | 'vnpay';
        totalPrice?: number;
        ticketPackageId?: number;
        pay_txt_code: string;
        combo: string[];
}) {
        return request<{ message: string; booking: any }>('/api/create-booking', {
                method: 'POST',
                body: JSON.stringify(body)
        });
}

export async function validateBookingApi(body: {
        email: string;
        emailBook: string;
        phone: string;
        name: string;
        movieId?: number;
        ticketCount: number;
        ticketPackageId?: number;
        combo: string[];
}) {
        return request<{
                status: string;
                message?: string;
                user?: { id: number; email: string; fullname?: string; phone?: string };
                movie?: {
                        id: number;
                        title: string;
                        is_active?: boolean | null;
                        duration_min?: number | null;
                };
                ticketPackage?: { id: number; name: string; price: number };
                unitPrice?: number;
                totalPrice?: number;
        }>('/api/validate-booking', {
                method: 'POST',
                body: JSON.stringify(body)
        });
}

export async function confirmBookingApi(body: {
        user_id: number;
        payment_id: number;
        payment_status: string;
        transaction_id?: string;
        paid_at?: string;
}) {
        return request<{ message: string; booking: any }>('/api/confirm-booking', {
                method: 'POST',
                body: JSON.stringify(body)
        });
}

export async function getBookingByIdApi(bookingId: number) {
        return request<{
                id: number;
                payment_status: string;
                user_id: number;
                name: string;
                phone: string;
                email: string;
                ticket_count: number;
                total_price: number;
                payment_method?: string;
        }>(`/api/bookings/${bookingId}`);
}

export async function getBookingByCodeApi(code: string) {
        return request<{
                id: number;
                booking_code: string;
                payment_status: string;
                user_id: number;
                name: string;
                phone: string;
                email: string;
                ticket_count: number;
                total_price: number;
                created_at: string;
                paid_at: string | null;
                expiry_date: string | null;
                checked_in_at: string | null;
                payment_method: string | null;
                userName: string;
                is_used: boolean;
                valid: boolean;
                can_use: boolean;
                validity_days: number | null;
                expired: boolean;
        }>(`/api/bookings-code/${code}`);
}

export async function useTicketApi(code: string) {
        return request<{
                status: string;
                message: string;
                booking: { id: number; is_used: boolean };
        }>(`/api/bookings-use`, {
                method: 'POST',
                body: JSON.stringify({ code })
        });
}
