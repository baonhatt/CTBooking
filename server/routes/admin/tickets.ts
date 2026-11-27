import { eq, or, desc, asc, count, inArray, and, sql, isNull, isNotNull, like } from 'drizzle-orm';
import { formatDateForDb } from '../../lib/date-utils';

import { logAuditAction } from '../../lib/audit-logger';
import { buildAuditPayload } from '../../lib/audit-utils';
import {
  assertBranchesExist,
  assertMoviesExist,
  assertStaffMayAssign,
  branchScopeLabel,
  branchScopeStatements,
  packageMoviesStatements,
  readBranchScope,
  readPackageMoviesChange,
  readPackageMoviesInput,
  readScopeChange,
  readScopeInput,
  runBatch,
  sqlInStaffBranches,
  sqlServesBranch,
  staffMayModify,
  withBranchScope,
  withPackageMovies,
  type BranchScope,
  type PackageMovies
} from '../../lib/catalog-scope';

/** Features stored as JSON text, as a list. */
function parseFeatures(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Package rows as the admin screens read them: features as a list, branches, movie scope and selected movies. */
export async function packagesForAdmin(anyDb: any, rows: any[]) {
  const scoped = await withBranchScope(anyDb, 'package', rows);
  const withMovies = await withPackageMovies(anyDb, scoped);
  return withMovies.map((row: any) => ({ ...row, features: parseFeatures(row.features) }));
}

/** The record as written to the audit log: the row plus its branches and movies. */
function packageAuditRecord(row: any, scope: BranchScope | null, movies: PackageMovies | null) {
  return { ...row, ...(scope || {}), ...(movies || {}) };
}

/**
 * Lấy danh sách các gói vé có phân trang và tìm kiếm
 * @param anyDb Kết nối database
 * @param tables Danh sách các bảng cần sử dụng
 * @param args Tham số phân trang và tìm kiếm
 * @returns Danh sách gói vé kèm thông tin phân trang
 */
export async function listTicketPackagesImpl(
  anyDb: any,
  tables: { ticket_packages: any; movies: any; branches?: any },
  args: {
    page: number;
    pageSize: number;
    q: string;
    includeInactive?: boolean;
    branch_id?: number;
    restrictToBranchIds?: number[] | null;
    type?: 'all' | 'movie' | 'vr';
    sort?: string;
    dir?: string;
  }
) {
  const { page, pageSize, q, includeInactive = false, branch_id, restrictToBranchIds = null, type = 'all', sort, dir } = args;

  // 1. Xây dựng điều kiện where
  let whereCondition = includeInactive
    ? isNull(tables.ticket_packages.deleted_at)
    : and(eq(tables.ticket_packages.is_active, true), isNull(tables.ticket_packages.deleted_at));

  // Type filter
  if (type === 'movie') {
    const movieCond = sql`(${tables.ticket_packages.type} IS NULL OR ${tables.ticket_packages.type} != 'vr')`;
    whereCondition = whereCondition ? and(whereCondition, movieCond) : movieCond;
  } else if (type === 'vr') {
    const vrCond = eq(tables.ticket_packages.type, 'vr');
    whereCondition = whereCondition ? and(whereCondition, vrCond) : vrCond;
  }

  if (q) {
    const lowerSearch = q.toLowerCase();
    const searchCondition = or(
      sql`LOWER(${tables.ticket_packages.name}) LIKE ${`%${lowerSearch}%`}`,
      sql`LOWER(${tables.ticket_packages.description}) LIKE ${`%${lowerSearch}%`}`,
      sql`LOWER(${tables.ticket_packages.type}) LIKE ${`%${lowerSearch}%`}`
    );

    whereCondition = whereCondition ? and(whereCondition, searchCondition) : searchCondition;
  }
  if (branch_id) {
    const branchFilter = sqlServesBranch('package', branch_id);
    whereCondition = whereCondition ? and(whereCondition, branchFilter) : branchFilter;
  }
  if (restrictToBranchIds) {
    const staffFilter = sqlInStaffBranches('package', restrictToBranchIds);
    whereCondition = whereCondition ? and(whereCondition, staffFilter) : staffFilter;
  }
  // Determine order by
  let orderByClause = [asc(tables.ticket_packages.display_order), desc(tables.ticket_packages.id)];
  if (sort) {
    const directionFn = dir === 'asc' ? asc : desc;
    switch (sort) {
      case 'updated_at':
        orderByClause = [directionFn(tables.ticket_packages.updated_at), desc(tables.ticket_packages.id)];
        break;
      case 'price':
        orderByClause = [directionFn(sql`CAST(${tables.ticket_packages.price} AS DECIMAL)`), desc(tables.ticket_packages.id)];
        break;
      case 'name':
        orderByClause = [directionFn(tables.ticket_packages.name), desc(tables.ticket_packages.id)];
        break;
      case 'display_order':
        orderByClause = [directionFn(tables.ticket_packages.display_order), desc(tables.ticket_packages.id)];
        break;
      case 'type':
        orderByClause = [
          directionFn(sql`CASE WHEN ${tables.ticket_packages.type} = 'vr' THEN 1 ELSE 0 END`),
          desc(tables.ticket_packages.id)
        ];
        break;
    }
  }

  // 2. Lấy dữ liệu phân trang - tạm thời bỏ join branches
  const [totalResArray, pkgList] = await Promise.all([
    anyDb.select({ count: count() }).from(tables.ticket_packages).where(whereCondition),
    anyDb
      .select()
      .from(tables.ticket_packages)
      .where(whereCondition)
      .orderBy(...orderByClause)
      .limit(pageSize)
      .offset((page - 1) * pageSize)
  ]);
  const totalResult = totalResArray[0];
  const packages = pkgList;

  const total = totalResult ? Number(totalResult.count) : 0;

  // 3. Branches, movies and features of each package
  const items = await packagesForAdmin(anyDb, packages);

  // 4. Trả về kết quả phân trang
  return {
    items,
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize)
  };
}

