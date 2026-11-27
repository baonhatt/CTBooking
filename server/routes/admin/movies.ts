import { eq, desc, asc, and, inArray, sql, or, isNull, isNotNull, like, count } from 'drizzle-orm';
import { formatDateForDb } from '../../lib/date-utils';
import { logAuditAction } from '../../lib/audit-logger';
import { buildAuditPayload } from '../../lib/audit-utils';
import * as schema from '../../../shared/schema';
import {
  assertBranchesExist,
  assertStaffMayAssign,
  branchScopeStatements,
  packagesSelectingMovie,
  readBranchScope,
  readScopeChange,
  readScopeInput,
  runBatch,
  sqlInStaffBranches,
  sqlServesBranch,
  staffMayModify,
  withBranchScope,
  withPackageMovies,
  type BranchScope
} from '../../lib/catalog-scope';

/** Error with an HTTP status. */
function statusError(status: number, message: string) {
  const err: any = new Error(message);
  err.statusCode = status;
  return err;
}

/** Refuses to hide or delete a movie that an active package lists among its selected movies. */
async function assertNoPackageSelects(anyDb: any, movieId: number, message: string) {
  const packages = await packagesSelectingMovie(anyDb, movieId);
  if (packages.length > 0) throw statusError(400, `${message}: ${packages.map((p: any) => p.name).join(', ')}`);
}

/**
 * Refuses to take a movie away from a branch that still has showtimes of it: a showtime is only valid for a movie
 * shown at its branch. The admin first removes those showtimes.
 */
async function assertNoShowtimesLeft(anyDb: any, movieId: number, oldScope: BranchScope, newScope: BranchScope) {
  if (newScope.all_branches) return;
  const showtimes = schema.showtimes;
  const rows = await anyDb
    .select({ branch_id: showtimes.branch_id, branch_name: schema.branches.name, count: sql<number>`COUNT(*)` })
    .from(showtimes)
    .leftJoin(schema.branches, eq(schema.branches.id, showtimes.branch_id))
    .where(eq(showtimes.movie_id, movieId))
    .groupBy(showtimes.branch_id, schema.branches.name);
  const left = rows.filter((row: any) => !newScope.branch_ids.includes(Number(row.branch_id)));
  if (left.length > 0) {
    const where = left.map((row: any) => `${row.branch_name || 'chi nhánh #' + row.branch_id} (${row.count} suất)`).join(', ');
    throw statusError(400, `Phim còn suất chiếu ở ${where}. Xóa các suất chiếu đó trước khi bỏ chi nhánh khỏi phim.`);
  }
}

/** The record as written to the audit log: the row plus its branches. */
function movieAuditRecord(row: any, scope: BranchScope | null) {
  return { ...row, ...(scope || {}) };
}

