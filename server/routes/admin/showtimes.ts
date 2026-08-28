import { eq, and, ne, asc, sql } from 'drizzle-orm';
import { logAuditAction } from '../../lib/audit-logger';
import { formatDateForDb } from '../../lib/date-utils';
import { isValidTime, normalizeTime } from '../../lib/showtime-utils';

type StaffInfo = { id: number; email: string; fullname: string };

function assertBranchAccess(branchId: number, restrictToBranchIds: number[] | null) {
  if (restrictToBranchIds === null) return;
  if (!restrictToBranchIds.includes(branchId)) {
    const err: any = new Error('Bạn không có quyền thao tác chi nhánh này');
    err.statusCode = 403;
    throw err;
  }
}

function mapShowtimeRow(row: any) {
  return {
    id: row.id,
    branch_id: row.branch_id,
    movie_id: row.movie_id,
    start_time: row.start_time,
    end_time: row.end_time,
    created_at: row.created_at,
    updated_at: row.updated_at,
    movie_title: row.movie_title ?? null,
    movie_duration_min: row.movie_duration_min ?? 0,
    movie_cover_image: row.movie_cover_image ?? null,
    movie_deleted: Boolean(row.movie_deleted_at)
  };
}

async function findOverlappingShowtime(
  db: any,
  tables: { showtimes: any },
  branchId: number,
  startTime: string,
  endTime: string,
  excludeId?: number
) {
  const conditions: any[] = [
    eq(tables.showtimes.branch_id, branchId),
    sql`${tables.showtimes.start_time} < ${endTime} AND ${tables.showtimes.end_time} > ${startTime}`
  ];
  if (excludeId) conditions.push(ne(tables.showtimes.id, excludeId));

  const [existing] = await db
    .select({ id: tables.showtimes.id, start_time: tables.showtimes.start_time, end_time: tables.showtimes.end_time })
    .from(tables.showtimes)
    .where(and(...conditions))
    .limit(1);

  return existing ?? null;
}

export async function listShowtimesImpl(
  db: any,
  tables: { showtimes: any; movies: any },
  branchId: number,
  restrictToBranchIds: number[] | null
) {
  if (!branchId) {
    return { status: 'error', message: 'Thiếu chi nhánh', statusCode: 400 };
  }
  assertBranchAccess(branchId, restrictToBranchIds);

  const rows = await db
    .select({
      id: tables.showtimes.id,
      branch_id: tables.showtimes.branch_id,
      movie_id: tables.showtimes.movie_id,
      start_time: tables.showtimes.start_time,
      end_time: tables.showtimes.end_time,
      created_at: tables.showtimes.created_at,
      updated_at: tables.showtimes.updated_at,
      movie_title: tables.movies.title,
      movie_duration_min: tables.movies.duration_min,
      movie_cover_image: tables.movies.cover_image,
      movie_deleted_at: tables.movies.deleted_at
    })
    .from(tables.showtimes)
    .leftJoin(tables.movies, eq(tables.showtimes.movie_id, tables.movies.id))
    .where(eq(tables.showtimes.branch_id, branchId))
    .orderBy(asc(tables.showtimes.start_time));

  return { items: rows.map(mapShowtimeRow) };
}

export async function createShowtimeImpl(
  db: any,
  tables: { showtimes: any; movies: any; branches: any; auditLogs: any },
  data: { branch_id: number; movie_id: number; start_time: string; end_time: string },
  restrictToBranchIds: number[] | null,
  staffInfo?: StaffInfo
) {
  const branchId = Number(data.branch_id);
  const movieId = Number(data.movie_id);
  const startTime = normalizeTime(data.start_time);
  const endTime = normalizeTime(data.end_time);

  if (!branchId || !movieId) {
    return { status: 'error', message: 'Thiếu chi nhánh hoặc phim', statusCode: 400 };
  }
  if (!isValidTime(startTime) || !isValidTime(endTime)) {
    return { status: 'error', message: 'Giờ chiếu không hợp lệ (định dạng 10:00)', statusCode: 400 };
  }
  if (endTime <= startTime) {
    return { status: 'error', message: 'Giờ kết thúc phải sau giờ bắt đầu trong cùng ngày', statusCode: 400 };
  }
  assertBranchAccess(branchId, restrictToBranchIds);

  const [branch] = await db
    .select({ id: tables.branches.id })
    .from(tables.branches)
    .where(eq(tables.branches.id, branchId))
    .limit(1);
  if (!branch) return { status: 'error', message: 'Không tìm thấy chi nhánh', statusCode: 404 };

  const [movie] = await db
    .select({ id: tables.movies.id, deleted_at: tables.movies.deleted_at })
    .from(tables.movies)
    .where(eq(tables.movies.id, movieId))
    .limit(1);
  if (!movie || movie.deleted_at) return { status: 'error', message: 'Không tìm thấy phim', statusCode: 404 };

  const overlap = await findOverlappingShowtime(db, tables, branchId, startTime, endTime);
  if (overlap) {
    return {
      status: 'error',
      message: `Suất bị trùng với khung ${overlap.start_time} – ${overlap.end_time}`,
      statusCode: 400
    };
  }

  const now = formatDateForDb(new Date()) as string;
  const [created] = await db
    .insert(tables.showtimes)
    .values({
      branch_id: branchId,
      movie_id: movieId,
      start_time: startTime,
      end_time: endTime,
      created_at: now,
      updated_at: now
    })
    .returning();

  if (staffInfo) {
    await logAuditAction(
      db,
      tables.auditLogs,
      'create',
      'showtimes',
      created.id,
      `Tạo suất chiếu ${startTime}-${endTime} (phim #${movieId}) chi nhánh #${branchId}`,
      staffInfo.id,
      staffInfo.email,
      staffInfo.fullname,
      undefined,
      JSON.stringify(created)
    );
  }

  return { status: 'success', item: created };
}