/**
 * Lấy thông tin chi tiết một gói vé theo ID
 * @param anyDb Kết nối database
 * @param tables Danh sách các bảng cần sử dụng
 * @param id ID của gói vé cần lấy
 * @returns Thông tin chi tiết gói vé hoặc null nếu không tìm thấy
 */
export async function getTicketPackageImpl(
  anyDb: any,
  tables: { ticket_packages: any; auditLogs: any; branches?: any; movies?: any; bookings?: any },
  id: number,
  restrictToBranchIds: number[] | null = null
) {
  const whereClause =
    restrictToBranchIds
      ? and(
          eq(tables.ticket_packages.id, id),
          sqlInStaffBranches('package', restrictToBranchIds)
        )
      : eq(tables.ticket_packages.id, id);
  const [item] = await anyDb.select().from(tables.ticket_packages).where(whereClause).limit(1);
  if (!item) return null;

  // Get tracking data from audit logs
  const [createLog] = await anyDb
    .select()
    .from(tables.auditLogs)
    .where(
      and(
        eq(tables.auditLogs.entityType, 'ticket_package'),
        eq(tables.auditLogs.entityId, String(id)),
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
        eq(tables.auditLogs.entityType, 'ticket_package'),
        eq(tables.auditLogs.entityId, String(id)),
        eq(tables.auditLogs.action, 'update')
      )
    )
    .orderBy(desc(tables.auditLogs.createdAt))
    .limit(1);

  const [adminItem] = await packagesForAdmin(anyDb, [item]);

  // Titles of the selected movies, so the admin detail shows names instead of ids. Deleted or hidden movies are still
  // named: the package keeps them until an admin changes its movies.
  let selectedMovies: Array<{ id: number; title: string }> = [];
  if (tables.movies && adminItem.movie_ids.length > 0) {
    const movieRows = await anyDb
      .select({ id: tables.movies.id, title: tables.movies.title })
      .from(tables.movies)
      .where(inArray(tables.movies.id, adminItem.movie_ids));
    const titleById = new Map<number, string>(movieRows.map((row: any) => [Number(row.id), String(row.title)]));
    selectedMovies = adminItem.movie_ids
      .filter((movieId: number) => titleById.has(movieId))
      .map((movieId: number) => ({ id: movieId, title: titleById.get(movieId) as string }));
  }

  // How many orders use this package (a package with orders cannot be deleted; the delete dialog shows this first)
  let bookingCount = 0;
  if (tables.bookings) {
    const [usage] = await anyDb
      .select({ count: count() })
      .from(tables.bookings)
      .where(eq(tables.bookings.ticket_package_id, id));
    bookingCount = Number(usage?.count || 0);
  }

  return {
    ...adminItem,
    booking_count: bookingCount,
    created_by_staff_name: createLog?.staffFullname || null,
    updated_by_staff_name: updateLog?.staffFullname || null,
    movies: selectedMovies
  };
}

