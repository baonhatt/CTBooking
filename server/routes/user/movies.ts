import { eq, desc, and, isNull } from 'drizzle-orm';
import { sqlBranchIdsMatchFilter } from '../../lib/branch-ids';

/** A movie of the "showing now" list, with only what the customer screens read (carousel, hero poster, booking). */
export type PublicActiveMovie = {
  id: number;
  title: string;
  cover_image: string;
  genres: any[];
  release_date: string;
};

export async function getAllActiveMoviesToday(
  anyDb: any,
  tables: { movies: any },
  branch_id?: number
): Promise<{ activeMovies: PublicActiveMovie[] }> {
  const baseCondition = and(eq(tables.movies.is_active, true), isNull(tables.movies.deleted_at));
  const whereCondition = branch_id
    ? and(baseCondition, sqlBranchIdsMatchFilter(tables.movies.branch_ids, tables.movies.branch_id, branch_id))
    : baseCondition;

  const active_movies = await anyDb.query.movies.findMany({
    where: whereCondition,
    columns: {
      id: true,
      title: true,
      cover_image: true,
      genres: true,
      release_date: true
    },
    orderBy: [desc(tables.movies.release_date)]
  });

  const activeMovies: PublicActiveMovie[] = active_movies.map((m: any) => ({
    id: m.id,
    title: m.title,
    cover_image: m.cover_image ?? '',
    genres: m.genres
      ? Array.isArray(m.genres)
        ? m.genres
        : (() => {
            try {
              return JSON.parse(m.genres);
            } catch {
              return [];
            }
          })()
      : [],
    release_date: m.release_date ?? new Date().toISOString()
  }));
  return { activeMovies };
}

