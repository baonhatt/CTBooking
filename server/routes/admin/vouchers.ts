import { eq, desc, asc, or, count, and, isNull, isNotNull, like, sql, sum, inArray } from 'drizzle-orm';
import { formatDateForDb } from '../../lib/date-utils';
import { logAuditAction } from '../../lib/audit-logger';
import { buildAuditPayload } from '../../lib/audit-utils';
import {
  assertBranchesExist,
  assertPackagesExist,
  assertStaffMayAssign,
  branchScopeStatements,
  readScopeChange,
  readScopeInput,
  readVoucherPackagesChange,
  readVoucherPackagesInput,
  readVoucherScope,
  runBatch,
  sqlInStaffBranches,
  staffMayModify,
  staffMaySee,
  voucherPackagesStatements,
  withBranchScope,
  withVoucherScope,
  type BranchScope,
  type VoucherScope
} from '../../lib/catalog-scope';
import { validateVoucherFields } from '../../lib/voucher-input';
import { isFullDiscountVoucher, isSuperAdminStaff, FULL_DISCOUNT_SALES_MESSAGE } from '../../lib/free-voucher';
import { staffs as staffsTable, bookings as bookingsTable } from '../../../shared/schema';

/** True for a number the screen left empty (undefined, null or an empty text). */
function isEmptyNumber(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

export function parseVoucherMetadata(desc: string | null | undefined): {
  note: string;
  sale_staff_id: number | null;
  sale_name: string | null;
  sale_email: string | null;
} {
  if (!desc) {
    return { note: '', sale_staff_id: null, sale_name: null, sale_email: null };
  }
  try {
    const trimmed = desc.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const parsed = JSON.parse(trimmed);
      return {
        note: parsed.note || parsed.text || '',
        sale_staff_id: parsed.sale_staff_id ? Number(parsed.sale_staff_id) : null,
        sale_name: parsed.sale_name || null,
        sale_email: parsed.sale_email || null
      };
    }
  } catch {}
  return { note: desc, sale_staff_id: null, sale_name: null, sale_email: null };
}

export function formatVoucherDescription(
  note?: string | null,
  sale?: { staff_id?: number | null; name?: string | null; email?: string | null }
): string | null {
  const staff_id = sale?.staff_id ? Number(sale.staff_id) : null;
  const name = sale?.name ? String(sale.name).trim() : null;
  const email = sale?.email ? String(sale.email).trim() : null;
  const cleanNote = note ? String(note).trim() : '';

  if (staff_id || name || email) {
    return JSON.stringify({
      note: cleanNote,
      sale_staff_id: staff_id,
      sale_name: name,
      sale_email: email
    });
  }
  return cleanNote || null;
}

/** Status filters of the voucher list (expired, not started yet, quota used up, quota nearly used up). */
export const VOUCHER_STATUS_FILTERS = ['expired', 'upcoming', 'out_of_quota', 'low_quota'];

/** A voucher counts as "nearly out" when this share of its quota is used (and some is still left). */
const LOW_QUOTA_SHARE = 0.9;

/** Columns the list can be sorted by: the key sent by the screen -> the column name. Anything else is ignored. */
const VOUCHER_SORT_COLUMNS: Record<string, string> = {
  created_at: 'created_at',
  code: 'code',
  name: 'name',
  discount_value: 'discount_value',
  used_count: 'used_count',
  valid_until: 'valid_until'
};

/** The SQL condition for one status filter, or null when the value is not a known filter. */
export function voucherStatusCondition(vouchers: any, status?: string) {
  // datetime() reads both the ISO text ("2026-11-10T03:00:00.000Z") and the "YYYY-MM-DD HH:MM:SS" text
  if (status === 'expired') {
    return sql`(${vouchers.valid_until} IS NOT NULL AND datetime(${vouchers.valid_until}) < datetime('now'))`;
  }
  if (status === 'upcoming') {
    return sql`(${vouchers.valid_from} IS NOT NULL AND datetime(${vouchers.valid_from}) > datetime('now'))`;
  }
  if (status === 'out_of_quota') {
    return sql`(${vouchers.usage_limit} IS NOT NULL AND ${vouchers.used_count} >= ${vouchers.usage_limit})`;
  }
  if (status === 'low_quota') {
    return sql`(${vouchers.usage_limit} IS NOT NULL AND ${vouchers.usage_limit} > 0 AND ${vouchers.used_count} < ${vouchers.usage_limit} AND ${vouchers.used_count} >= ${vouchers.usage_limit} * ${LOW_QUOTA_SHARE})`;
  }
  return null;
}