/**
 * Tạo mới một gói vé
 * @param anyDb Kết nối database
 * @param tables Danh sách các bảng cần sử dụng
 * @param args Thông tin gói vé cần tạo
 * @returns Thông tin gói vé vừa tạo
 */
export async function createTicketPackageImpl(
  anyDb: any,
  tables: { ticket_packages: any; movies: any; auditLogs: any },
  args: {
    name: string;
    code?: string;
    description?: string;
    price: number;
    features?: any;
    type?: string;
    min_group_size?: number;
    max_group_size?: number;
    is_member_only?: boolean;
    is_active?: boolean;
    display_order?: number;
    all_branches?: boolean;
    branch_ids?: number[];
    movie_scope?: string;
    movie_ids?: number[];
    // ===== VR-specific fields =====
    cover_image?: string;
    duration_min?: number;
    vr_genre?: string;
    min_players?: number;
    max_players?: number;
  },
  RUN_ENV: any,
  staffInfo?: { id: number; email: string; fullname: string },
  restrictToBranchIds: number[] | null = null
) {
  const { name, code, description, price, features, type, min_group_size, max_group_size, is_member_only } = args;
  const { is_active, display_order, cover_image, duration_min, vr_genre, min_players, max_players } = args;

  // Where it is sold: the form must say so (every branch, or a list that may be empty); a missing choice is refused
  const scope: BranchScope = readScopeInput(args);
  assertStaffMayAssign(scope, restrictToBranchIds, 'gói vé');
  await assertBranchesExist(anyDb, scope.branch_ids);

  // Its movies (none for VR): the form must say so (every movie of the branch, or a list)
  const isVr = type === 'vr';
  const movies: PackageMovies = isVr ? { movie_scope: 'selected', movie_ids: [] } : readPackageMoviesInput(args);
  await assertMoviesExist(anyDb, movies.movie_ids);

  const formattedNow = formatDateForDb(new Date());
  let processedFeatures: string[] | undefined = undefined;
  if (features) {
    processedFeatures = Array.isArray(features)
      ? features
      : String(features)
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean);
  }

  const inserted = await anyDb
    .insert(tables.ticket_packages)
    .values({
      name,
      code,
      description,
      price: Number(price).toString(),
      features: processedFeatures ? JSON.stringify(processedFeatures) : null,
      type,
      min_group_size: min_group_size !== undefined ? Number(min_group_size) : null,
      max_group_size: max_group_size !== undefined ? Number(max_group_size) : null,
      is_member_only: Boolean(is_member_only),
      is_active: is_active ?? true,
      display_order: Number(display_order ?? 0),
      all_branches: scope.all_branches,
      movie_scope: movies.movie_scope,
      cover_image: cover_image || null,
      duration_min: duration_min !== undefined ? Number(duration_min) : null,
      vr_genre: vr_genre || null,
      min_players: min_players !== undefined ? Number(min_players) : null,
      max_players: max_players !== undefined ? Number(max_players) : null,
      created_at: formattedNow,
      updated_at: formattedNow
    })
    .returning();
  const item = Array.isArray(inserted) ? inserted[0] : inserted;
  if (!item) throw new Error('Không thể tạo gói vé');

  // Branch links and movies in one batch (a failure leaves the package sold nowhere, never at a wrong branch)
  await runBatch(anyDb, [
    ...(await branchScopeStatements(anyDb, 'package', item.id, scope)),
    ...(await packageMoviesStatements(anyDb, item.id, movies))
  ]);

  if (staffInfo) {
    await logAuditAction(
      anyDb,
      tables.auditLogs,
      'create',
      'ticket_package',
      item.id,
      `Tạo gói vé: ${name}`,
      staffInfo.id,
      staffInfo.email,
      staffInfo.fullname,
      undefined,
      buildAuditPayload(packageAuditRecord(item, scope, movies))
    );
  }

  const [adminItem] = await packagesForAdmin(anyDb, [{ ...item, all_branches: scope.all_branches }]);
  return { item: adminItem };
}

/**
 * Cập nhật thông tin gói vé
 * @param anyDb Kết nối database
 * @param tables Danh sách các bảng cần sử dụng
 * @param id ID của gói vé cần cập nhật
 * @param args Thông tin cập nhật
 * @returns Thông tin gói vé đã được cập nhật
 */
