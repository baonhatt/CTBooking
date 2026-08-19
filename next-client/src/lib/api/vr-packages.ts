import { request } from '@/lib/api/http';

export interface VRPackageItem {
  vr_package_id: number;
  quantity: number;
}

export interface VoucherValidateRequest {
  code: string;
  vr_items?: VRPackageItem[];
  branch_id?: number;
  user_id?: number;
  booking_type?: 'vr' | 'movie' | 'all';
}

export interface VRBookingRequest {
  email: string;
  emailBook: string;
  phone: string;
  name: string;
  vr_items: VRPackageItem[];
  voucher_code?: string;
  branch_id?: number;
  paymentMethod: 'cash' | 'momo' | 'vnpay' | 'vietqr';
  pay_txt_code?: string;
}

export function getVRPackages(
  branch_id?: number,
  opts?: { signal?: AbortSignal }
) {
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
  return request<{ success: boolean; booking: any; error?: string }>('/api/vr/create-booking', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function getVRBookingById(id: number) {
  return request<any>(`/api/vr/bookings/${id}`);
}