export async function createMovieImpl(
  anyDb: any,
  tables: { movies: any; auditLogs: any },
  data: {
    title: string;
    description?: string;
    cover_image?: string | null;
    cover_image_base64?: string | null;
    detail_images?: any;
    genres?: any;
    rating?: string | null;
    duration_min: number;
    is_active?: boolean;
    release_date: string | Date | null;
    all_branches?: boolean;
    branch_ids?: number[];
  },
  config?: any,
  RUN_ENV?: any,
  uploader?: (base64: string, folder: string) => Promise<{ url: string }>,
  staffInfo?: { id: number; email: string; fullname: string },
  restrictToBranchIds: number[] | null = null
) {
  if (config) {
    process.env = config;
  }
  const now = new Date();
  let coverImageUrl = data.cover_image || null;
  if (data.cover_image_base64 && uploader) {
    try {
      const uploadResult = await uploader(data.cover_image_base64, 'ctbooking/images/movies');
      coverImageUrl = uploadResult.url;
    } catch (error) {
      console.error('Lỗi khi upload ảnh:', error);
      throw error; // Throw lỗi khi upload ảnh
    }
  }

  // Where it is shown: the form must say so (every branch, or a list that may be empty); a missing choice is refused
  const scope: BranchScope = readScopeInput(data);
  assertStaffMayAssign(scope, restrictToBranchIds, 'phim');
  await assertBranchesExist(anyDb, scope.branch_ids);

  const baseData: any = {
    title: data.title,
    description: data.description,
    cover_image: coverImageUrl,
    // TẠM BỎ QUA NHIỀU ẢNH (20261110): hiện mỗi phim chỉ dùng 1 poster (cover_image). Ảnh chi tiết (detail_images) chưa dùng: website khách không hiển thị và form sửa chưa có chỗ thêm/xóa ảnh này. Khi cần thư viện ảnh phim: thêm upload nhiều ảnh vào form sửa (MovieEditModal), hiển thị ở website khách, rồi bỏ ghi chú này.
    detail_images: Array.isArray(data.detail_images) ? JSON.stringify(data.detail_images) : data.detail_images,
    genres: Array.isArray(data.genres) ? JSON.stringify(data.genres) : data.genres,
    rating: data.rating ?? null,
    duration_min: data.duration_min,
    all_branches: scope.all_branches,
    is_active: data.is_active === undefined ? true : Boolean(data.is_active),
    release_date: data.release_date ? formatDateForDb(data.release_date) : null,
    created_at: formatDateForDb(now),
    updated_at: formatDateForDb(now)
  };
  try {
    const movieInsert = await anyDb.insert(tables.movies).values(baseData).returning();
    let movie: any = Array.isArray(movieInsert) ? movieInsert[0] : movieInsert;
    if (!movie) throw new Error('Không thể tạo phim');
    await runBatch(anyDb, await branchScopeStatements(anyDb, 'movie', movie.id, scope));

    const auditNew = buildAuditPayload(movieAuditRecord(movie, scope));

    // Log audit action
    if (staffInfo) {
      await logAuditAction(
        anyDb,
        tables.auditLogs,
        'create',
        'movie',
        movie.id,
        `Tạo phim: ${data.title}`,
        staffInfo.id,
        staffInfo.email,
        staffInfo.fullname,
        undefined,
        auditNew
      );
    }

    const [scopedMovie] = await withBranchScope(anyDb, 'movie', [{ ...movie, all_branches: scope.all_branches }]);
    return { movie: scopedMovie };
  } catch (err: any) {
    throw err;
  }
}

export async function updateMovieImpl(
  anyDb: any,
  tables: { movies: any; ticket_packages: any; auditLogs: any },
  id: number,
  data: {
    title?: string;
    description?: string;
    cover_image?: string | null;
    cover_image_base64?: string; // Thêm trường này
    detail_images?: any;
    genres?: any;
    rating?: string | null;
    duration_min?: number;
    is_active?: boolean;
    release_date?: string | Date | null;
    all_branches?: boolean;
    branch_ids?: number[];
  },
  config?: any,
  RUN_ENV?: any,
  uploader?: (base64: string, folder: string) => Promise<{ url: string }>,
  deleter?: (url: string) => Promise<void>,
  staffInfo?: { id: number; email: string; fullname: string },
  restrictToBranchIds: number[] | null = null
) {
  if (config) {
    process.env = config;
  }
  const now = new Date();
  // Fetch old movie to check for image changes
  const oldMovie = await anyDb.query.movies.findFirst({
    where: eq(tables.movies.id, id)
  });
  const oldScope = oldMovie ? await readBranchScope(anyDb, 'movie', id) : null;
  if (oldMovie && !staffMayModify(oldScope, restrictToBranchIds)) {
    const err: any = new Error('Bạn không có quyền sửa phim này (phim thuộc chi nhánh khác hoặc áp dụng cho tất cả chi nhánh)');
    err.statusCode = 403;
    throw err;
  }
  const payload: any = { updated_at: formatDateForDb(now) };
  // Xử lý upload ảnh nếu có base64
  if (data.cover_image_base64 && uploader) {
    try {
      const uploadResult = await uploader(data.cover_image_base64, 'ctbooking/movies');
      payload.cover_image = uploadResult.url;
    } catch (error) {
      console.error('Lỗi khi upload ảnh:', error);
      // Có thể throw lỗi hoặc bỏ qua
    }
  } else if (data.cover_image !== undefined) {
    payload.cover_image = data.cover_image;
  }
  // Các trường khác
  if (data.title !== undefined) payload.title = data.title;
  if (data.description !== undefined) payload.description = data.description;
  if (data.detail_images !== undefined)
    payload.detail_images = Array.isArray(data.detail_images) ? JSON.stringify(data.detail_images) : data.detail_images;
  if (data.genres !== undefined)
    payload.genres = Array.isArray(data.genres) ? JSON.stringify(data.genres) : data.genres;
  if (data.rating !== undefined) payload.rating = data.rating ?? null;
  if (data.duration_min !== undefined) payload.duration_min = data.duration_min;
  // Sent fields change the branches; fields not sent leave them as they are
  const newScope = readScopeChange(data);
  if (newScope) {
    assertStaffMayAssign(newScope, restrictToBranchIds, 'phim');
    await assertBranchesExist(anyDb, newScope.branch_ids);
    if (oldScope) await assertNoShowtimesLeft(anyDb, id, oldScope, newScope);
  }
  if (data.is_active !== undefined) payload.is_active = data.is_active;
  if (data.release_date !== undefined) {
    payload.release_date = data.release_date ? formatDateForDb(data.release_date) : null;
  }
  if (data.is_active === false) {
    await assertNoPackageSelects(anyDb, id, 'Không thể ẩn phim vì phim đang được sử dụng trong các gói');
  }
  try {
    // The row and its branches change together
    await runBatch(anyDb, [
      anyDb.update(tables.movies).set(payload).where(eq(tables.movies.id, id)),
      ...(newScope ? await branchScopeStatements(anyDb, 'movie', id, newScope) : [])
    ]);
    const movie: any = await anyDb.query.movies.findFirst({ where: eq(tables.movies.id, id) });
    if (!movie) throw new Error('Không tìm thấy phim để cập nhật');
    const [scopedMovie] = await withBranchScope(anyDb, 'movie', [movie]);

    // Clean up old Cloudinary image if changed
    if (
      oldMovie &&
      payload.cover_image &&
      oldMovie.cover_image &&
      oldMovie.cover_image !== payload.cover_image &&
      deleter
    ) {
      deleter(oldMovie.cover_image).catch((e) => console.error('Failed to delete old movie image:', e));
    }

    const auditOld = buildAuditPayload(movieAuditRecord(oldMovie, oldScope));
    const auditNew = buildAuditPayload(scopedMovie);

    // Log audit action
    if (staffInfo) {
      await logAuditAction(
        anyDb,
        tables.auditLogs,
        'update',
        'movie',
        id,
        `Cập nhật phim: ${oldMovie?.title || id}`,
        staffInfo.id,
        staffInfo.email,
        staffInfo.fullname,
        auditOld,
        auditNew
      );
    }

    return { movie: scopedMovie };
  } catch (err: any) {
    throw err;
  }
}