export async function updateTicketPackageImpl(
  anyDb: any,
  tables: { ticket_packages: any; movies: any; auditLogs: any },
  id: number,
  args: {
    name?: string;
    code?: string;
    description?: string;
    price?: number;
    features?: any;
    type?: string;
    min_group_size?: number;
    max_group_size?: number;
    is_member_only?: boolean;
    is_active?: boolean;
    display_order?: number;
    all_branches?: boolean;
    branch_ids?: number[];
    movie_scope?: string;
    movie_ids?: number[];
    // ===== VR-specific fields =====
    cover_image?: string;
    duration_min?: number;
    vr_genre?: string;
    min_players?: number;
    max_players?: number;
  },
  RUN_ENV: any,
  staffInfo?: { id: number; email: string; fullname: string },
  restrictToBranchIds: number[] | null = null
) {
  const existing = await anyDb.query.ticket_packages.findFirst({ where: eq(tables.ticket_packages.id, id) });
  if (!existing) {
    throw new Error('Không tìm thấy gói vé');
  }
  const [existingAdmin] = await packagesForAdmin(anyDb, [existing]);
  const oldScope: BranchScope = { all_branches: existingAdmin.all_branches, branch_ids: existingAdmin.branch_ids };
  const oldMovies: PackageMovies = { movie_scope: existingAdmin.movie_scope, movie_ids: existingAdmin.movie_ids };

  if (!staffMayModify(oldScope, restrictToBranchIds)) {
    const err: any = new Error('Bạn không có quyền sửa gói vé này (thuộc chi nhánh khác hoặc tất cả chi nhánh)');
    err.statusCode = 403;
    throw err;
  }

  const { name, code, description, price, features, type, min_group_size, max_group_size, is_member_only } = args;
  const { is_active, display_order, cover_image, duration_min, vr_genre, min_players, max_players } = args;

  // Loại gói (vé phim / VR) không được đổi sau khi tạo; gửi lại đúng loại cũ thì chấp nhận
  if (type !== undefined && type !== null && type !== '') {
    const existingType = existing.type === 'vr' ? 'vr' : 'movie';
    const requestedType = type === 'vr' ? 'vr' : 'movie';
    if (requestedType !== existingType) {
      const err: any = new Error('Không thể đổi loại gói vé sau khi tạo');
      err.statusCode = 400;
      throw err;
    }
  }

  // Sent fields change the branches / movies; fields not sent leave them as they are
  const newScope = readScopeChange(args);
  if (newScope) {
    assertStaffMayAssign(newScope, restrictToBranchIds, 'gói vé');
    await assertBranchesExist(anyDb, newScope.branch_ids);
  }
  const newMovies = existing.type === 'vr' ? undefined : readPackageMoviesChange(args);
  if (newMovies) await assertMoviesExist(anyDb, newMovies.movie_ids);

  const formattedNow = formatDateForDb(new Date());
  const data: any = { updated_at: formattedNow };
  if (name !== undefined) data.name = name;
  if (code !== undefined) data.code = code;
  if (description !== undefined) data.description = description;
  // type is intentionally never written on update (see check above)
  if (price !== undefined) data.price = Number(price).toString();
  if (min_group_size !== undefined) data.min_group_size = Number(min_group_size);
  if (max_group_size !== undefined) data.max_group_size = Number(max_group_size);
  if (is_member_only !== undefined) data.is_member_only = Boolean(is_member_only);
  if (is_active !== undefined) data.is_active = Boolean(is_active);
  if (display_order !== undefined) data.display_order = Number(display_order);
  // ===== VR-specific fields =====
  if (cover_image !== undefined) data.cover_image = cover_image || null;
  if (duration_min !== undefined) data.duration_min = duration_min !== null ? Number(duration_min) : null;
  if (vr_genre !== undefined) data.vr_genre = vr_genre || null;
  if (min_players !== undefined) data.min_players = min_players !== null ? Number(min_players) : null;
  if (max_players !== undefined) data.max_players = max_players !== null ? Number(max_players) : null;
  if (features !== undefined) {
    const featuresArr = Array.isArray(features)
      ? features
      : String(features)
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean);
    data.features = featuresArr.length > 0 ? JSON.stringify(featuresArr) : null;
  }

  // The row, its branches and its movies change together
  await runBatch(anyDb, [
    anyDb.update(tables.ticket_packages).set(data).where(eq(tables.ticket_packages.id, id)),
    ...(newScope ? await branchScopeStatements(anyDb, 'package', id, newScope) : []),
    ...(newMovies ? await packageMoviesStatements(anyDb, id, newMovies) : [])
  ]);

  const item = await anyDb.query.ticket_packages.findFirst({ where: eq(tables.ticket_packages.id, id) });
  if (!item) return null;
  const [adminItem] = await packagesForAdmin(anyDb, [item]);

  if (staffInfo) {
    await logAuditAction(
      anyDb,
      tables.auditLogs,
      'update',
      'ticket_package',
      id,
      `Cập nhật gói vé: ${name || existing.name || id}`,
      staffInfo.id,
      staffInfo.email,
      staffInfo.fullname,
      buildAuditPayload(packageAuditRecord(existing, oldScope, oldMovies)),
      buildAuditPayload(
        packageAuditRecord(
          item,
          { all_branches: adminItem.all_branches, branch_ids: adminItem.branch_ids },
          { movie_scope: adminItem.movie_scope, movie_ids: adminItem.movie_ids }
        )
      )
    );
  }

  return adminItem;
}