/** Sort order of the list: the chosen column (newest first when none), with the id as tie-break so pages stay stable. */
export function buildVoucherOrderBy(vouchers: any, sort_by?: string, sort_dir?: string) {
  const columnName = sort_by ? VOUCHER_SORT_COLUMNS[sort_by] : undefined;
  if (!columnName) return [desc(vouchers.created_at), desc(vouchers.id)];
  const direction = sort_dir === 'asc' ? asc : desc;
  return [direction(vouchers[columnName]), desc(vouchers.id)];
}

/** Vouchers of one branch: the ones of every branch and those linked to the branch. */
export function voucherBranchCondition(_vouchers: any, branchId: number | null | undefined) {
  if (!branchId) return null;
  return sqlInStaffBranches('voucher', [branchId]);
}

/** The is_active filter of the lists: 'true'/'1' active, 'false'/'0' inactive, anything else (all, blank) no filter. */
export function voucherActiveCondition(vouchers: any, isActive: string | undefined) {
  if (isActive === 'true' || isActive === '1') return eq(vouchers.is_active, true);
  if (isActive === 'false' || isActive === '0') return eq(vouchers.is_active, false);
  return null;
}

/**
 * The fields a voucher row (with its scope: withVoucherScope) sends to the admin screens: the stored description is
 * replaced by its parsed parts (note, Sales person).
 */
function voucherRowForScreen(row: any) {
  const { description, ...voucherFields } = row;
  const meta = parseVoucherMetadata(description);
  return {
    ...voucherFields,
    note: meta.note,
    sale_staff_id: meta.sale_staff_id,
    sale_name: meta.sale_name,
    sale_email: meta.sale_email
  };
}

/**
 * The voucher form's choice of packages. A voucher of every type (scope 'all') covers every package; otherwise the
 * form must say so ({ all_packages } or a list). On an edit, a choice not sent stays as it is.
 */
function voucherPackagesFromInput(
  scopeValue: string,
  input: { all_packages?: unknown; package_ids?: unknown },
  mode: 'create' | 'edit'
) {
  if (scopeValue === 'all') return { all_packages: true, package_ids: [] as number[] };
  return mode === 'create' ? readVoucherPackagesInput(input) : readVoucherPackagesChange(input);
}

/** The record as written to the audit log: the row plus where and on what it applies. */
function voucherAuditRecord(row: any, scope: VoucherScope | null) {
  return { ...row, ...(scope || {}) };
}

export async function listVouchersImpl(
  anyDb: any,
  tables: { vouchers: any; voucher_redemption_logs?: any; bookings?: any },
  args: {
    page: number;
    pageSize: number;
    q: string;
    scope?: string;
    is_active?: string;
    sale_staff_id?: string | number;
    status?: string;
    sort_by?: string;
    sort_dir?: string;
    branch_id?: number | null;
    restrictToBranchIds?: number[] | null;
  }
) {
  const { page, pageSize, q, scope, is_active, sale_staff_id, status, sort_by, sort_dir, branch_id, restrictToBranchIds = null } = args;
  const conditions = [] as any[];
  conditions.push(isNull(tables.vouchers.deleted_at));

  if (q) {
    const lowerQ = q.toLowerCase();
    conditions.push(
      or(
        sql`LOWER(${tables.vouchers.code}) LIKE ${`%${lowerQ}%`}`,
        sql`LOWER(${tables.vouchers.name}) LIKE ${`%${lowerQ}%`}`,
        sql`LOWER(${tables.vouchers.description}) LIKE ${`%${lowerQ}%`}`
      )
    );
  }

  if (scope && scope !== 'all') {
    conditions.push(eq(tables.vouchers.scope, scope));
  }

  const activeCondition = voucherActiveCondition(tables.vouchers, is_active);
  if (activeCondition) conditions.push(activeCondition);

  const branchCondition = voucherBranchCondition(tables.vouchers, branch_id);
  if (branchCondition) conditions.push(branchCondition);

  if (sale_staff_id && sale_staff_id !== 'all') {
    const targetStaffId = Number(sale_staff_id);
    conditions.push(
      // The brackets keep the OR inside this one condition (otherwise it would leak into the other filters)
      sql`(${tables.vouchers.description} LIKE ${`%"sale_staff_id":${targetStaffId}%`} OR ${tables.vouchers.description} LIKE ${`%"sale_staff_id": ${targetStaffId}%`})`
    );
  }

  const statusCondition = voucherStatusCondition(tables.vouchers, status);
  if (statusCondition) conditions.push(statusCondition);

  // Branch access filter: staff can only see vouchers from their assigned branches
  // (or vouchers of every branch)
  if (restrictToBranchIds !== null && restrictToBranchIds !== undefined) {
    if (restrictToBranchIds.length === 0) {
      conditions.push(sql`1 = 0`);
    } else {
      conditions.push(sqlInStaffBranches('voucher', restrictToBranchIds));
    }
  }

  const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRes] = await anyDb.select({ count: count() }).from(tables.vouchers).where(whereCondition);
  const total = totalRes?.count || 0;
  const rawItems = await anyDb.query.vouchers.findMany({
    where: whereCondition,
    orderBy: buildVoucherOrderBy(tables.vouchers, sort_by, sort_dir),
    limit: pageSize,
    offset: (page - 1) * pageSize
  });

  const voucherIds = rawItems.map((v: any) => v.id);
  let aggregatedStats: Record<number, any> = {};

  if (voucherIds.length > 0 && tables.voucher_redemption_logs) {
    try {
      const statsList = await voucherRedemptionStats(anyDb, tables, voucherIds, restrictToBranchIds);

      statsList.forEach((stat: any) => {
        aggregatedStats[stat.voucher_id] = stat;
      });
    } catch {}
  }

  const items = (await withVoucherScope(anyDb, rawItems)).map((v: any) => {
    let total_revenue = 0;
    let redemptions_count = v.used_count || 0;

    const stats = aggregatedStats[v.id];
    if (stats) {
      total_revenue = Number(stats.total_revenue || 0);
      if (Number(stats.total_count || 0) > redemptions_count) {
        redemptions_count = Number(stats.total_count);
      }
    }

    return {
      ...voucherRowForScreen(v),
      total_revenue,
      used_count: redemptions_count
    };
  });

  return { items, page, pageSize, total };
}

