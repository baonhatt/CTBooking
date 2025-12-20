import { eq, desc, and, inArray } from "drizzle-orm";
import { formatDateForDb } from "../../lib/date-utils";

export async function createMovieImpl(anyDb: any, tables: { movies: any }, data: { title: string; description?: string; cover_image?: string | null; detail_images?: any; genres?: any; rating?: string | null; duration_min: number; is_active?: boolean; release_date: string | Date | null },RUNTIME_ENV? :string, ) {
  const now = new Date();  
  const baseData: any = {
    title: data.title,
    description: data.description,
    cover_image: data.cover_image ?? null,
    detail_images: data.detail_images,
    genres: data.genres,
    rating: data.rating ?? null,
    duration_min: data.duration_min,
    is_active: data.is_active === undefined ? true : Boolean(data.is_active),
    release_date: data.release_date ? formatDateForDb(data.release_date, RUNTIME_ENV) : null,
    created_at: formatDateForDb(now, RUNTIME_ENV),
    updated_at: formatDateForDb(now, RUNTIME_ENV),
  };
  try {
    const movieInsert = await anyDb.insert(tables.movies).values(baseData).returning();
    let movie: any = Array.isArray(movieInsert) ? movieInsert[0] : movieInsert;
    if (!movie) throw new Error("Không thể tạo phim");
    return { movie };
  } catch (err: any) {
    throw err;
  }
}

export async function updateMovieImpl(anyDb: any, tables: { movies: any }, id: number, data: { title?: string; description?: string; cover_image?: string | null; detail_images?: any; genres?: any; rating?: string | null; duration_min?: number; is_active?: boolean; release_date?: string | Date | null }, RUNTIME_ENV?: string) {
  const now = new Date();
  const payload: any = { updated_at: formatDateForDb(now, RUNTIME_ENV) };

  if (data.title !== undefined) payload.title = data.title;
  if (data.description !== undefined) payload.description = data.description;
  if (data.cover_image !== undefined) payload.cover_image = data.cover_image;
  if (data.detail_images !== undefined) payload.detail_images = data.detail_images;
  if (data.genres !== undefined) payload.genres = data.genres;
  if (data.rating !== undefined) payload.rating = data.rating ?? null;
  if (data.duration_min !== undefined) payload.duration_min = data.duration_min;
  if (data.is_active !== undefined) payload.is_active = Boolean(data.is_active);
  if (data.release_date !== undefined) payload.release_date = data.release_date ? formatDateForDb(data.release_date, RUNTIME_ENV) : null;

  const updatedRes = await anyDb.update(tables.movies).set(payload).where(eq(tables.movies.id, id)).returning();
  let movie: any = Array.isArray(updatedRes) ? updatedRes[0] : updatedRes;

  return movie || null;
}

export async function deleteMovieImpl(anyDb: any, tables: { movies: any }, id: number) {
  // Check if movie exists before deleting
  const existing = await anyDb.query.movies.findFirst({
    where: eq(tables.movies.id, id),
  });

  if (!existing) return null;

  await anyDb.delete(tables.movies).where(eq(tables.movies.id, id));

  return { ok: true };
}

export async function getMovieByIdImpl(anyDb: any, tables: { movies: any; bookings: any }, movieId: number) {
  const movie = await anyDb.query.movies.findFirst({
    where: eq(tables.movies.id, movieId),
  });
  if (!movie) return null;
  const paid = await anyDb.query.bookings.findMany({
    where: and(eq(tables.bookings.movie_id, movieId), inArray(tables.bookings.payment_status, ["paid"])),
    columns: { ticket_count: true, total_price: true },
  });
  const totalTicketsSold = paid.reduce((sum: number, booking: any) => sum + (Number(booking.ticket_count) || 0), 0);
  const totalRevenue = paid.reduce((sum: number, booking: any) => sum + Number(booking.total_price || 0), 0);
  const successfulBookings = paid.length;
  const mapped = {
    id: movie.id,
    title: movie.title,
    description: movie.description || "Không có mô tả",
    cover_image: movie.cover_image,
    genres: movie.genres || [],
    rating: Number(movie.rating || 0),
    duration_min: movie.duration_min || 0,
    is_active: movie.is_active,
    release_date: movie.release_date,
    stats: { totalTicketsSold, totalRevenue, successfulBookings },
    detail_images: movie.detail_images || [],
  };
  return mapped;
}


