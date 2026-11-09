import { request } from '@/lib/api/http';
import type { CreatedBooking } from './booking';

export interface VRPackageItem {
  vr_package_id: number;
  quantity: number;
}

export interface VoucherValidateRequest {
  code: string;
  vr_items?: VRPackageItem[];
  movie_items?: Array<{ package_id: number; quantity: number; price: number }>;
  branch_id?: number;
  user_id?: number;
  booking_type?: 'vr' | 'movie' | 'all';
  order_total_before?: number;
}

export interface VRBookingRequest {
  email: string;
  emailBook: string;
  phone: string;
  name: string;
  vr_items: VRPackageItem[];
  voucher_code?: string;
  branch_id?: number;
  paymentMethod: 'cash' | 'vietqr';
}

export function getVRPackages(branch_id?: number, opts?: { signal?: AbortSignal }) {
  let url = '/api/vr/packages';
  if (branch_id !== undefined && branch_id !== null) {
    url += `?branch_id=${branch_id}`;
  }
  return request<{ items: any[] }>(url, { signal: opts?.signal });
}

export function validateVrVoucher(payload: VoucherValidateRequest) {
  return request<any>('/api/vr/voucher/validate', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function validateVRBooking(payload: VRBookingRequest) {
  return request<any>('/api/vr/validate-booking', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function createVRBooking(payload: VRBookingRequest) {
  return request<{ success: boolean; booking: CreatedBooking; error?: string }>('/api/vr/create-booking', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

// The VR booking lookup by id was removed: the payment page reads its status with fetchBookingStatus (booking.ts).