/**
 * Revenue and redemption count per voucher. Staff of some branches count only the orders of their own branches
 * (the order's branch); the Super Admin (null) counts every branch.
 */
export async function voucherRedemptionStats(
  anyDb: any,
  tables: { voucher_redemption_logs?: any; bookings?: any },
  voucherIds: number[],
  restrictToBranchIds: number[] | null
): Promise<Array<{ voucher_id: number; total_revenue: any; total_count: number }>> {
  const logs = tables.voucher_redemption_logs;
  const fields = {
    voucher_id: logs.voucher_id,
    total_revenue: sum(logs.order_total_after_discount),
    total_count: count()
  };
  if (restrictToBranchIds === null || restrictToBranchIds === undefined) {
    return anyDb.select(fields).from(logs).where(inArray(logs.voucher_id, voucherIds)).groupBy(logs.voucher_id);
  }
  if (!tables.bookings) throw new Error('bookings table is needed to scope voucher revenue by branch');
  if (restrictToBranchIds.length === 0) return [];
  return anyDb
    .select(fields)
    .from(logs)
    .innerJoin(tables.bookings, eq(logs.booking_id, tables.bookings.id))
    .where(and(inArray(logs.voucher_id, voucherIds), inArray(tables.bookings.branch_id, restrictToBranchIds)))
    .groupBy(logs.voucher_id);
}