export async function updateShowtimeImpl(
  db: any,
  tables: { showtimes: any; movies: any; auditLogs: any },
  id: number,
  data: { movie_id?: number; start_time?: string; end_time?: string },
  restrictToBranchIds: number[] | null,
  staffInfo?: StaffInfo
) {
  const [existing] = await db.select().from(tables.showtimes).where(eq(tables.showtimes.id, id)).limit(1);
  if (!existing) return { status: 'error', message: 'Không tìm thấy suất chiếu', statusCode: 404 };
  assertBranchAccess(existing.branch_id, restrictToBranchIds);

  const movieId = data.movie_id !== undefined ? Number(data.movie_id) : existing.movie_id;
  const startTime = data.start_time !== undefined ? normalizeTime(data.start_time) : existing.start_time;
  const endTime = data.end_time !== undefined ? normalizeTime(data.end_time) : existing.end_time;

  if (!movieId) return { status: 'error', message: 'Thiếu phim', statusCode: 400 };
  if (!isValidTime(startTime) || !isValidTime(endTime)) {
    return { status: 'error', message: 'Giờ chiếu không hợp lệ (định dạng 10:00)', statusCode: 400 };
  }
  if (endTime <= startTime) {
    return { status: 'error', message: 'Giờ kết thúc phải sau giờ bắt đầu trong cùng ngày', statusCode: 400 };
  }

  const [movie] = await db
    .select({ id: tables.movies.id, deleted_at: tables.movies.deleted_at })
    .from(tables.movies)
    .where(eq(tables.movies.id, movieId))
    .limit(1);
  if (!movie || movie.deleted_at) return { status: 'error', message: 'Không tìm thấy phim', statusCode: 404 };

  const overlap = await findOverlappingShowtime(db, tables, existing.branch_id, startTime, endTime, id);
  if (overlap) {
    return {
      status: 'error',
      message: `Suất bị trùng với khung ${overlap.start_time} – ${overlap.end_time}`,
      statusCode: 400
    };
  }

  const now = formatDateForDb(new Date()) as string;
  const [updated] = await db
    .update(tables.showtimes)
    .set({
      movie_id: movieId,
      start_time: startTime,
      end_time: endTime,
      updated_at: now
    })
    .where(eq(tables.showtimes.id, id))
    .returning();

  if (staffInfo) {
    await logAuditAction(
      db,
      tables.auditLogs,
      'update',
      'showtimes',
      id,
      `Sửa suất chiếu #${id}`,
      staffInfo.id,
      staffInfo.email,
      staffInfo.fullname,
      JSON.stringify(existing),
      JSON.stringify(updated)
    );
  }

  return { status: 'success', item: updated };
}

export async function deleteShowtimeImpl(
  db: any,
  tables: { showtimes: any; auditLogs: any },
  id: number,
  restrictToBranchIds: number[] | null,
  staffInfo?: StaffInfo
) {
  const [existing] = await db.select().from(tables.showtimes).where(eq(tables.showtimes.id, id)).limit(1);
  if (!existing) return { status: 'error', message: 'Không tìm thấy suất chiếu', statusCode: 404 };
  assertBranchAccess(existing.branch_id, restrictToBranchIds);

  await db.delete(tables.showtimes).where(eq(tables.showtimes.id, id));

  if (staffInfo) {
    await logAuditAction(
      db,
      tables.auditLogs,
      'delete',
      'showtimes',
      id,
      `Xóa suất chiếu ${existing.start_time}-${existing.end_time} chi nhánh #${existing.branch_id}`,
      staffInfo.id,
      staffInfo.email,
      staffInfo.fullname,
      JSON.stringify(existing)
    );
  }

  return { status: 'success' };
}

export async function copyShowtimesImpl(
  db: any,
  tables: { showtimes: any; auditLogs: any },
  data: { from_branch_id: number; to_branch_id: number },
  restrictToBranchIds: number[] | null,
  staffInfo?: StaffInfo
) {
  const fromBranchId = Number(data.from_branch_id);
  const toBranchId = Number(data.to_branch_id);

  if (!fromBranchId || !toBranchId) {
    return { status: 'error', message: 'Thiếu chi nhánh nguồn hoặc đích', statusCode: 400 };
  }
  if (fromBranchId === toBranchId) {
    return { status: 'error', message: 'Chi nhánh nguồn và đích phải khác nhau', statusCode: 400 };
  }

  assertBranchAccess(fromBranchId, restrictToBranchIds);
  assertBranchAccess(toBranchId, restrictToBranchIds);

  const source = await db
    .select()
    .from(tables.showtimes)
    .where(eq(tables.showtimes.branch_id, fromBranchId))
    .orderBy(asc(tables.showtimes.start_time));

  if (!source.length) {
    return { status: 'error', message: 'Chi nhánh nguồn chưa có lịch chiếu', statusCode: 400 };
  }

  const now = formatDateForDb(new Date()) as string;
  await db.delete(tables.showtimes).where(eq(tables.showtimes.branch_id, toBranchId));

  for (const slot of source) {
    await db.insert(tables.showtimes).values({
      branch_id: toBranchId,
      movie_id: slot.movie_id,
      start_time: slot.start_time,
      end_time: slot.end_time,
      created_at: now,
      updated_at: now
    });
  }

  if (staffInfo) {
    await logAuditAction(
      db,
      tables.auditLogs,
      'copy',
      'showtimes',
      toBranchId,
      `Sao chép ${source.length} suất từ chi nhánh #${fromBranchId} sang #${toBranchId}`,
      staffInfo.id,
      staffInfo.email,
      staffInfo.fullname
    );
  }

  return { status: 'success', copied: source.length };
}
