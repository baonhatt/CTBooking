import { eq, and, asc, isNull } from 'drizzle-orm';

export async function getPublicScheduleImpl(
        db: any,
        tables: { showtimes: any; movies: any },
        branchId: number
) {
        if (!branchId) {
                return { items: [], opens_at: null, closes_at: null };
        }

        const rows = await db
                .select({
                        id: tables.showtimes.id,
                        branch_id: tables.showtimes.branch_id,
                        movie_id: tables.showtimes.movie_id,
                        start_time: tables.showtimes.start_time,
                        end_time: tables.showtimes.end_time,
                        movie_title: tables.movies.title,
                        movie_duration_min: tables.movies.duration_min,
                        movie_cover_image: tables.movies.cover_image
                })
                .from(tables.showtimes)
                .innerJoin(tables.movies, eq(tables.showtimes.movie_id, tables.movies.id))
                .where(and(eq(tables.showtimes.branch_id, branchId), isNull(tables.movies.deleted_at)))
                .orderBy(asc(tables.showtimes.start_time));

        const items = rows.map((row: any) => ({
                id: row.id,
                movie_id: row.movie_id,
                start_time: row.start_time,
                end_time: row.end_time,
                movie_title: row.movie_title,
                movie_duration_min: row.movie_duration_min ?? 0,
                movie_cover_image: row.movie_cover_image ?? null
        }));

        return {
                items,
                opens_at: items[0]?.start_time ?? null,
                closes_at: items[items.length - 1]?.end_time ?? null
        };
}
