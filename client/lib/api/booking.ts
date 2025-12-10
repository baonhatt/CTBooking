import { request } from "./http";

export async function createBookingApi(body: {
  email: string;
  emailBook: string;
  phone: string;
  name: string;
  showtimeId: number;
  ticketCount: number;
  paymentMethod: "cash" | "momo" | "vnpay";
  totalPrice?: number;
  ticketPackageId?: number;
}) {
  return request<{ message: string; booking: any }>("/api/create-booking", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function validateBookingApi(body: {
  email: string;
  emailBook: string;
  phone: string;
  name: string;
  showtimeId: number;
  ticketCount: number;
  ticketPackageId?: number;
}) {
  return request<{
    ok: boolean;
    message?: string;
    user?: { id: number; email: string; fullname?: string; phone?: string };
    showtime?: { id: number; start_time: string; end_time?: string | null; is_active?: boolean | null };
    movie?: { id: number; title: string; is_active?: boolean | null; duration_min?: number | null };
    ticketPackage?: { id: number; name: string; price: number };
    unitPrice?: number;
    totalPrice?: number;
  }>("/api/validate-booking", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function confirmBookingApi(body: {
  user_id: number;
  payment_id: number;
  payment_status: string;
  transaction_id?: string;
  paid_at?: string;
}) {
  return request<{ message: string; booking: any }>("/api/confirm-booking", {
    method: "POST",
    body: JSON.stringify(body),
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
    showtime_id: number;
    showtime?: {
      id: number;
      start_time: string;
      movie?: {
        id: number;
        title: string;
      };
    };
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
    showtime_id: number;
    created_at: string;
    paid_at: string | null;
    payment_method: string | null;
    userName: string;
    showtime?: {
      id: number;
      start_time: string;
      end_time: string | null;
      movie?: {
        id: number;
        title: string;
        genres: any;
        duration_min: number | null;
        cover_image: string | null;
      };
    };
  }>(`/api/bookings/code/${code}`);
}