export async function deleteMovieImpl(
  anyDb: any,
  tables: { movies: any; auditLogs: any; ticket_packages: any },
  id: number,
  RUN_ENV: any,
  deleter?: (url: string) => Promise<void>,
  staffInfo?: { id: number; email: string; fullname: string },
  restrictToBranchIds: number[] | null = null
) {
  // Check if movie exists before deleting
  const existing = await anyDb.query.movies.findFirst({
    where: eq(tables.movies.id, id)
  });

  if (!existing) return null;
  if (!staffMayModify(await readBranchScope(anyDb, 'movie', id), restrictToBranchIds)) {
    const err: any = new Error('Bạn không có quyền xóa phim này (phim thuộc chi nhánh khác hoặc áp dụng cho tất cả chi nhánh)');
    err.statusCode = 403;
    throw err;
  }

  // A movie that an active package lists among its selected movies cannot be deleted
  await assertNoPackageSelects(anyDb, id, 'Không thể xóa phim vì đang được sử dụng trong gói vé');

  // Soft delete by setting is_active = false and deleted_at
  await anyDb
    .update(tables.movies)
    .set({ is_active: false, deleted_at: new Date().toISOString(), deleted_by_staff_id: staffInfo?.id })
    .where(eq(tables.movies.id, id));


  const auditOld = buildAuditPayload(existing);
  const auditNew = buildAuditPayload({
    ...existing,
    is_active: false,
    deleted_at: new Date().toISOString(),
    deleted_by_staff_id: staffInfo?.id
  });

  // Log audit action
  if (staffInfo) {
    await logAuditAction(
      anyDb,
      tables.auditLogs,
      'delete',
      'movie',
      id,
      `Xóa phim: ${existing.title}`,
      staffInfo.id,
      staffInfo.email,
      staffInfo.fullname,
      auditOld,
      auditNew
    );
  }

  return { ok: true };
}

