import { request } from './http';

// Note: adminLoginApi removed - login is handled via AdminGate.tsx using /api/admin/auth/login

export async function getAdminRevenue(options?: {
        from?: string;
        to?: string;
        status?: 'all' | 'paid';
        signal?: AbortSignal;
}) {
        const params = new URLSearchParams();
        if (options?.from) params.set('from', options.from);
        if (options?.to) params.set('to', options.to);
        if (options?.status) params.set('status', options.status);
        const path = `/api/admin/revenue${params.toString() ? `?${params.toString()}` : ''}`;
        return request<{ total: number; count: number }>(path, {
                signal: options?.signal
        });
}

export async function getTransactions(options?: {
        page?: number;
        pageSize?: number;
        searchText?: string;
        status?: 'all' | 'paid' | 'failed' | 'pending';
        payment_method?: string;
        from?: string;
        to?: string;
        sort?: 'created_at' | 'paid_at';
        dir?: 'asc' | 'desc';
        branch_id?: number | 'all';
        booking_type?: 'all' | 'movie' | 'vr';
        signal?: AbortSignal;
}) {
        const params = new URLSearchParams();
        if (options?.page) params.set('page', String(options.page));
        if (options?.pageSize) params.set('pageSize', String(options.pageSize));
        if (options?.searchText) params.set('searchText', options.searchText);
        if (options?.status) params.set('status', options.status);
        if (options?.payment_method) params.set('payment_method', options.payment_method);
        if (options?.from) params.set('from', options.from);
        if (options?.to) params.set('to', options.to);
        if (options?.sort) params.set('sort', options.sort);
        if (options?.branch_id) params.set('branch_id', String(options.branch_id));
        if (options?.dir) params.set('dir', options.dir);
        if (options?.booking_type) params.set('booking_type', options.booking_type);
        const path = `/api/admin/transactions${params.toString() ? `?${params.toString()}` : ''}`;
        return request<{
                items: any[];
                page: number;
                pageSize: number;
                total: number;
        }>(path, { signal: options?.signal });
}

export async function getDashboardMetrics(period: string = 'week', year?: number, branch_id?: number | 'all') {
        const params = new URLSearchParams();
        params.append('period', period);
        if (year) params.append('year', String(year));
        if (branch_id) params.append('branch_id', String(branch_id));
        return request<{
                branch_id?: number | null;
                branch_name?: string | null;
                branch_ids?: number[] | null;
                branch?: { id: number; name: string; code?: string } | null;
                totalMovies: number;
                totalToys: number;
                totalUsers: number;
                totalTransactions: number;
                revenueTotal: number;
                revenueByMethod: { cash: number; momo: number; vnpay: number; vietqr: number };
                topTicketsWeek: Array<{ id: number; title: string; revenue: number; count: number }>;
                paymentStats: Array<{ method: string; revenue: number; count: number }>;
                topVipUsers: Array<{ userId: number; email: string; totalSpent: number; bookingCount: number }>;
                ticketUsage: { used: number; total: number };
                paymentHealth: { paid: number; pending: number; failed: number };
                bookingHours: number[];
        }>(`/api/admin/dashboard/metrics?${params.toString()}`);
}

export async function getRevenueByDate(date?: string, status?: 'all' | 'paid', year?: number, branch_id?: number | 'all') {
        const params = new URLSearchParams();
        if (date) params.append('date', date);
        if (status) params.append('status', status);
        if (year) params.append('year', String(year));
        if (branch_id) params.append('branch_id', String(branch_id));
        return request<{
                date: string;
                total: number;
                count: number;
                revenueByMethod: { cash: number; momo: number; vnpay: number; vietqr: number };
        }>(`/api/admin/dashboard/revenue-date?${params.toString()}`);
}

export async function getRevenue7Days(year?: number, branch_id?: number | 'all') {
        const params = new URLSearchParams();
        if (year) params.append('year', String(year));
        if (branch_id) params.append('branch_id', String(branch_id));
        return request<{
                data: Array<{ day: string; revenue: number }>;
        }>(`/api/admin/dashboard/revenue-7days?${params.toString()}`);
}

export async function getRevenueByMonth(year?: number, month?: number, status?: 'all' | 'paid', branch_id?: number | 'all') {
        const params = new URLSearchParams();
        if (year) params.append('year', String(year));
        if (month) params.append('month', String(month));
        if (status) params.append('status', status);
        if (branch_id) params.append('branch_id', String(branch_id));

        if (month) {
                return request<{
                        total: number;
                        count: number;
                        revenueByMethod: { cash: number; momo: number; vnpay: number; vietqr: number };
                }>(`/api/admin/dashboard/revenue-month?${params.toString()}`);
        }

        return request<{
                year: number;
                data: Array<{ month: number; revenue: number }>;
        }>(`/api/admin/dashboard/revenue-month?${params.toString()}`);
}

