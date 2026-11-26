/** One movie of the film popup (GET /api/movies-detail/:id): an active movie, only the fields the popup shows. */
export interface MovieDetail {
  id: number;
  title: string;
  description: string | null;
  cover_image: string | null;
  genres: any[];
  rating: number | null;
  duration_min: number | null;
  release_date: string | null;
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