export async function listDeletedVouchersImpl(
  anyDb: any,
  tables: { vouchers: any },
  options: {
    page?: number;
    pageSize?: number;
    search?: string;
    scope?: string;
    is_active?: string;
    branch_id?: number | null;
    restrictToBranchIds?: number[] | null;
  } = {}
) {
  const { vouchers } = tables;
  const { page = 1, pageSize = 10, search = '', scope, is_active, branch_id, restrictToBranchIds = null } = options;
  const conditions = [] as any[];
  if (search) {
    const lowerQ = search.toLowerCase();
    conditions.push(
      or(sql`LOWER(${vouchers.code}) LIKE ${`%${lowerQ}%`}`, sql`LOWER(${vouchers.name}) LIKE ${`%${lowerQ}%`}`)
    );
  }
  if (scope && scope !== 'all') {
    conditions.push(eq(vouchers.scope, scope));
  }
  conditions.push(isNotNull(vouchers.deleted_at));

  const activeCondition = voucherActiveCondition(vouchers, is_active);
  if (activeCondition) conditions.push(activeCondition);

  const branchCondition = voucherBranchCondition(vouchers, branch_id);
  if (branchCondition) conditions.push(branchCondition);

  // Branch access filter
  if (restrictToBranchIds !== null && restrictToBranchIds !== undefined) {
    if (restrictToBranchIds.length === 0) {
      conditions.push(sql`1 = 0`);
    } else {
      conditions.push(sqlInStaffBranches('voucher', restrictToBranchIds));
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const itemsRaw = await anyDb.query.vouchers.findMany({
    where: whereClause,
    // Only the name of the staff member who deleted it (never the whole staff record)
    with: { deleted_by_staff: { columns: { fullname: true } } },
    orderBy: [desc(vouchers.deleted_at)],
    limit: pageSize,
    offset: (page - 1) * pageSize
  });
  
  const items = (await withVoucherScope(anyDb, itemsRaw)).map(({ deleted_by_staff, ...v }: any) => ({
    ...voucherRowForScreen(v),
    deleted_by_staff_name: deleted_by_staff?.fullname || null
  }));
  const [countResult] = await anyDb.select({ count: count() }).from(vouchers).where(whereClause);
  return { status: 'success', items, total: countResult?.count || 0, page, pageSize };
}

/** The most ticket packages the voucher form lists (far above the real number of packages). */
export const VOUCHER_PACKAGE_OPTIONS_LIMIT = 1000;

/**
 * Ticket packages the voucher form can pick: active and inactive ones (an old voucher may point at a package that is
 * switched off now), never deleted ones. Staff of some branches see the global packages and those of their branches.
 * Only the fields the form shows.
 */
export async function listVoucherPackageOptionsImpl(
  anyDb: any,
  tables: { ticket_packages: any },
  options: { type?: string; branch_id?: number | null; restrictToBranchIds?: number[] | null } = {}
) {
  const packages = tables.ticket_packages;
  const restrictToBranchIds = options.restrictToBranchIds ?? null;
  const conditions: any[] = [isNull(packages.deleted_at)];
  if (options.type === 'vr') conditions.push(eq(packages.type, 'vr'));
  if (options.type === 'movie') conditions.push(sql`(${packages.type} IS NULL OR ${packages.type} != 'vr')`);
  if (options.branch_id) conditions.push(sqlInStaffBranches('package', [options.branch_id]));
  if (restrictToBranchIds) conditions.push(sqlInStaffBranches('package', restrictToBranchIds));

  const rows = await anyDb
    .select({
      id: packages.id,
      name: packages.name,
      price: packages.price,
      type: packages.type,
      all_branches: packages.all_branches,
      is_active: packages.is_active
    })
    .from(packages)
    .where(and(...conditions))
    .orderBy(asc(packages.display_order), desc(packages.id))
    .limit(VOUCHER_PACKAGE_OPTIONS_LIMIT);

  const items = await withBranchScope(anyDb, 'package', rows);
  return { items, total: items.length };
}

/** How many redemptions the detail shows by default, and the most it can be asked for ("xem thêm"). */
export const DEFAULT_REDEMPTION_LIMIT = 20;
const MAX_REDEMPTION_LIMIT = 200;

export function clampRedemptionLimit(value: unknown): number {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number) || number < 1) return DEFAULT_REDEMPTION_LIMIT;
  return Math.min(number, MAX_REDEMPTION_LIMIT);
}

