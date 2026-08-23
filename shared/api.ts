/**
 * Shared code between client and server
 * Useful to share types between client and server
 * and/or small pure JS functions that can be used on both client and server
 */

/**
 * Example response type for /api/demo
 */
export interface DemoResponse {
        message: string;
}

export interface Movie {
<<<<<<< HEAD
        id: string;
        title: string;
        year: number;
        duration: string;
        price: number;
        release_date: Date;
        rating: number;
        genres: string[];
        posterUrl: string;
=======
  id: string;
  title: string;
  year: number;
  duration: string;
  price: number;
  release_date: Date;
  rating: number;
  genres: string[];
  posterUrl: string;
>>>>>>> preview
}

export interface Login {
        email: string;
        password: string;
}

export interface Register {
        email: string;
        password: string;
        name?: string;
}

export interface MoviesResponse {
<<<<<<< HEAD
        year: number;
        count: number;
        items: Movie[];
}

export interface ActiveMoviesTodayResponse {
        id: number;
        title: string;
        description: string;
        cover_image: string;
        detail_images: string;
        genres: string;
        rating: string;
        duration_min: number;
        price: number;
        release_date: Date;
}

export interface PaymentRequest {
        email: string;
        emailBook: string;
        phone: string;
        name: string;
        movieId?: number;
        combo?: number[];
        ticketCount: number;
        paymentMethod: 'cash' | 'momo' | 'vnpay';
        totalPrice?: number;
        ticketPackageId?: number;
        pay_txt_code?: string;
=======
  year: number;
  count: number;
  items: Movie[];
}

export interface ActiveMoviesTodayResponse {
  id: number;
  title: string;
  description: string;
  cover_image: string;
  detail_images: string;
  genres: string;
  rating: string;
  duration_min: number;
  price: number;
  release_date: Date;
}

export interface PaymentRequest {
  email: string;
  emailBook: string;
  phone: string;
  name: string;
  movieId?: number;
  combo?: number[];
  ticketCount: number;
  paymentMethod: 'cash' | 'momo' | 'vnpay' | 'vietqr';
  totalPrice?: number;
  ticketPackageId?: number;
  pay_txt_code?: string;
  vr_items?: VRPackageItem[];
  voucher_code?: string;
  branch_id?: number;
>>>>>>> preview
}

// =====================================================================
// VR EXPERIENCE + VOUCHER TYPES (added for VR module)
// =====================================================================

export interface VRPackageItem {
  vr_package_id: number;
  quantity: number;
}

export interface VRPackageSummary {
  id: number;
  name: string;
  code?: string;
  description?: string;
  price: number;
  features?: string;
  is_active: boolean;
  display_order: number;
  branch_ids?: string;
  cover_image?: string;
  duration_min?: number;
  vr_genre?: string;
  min_players?: number;
  max_players?: number;
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

export interface VoucherSummary {
  id: number;
  code: string;
  name: string;
  description?: string;
  scope: 'vr' | 'movie' | 'all';
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  min_order_value: number;
  max_discount?: number;
  usage_limit?: number;
  per_user_limit?: number;
  used_count: number;
  is_active: boolean;
  valid_from?: string;
  valid_until?: string;
  applicable_ticket_package_ids?: string;
  branch_ids?: string;
}

export interface VoucherValidateRequest {
  code: string;
  vr_items?: VRPackageItem[];
  branch_id?: number;
  user_id?: number;
  order_total_before?: number;
}

export interface VoucherValidateResponse {
  valid: boolean;
  message?: string;
  error_code?: 'VOUCHER_NOT_FOUND'
    | 'VOUCHER_INACTIVE'
    | 'VOUCHER_EXPIRED'
    | 'VOUCHER_USAGE_LIMIT_REACHED'
    | 'VOUCHER_PER_USER_LIMIT_REACHED'
    | 'VOUCHER_MIN_ORDER_NOT_REACHED'
    | 'VOUCHER_SCOPE_MISMATCH'
    | 'VOUCHER_PACKAGE_NOT_APPLICABLE'
    | 'VOUCHER_BRANCH_MISMATCH'
    | 'VOUCHER_NOT_YET_VALID';
  discount_amount?: number;
  discount_type?: 'percent' | 'fixed';
  voucher_details?: VoucherSummary;
  order_total_before?: number;
  order_total_after?: number;
}

export interface VoucherCreateRequest {
  code: string;
  name: string;
  description?: string;
  scope?: 'vr' | 'movie' | 'all';
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  min_order_value?: number;
  max_discount?: number;
  usage_limit?: number;
  per_user_limit?: number;
  is_active?: boolean;
  valid_from?: string;
  valid_until?: string;
  applicable_ticket_package_ids?: number[] | string;
  branch_ids?: number[] | string;
}

export interface VoucherUpdateRequest extends VoucherCreateRequest {
  id: number;
}

export interface VRPackageLineItem {
  id?: number;
  booking_id?: number;
  vr_ticket_package_id: number;
  quantity: number;
  unit_price: number;
  package_name: string;
  voucher_id?: number;
  discounted_unit_price?: number;
  line_total: number;
  voucher_discount_amount?: number;
  branch_id?: number;
  created_at?: string;
}

export interface VRBookingResponse {
  success: boolean;
  booking?: {
    id: number;
    booking_code: string;
    booking_type: 'vr' | 'movie';
    total_price: number;
    original_total_price: number;
    voucher_discount_amount: number;
    voucher_code_snapshot?: string;
    voucher_id?: number;
    payment_status: string;
    payment_method: string;
    vr_items: VRPackageLineItem[];
  };
  error?: string;
}

