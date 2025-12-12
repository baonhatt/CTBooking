// Simple in-memory store for movie details
interface MovieDetail {
  id: number;
  title: string;
  description: string;
  cover_image: string | null;
  genres: any[];
  rating: number;
  duration_min: number;
  price: number;
  is_active: boolean;
  release_date: string | null;
  created_at: string;
  updated_at: string;
  hasShowtimes: boolean;
  stats: {
    totalShowtimes: number;
    totalTicketsSold: number;
    totalRevenue: number;
    successfulBookings: number;
  };
}

class MovieStore {
  private movies: Map<number, MovieDetail> = new Map();

  setMovie(movie: MovieDetail) {
    this.movies.set(movie.id, movie);
  }

  getMovie(id: number): MovieDetail | undefined {
    return this.movies.get(id);
  }

  clearMovies() {
    this.movies.clear();
  }

  getAllMovies(): MovieDetail[] {
    return Array.from(this.movies.values());
  }
}

// Export singleton instance
export const movieStore = new MovieStore();