/**
 * Xóa gói vé (soft delete hoặc hard delete)
 * @param anyDb Kết nối database
 * @param tables Danh sách các bảng cần sử dụng
 * @param id ID của gói vé cần xóa
 * @returns Kết quả thực hiện xóa
 */
export async function deleteTicketPackageImpl(
  anyDb: any,
  tables: { ticket_packages: any; bookings: any; auditLogs: any },
  id: number,
  RUN_ENV: any,
  staffInfo?: { id: number; email: string; fullname: string },
  restrictToBranchIds: number[] | null = null
) {
  try {
    // 1. Kiểm tra gói vé có tồn tại không
    const existing = await anyDb.query.ticket_packages.findFirst({
      where: eq(tables.ticket_packages.id, id)
    });

    // Nếu không tìm thấy gói vé, trả về null
    if (!existing) return null;

    if (!staffMayModify(await readBranchScope(anyDb, 'package', id), restrictToBranchIds)) {
      const err: any = new Error('Bạn không có quyền xóa gói vé này (thuộc chi nhánh khác hoặc tất cả chi nhánh)');
      err.statusCode = 403;
      throw err;
    }

    // 2. Check if ticket package is being used in bookings
    const [bookingCount] = await anyDb
      .select({ count: count() })
      .from(tables.bookings)
      .where(eq(tables.bookings.ticket_package_id, id));

    if (bookingCount?.count > 0) {
      const err: any = new Error(`Không thể xóa gói vé vì có ${bookingCount.count} booking đang sử dụng`);
      err.statusCode = 400;
      throw err;
    }

    // 3. Thực hiện soft delete (update is_active = false và deleted_at)
    await anyDb
      .update(tables.ticket_packages)
      .set({
        is_active: false,
        deleted_at: new Date().toISOString(),
        deleted_by_staff_id: staffInfo?.id,
        updated_at: formatDateForDb(new Date())
      })
      .where(eq(tables.ticket_packages.id, id));



    // Log audit action
    if (staffInfo) {
      await logAuditAction(
        anyDb,
        tables.auditLogs,
        'delete',
        'ticket_package',
        id,
        `Xóa gói vé: ${existing.name}`,
        staffInfo.id,
        staffInfo.email,
        staffInfo.fullname
      );
    }

    return {
      status: 200,
      message: 'Gói vé đã được chuyển sang trạng thái Ngừng hoạt động thành công'
    };
  } catch (err: any) {
    // Bắt và ném lại lỗi nếu có
    throw err;
  }
}

export async function restoreTicketPackageImpl(
  anyDb: any,
  tables: { ticket_packages: any; auditLogs: any },
  id: number,
  staffInfo?: { id: number; email: string; fullname: string },
  restrictToBranchIds: number[] | null = null
) {
  try {
    const existing = await anyDb.query.ticket_packages.findFirst({
      where: eq(tables.ticket_packages.id, id)
    });

    if (!existing) {
      const err: any = new Error('Ticket package not found');
      err.statusCode = 404;
      throw err;
    }

    if (!staffMayModify(await readBranchScope(anyDb, 'package', id), restrictToBranchIds)) {
      const err: any = new Error('Bạn không có quyền khôi phục gói vé này');
      err.statusCode = 403;
      throw err;
    }

    // Restore by setting is_active = true and deleted_at = null
    await anyDb
      .update(tables.ticket_packages)
      .set({
        is_active: true,
        deleted_at: null,
        updated_at: formatDateForDb(new Date())
      })
      .where(eq(tables.ticket_packages.id, id));

    const auditOld = buildAuditPayload(existing);
    const auditNew = buildAuditPayload({ ...existing, is_active: true, deleted_at: null });

    // Log audit action
    if (staffInfo) {
      await logAuditAction(
        anyDb,
        tables.auditLogs,
        'restore',
        'ticket_package',
        id,
        `Restore gói vé: ${existing.name}`,
        staffInfo.id,
        staffInfo.email,
        staffInfo.fullname,
        auditOld,
        auditNew
      );
    }

    return { ok: true };
  } catch (err: any) {
    throw err;
  }
}

