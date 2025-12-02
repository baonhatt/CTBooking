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
  id: string;
  title: string;
  year: number;
  duration: string;
  price: number;
  release_date: Date;
  rating: number;
  genres: string[];
  posterUrl: string;
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
  year: number;
  count: number;
  items: Movie[];
}

export interface ShowtimeResponse {
  id: number;
  start_time: Date;
  total_sold: number;
  price: number;
}

export interface ActiveMoviesTodayResponse {
  title: string;
  description: string;
  cover_image: string;
  detail_images: string;
  genres: string;
  rating: string;
  duration_min: number;
  price: number;
  release_date: Date;
  showtimes: ShowtimeResponse[];
}

export interface PaymentRequest {
  email: string;
  showtimeId: number;
  ticketCount: number;
  paymentMethod: 'cash' | 'momo' | 'vnpay';
  totalPrice: number;
}
