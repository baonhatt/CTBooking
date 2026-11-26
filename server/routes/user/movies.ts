import { eq, desc, asc, count, sql, and, inArray, isNull } from 'drizzle-orm';
import {
  enrichItemsWithParsedBranchIds,
  parseBranchIds,
  sqlBranchIdsMatchFilter,
  sqlBranchIdsStaffAccessFilter
} from '../../lib/branch-ids';

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

export async function listMovies(
  anyDb: any,
  tables: { movies: any },
  args: {
    page: number;
    pageSize: number;
    q: string;
    sort: string;
    dir: 'asc' | 'desc';
    status?: 'all' | 'active' | 'inactive';
    branch_id?: number;
    restrictToBranchIds?: number[] | null;
  }
) {
  const { page, pageSize, q, sort, dir, status = 'all', branch_id, restrictToBranchIds = null } = args;
  const conditions: any[] = [];
  if (q) {
    const term = `%${q.toLowerCase()}%`;
    conditions.push(
      sql`lower(${tables.movies.title}) like ${term} or lower(${tables.movies.description}) like ${term}`
    );
  }
  if (status === 'active') {
    conditions.push(and(eq(tables.movies.is_active, true), isNull(tables.movies.deleted_at)));
  } else if (status === 'inactive') {
    conditions.push(eq(tables.movies.is_active, false));
  }
  if (branch_id) {
    conditions.push(sqlBranchIdsMatchFilter(tables.movies.branch_ids, tables.movies.branch_id, branch_id));
  }
  if (restrictToBranchIds && restrictToBranchIds.length > 0) {
    conditions.push(sqlBranchIdsStaffAccessFilter(tables.movies.branch_ids, restrictToBranchIds));
  }
  const whereClause = conditions.length ? and(...conditions) : undefined;
  const totalResult = await anyDb.select({ count: count() }).from(tables.movies).where(whereClause);
  const total = totalResult[0]?.count || 0;
  const items = await anyDb.query.movies.findMany({
    where: whereClause,
    with: {
      branch: true
    },
    orderBy: (tbl: any, fns: { asc: any; desc: any }) => {
      const direction = dir === 'asc' ? fns.asc : fns.desc;
      switch (sort) {
        case 'release_date':
          return [direction(tbl.release_date)];
        case 'title':
          return [direction(tbl.title)];
        case 'rating':
          return [direction(tbl.rating)];
        default:
          return [direction(tbl.updated_at)];
      }
    },
    limit: pageSize,
    offset: (page - 1) * pageSize
  });
  // Parse JSON fields (handle old data formats)
  const parsedItems = enrichItemsWithParsedBranchIds(
    items.map((m: any) => ({
      ...m,
      detail_images: m.detail_images
        ? Array.isArray(m.detail_images)
          ? m.detail_images
          : (() => {
              try {
                return JSON.parse(m.detail_images);
              } catch {
                return [];
              }
            })()
        : [],
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
        : []
    }))
  );
  return { items: parsedItems, page, pageSize, total };
}

export async function getMovie(
  anyDb: any,
  tables: { movies: any },
  id: number,
  restrictToBranchIds: number[] | null = null
) {
  const whereClause =
    restrictToBranchIds && restrictToBranchIds.length > 0
      ? and(eq(tables.movies.id, id), sqlBranchIdsStaffAccessFilter(tables.movies.branch_ids, restrictToBranchIds))
      : eq(tables.movies.id, id);
  const movie = await anyDb.query.movies.findFirst({
    where: whereClause,
    with: {
      branch: true
    }
  });
  if (!movie) return null;
  // Parse JSON fields (handle old data formats)
  return enrichItemsWithParsedBranchIds([
    {
      ...movie,
      detail_images: movie.detail_images
        ? Array.isArray(movie.detail_images)
          ? movie.detail_images
          : (() => {
              try {
                return JSON.parse(movie.detail_images);
              } catch {
                return [];
              }
            })()
        : [],
      genres: movie.genres
        ? Array.isArray(movie.genres)
          ? movie.genres
          : (() => {
              try {
                return JSON.parse(movie.genres);
              } catch {
                return [];
              }
            })()
        : []
    }
  ])[0];
}
