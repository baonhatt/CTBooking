import { eq, desc, asc, count, and, or, sql, isNull, isNotNull, like, gte, inArray } from 'drizzle-orm';
import { formatDateForDb } from '../../lib/date-utils';
import { logAuditAction } from '../../lib/audit-logger';
import { buildAuditPayload } from '../../lib/audit-utils';

export async function listBranchesImpl(
  anyDb: any,
  tables: { branches: any; movies: any; ticket_packages: any; bookings: any },
  args: {
    page: number;
    pageSize: number;
    q: string;
    includeInactive?: boolean;
    onlyOpen?: boolean;
    /** No longer used: the unused ticket codes are read on demand (listBranchUnusedCodesImpl). Kept so old callers compile. */
    codesForBranchIds?: number[] | null;
    /** The staff member's branches (null = Super Admin, every branch) */
    restrictToBranchIds?: number[] | null;
  }
) {
  const { page, pageSize, q, includeInactive = false, onlyOpen = false } = args;
  const restrictToBranchIds = args.restrictToBranchIds ?? null;

  let whereCondition = includeInactive
    ? isNull(tables.branches.deleted_at)
    : and(eq(tables.branches.is_active, true), isNull(tables.branches.deleted_at));

  // Staff of some branches see only their own branches
  if (restrictToBranchIds) {
    const scopeCondition = restrictToBranchIds.length ? inArray(tables.branches.id, restrictToBranchIds) : sql`1 = 0`;
    whereCondition = and(whereCondition, scopeCondition);
  }

  if (onlyOpen) {
    const openCondition = eq(tables.branches.is_open, true);
    whereCondition = whereCondition ? and(whereCondition, openCondition) : openCondition;
  }

  if (q) {
    const lowerSearch = q.toLowerCase();
    const searchCondition = or(
      sql`LOWER(${tables.branches.name}) LIKE ${`%${lowerSearch}%`}`,
      sql`LOWER(${tables.branches.code}) LIKE ${`%${lowerSearch}%`}`,
      sql`LOWER(${tables.branches.address}) LIKE ${`%${lowerSearch}%`}`
    );
    whereCondition = whereCondition ? and(whereCondition, searchCondition) : searchCondition;
  }

  const [totalResArray, branchList] = await Promise.all([
    anyDb.select({ count: count() }).from(tables.branches).where(whereCondition),
    anyDb
      .select()
      .from(tables.branches)
      .where(whereCondition)
      .orderBy(desc(tables.branches.is_default), asc(tables.branches.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
  ]);

  const totalResult = totalResArray[0];
  const branches = branchList;
  const total = totalResult ? Number(totalResult.count) : 0;

  if (branches.length === 0) {
    return {
      items: [],
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  const branchIds = branches.map((b: any) => b.id);
  const now = new Date();
  const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
  const fifteenMinutesAgoStr = formatDateForDb(fifteenMinutesAgo);

  // Tối ưu hóa triệt để: Gom 6N queries riêng lẻ thành 3 truy vấn batch GROUP BY
  // (the unused ticket codes are read on demand, when the close-branch dialog opens)
  const [movieStats, packageStats, bookingStats] = await Promise.all([
    // 1. Movie stats theo branch
    anyDb
      .select({
        branch_id: tables.movies.branch_id,
        count: count()
      })
      .from(tables.movies)
      .where(
        and(
          inArray(tables.movies.branch_id, branchIds),
          eq(tables.movies.is_active, true),
          isNull(tables.movies.deleted_at)
        )
      )
      .groupBy(tables.movies.branch_id),

    // 2. Package stats theo branch
    anyDb
      .select({
        branch_id: tables.ticket_packages.branch_id,
        count: count()
      })
      .from(tables.ticket_packages)
      .where(
        and(
          inArray(tables.ticket_packages.branch_id, branchIds),
          eq(tables.ticket_packages.is_active, true),
          isNull(tables.ticket_packages.deleted_at)
        )
      )
      .groupBy(tables.ticket_packages.branch_id),

    // 3. Tổng hợp toàn bộ số liệu booking trong 1 truy vấn duy nhất
    anyDb
      .select({
        branch_id: tables.bookings.branch_id,
        booking_count: count(),
        pending_bookings_count: sql<number>`SUM(CASE WHEN ${tables.bookings.payment_status} = 'pending' AND ${tables.bookings.created_at} >= ${fifteenMinutesAgoStr} THEN 1 ELSE 0 END)`,
        paid_unused_count: sql<number>`SUM(CASE WHEN ${tables.bookings.payment_status} = 'paid' AND (${tables.bookings.is_used} = 0 OR ${tables.bookings.is_used} = false OR ${tables.bookings.is_used} IS NULL) THEN 1 ELSE 0 END)`
      })
      .from(tables.bookings)
      .where(inArray(tables.bookings.branch_id, branchIds))
      .groupBy(tables.bookings.branch_id)
  ]);

  const movieMap = new Map<number, number>(movieStats.map((r: any) => [r.branch_id, Number(r.count || 0)]));
  const packageMap = new Map<number, number>(packageStats.map((r: any) => [r.branch_id, Number(r.count || 0)]));
  const bookingMap = new Map<number, any>(bookingStats.map((r: any) => [r.branch_id, r]));

  const itemsWithStats = branches.map((branch: any) => {
    const bStat = bookingMap.get(branch.id);
    return {
      ...branch,
      movie_count: movieMap.get(branch.id) || 0,
      package_count: packageMap.get(branch.id) || 0,
      booking_count: Number(bStat?.booking_count || 0),
      pending_bookings_count: Number(bStat?.pending_bookings_count || 0),
      paid_unused_count: Number(bStat?.paid_unused_count || 0)
    };
  });

  return {
    items: itemsWithStats,
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize)
  };
}

export async function listBranchOptionsImpl(
  anyDb: any,
  tables: { branches: any },
  args?: { includeInactive?: boolean; onlyOpen?: boolean; restrictToBranchIds?: number[] | null }
) {
  const { includeInactive = false, onlyOpen = false, restrictToBranchIds = null } = args || {};

  let whereCondition = includeInactive
    ? isNull(tables.branches.deleted_at)
    : and(eq(tables.branches.is_active, true), isNull(tables.branches.deleted_at));

  if (onlyOpen) {
    const openCondition = eq(tables.branches.is_open, true);
    whereCondition = whereCondition ? and(whereCondition, openCondition) : openCondition;
  }

  // Filter to only branches the staff can access
  if (restrictToBranchIds !== null && restrictToBranchIds !== undefined) {
    if (restrictToBranchIds.length === 0) {
      return { items: [] };
    }
    const branchFilter = inArray(tables.branches.id, restrictToBranchIds);
    whereCondition = whereCondition ? and(whereCondition, branchFilter) : branchFilter;
  }

  const branches = await anyDb
    .select({
      branch_id: tables.branches.id,
      id: tables.branches.id,
      name: tables.branches.name,
      code: tables.branches.code,
      address: tables.branches.address,
      phone: tables.branches.phone,
      email: tables.branches.email,
      is_default: tables.branches.is_default,
      is_open: tables.branches.is_open,
      is_active: tables.branches.is_active,
      banner_images: tables.branches.banner_images,
      settings: tables.branches.settings
    })
    .from(tables.branches)
    .where(whereCondition)
    .orderBy(desc(tables.branches.is_default), asc(tables.branches.name));

  return {
    items: branches
  };
}

/** The most unused ticket codes the close-branch dialog lists for one branch. */
export const UNUSED_CODES_LIMIT = 50;

/**
 * Paid tickets of one branch that were never used, for the close-branch warning: their booking codes (newest first,
 * at most UNUSED_CODES_LIMIT) and how many there are in all.
 */
export async function listBranchUnusedCodesImpl(
  anyDb: any,
  tables: { bookings: any },
  branchId: number,
  limit: number = UNUSED_CODES_LIMIT
) {
  const bookings = tables.bookings;
  const unusedPaid = and(
    eq(bookings.branch_id, branchId),
    eq(bookings.payment_status, 'paid'),
    or(eq(bookings.is_used, false), isNull(bookings.is_used))
  );
  const [rows, [countRow]] = await Promise.all([
    anyDb
      .select({ code: bookings.booking_code })
      .from(bookings)
      .where(and(unusedPaid, isNotNull(bookings.booking_code)))
      .orderBy(desc(bookings.id))
      .limit(limit),
    anyDb.select({ count: count() }).from(bookings).where(unusedPaid)
  ]);
  return { codes: rows.map((row: any) => row.code as string), total: Number(countRow?.count || 0) };
}

/** Branch choices of the admin screens: only the fields the pickers and filters read. */
export async function listAdminBranchOptionsImpl(
  anyDb: any,
  tables: { branches: any },
  args?: { includeInactive?: boolean; onlyOpen?: boolean; restrictToBranchIds?: number[] | null }
) {
  const { includeInactive = false, onlyOpen = false, restrictToBranchIds = null } = args || {};
  const conditions: any[] = [isNull(tables.branches.deleted_at)];
  if (!includeInactive) conditions.push(eq(tables.branches.is_active, true));
  if (onlyOpen) conditions.push(eq(tables.branches.is_open, true));
  if (restrictToBranchIds) {
    if (restrictToBranchIds.length === 0) return { items: [] };
    conditions.push(inArray(tables.branches.id, restrictToBranchIds));
  }

  const items = await anyDb
    .select({
      // branch_id repeats id: TicketCheckContent still reads it as a fallback
      branch_id: tables.branches.id,
      id: tables.branches.id,
      name: tables.branches.name,
      code: tables.branches.code,
      address: tables.branches.address,
      is_default: tables.branches.is_default,
      is_open: tables.branches.is_open,
      is_active: tables.branches.is_active
    })
    .from(tables.branches)
    .where(and(...conditions))
    .orderBy(desc(tables.branches.is_default), asc(tables.branches.name));

  return { items };
}

export async function getBranchImpl(anyDb: any, tables: { branches: any; auditLogs: any }, id: number) {
  const [item] = await anyDb.select().from(tables.branches).where(eq(tables.branches.id, id)).limit(1);
  if (!item) return null;

  // Get tracking data from audit logs
  const [createLog] = await anyDb
    .select()
    .from(tables.auditLogs)
    .where(
      and(
        eq(tables.auditLogs.entityType, 'branch'),
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
        eq(tables.auditLogs.entityType, 'branch'),
        eq(tables.auditLogs.entityId, String(id)),
        eq(tables.auditLogs.action, 'update')
      )
    )
    .orderBy(desc(tables.auditLogs.createdAt))
    .limit(1);

  return {
    ...item,
    created_by_staff_name: createLog?.staffFullname || null,
    updated_by_staff_name: updateLog?.staffFullname || null
  };
}

export async function getDefaultBranchImpl(anyDb: any, tables: { branches: any }) {
  const [item] = await anyDb
    .select()
    .from(tables.branches)
    .where(
      and(
        eq(tables.branches.is_default, true),
        eq(tables.branches.is_active, true),
        eq(tables.branches.is_open, true),
        isNull(tables.branches.deleted_at)
      )
    )
    .limit(1);
  return item || null;
}

export async function createBranchImpl(
  anyDb: any,
  tables: { branches: any; auditLogs: any },
  args: {
    name: string;
    code: string;
    address?: string;
    phone?: string;
    email?: string;
    is_default?: boolean;
    is_active?: boolean;
    is_open?: boolean;
    banner_images?: string;
    settings?: string;
  },
  staffInfo?: { id: number; email: string; fullname: string }
) {
  const { name, code, address, phone, email, is_default, is_active, is_open, banner_images, settings } = args;
  const now = new Date();

  // Check if this is the first branch
  const [existingCount] = await anyDb
    .select({ count: count() })
    .from(tables.branches)
    .where(isNull(tables.branches.deleted_at));
  const finalIsDefault = existingCount?.count === 0 ? true : is_default || false;

  if (finalIsDefault) {
    await anyDb
      .update(tables.branches)
      .set({ is_default: false, updated_at: formatDateForDb(now) })
      .where(eq(tables.branches.is_default, true));
  }

  const inserted = await anyDb
    .insert(tables.branches)
    .values({
      name,
      code,
      address: address || null,
      phone: phone || null,
      email: email || null,
      is_default: finalIsDefault,
      is_active: is_active ?? true,
      is_open: is_open ?? true,
      banner_images: banner_images || null,
      settings: settings || null,
      created_at: formatDateForDb(now),
      updated_at: formatDateForDb(now)
    })
    .returning();

  const item = Array.isArray(inserted) ? inserted[0] : inserted;
  if (!item) throw new Error('Không thể tạo chi nhánh');

  // Log audit action
  if (staffInfo) {
    await logAuditAction(
      anyDb,
      tables.auditLogs,
      'create',
      'branch',
      item.id,
      `Tạo chi nhánh: ${name} (${code})`,
      staffInfo.id,
      staffInfo.email,
      staffInfo.fullname
    );
  }

  return { item };
}

export async function updateBranchImpl(
  anyDb: any,
  tables: { branches: any; auditLogs: any; bookings: any },
  id: number,
  args: {
    name?: string;
    code?: string;
    address?: string;
    phone?: string;
    email?: string;
    is_default?: boolean;
    is_active?: boolean;
    is_open?: boolean;
    banner_images?: string;
    settings?: string;
  },
  staffInfo?: { id: number; email: string; fullname: string }
) {
  const existing = await anyDb.query.branches.findFirst({ where: eq(tables.branches.id, id) });
  if (!existing) {
    return null;
  }

  const { name, code, address, phone, email, is_default, is_active, is_open, banner_images, settings } = args;
  const now = new Date();
  const data: any = { updated_at: formatDateForDb(now) };

  if (name !== undefined) data.name = name;
  if (code !== undefined) data.code = code;
  if (address !== undefined) data.address = address;
  if (phone !== undefined) data.phone = phone;
  if (email !== undefined) data.email = email;
  if (is_active !== undefined) data.is_active = is_active;
  if (banner_images !== undefined) data.banner_images = banner_images;
  if (is_open !== undefined) {
    if (is_open === false) {
      if (existing.is_default) {
        throw new Error('Không thể đóng cửa chi nhánh mặc định. Vui lòng thiết lập chi nhánh khác làm mặc định trước.');
      }

      // Check for pending bookings within 15 minutes
      const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
      const [pending] = await anyDb
        .select({ count: count() })
        .from(tables.bookings)
        .where(
          and(
            eq(tables.bookings.branch_id, id),
            eq(tables.bookings.payment_status, 'pending'),
            gte(tables.bookings.created_at, formatDateForDb(fifteenMinutesAgo))
          )
        );

      if (pending?.count > 0) {
        throw new Error(
          `Không thể đóng cửa ngay lúc này. Có ${pending.count} khách hàng đang thực hiện thanh toán. Vui lòng thử lại sau 15 phút hoặc khi các đơn hàng này hoàn tất/hết hạn.`
        );
      }
    }
    data.is_open = is_open;
  }
  if (settings !== undefined) data.settings = settings;

  if (is_default !== undefined && is_default === true) {
    await anyDb
      .update(tables.branches)
      .set({ is_default: false, updated_at: formatDateForDb(now) })
      .where(eq(tables.branches.is_default, true));
    data.is_default = true;
  }

  const updatedRes = await anyDb.update(tables.branches).set(data).where(eq(tables.branches.id, id)).returning();

  const item = Array.isArray(updatedRes) ? updatedRes[0] : updatedRes;
  if (!item) return null;

  const auditOld = buildAuditPayload(existing);
  const auditNew = buildAuditPayload(item);

  // Log audit action
  if (staffInfo) {
    await logAuditAction(
      anyDb,
      tables.auditLogs,
      'update',
      'branch',
      id,
      `Cập nhật chi nhánh: ${item.name} (${item.code})`,
      staffInfo.id,
      staffInfo.email,
      staffInfo.fullname,
      auditOld,
      auditNew
    );
  }

  return item;
}

export async function deleteBranchImpl(
  anyDb: any,
  tables: { branches: any; movies: any; ticket_packages: any; bookings: any; staff_branches: any; auditLogs: any },
  id: number,
  staffInfo?: { id: number; email: string; fullname: string }
) {
  const existing = await anyDb.query.branches.findFirst({
    where: eq(tables.branches.id, id)
  });

  if (!existing) return null;

  if (existing.is_default) {
    throw new Error('Không thể xóa chi nhánh mặc định');
  }

  const [activeMovies] = await anyDb
    .select({ count: count() })
    .from(tables.movies)
    .where(and(eq(tables.movies.branch_id, id), eq(tables.movies.is_active, true), isNull(tables.movies.deleted_at)));

  if (activeMovies?.count > 0) {
    throw new Error(`Không thể xóa chi nhánh vì có ${activeMovies.count} phim đang hoạt động`);
  }

  const [activePackages] = await anyDb
    .select({ count: count() })
    .from(tables.ticket_packages)
    .where(
      and(
        eq(tables.ticket_packages.branch_id, id),
        eq(tables.ticket_packages.is_active, true),
        isNull(tables.ticket_packages.deleted_at)
      )
    );

  if (activePackages?.count > 0) {
    throw new Error(`Không thể xóa chi nhánh vì có ${activePackages.count} gói vé đang hoạt động`);
  }

  const [bookings] = await anyDb
    .select({ count: count() })
    .from(tables.bookings)
    .where(eq(tables.bookings.branch_id, id));

  if (bookings?.count > 0) {
    throw new Error(`Không thể xóa chi nhánh vì có ${bookings.count} giao dịch trong lịch sử`);
  }

  // Check if any staff is assigned to this branch
  const [staffCount] = await anyDb
    .select({ count: count() })
    .from(tables.staff_branches)
    .where(eq(tables.staff_branches.branchId, id));

  if (staffCount?.count > 0) {
    throw new Error(`Không thể xóa chi nhánh vì có ${staffCount.count} nhân viên đang được gán`);
  }

  const deletionTimestamp = new Date().toISOString();

  // Soft delete by setting is_active = false and deleted_at
  await anyDb
    .update(tables.branches)
    .set({ is_active: false, deleted_at: deletionTimestamp, deleted_by_staff_id: staffInfo?.id })
    .where(eq(tables.branches.id, id));

  const auditOld = buildAuditPayload(existing);
  const auditNew = buildAuditPayload({
    ...existing,
    is_active: false,
    deleted_at: deletionTimestamp,
    deleted_by_staff_id: staffInfo?.id
  });

  // Log audit action
  if (staffInfo) {
    await logAuditAction(
      anyDb,
      tables.auditLogs,
      'delete',
      'branch',
      id,
      `Xóa chi nhánh: ${existing.name} (${existing.code})`,
      staffInfo.id,
      staffInfo.email,
      staffInfo.fullname,
      auditOld,
      auditNew
    );
  }

  return { ok: true };
}

export async function restoreBranchImpl(
  anyDb: any,
  tables: { branches: any; auditLogs: any },
  id: number,
  staffInfo?: { id: number; email: string; fullname: string }
) {
  const existing = await anyDb.query.branches.findFirst({
    where: eq(tables.branches.id, id)
  });

  if (!existing) {
    const err: any = new Error('Branch not found');
    err.statusCode = 404;
    throw err;
  }

  // Restore by setting is_active = true and deleted_at = null
  await anyDb.update(tables.branches).set({ is_active: true, deleted_at: null }).where(eq(tables.branches.id, id));

  const auditOld = buildAuditPayload(existing);
  const auditNew = buildAuditPayload({ ...existing, is_active: true, deleted_at: null });

  // Log audit action
  if (staffInfo) {
    await logAuditAction(
      anyDb,
      tables.auditLogs,
      'restore',
      'branch',
      id,
      `Restore chi nhánh: ${existing.name}`,
      staffInfo.id,
      staffInfo.email,
      staffInfo.fullname,
      auditOld,
      auditNew
    );
  }

  return { ok: true };
}

export async function toggleBranchOpenImpl(
  anyDb: any,
  tables: { branches: any; auditLogs: any; bookings: any },
  id: number,
  staffInfo?: { id: number; email: string; fullname: string }
) {
  const [existing] = await anyDb.select().from(tables.branches).where(eq(tables.branches.id, id)).limit(1);

  if (!existing) {
    throw new Error('Branch not found');
  }

  const newStatus = !existing.is_open;

  if (newStatus === false) {
    if (existing.is_default) {
      throw new Error('Không thể đóng cửa chi nhánh mặc định.');
    }

    // Check for pending bookings
    const now = new Date();
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
    const [pending] = await anyDb
      .select({ count: count() })
      .from(tables.bookings)
      .where(
        and(
          eq(tables.bookings.branch_id, id),
          eq(tables.bookings.payment_status, 'pending'),
          gte(tables.bookings.created_at, formatDateForDb(fifteenMinutesAgo))
        )
      );

    if (pending?.count > 0) {
      throw new Error(`Không thể đóng cửa ngay lúc này. Có ${pending.count} khách hàng đang thực hiện thanh toán.`);
    }
  }

  await anyDb
    .update(tables.branches)
    .set({ is_open: newStatus, updated_at: new Date().toISOString() })
    .where(eq(tables.branches.id, id));

  if (staffInfo) {
    await logAuditAction(
      anyDb,
      tables.auditLogs,
      'update',
      'branch',
      id,
      `${newStatus ? 'Mở cửa' : 'Đóng cửa'} chi nhánh: ${existing.name}`,
      staffInfo.id,
      staffInfo.email,
      staffInfo.fullname
    );
  }

  return { ok: true, is_open: newStatus };
}

export async function toggleBranchStatusImpl(
  anyDb: any,
  tables: { branches: any; auditLogs: any; staff_branches: any },
  id: number,
  staffInfo?: { id: number; email: string; fullname: string }
) {
  const [existing] = await anyDb.select().from(tables.branches).where(eq(tables.branches.id, id)).limit(1);

  if (!existing) {
    throw new Error('Branch not found');
  }

  const newStatus = !existing.is_active;

  await anyDb
    .update(tables.branches)
    .set({ is_active: newStatus, updated_at: new Date().toISOString() })
    .where(eq(tables.branches.id, id));

  if (staffInfo) {
    await logAuditAction(
      anyDb,
      tables.auditLogs,
      'update',
      'branch',
      id,
      `${newStatus ? 'Kích hoạt' : 'Ẩn'} chi nhánh: ${existing.name}`,
      staffInfo.id,
      staffInfo.email,
      staffInfo.fullname
    );
  }

  return { ok: true, is_active: newStatus };
}

export async function listDeletedBranchesImpl(
  anyDb: any,
  tables: { branches: any; staffs: any },
  options: {
    page?: number;
    pageSize?: number;
    search?: string;
    sort?: string;
    dir?: string;
    /** The staff member's branches (null = Super Admin, every branch) */
    restrictToBranchIds?: number[] | null;
  } = {}
) {
  const { branches, staffs } = tables;
  const { page = 1, pageSize = 10, search = '', sort, dir } = options;
  const restrictToBranchIds = options.restrictToBranchIds ?? null;

  const conditions = [];
  if (search) {
    conditions.push(like(branches.name, `%${search}%`));
  }
  conditions.push(isNotNull(branches.deleted_at));
  if (restrictToBranchIds) {
    conditions.push(restrictToBranchIds.length ? inArray(branches.id, restrictToBranchIds) : sql`1 = 0`);
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const items = await anyDb
    .select({
      id: branches.id,
      name: branches.name,
      code: branches.code,
      address: branches.address,
      phone: branches.phone,
      email: branches.email,
      is_default: branches.is_default,
      deleted_at: branches.deleted_at,
      deleted_by_staff_name: staffs.fullname
    })
    .from(branches)
    .leftJoin(staffs, eq(branches.deleted_by_staff_id, staffs.id))
    .where(whereClause)
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .orderBy(
      sort === 'name'
        ? dir === 'asc' ? asc(branches.name) : desc(branches.name)
        : dir === 'asc' ? asc(branches.deleted_at) : desc(branches.deleted_at)
    );

  const [countResult] = await anyDb.select({ count: count() }).from(branches).where(whereClause);

  return {
    status: 'success',
    items,
    total: countResult?.count || 0,
    page,
    pageSize
  };
}