export async function listDeletedTicketPackagesImpl(
  anyDb: any,
  tables: { ticket_packages: any; staffs: any; branches?: any },
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
  const { ticket_packages, staffs } = tables;
  const { page = 1, pageSize = 10, search = '', sort, dir, branch_id, restrictToBranchIds = null } = options;

  const conditions = [];
  if (search) {
    conditions.push(like(ticket_packages.name, `%${search}%`));
  }
  if (branch_id) {
    conditions.push(sqlServesBranch('package', branch_id));
  }
  if (restrictToBranchIds) {
    conditions.push(sqlInStaffBranches('package', restrictToBranchIds));
  }
  conditions.push(isNotNull(ticket_packages.deleted_at));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Only the columns the deleted-packages screen shows (branch ids are turned into names below)
  const items = await anyDb
    .select({
      id: ticket_packages.id,
      name: ticket_packages.name,
      code: ticket_packages.code,
      price: ticket_packages.price,
      type: ticket_packages.type,
      is_member_only: ticket_packages.is_member_only,
      all_branches: ticket_packages.all_branches,
      deleted_at: ticket_packages.deleted_at,
      deleted_by_staff_name: staffs.fullname
    })
    .from(ticket_packages)
    .leftJoin(staffs, eq(ticket_packages.deleted_by_staff_id, staffs.id))
    .where(whereClause)
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .orderBy(
      sort === 'name'
        ? dir === 'asc' ? asc(ticket_packages.name) : desc(ticket_packages.name)
        : dir === 'asc' ? asc(ticket_packages.deleted_at) : desc(ticket_packages.deleted_at)
    );

  const [countResult] = await anyDb.select({ count: count() }).from(ticket_packages).where(whereClause);

  const namesById = new Map<number, string>();
  if (tables.branches) {
    const branchRows = await anyDb.select({ id: tables.branches.id, name: tables.branches.name }).from(tables.branches);
    for (const branch of branchRows) namesById.set(Number(branch.id), branch.name);
  }

  return {
    status: 'success',
    items: (await withBranchScope(anyDb, 'package', items)).map(({ all_branches, branch_ids, ...item }: any) => ({
      ...item,
      branch_name: branchScopeLabel({ all_branches, branch_ids }, namesById)
    })),
    total: countResult?.count || 0,
    page,
    pageSize
  };
}

export async function toggleTicketStatusImpl(
  anyDb: any,
  tables: { ticket_packages: any; auditLogs: any },
  id: number,
  RUN_ENV: any,
  staffInfo?: { id: number; email: string; fullname: string },
  restrictToBranchIds: number[] | null = null
) {
  const existing = await anyDb.query.ticket_packages.findFirst({
    where: eq(tables.ticket_packages.id, id)
  });

  if (!existing) {
    const err: any = new Error('Gói vé không tồn tại');
    err.statusCode = 404;
    throw err;
  }

  if (!staffMayModify(await readBranchScope(anyDb, 'package', id), restrictToBranchIds)) {
    const err: any = new Error('Bạn không có quyền thay đổi trạng thái gói vé này');
    err.statusCode = 403;
    throw err;
  }

  const newStatus = !existing.is_active;

  await anyDb
    .update(tables.ticket_packages)
    .set({
      is_active: newStatus,
      updated_at: formatDateForDb(new Date())
    })
    .where(eq(tables.ticket_packages.id, id));



  const auditOld = buildAuditPayload(existing);
  const auditNew = buildAuditPayload({ ...existing, is_active: newStatus });

  if (staffInfo) {
    await logAuditAction(
      anyDb,
      tables.auditLogs,
      'update',
      'ticket_package',
      id,
      `${newStatus ? 'Kích hoạt' : 'Ẩn'} gói vé: ${existing.name}`,
      staffInfo.id,
      staffInfo.email,
      staffInfo.fullname,
      auditOld,
      auditNew
    );
  }

  return { ok: true, is_active: newStatus };
}