export async function getVoucherImpl(
  anyDb: any,
  tables: { vouchers: any; auditLogs: any; voucher_redemption_logs: any },
  id: number,
  restrictToBranchIds?: number[] | null,
  redemptionLimit: number = DEFAULT_REDEMPTION_LIMIT
) {
  const voucherRow = await anyDb.query.vouchers.findFirst({ where: eq(tables.vouchers.id, id) });
  if (!voucherRow) return null;
  const [voucher] = await withVoucherScope(anyDb, [voucherRow]);

  // Check branch access
  if (!staffMaySee(voucher, restrictToBranchIds ?? null)) return null;

  const meta = parseVoucherMetadata(voucher.description);

  // Branch staff only see (and count) the uses on orders of their own branches; the Super Admin (null) sees all
  const redemptionWhere =
    restrictToBranchIds !== null && restrictToBranchIds !== undefined
      ? and(
          eq(tables.voucher_redemption_logs.voucher_id, id),
          inArray(
            tables.voucher_redemption_logs.booking_id,
            anyDb.select({ id: bookingsTable.id }).from(bookingsTable).where(inArray(bookingsTable.branch_id, restrictToBranchIds))
          )
        )
      : eq(tables.voucher_redemption_logs.voucher_id, id);

  const [redemptionCountRes] = await anyDb
    .select({ count: count() })
    .from(tables.voucher_redemption_logs)
    .where(redemptionWhere);

  const redemptionRows = await anyDb.query.voucher_redemption_logs.findMany({
    where: redemptionWhere,
    // Only what the history table shows: no customer, staff or order totals
    columns: { id: true, redeemed_at: true, discount_amount_applied: true },
    // The booking code is what staff know a booking by (the numeric id stays out of the screen)
    with: { booking: { columns: { booking_code: true } } },
    orderBy: [desc(tables.voucher_redemption_logs.redeemed_at)],
    limit: clampRedemptionLimit(redemptionLimit)
  });
  const recent_redemptions = redemptionRows.map((row: any) => ({
    id: row.id,
    booking_code: row.booking?.booking_code || null,
    redeemed_at: row.redeemed_at,
    discount_amount_applied: row.discount_amount_applied
  }));

  const [createLog] = await anyDb
    .select()
    .from(tables.auditLogs)
    .where(
      and(
        eq(tables.auditLogs.entityType, 'voucher'),
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
        eq(tables.auditLogs.entityType, 'voucher'),
        eq(tables.auditLogs.entityId, String(id)),
        eq(tables.auditLogs.action, 'update')
      )
    )
    .orderBy(desc(tables.auditLogs.createdAt))
    .limit(1);

  // The raw description is the stored JSON (note + Sales person); the screen gets them parsed below
  const {
    description: _rawDescription,
    deleted_at: _deletedAt,
    deleted_by_staff_id: _deletedBy,
    ...voucherFields
  } = voucher;
  return {
    ...voucherFields,
    note: meta.note,
    sale_staff_id: meta.sale_staff_id,
    sale_name: meta.sale_name,
    sale_email: meta.sale_email,
    redemption_total_count: redemptionCountRes?.count || 0,
    recent_redemptions,
    created_by_staff_name: createLog?.staffFullname || null,
    updated_by_staff_name: updateLog?.staffFullname || null
  };
}

/**
 * A 100% voucher (test voucher, see lib/free-voucher.ts) is saved only by a Super Admin (no branch restriction) and
 * only with a Super Admin as its Sales person.
 */
async function checkFullDiscountVoucher(
  anyDb: any,
  fields: { discount_type?: string | null; discount_value?: any },
  saleStaffId: number | null | undefined,
  restrictToBranchIds: number[] | null | undefined
) {
  if (!isFullDiscountVoucher(fields)) return;
  const callerIsSuperAdmin = restrictToBranchIds === null || restrictToBranchIds === undefined;
  if (!callerIsSuperAdmin || !(await isSuperAdminStaff(anyDb, staffsTable, saleStaffId))) {
    throw Object.assign(new Error(FULL_DISCOUNT_SALES_MESSAGE), { statusCode: 403 });
  }
}

