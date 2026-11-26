import { request } from './http';

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

// Export of the transaction list with the same filters. The server returns at most 5000 rows and says when it cut the list.
export async function exportTransactions(options?: {
  searchText?: string;
  status?: string;
  payment_method?: string;
  from?: string;
  to?: string;
  sort?: 'created_at' | 'paid_at';
  dir?: 'asc' | 'desc';
  branch_id?: number | 'all';
  booking_type?: 'all' | 'movie' | 'vr';
}) {
  const params = new URLSearchParams();
  if (options?.searchText) params.set('searchText', options.searchText);
  if (options?.status) params.set('status', options.status);
  if (options?.payment_method) params.set('payment_method', options.payment_method);
  if (options?.from) params.set('from', options.from);
  if (options?.to) params.set('to', options.to);
  if (options?.sort) params.set('sort', options.sort);
  if (options?.branch_id) params.set('branch_id', String(options.branch_id));
  if (options?.dir) params.set('dir', options.dir);
  if (options?.booking_type) params.set('booking_type', options.booking_type);
  const path = '/api/admin/transactions/export' + (params.toString() ? '?' + params.toString() : '');
  return request<{ items: any[]; total: number; truncated: boolean; limit: number }>(path);
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
    revenue_hidden?: boolean;
    revenueTotal?: number;
    revenueByMethod?: { cash: number; vietqr: number };
    topTicketsWeek: Array<{ id: number; title: string; revenue?: number; count: number }>;
    paymentStats: Array<{ method: string; revenue?: number; count: number }>;
    topVipUsers?: Array<{ userId: number; email: string; totalSpent: number; bookingCount: number }>;
    ticketUsage: { used: number; total: number };
    paymentHealth: { paid: number; pending: number; failed: number };
    bookingHours: number[];
  }>(`/api/admin/dashboard/metrics?${params.toString()}`);
}

export async function getRevenueByDate(
  date?: string,
  status?: 'all' | 'paid',
  year?: number,
  branch_id?: number | 'all'
) {
  const params = new URLSearchParams();
  if (date) params.append('date', date);
  if (status) params.append('status', status);
  if (year) params.append('year', String(year));
  if (branch_id) params.append('branch_id', String(branch_id));
  return request<{
    date: string;
    total: number;
    count: number;
    revenueByMethod: { cash: number; vietqr: number };
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

export async function getRevenueByMonth(
  year?: number,
  month?: number,
  status?: 'all' | 'paid',
  branch_id?: number | 'all'
) {
  const params = new URLSearchParams();
  if (year) params.append('year', String(year));
  if (month) params.append('month', String(month));
  if (status) params.append('status', status);
  if (branch_id) params.append('branch_id', String(branch_id));

  if (month) {
    return request<{
      total: number;
      count: number;
      revenueByMethod: { cash: number; vietqr: number };
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
    };
    booking_details: {
      ticket_count: number;
      total_price: number;
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
  return request<{ status: string; is_active?: boolean }>(`/api/admin/vouchers/${id}/toggle-status`, {
    method: 'POST'
  });
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
  }>(`/api/admin/deleted/vouchers${qs ? `?${qs}` : ''}`);
}

export async function listStaffOptionsApi() {
  return request<{ status?: string; items: any[]; total: number }>('/api/admin/staff?pageSize=100');
}

/* ========== LIST TICKET PACKAGES FOR VOUCHER FORM ========== */
/** A ticket package the voucher form can pick (active or not; the server scopes it to the staff member's branches). */
export interface VoucherPackageOption {
  id: number;
  name: string;
  price: number;
  type: string | null;
  branch_id: number | null;
  branch_ids: number[] | null;
  is_active: boolean;
}

export async function listVRTicketPackagesForVoucher(type: string = 'vr', branchFilter?: { branch_id?: number | null }) {
  const params = new URLSearchParams();
  params.set('type', type);
  if (branchFilter?.branch_id) {
    params.set('branch_id', String(branchFilter.branch_id));
  }
  return request<{ items: VoucherPackageOption[]; total: number }>(`/api/admin/vouchers/package-options?${params.toString()}`);
}

// ============================================================
// UNMATCHED TRANSFERS ("Chuyển khoản chưa khớp")
// ============================================================

export interface UnmatchedTransfer {
  id: number;
  sepay_id: string | null;
  amount: number;
  content: string | null;
  bank_ref: string | null;
  transfer_at: string | null;
  status: 'open' | 'matched' | 'ignored';
  booking_id: number | null;
  note: string | null;
  resolved_by_name: string | null;
  resolved_at: string | null;
  created_at: string;
}

export async function getUnmatchedTransfersApi(options: {
  status: 'open' | 'matched' | 'ignored';
  q?: string;
  page?: number;
  pageSize?: number;
}) {
  const params = new URLSearchParams({ status: options.status });
  if (options.q) params.set('q', options.q);
  if (options.page) params.set('page', String(options.page));
  if (options.pageSize) params.set('pageSize', String(options.pageSize));
  return request<{ items: UnmatchedTransfer[]; total: number; page: number; pageSize: number }>(
    `/api/admin/unmatched-transfers?${params.toString()}`
  );
}

export async function assignUnmatchedTransferApi(id: number, payCode: string) {
  return request<{ message: string; booking_id: number; voucher_slot_unavailable?: boolean }>(
    `/api/admin/unmatched-transfers/${id}/assign`,
    { method: 'POST', body: JSON.stringify({ pay_code: payCode }) }
  );
}

export async function ignoreUnmatchedTransferApi(id: number, note: string) {
  return request<{ message: string }>(`/api/admin/unmatched-transfers/${id}/ignore`, {
    method: 'POST',
    body: JSON.stringify({ note })
  });
}

// ============================================================
// ACTION ITEMS ("Đơn cần xử lý")
// ============================================================

export interface ActionItemResolution {
  by: string;
  at: string;
  note: string;
  how: string;
}

export interface OrderIssue {
  id: number;
  reason: string;
  reason_label: string;
  details: string;
  created_at: string;
  pay_txt_code: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  payment_status: string;
  amount_received: number | null;
  amount_needed: number | null;
  bank_ref: string;
  resolved: ActionItemResolution | null;
}

export interface EmailIssue {
  id: number;
  recipient: string;
  email_type: string;
  error_message: string;
  created_at: string;
  can_resend: boolean;
  resolved: ActionItemResolution | null;
}

export async function getActionItemsCountApi() {
  return request<{ unmatched: number; orders: number; emails: number; total: number }>('/api/admin/action-items/count');
}

export async function getActionItemsApi<T>(kind: 'orders' | 'emails', status: 'open' | 'done', page = 1, pageSize = 20) {
  const params = new URLSearchParams({ status, page: String(page), pageSize: String(pageSize) });
  return request<{ items: T[]; total: number; page: number; pageSize: number }>(`/api/admin/action-items/${kind}?${params.toString()}`);
}

export async function actOnActionItemApi(
  kind: 'orders' | 'emails',
  id: number,
  action: 'resolve' | 'confirm' | 'resend',
  note?: string
) {
  return request<{ message: string; voucher_slot_unavailable?: boolean }>(`/api/admin/action-items/${kind}/${id}/${action}`, {
    method: 'POST',
    body: JSON.stringify(note ? { note } : {})
  });
}
