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
