import { scrollToElementId } from '@/lib/scroll';

/**
 * Sending a visitor to choose a ticket package.
 *
 * A film is sold in several packages (1 person, groups, combos), so "Đặt vé" on a film (film popup, showtime list)
 * never picks one: it takes the visitor to the package section ("Chọn gói phù hợp", id="promotions") to choose.
 * The film they came from is remembered for this tab only, so booking a package that includes it shows that film
 * (title and poster) on the order instead of the package's first film. Showtimes are not remembered: a ticket is not
 * tied to a time.
 */

const PACKAGE_SECTION_ID = 'promotions';
const PREFERRED_MOVIE_KEY = 'preferredMovieId';

/** Remembers the film (when given) and scrolls to the package section, or opens it on the home page */
export function goToPackageSection(navigate: (url: string) => void, movieId?: number | string | null) {
  try {
    if (movieId) sessionStorage.setItem(PREFERRED_MOVIE_KEY, String(movieId));
  } catch {
    // Storage blocked (private window): the order simply shows the package's first film
  }
  if (!scrollToElementId(PACKAGE_SECTION_ID)) navigate(`/#${PACKAGE_SECTION_ID}`);
}

/** The remembered film when this package includes it, otherwise undefined */
export function preferredMovieIn(packageMovies: Array<{ id?: number | string }> | undefined): number | undefined {
  let rememberedId = 0;
  try {
    rememberedId = Number(sessionStorage.getItem(PREFERRED_MOVIE_KEY) || 0);
  } catch {
    return undefined;
  }
  if (!rememberedId) return undefined;
  return (packageMovies || []).some((movie) => Number(movie?.id) === rememberedId) ? rememberedId : undefined;
}