export async function restoreMovieImpl(
  anyDb: any,
  tables: { movies: any; auditLogs: any },
  id: number,
  staffInfo?: { id: number; email: string; fullname: string },
  restrictToBranchIds: number[] | null = null
) {
  const existing = await anyDb.query.movies.findFirst({
    where: eq(tables.movies.id, id)
  });

  if (!existing) {
    const err: any = new Error('Movie not found');
    err.statusCode = 404;
    throw err;
  }

  if (!staffMayModify(await readBranchScope(anyDb, 'movie', id), restrictToBranchIds)) {
    const err: any = new Error('Bạn không có quyền khôi phục phim này (phim thuộc chi nhánh khác hoặc áp dụng cho tất cả chi nhánh)');
    err.statusCode = 403;
    throw err;
  }

  // Restore by setting is_active = true and deleted_at = null
  await anyDb.update(tables.movies).set({ is_active: true, deleted_at: null }).where(eq(tables.movies.id, id));

  const auditOldRestore = buildAuditPayload(existing);
  const auditNewRestore = buildAuditPayload({ ...existing, is_active: true, deleted_at: null });

  // Log audit action
  if (staffInfo) {
    await logAuditAction(
      anyDb,
      tables.auditLogs,
      'restore',
      'movie',
      id,
      `Restore phim: ${existing.title}`,
      staffInfo.id,
      staffInfo.email,
      staffInfo.fullname,
      auditOldRestore,
      auditNewRestore
    );
  }

  return { ok: true };
}

export async function listDeletedMoviesImpl(
  anyDb: any,
  tables: { movies: any; staffs: any },
  options: {
    page?: number;
    pageSize?: number;
    search?: string;
    sort?: string;
    dir?: string;
    branch_id?: number | null;
    restrictToBranchIds?: number[] | null;
  } = {}
) {
  const { movies, staffs } = tables;
  const { page = 1, pageSize = 10, search = '', sort, dir, branch_id, restrictToBranchIds = null } = options;

  const conditions = [];
  if (search) {
    conditions.push(like(movies.title, `%${search}%`));
  }
  if (branch_id) {
    conditions.push(sqlServesBranch('movie', branch_id));
  }
  if (restrictToBranchIds) {
    conditions.push(sqlInStaffBranches('movie', restrictToBranchIds));
  }
  conditions.push(isNotNull(movies.deleted_at));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Only the columns the deleted-movies screen shows
  const items = await anyDb
    .select({
      id: movies.id,
      title: movies.title,
      cover_image: movies.cover_image,
      genres: movies.genres,
      rating: movies.rating,
      duration_min: movies.duration_min,
      release_date: movies.release_date,
      deleted_at: movies.deleted_at,
      deleted_by_staff_name: staffs.fullname
    })
    .from(movies)
    .leftJoin(staffs, eq(movies.deleted_by_staff_id, staffs.id))
    .where(whereClause)
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .orderBy(
      sort === 'name'
        ? dir === 'asc' ? asc(movies.title) : desc(movies.title)
        : dir === 'asc' ? asc(movies.deleted_at) : desc(movies.deleted_at)
    );

  const [countResult] = await anyDb.select({ count: count() }).from(movies).where(whereClause);

  return {
    status: 'success',
    // The screen lists genres as tags, so they go out as an array, not the stored JSON text
    items: items.map((item: any) => ({ ...item, genres: parseGenres(item.genres) })),
    total: countResult?.count || 0,
    page,
    pageSize
  };
}