export async function createVoucherImpl(
  anyDb: any,
  tables: { vouchers: any; auditLogs: any },
  args: {
    code: string;
    name: string;
    description?: string;
    note?: string;
    sale_staff_id?: number | null;
    sale_name?: string | null;
    sale_email?: string | null;
    scope?: string;
    discount_type: string;
    discount_value: number;
    min_order_value?: number;
    max_discount?: number | null;
    usage_limit?: number;
    per_user_limit?: number;
    is_active?: boolean;
    valid_from?: string;
    valid_until?: string;
    all_branches?: boolean;
    branch_ids?: number[];
    all_packages?: boolean;
    package_ids?: number[];
  },
  staffInfo?: { id: number; email: string; fullname: string },
  restrictToBranchIds?: number[] | null
) {
  const cleanCode = (args.code || '').trim().toUpperCase();
  if (!cleanCode) throw Object.assign(new Error('Mã voucher không được trống'), { statusCode: 400 });
  validateVoucherFields({ ...args, scope: args.scope || 'all' });
  const dValue = Number(args.discount_value);
  // Where and on what it applies: the form must say so; a missing choice is refused (never "every branch")
  const restrict = restrictToBranchIds ?? null;
  const branchScope: BranchScope = readScopeInput(args);
  assertStaffMayAssign(branchScope, restrict, 'voucher');
  await assertBranchesExist(anyDb, branchScope.branch_ids);
  const packageChoice = voucherPackagesFromInput(args.scope || 'all', args, 'create')!;
  await assertPackagesExist(anyDb, packageChoice.package_ids);
  await checkFullDiscountVoucher(anyDb, args, args.sale_staff_id, restrictToBranchIds);

  const formattedDesc = formatVoucherDescription(args.note || args.description, {
    staff_id: args.sale_staff_id,
    name: args.sale_name,
    email: args.sale_email
  });

  const nowIso = new Date();
  const payload: any = {
    code: cleanCode,
    name: args.name,
    description: formattedDesc,
    scope: args.scope || 'all',
    discount_type: args.discount_type,
    discount_value: String(dValue),
    min_order_value: String(Number(args.min_order_value ?? 0)),
    // Empty or null means "no cap" and stays null (String(Number(null)) would save "0")
    max_discount: isEmptyNumber(args.max_discount) ? null : String(Number(args.max_discount)),
    usage_limit: args.usage_limit !== undefined && args.usage_limit !== null ? Number(args.usage_limit) : null,
    per_user_limit: args.per_user_limit !== undefined && args.per_user_limit !== null ? Number(args.per_user_limit) : 1,
    is_active: args.is_active !== undefined ? (args.is_active ? 1 : 0) : 1,
    valid_from: args.valid_from || null,
    valid_until: args.valid_until || null,
    all_branches: branchScope.all_branches,
    all_packages: packageChoice.all_packages,
    created_at: formatDateForDb(nowIso),
    updated_at: formatDateForDb(nowIso)
  };

  try {
    const inserted = await anyDb.insert(tables.vouchers).values(payload).returning();
    let voucher: any = Array.isArray(inserted) ? inserted[0] : inserted;
    if (!voucher) {
      voucher = await anyDb.query.vouchers.findFirst({ where: eq(tables.vouchers.code, cleanCode) });
    }
    if (!voucher) throw new Error('Không thể tạo voucher');
    await runBatch(anyDb, [
      ...(await branchScopeStatements(anyDb, 'voucher', voucher.id, branchScope)),
      ...(await voucherPackagesStatements(anyDb, voucher.id, packageChoice))
    ]);
    const voucherScope = await readVoucherScope(anyDb, voucher.id);

    const auditNew = buildAuditPayload(voucherAuditRecord(voucher, voucherScope));
    if (staffInfo) {
      await logAuditAction(
        anyDb,
        tables.auditLogs,
        'create',
        'voucher',
        voucher.id,
        `Tạo voucher: ${cleanCode}`,
        staffInfo.id,
        staffInfo.email,
        staffInfo.fullname,
        undefined,
        auditNew
      );
    }
    return { voucher: { ...voucher, ...voucherScope } };
  } catch (err: any) {
    if (
      String(err.message || err)
        .toLowerCase()
        .includes('unique') ||
      String(err.message || err).includes('UNIQUE')
    ) {
      throw new Error(`Mã voucher "${cleanCode}" đã tồn tại, vui lòng chọn mã khác`);
    }
    throw err;
  }
}

