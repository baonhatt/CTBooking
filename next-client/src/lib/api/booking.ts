import { request, buildUrl } from '@/lib/api/http';
import { VRPackageItem } from './vr-packages';

/** Header that proves "this is my order" to the status and cancel routes. */
const ORDER_TOKEN_HEADER = 'X-Order-Token';

/** What the server returns for a new order. The payment reference, token and deadline all come from the server. */
export interface CreatedBooking {
  id: number;
  user_id?: number | null;
  pay_txt_code: string;
  order_token: string;
  payment_expires_at: string;
  server_now: string;
  [key: string]: any;
}

export async function createBookingApi(body: {
  email: string;
  emailBook: string;
  phone: string;
  name: string;
  movieId?: number;
  ticketCount: number;
  paymentMethod: 'vietqr' | 'cash';
  totalPrice?: number;
  ticketPackageId?: number;
  combo?: string[];
  movie_items?: { package_id: number; quantity: number; price?: number }[];
  vr_items?: VRPackageItem[];
  voucher_code?: string;
  branch_id?: number;
}) {
  return request<{ message: string; booking: CreatedBooking }>('/api/create-booking', {
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
  combo?: string[];
  movie_items?: { package_id: number; quantity: number; price?: number }[];
  vr_items?: VRPackageItem[];
  voucher_code?: string;
  branch_id?: number;
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
    movieTotalPrice?: number;
    vrTotalPrice?: number;
    originalTotalPrice?: number;
    voucherDiscountAmount?: number;
    totalPrice?: number;
    vr_items?: any[];
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
  return request<{ message: string; booking: any }>('/api/admin/confirm-booking', {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

/** What the payment page may know about an order: the payment state and the deadline, nothing personal. */
export interface BookingStatus {
  id: number;
  payment_status: string;
  payment_expires_at: string | null;
  server_now: string;
}

/** `httpStatus` is null when the server could not be reached at all (offline, timeout). */
export type BookingStatusResult = { ok: true; data: BookingStatus } | { ok: false; httpStatus: number | null };

/**
 * Reads the payment status of one order. Needs the order token that came with the new order, so a booking id on
 * its own gets nothing. A 404 means the token does not match or the order is gone.
 */
export async function fetchBookingStatus(
  bookingId: number,
  orderToken: string,
  options: { signal?: AbortSignal } = {}
): Promise<BookingStatusResult> {
  try {
    const res = await fetch(buildUrl(`/api/bookings/${bookingId}`), {
      cache: 'no-store',
      credentials: 'include',
      headers: { [ORDER_TOKEN_HEADER]: orderToken },
      signal: options.signal
    });
    if (!res.ok) return { ok: false, httpStatus: res.status };
    return { ok: true, data: (await res.json()) as BookingStatus };
  } catch {
    return { ok: false, httpStatus: null };
  }
}

/**
 * Cancels an unpaid order. `httpStatus` 200 means cancelled, 409 means it was already paid, 404 means it is gone,
 * null means the server could not be reached.
 */
export async function cancelBookingByToken(
  bookingId: number,
  orderToken: string
): Promise<{ httpStatus: number | null }> {
  try {
    const res = await fetch(buildUrl('/api/cancel-booking'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', [ORDER_TOKEN_HEADER]: orderToken },
      body: JSON.stringify({ payment_id: bookingId })
    });
    return { httpStatus: res.status };
  } catch {
    return { httpStatus: null };
  }
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
    original_total_price?: number;
    voucher_discount_amount?: number;
    voucher_code_snapshot?: string;
    booking_type?: string;
    created_at: string;
    paid_at: string | null;
    expiry_date: string | null;
    checked_in_at: string | null;
    payment_method: string | null;
    userName: string;
    ticket_package_name?: string;
    ticket_unit_price?: number;
    movie_title?: string;
    movie_duration?: string;
    movie_poster?: string;
    is_used: boolean;
    valid: boolean;
    can_use: boolean;
    validity_days: number | null;
    expired: boolean;
    vr_items?: any[];
  }>(`/api/admin/bookings-code/${code}`);
}

export async function useTicketApi(code: string) {
  return request<{
    status: string;
    message: string;
    booking: { id: number; is_used: boolean };
  }>(`/api/admin/bookings-use`, {
    method: 'POST',
    body: JSON.stringify({ code })
  });
}