/** Genres as an array, whatever the stored form: JSON array text, an array, or blank. */
export function parseGenres(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export type AdminMovieListStatus = 'all' | 'active' | 'inactive';

/**
 * The admin movie list (Movies screen and the movie pickers of the showtime and ticket package forms).
 * Never returns deleted movies. Staff of some branches see the global movies and the movies of their branches.
 * Returns only the columns those screens read.
 */
export async function listAdminMoviesImpl(
  anyDb: any,
  tables: { movies: any },
  options: {
    page: number;
    pageSize: number;
    q?: string;
    sort?: string;
    dir?: 'asc' | 'desc';
    status?: AdminMovieListStatus;
    branch_id?: number | null;
    restrictToBranchIds?: number[] | null;
  }
) {
  const { movies } = tables;
  const { page, pageSize, q = '', sort = 'updated_at', dir = 'desc', status = 'all', branch_id = null } = options;
  const restrictToBranchIds = options.restrictToBranchIds ?? null;

  const conditions: any[] = [isNull(movies.deleted_at)];
  const searchText = q.trim().toLowerCase();
  if (searchText) {
    const term = `%${searchText}%`;
    conditions.push(or(sql`lower(${movies.title}) like ${term}`, sql`lower(${movies.description}) like ${term}`));
  }
  if (status === 'active') conditions.push(eq(movies.is_active, true));
  if (status === 'inactive') conditions.push(eq(movies.is_active, false));
  if (branch_id) conditions.push(sqlServesBranch('movie', branch_id));
  if (restrictToBranchIds) conditions.push(sqlInStaffBranches('movie', restrictToBranchIds));
  const whereClause = and(...conditions);

  const sortColumns: Record<string, any> = {
    release_date: movies.release_date,
    title: movies.title,
    rating: movies.rating,
    updated_at: movies.updated_at
  };
  const sortColumn = sortColumns[sort] || movies.updated_at;
  const order = dir === 'asc' ? asc(sortColumn) : desc(sortColumn);

  const rows = await anyDb
    .select({
      id: movies.id,
      title: movies.title,
      release_date: movies.release_date,
      duration_min: movies.duration_min,
      genres: movies.genres,
      cover_image: movies.cover_image,
      updated_at: movies.updated_at,
      rating: movies.rating,
      is_active: movies.is_active,
      all_branches: movies.all_branches
    })
    .from(movies)
    .where(whereClause)
    .orderBy(order, desc(movies.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [countResult] = await anyDb.select({ count: count() }).from(movies).where(whereClause);

  const items = (await withBranchScope(anyDb, 'movie', rows)).map((row: any) => ({ ...row, genres: parseGenres(row.genres) }));

  return { items, page, pageSize, total: Number(countResult?.count || 0) };
}

export async function updateMovieStatusImpl(
  anyDb: any,
  tables: { movies: any; ticket_packages: any; auditLogs: any },
  id: number,
  isActive: boolean,
  RUN_ENV?: any,
  restrictToBranchIds: number[] | null = null,
  staffInfo?: { id: number; email: string; fullname: string }
) {
  try {
    if (typeof isActive !== 'boolean') {
      throw new Error('isActive must be a boolean');
    }
    const existingMovie = await anyDb.query.movies.findFirst({
      where: eq(tables.movies.id, id)
    });
    if (!existingMovie) {
      throw new Error('Movie not found');
    }
    if (!staffMayModify(await readBranchScope(anyDb, 'movie', id), restrictToBranchIds)) {
      const err: any = new Error('Bạn không có quyền thay đổi trạng thái phim này (phim thuộc chi nhánh khác hoặc áp dụng cho tất cả chi nhánh)');
      err.statusCode = 403;
      throw err;
    }
    if (isActive === false) {
      const packages = await packagesSelectingMovie(anyDb, id);
      if (packages.length > 0) {
        return {
          status: 400,
          message: `Không thể ẩn phim vì phim đang được sử dụng trong các gói: ${packages.map((p: any) => p.name).join(', ')}`
        };
      }
    }
    const payload: any = {
      is_active: isActive,
      updated_at: formatDateForDb(new Date())
    };

    const result = await anyDb.update(tables.movies).set(payload).where(eq(tables.movies.id, id)).returning();

    const updatedMovie = Array.isArray(result) ? result[0] : result;

    if (!updatedMovie) {
      throw new Error('Movie not found');
    }

    // Log audit action
    if (staffInfo) {
      await logAuditAction(
        anyDb,
        tables.auditLogs,
        'update',
        'movie',
        id,
        `${isActive ? 'Kích hoạt' : 'Vô hiệu hóa'} phim: ${existingMovie.title}`,
        staffInfo.id,
        staffInfo.email,
        staffInfo.fullname
      );
    }

    return {
      status: 200,
      message: 'Đã thay đổi trạng thái thành công!',
      item: updatedMovie
    };
  } catch (error) {
    console.error('Error updating movie status:', error);
    throw error;
  }
}

export async function getMovieByIdImpl(
  anyDb: any,
  tables: { movies: any; bookings?: any; ticket_packages: any; auditLogs: any },
  movieId: number,
  restrictToBranchIds: number[] | null = null
) {
  // Helper to safely parse JSON strings from D1/SQLite
  const safeParseJson = (val: any) => {
    if (!val || val === 'null' || val === 'undefined') return [];
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        // Nếu không parse được JSON nhưng nãy đã check !val,
        // có thể val là string đơn thuần, convert sang array
        return val ? [val] : [];
      }
    }
    return Array.isArray(val) ? val : [];
  };

  const safeDate = (dateVal: any) => {
    if (!dateVal) return null;
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? null : d.toISOString();
  };

  const movieWhere =
    restrictToBranchIds
      ? and(eq(tables.movies.id, movieId), sqlInStaffBranches('movie', restrictToBranchIds))
      : eq(tables.movies.id, movieId);
  const movie = await anyDb.query.movies.findFirst({ where: movieWhere });
  if (!movie) return null;

  const [scopedMovie] = await withBranchScope(anyDb, 'movie', [movie]);

  // The packages a customer can buy for this movie: active packages that select it, and active packages of every
  // movie of the branch sold at one of the movie's branches
  const activePackages = await anyDb
    .select({
      id: tables.ticket_packages.id,
      name: tables.ticket_packages.name,
      code: tables.ticket_packages.code,
      price: tables.ticket_packages.price,
      all_branches: tables.ticket_packages.all_branches,
      movie_scope: tables.ticket_packages.movie_scope
    })
    .from(tables.ticket_packages)
    .where(
      restrictToBranchIds
        ? and(
            eq(tables.ticket_packages.is_active, true),
            isNull(tables.ticket_packages.deleted_at),
            sql`(${tables.ticket_packages.type} IS NULL OR ${tables.ticket_packages.type} != 'vr')`,
            sqlInStaffBranches('package', restrictToBranchIds)
          )
        : and(
            eq(tables.ticket_packages.is_active, true),
            isNull(tables.ticket_packages.deleted_at),
            sql`(${tables.ticket_packages.type} IS NULL OR ${tables.ticket_packages.type} != 'vr')`
          )
    );
  const packagesWithMovies = await withPackageMovies(anyDb, await withBranchScope(anyDb, 'package', activePackages));
  const sharesBranch = (pkg: BranchScope) =>
    scopedMovie.all_branches || pkg.all_branches || pkg.branch_ids.some((branchId) => scopedMovie.branch_ids.includes(branchId));
  const applicableRows = packagesWithMovies
    .filter((pkg: any) => (pkg.movie_scope === 'all_at_branch' ? sharesBranch(pkg) : pkg.movie_ids.includes(movieId)))
    .map((pkg: any) => ({
      id: pkg.id,
      name: pkg.name,
      code: pkg.code ?? null,
      price: pkg.price,
      all_branches: pkg.all_branches,
      branch_ids: pkg.branch_ids
    }));

  // Get tracking data from audit logs
  const [createLog] = await anyDb
    .select()
    .from(tables.auditLogs)
    .where(
      and(
        eq(tables.auditLogs.entityType, 'movie'),
        eq(tables.auditLogs.entityId, String(movieId)),
        eq(tables.auditLogs.action, 'create')
      )
    )
    .orderBy(tables.auditLogs.createdAt)
    .limit(1);

  const [updateLog] = await anyDb
    .select()
    .from(tables.auditLogs)
    .where(
      and(
        eq(tables.auditLogs.entityType, 'movie'),
        eq(tables.auditLogs.entityId, String(movieId)),
        eq(tables.auditLogs.action, 'update')
      )
    )
    .orderBy(desc(tables.auditLogs.createdAt))
    .limit(1);

  return {
    id: movie.id,
    title: movie.title,
    // Blank stays blank: the admin form loads this value for editing, so no made-up text or 0 here
    description: movie.description || '',
    cover_image: movie.cover_image,
    genres: safeParseJson(movie.genres),
    rating: movie.rating === null || movie.rating === undefined ? null : Number(movie.rating),
    duration_min: movie.duration_min ?? null,
    is_active: movie.is_active,
    release_date: safeDate(movie.release_date),
    created_at: safeDate(movie.created_at),
    updated_at: safeDate(movie.updated_at),
    deleted_at: safeDate(movie.deleted_at),
    created_by_staff_name: createLog?.staffFullname || null,
    updated_by_staff_name: updateLog?.staffFullname || null,
    applicable_packages: applicableRows,
    detail_images: safeParseJson(movie.detail_images),
    all_branches: scopedMovie.all_branches,
    branch_ids: scopedMovie.branch_ids
  };
}