export async function updateVoucherImpl(
  anyDb: any,
  tables: { vouchers: any; auditLogs: any },
  id: number,
  args: {
    code?: string;
    name?: string;
    description?: string;
    note?: string;
    sale_staff_id?: number | null;
    sale_name?: string | null;
    sale_email?: string | null;
    scope?: string;
    discount_type?: string;
    discount_value?: number;
    min_order_value?: number;
    max_discount?: number | null;
    usage_limit?: number;
    per_user_limit?: number;
    is_active?: boolean;
    valid_from?: string;
    valid_until?: string;
    all_branches?: boolean;
    branch_ids?: number[];
    all_packages?: boolean;
    package_ids?: number[];
  },
  staffInfo?: { id: number; email: string; fullname: string },
  restrictToBranchIds?: number[] | null
) {
  const existing = await anyDb.query.vouchers.findFirst({ where: eq(tables.vouchers.id, id) });
  if (!existing) {
    const err: any = new Error('Voucher không tồn tại');
    err.statusCode = 404;
    throw err;
  }
  const oldScope = await readVoucherScope(anyDb, id);

  // Check branch access
  if (restrictToBranchIds !== null && restrictToBranchIds !== undefined) {
    const hasAccess = staffMayModify(oldScope, restrictToBranchIds);
    if (!hasAccess) {
      const err: any = new Error('Voucher thuộc nhiều chi nhánh hoặc chi nhánh khác, chỉ Super Admin hoặc người quản lý đủ các chi nhánh đó được sửa');
      err.statusCode = 403;
      throw err;
    }
  }

  const existingMeta = parseVoucherMetadata(existing.description);
  const targetSaleStaffId = args.sale_staff_id !== undefined ? args.sale_staff_id : existingMeta.sale_staff_id;
  const targetSaleName = args.sale_name !== undefined ? args.sale_name : existingMeta.sale_name;
  const targetSaleEmail = args.sale_email !== undefined ? args.sale_email : existingMeta.sale_email;
  const targetNote =
    args.note !== undefined ? args.note : args.description !== undefined ? args.description : existingMeta.note;

  const formattedDesc = formatVoucherDescription(targetNote, {
    staff_id: targetSaleStaffId,
    name: targetSaleName,
    email: targetSaleEmail
  });

  const pick = (name: string) => ((args as any)[name] !== undefined ? (args as any)[name] : existing[name]);
  validateVoucherFields({
    discount_type: pick('discount_type'),
    discount_value: pick('discount_value'),
    scope: pick('scope'),
    min_order_value: pick('min_order_value'),
    max_discount: pick('max_discount'),
    usage_limit: pick('usage_limit'),
    per_user_limit: pick('per_user_limit'),
    valid_from: pick('valid_from'),
    valid_until: pick('valid_until')
  });
  // Sent fields change the branches / packages; fields not sent leave them as they are
  const newBranchScope = readScopeChange(args);
  if (newBranchScope) {
    assertStaffMayAssign(newBranchScope, restrictToBranchIds ?? null, 'voucher');
    await assertBranchesExist(anyDb, newBranchScope.branch_ids);
  }
  await checkFullDiscountVoucher(
    anyDb,
    { discount_type: pick('discount_type'), discount_value: pick('discount_value') },
    targetSaleStaffId,
    restrictToBranchIds
  );

  const data: any = { updated_at: formatDateForDb(new Date()) };
  if (args.code !== undefined) data.code = (args.code || '').trim().toUpperCase();
  if (args.name !== undefined) data.name = args.name;
  data.description = formattedDesc;
  if (args.scope !== undefined) data.scope = args.scope;
  if (args.discount_type !== undefined) data.discount_type = args.discount_type;
  if (args.discount_value !== undefined) data.discount_value = String(Number(args.discount_value));
  if (args.min_order_value !== undefined) data.min_order_value = String(Number(args.min_order_value ?? 0));
  if (args.max_discount !== undefined)
    data.max_discount = isEmptyNumber(args.max_discount) ? null : String(Number(args.max_discount));
  if (args.usage_limit !== undefined) data.usage_limit = args.usage_limit !== null ? Number(args.usage_limit) : null;
  if (args.per_user_limit !== undefined)
    data.per_user_limit = args.per_user_limit !== null ? Number(args.per_user_limit) : null;
  if (args.is_active !== undefined) data.is_active = args.is_active ? 1 : 0;
  if (args.valid_from !== undefined) data.valid_from = args.valid_from || null;
  if (args.valid_until !== undefined) data.valid_until = args.valid_until || null;
  // A voucher of every type (scope 'all') covers every package; otherwise the packages as sent (if sent)
  const targetScope = args.scope !== undefined ? args.scope : existing.scope;
  const newPackages = voucherPackagesFromInput(targetScope, args, 'edit');
  if (newPackages) await assertPackagesExist(anyDb, newPackages.package_ids);

  // The row, its branches and its packages change together
  await runBatch(anyDb, [
    anyDb.update(tables.vouchers).set(data).where(eq(tables.vouchers.id, id)),
    ...(newBranchScope ? await branchScopeStatements(anyDb, 'voucher', id, newBranchScope) : []),
    ...(newPackages ? await voucherPackagesStatements(anyDb, id, newPackages) : [])
  ]);
  const updatedRow: any = await anyDb.query.vouchers.findFirst({ where: eq(tables.vouchers.id, id) });
  const newScope = await readVoucherScope(anyDb, id);
  const updatedVoucher = updatedRow ? { ...updatedRow, ...newScope } : null;

  const auditOld = buildAuditPayload(voucherAuditRecord(existing, oldScope));
  const auditNew = buildAuditPayload(updatedVoucher);
  if (staffInfo) {
    await logAuditAction(
      anyDb,
      tables.auditLogs,
      'update',
      'voucher',
      id,
      `Cập nhật voucher: ${existing.code}`,
      staffInfo.id,
      staffInfo.email,
      staffInfo.fullname,
      auditOld,
      auditNew
    );
  }
  return updatedVoucher || null;
}