export async function getTransactionById(id: number) {
        return request<{
                id: number;
                user: {
                        email_auth: string;
                        fullname: string;
                        email: string;
                        phone: string | null;
                        is_active: boolean;
                };
                ticket_package: {
                        name: string;
                        ticket_unit_price: number;
                        movies: string;
                };
                booking_details: {
                        ticket_count: number;
                        total_price: number;
                        combo: string;
                        pay_txt_code: string | null;
                        booking_code: string | null;
                        is_used: boolean;
                        checked_in_at: string;
                        created_at: string;
                };
                payment_info: {
                        payment_method: string | null;
                        payment_status: string | null;
                        transaction_id: string | null;
                        paid_at: string | null;
                        expiry_date: string | null;
                        expired: boolean;
                        days_left: number | null;
                };
        }>(`/api/admin/transactions/${id}`);
}
export async function getEmailLogsApi(options?: {
        page?: number;
        limit?: number;
        status?: string;
        email_type?: string;
        search?: string;
        signal?: AbortSignal;
}) {
        const params = new URLSearchParams();
        if (options?.page) params.set('page', String(options.page));
        if (options?.limit) params.set('limit', String(options.limit));
        if (options?.status) params.set('status', options.status);
        if (options?.email_type) params.set('email_type', options.email_type);
        if (options?.search) params.set('search', options.search);

        const path = `/api/admin/email-logs?${params.toString()}`;
        return request<{
                data: any[];
                pagination: {
                        total: number;
                        page: number;
                        limit: number;
                        totalPages: number;
                };
        }>(path, { signal: options?.signal });
}

export async function checkSuperAdminSetup() {
        return request<{ exists: boolean }>('/api/admin/setup/super-admin');
}

export async function setupSuperAdmin(body: any) {
        return request<{ status: string; message?: string }>('/api/admin/setup/super-admin', {
                method: 'POST',
                body: JSON.stringify(body)
        });
}

export async function requestStaffPasswordChangeOTP(body: { oldPassword: string }) {
        return request<{ status: string; message: string }>('/api/admin/auth/request-password-change-otp', {
                method: 'POST',
                body: JSON.stringify(body)
        });
}

export async function changeStaffPasswordWithOTP(body: { oldPassword: string; newPassword: string; otp: string }) {
        return request<{ status: string; message: string }>('/api/admin/auth/change-password-with-otp', {
                method: 'POST',
                body: JSON.stringify(body)
        });
}

/* ========== VOUCHERS ADMIN API ========== */

export interface VoucherListFilters {
        page?: number;
        pageSize?: number;
        q?: string;
        scope?: 'all' | 'vr' | 'movie';
        is_active?: 'all' | 'true' | 'false';
        branch_id?: number | 'all';
}

export async function listVouchersApi(filters: VoucherListFilters = {}) {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([k, v]) => {
                if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
        });
        const qs = params.toString();
        return request<{
                items: any[];
                page: number;
                pageSize: number;
                total: number;
        }>(`/api/admin/vouchers${qs ? `?${qs}` : ''}`);
}

export async function getVoucherApi(id: number) {
        return request<any>(`/api/admin/vouchers/${id}`);
}

export async function createVoucherApi(payload: Record<string, any>) {
        return request<any>('/api/admin/vouchers', {
                method: 'POST',
                body: JSON.stringify(payload)
        });
}

export async function updateVoucherApi(id: number, payload: Record<string, any>) {
        return request<any>(`/api/admin/vouchers/${id}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
        });
}

export async function deleteVoucherApi(id: number) {
        return request<{ status: string; message?: string }>(`/api/admin/vouchers/${id}`, {
                method: 'DELETE'
        });
}

export async function restoreVoucherApi(id: number) {
        return request<{ status: string; message?: string }>(`/api/admin/vouchers/${id}/restore`, {
                method: 'POST'
        });
}

export async function toggleVoucherStatusApi(id: number) {
        return request<{ status: string; is_active?: boolean }>(
                `/api/admin/vouchers/${id}/toggle-status`,
                { method: 'POST' }
        );
}

export async function listDeletedVouchersApi(filters: VoucherListFilters = {}) {
	const params = new URLSearchParams();
	Object.entries(filters).forEach(([k, v]) => {
		if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
	});
	const qs = params.toString();
	return request<{
		items: any[];
		page: number;
		pageSize: number;
		total: number;
	}>(`/api/admin/vouchers/deleted${qs ? `?${qs}` : ''}`);
}

export async function listStaffOptionsApi() {
	return request<{ status?: string; items: any[]; total: number }>('/api/admin/staff?pageSize=100');
}

/* ========== LIST VR TICKET PACKAGES FOR VOUCHER FORM ========== */
export async function listVRTicketPackagesForVoucher(
        type: string = 'vr',
        branchFilter?: { branch_id?: number | null; restrictToBranchIds?: number[] | null }
) {
        const params = new URLSearchParams();
        params.set('type', type);
        params.set('pageSize', '100');
        params.set('is_active', 'all');
        if (branchFilter?.branch_id) {
                params.set('branch_id', String(branchFilter.branch_id));
        }
        return request<{ items: any[]; total: number }>(
                `/api/tickets?${params.toString()}`
        );
}