export async function toggleVoucherStatusImpl(
  anyDb: any,
  tables: { vouchers: any; auditLogs: any },
  id: number,
  staffInfo?: { id: number; email: string; fullname: string },
  restrictToBranchIds?: number[] | null
) {
  const existing = await anyDb.query.vouchers.findFirst({ where: eq(tables.vouchers.id, id) });
  if (!existing) {
    const err: any = new Error('Voucher không tồn tại');
    err.statusCode = 404;
    throw err;
  }

  // Check branch access
  if (restrictToBranchIds !== null && restrictToBranchIds !== undefined) {
    const hasAccess = staffMayModify(await readVoucherScope(anyDb, id), restrictToBranchIds);
    if (!hasAccess) {
      const err: any = new Error('Không có quyền thay đổi trạng thái voucher này');
      err.statusCode = 403;
      throw err;
    }
  }
  const newStatus = !existing.is_active;
  await anyDb
    .update(tables.vouchers)
    .set({ is_active: newStatus, updated_at: formatDateForDb(new Date()) })
    .where(eq(tables.vouchers.id, id));

  const auditOld = buildAuditPayload(existing);
  const auditNew = buildAuditPayload({ ...existing, is_active: newStatus });
  if (staffInfo) {
    await logAuditAction(
      anyDb,
      tables.auditLogs,
      'update',
      'voucher',
      id,
      `${newStatus ? 'Kích hoạt' : 'Vô hiệu hóa'} voucher: ${existing.code}`,
      staffInfo.id,
      staffInfo.email,
      staffInfo.fullname,
      auditOld,
      auditNew
    );
  }
  return { ok: true, is_active: newStatus };
}

export async function deleteVoucherImpl(
  anyDb: any,
  tables: { vouchers: any; auditLogs: any },
  id: number,
  staffInfo?: { id: number; email: string; fullname: string },
  restrictToBranchIds?: number[] | null
) {
  const existing = await anyDb.query.vouchers.findFirst({ where: eq(tables.vouchers.id, id) });
  if (!existing) return null;

  // Check branch access
  if (restrictToBranchIds !== null && restrictToBranchIds !== undefined) {
    const hasAccess = staffMayModify(await readVoucherScope(anyDb, id), restrictToBranchIds);
    if (!hasAccess) {
      const err: any = new Error('Không có quyền xóa voucher này');
      err.statusCode = 403;
      throw err;
    }
  }
  await anyDb
    .update(tables.vouchers)
    .set({
      is_active: 0,
      deleted_at: new Date().toISOString(),
      deleted_by_staff_id: staffInfo?.id || null,
      updated_at: formatDateForDb(new Date())
    })
    .where(eq(tables.vouchers.id, id));

  const auditOld = buildAuditPayload(existing);
  if (staffInfo) {
    await logAuditAction(
      anyDb,
      tables.auditLogs,
      'delete',
      'voucher',
      id,
      `Xóa voucher: ${existing.code}`,
      staffInfo.id,
      staffInfo.email,
      staffInfo.fullname,
      auditOld,
      undefined
    );
  }
  return { ok: true };
}

export async function restoreVoucherImpl(
  anyDb: any,
  tables: { vouchers: any; auditLogs: any },
  id: number,
  staffInfo?: { id: number; email: string; fullname: string },
  restrictToBranchIds?: number[] | null
) {
  const { vouchers } = tables;
  const existing = await anyDb.query.vouchers.findFirst({
    where: and(eq(vouchers.id, id), isNotNull(vouchers.deleted_at))
  });
  if (!existing) {
    const err: any = new Error('Không tìm thấy voucher hoặc voucher chưa bị xóa');
    err.statusCode = 404;
    throw err;
  }

  // Check branch access
  if (restrictToBranchIds !== null && restrictToBranchIds !== undefined) {
    const hasAccess = staffMayModify(await readVoucherScope(anyDb, id), restrictToBranchIds);
    if (!hasAccess) {
      const err: any = new Error('Không có quyền khôi phục voucher này');
      err.statusCode = 403;
      throw err;
    }
  }
  await anyDb
    .update(vouchers)
    .set({ deleted_at: null, deleted_by_staff_id: null, is_active: 0, updated_at: formatDateForDb(new Date()) })
    .where(eq(vouchers.id, id));

  const auditOld = buildAuditPayload(existing);
  const auditNew = buildAuditPayload({ ...existing, deleted_at: null, deleted_by_staff_id: null, is_active: 0 });
  if (staffInfo) {
    await logAuditAction(
      anyDb,
      tables.auditLogs,
      'restore',
      'voucher',
      id,
      `Khôi phục voucher: ${existing.code}`,
      staffInfo.id,
      staffInfo.email,
      staffInfo.fullname,
      auditOld,
      auditNew
    );
  }
  return { ok: true };
}
