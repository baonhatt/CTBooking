import { eq, desc, asc, or, count, and, isNull, isNotNull, like, sql, sum, inArray } from 'drizzle-orm';
import { formatDateForDb } from '../../lib/date-utils';
import { logAuditAction } from '../../lib/audit-logger';
import { buildAuditPayload } from '../../lib/audit-utils';
import { sqlBranchIdsStaffAccessFilter, staffCanAccessBranchIds, staffCanModifyBranchRecord } from '../../lib/branch-ids';
import { validateVoucherFields, checkVoucherBranches } from '../../lib/voucher-input';

/** True for a number the screen left empty (undefined, null or an empty text). */
function isEmptyNumber(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

function parseJsonArrayNullable(value: any): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === 'string') return value;
  return undefined;
}

export function parseJsonArrayOutput(val: any): any[] | null {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string' && val.trim().length > 0) {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return null;
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

export async function listVouchersImpl(
  anyDb: any,
  tables: { vouchers: any; voucher_redemption_logs?: any },
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
    restrictToBranchIds?: number[] | null;
  }
) {
  const { page, pageSize, q, scope, is_active, sale_staff_id, status, sort_by, sort_dir, restrictToBranchIds = null } = args;
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

  if (is_active !== undefined && is_active !== 'all' && is_active !== '') {
    const val = is_active === 'true' || is_active === '1' ? 1 : 0;
    conditions.push(eq(tables.vouchers.is_active, val));
  }

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
  // (or vouchers with branch_ids = null which apply to all branches)
  if (restrictToBranchIds !== null && restrictToBranchIds !== undefined) {
    if (restrictToBranchIds.length === 0) {
      conditions.push(sql`1 = 0`);
    } else {
      conditions.push(sqlBranchIdsStaffAccessFilter(tables.vouchers.branch_ids, restrictToBranchIds));
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
      const statsList = await anyDb
        .select({
          voucher_id: tables.voucher_redemption_logs.voucher_id,
          total_revenue: sum(tables.voucher_redemption_logs.order_total_after_discount),
          total_count: count()
        })
        .from(tables.voucher_redemption_logs)
        .where(inArray(tables.voucher_redemption_logs.voucher_id, voucherIds))
        .groupBy(tables.voucher_redemption_logs.voucher_id);
        
      statsList.forEach((stat: any) => {
        aggregatedStats[stat.voucher_id] = stat;
      });
    } catch {}
  }

  const items = rawItems.map((v: any) => {
    const meta = parseVoucherMetadata(v.description);
    let total_revenue = 0;
    let redemptions_count = v.used_count || 0;

    const stats = aggregatedStats[v.id];
    if (stats) {
      total_revenue = Number(stats.total_revenue || 0);
      if (Number(stats.total_count || 0) > redemptions_count) {
        redemptions_count = Number(stats.total_count);
      }
    }

    // applicable_user_ids is no longer part of the admin API (the column stays in the database)
    const { applicable_user_ids: _unusedUserIds, ...voucherFields } = v;
    return {
      ...voucherFields,
      note: meta.note,
      sale_staff_id: meta.sale_staff_id,
      sale_name: meta.sale_name,
      sale_email: meta.sale_email,
      total_revenue,
      used_count: redemptions_count,
      applicable_ticket_package_ids: parseJsonArrayOutput(v.applicable_ticket_package_ids),
        branch_ids: parseJsonArrayOutput(v.branch_ids)
    };
  });

  return { items, page, pageSize, total };
}

export async function listDeletedVouchersImpl(
  anyDb: any,
  tables: { vouchers: any },
  options: { page?: number; pageSize?: number; search?: string; scope?: string; restrictToBranchIds?: number[] | null } = {}
) {
  const { vouchers } = tables;
  const { page = 1, pageSize = 10, search = '', scope, restrictToBranchIds = null } = options;
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

  // Branch access filter
  if (restrictToBranchIds !== null && restrictToBranchIds !== undefined) {
    if (restrictToBranchIds.length === 0) {
      conditions.push(sql`1 = 0`);
    } else {
      conditions.push(sqlBranchIdsStaffAccessFilter(vouchers.branch_ids, restrictToBranchIds));
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
  
  const items = itemsRaw.map(({ applicable_user_ids: _unusedUserIds, deleted_by_staff, ...v }: any) => ({
    ...v,
    deleted_by_staff_name: deleted_by_staff?.fullname || null,
    applicable_ticket_package_ids: parseJsonArrayOutput(v.applicable_ticket_package_ids),
    branch_ids: parseJsonArrayOutput(v.branch_ids)
  }));
  const [countResult] = await anyDb.select({ count: count() }).from(vouchers).where(whereClause);
  return { status: 'success', items, total: countResult?.count || 0, page, pageSize };
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
  const voucher = await anyDb.query.vouchers.findFirst({ where: eq(tables.vouchers.id, id) });
  if (!voucher) return null;

  // Check branch access
  if (restrictToBranchIds !== null && restrictToBranchIds !== undefined) {
    const hasAccess = staffCanAccessBranchIds(voucher.branch_ids, restrictToBranchIds, false);
    if (!hasAccess) return null;
  }

  const meta = parseVoucherMetadata(voucher.description);

  const [redemptionCountRes] = await anyDb
    .select({ count: count() })
    .from(tables.voucher_redemption_logs)
    .where(eq(tables.voucher_redemption_logs.voucher_id, id));

  const redemptionRows = await anyDb.query.voucher_redemption_logs.findMany({
    where: eq(tables.voucher_redemption_logs.voucher_id, id),
    // The booking code is what staff know a booking by (the numeric id stays out of the screen)
    with: { booking: { columns: { booking_code: true } } },
    orderBy: [desc(tables.voucher_redemption_logs.redeemed_at)],
    limit: clampRedemptionLimit(redemptionLimit)
  });
  const recent_redemptions = redemptionRows.map(({ booking, ...row }: any) => ({
    ...row,
    booking_code: booking?.booking_code || null
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

  const { applicable_user_ids: _unusedUserIds, ...voucherFields } = voucher;
  return {
    ...voucherFields,
    note: meta.note,
    sale_staff_id: meta.sale_staff_id,
    sale_name: meta.sale_name,
    sale_email: meta.sale_email,
    redemption_total_count: redemptionCountRes?.count || 0,
    recent_redemptions,
    created_by_staff_name: createLog?.staffFullname || null,
    updated_by_staff_name: updateLog?.staffFullname || null,
    applicable_ticket_package_ids: parseJsonArrayOutput(voucher.applicable_ticket_package_ids),
    branch_ids: parseJsonArrayOutput(voucher.branch_ids)
  };
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
    applicable_ticket_package_ids?: any;
    branch_ids?: any;
  },
  staffInfo?: { id: number; email: string; fullname: string },
  restrictToBranchIds?: number[] | null
) {
  const cleanCode = (args.code || '').trim().toUpperCase();
  if (!cleanCode) throw Object.assign(new Error('Mã voucher không được trống'), { statusCode: 400 });
  validateVoucherFields({ ...args, scope: args.scope || 'all' });
  const dValue = Number(args.discount_value);
  const branchIdsToSave = checkVoucherBranches(args.branch_ids, restrictToBranchIds, { required: true });

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
    applicable_ticket_package_ids:
      (args.scope || 'all') === 'all' ? null : parseJsonArrayNullable(args.applicable_ticket_package_ids),
    branch_ids: branchIdsToSave === undefined || branchIdsToSave === null ? null : JSON.stringify(branchIdsToSave),
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

    const auditNew = buildAuditPayload(voucher);
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
    return { voucher };
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
    applicable_ticket_package_ids?: any;
    branch_ids?: any;
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

  // Check branch access
  if (restrictToBranchIds !== null && restrictToBranchIds !== undefined) {
    const hasAccess = staffCanModifyBranchRecord(existing.branch_ids, restrictToBranchIds, false);
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
  const branchIdsToSave = checkVoucherBranches(args.branch_ids, restrictToBranchIds, { required: false });

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
  const targetScope = args.scope !== undefined ? args.scope : existing.scope;
  if (targetScope === 'all') {
    data.applicable_ticket_package_ids = null;
  } else {
    if (args.applicable_ticket_package_ids !== undefined)
      data.applicable_ticket_package_ids = parseJsonArrayNullable(args.applicable_ticket_package_ids);
  }
  if (branchIdsToSave !== undefined) data.branch_ids = branchIdsToSave === null ? null : JSON.stringify(branchIdsToSave);

  const updatedRes = await anyDb.update(tables.vouchers).set(data).where(eq(tables.vouchers.id, id)).returning();
  let updatedVoucher: any = Array.isArray(updatedRes) ? updatedRes[0] : updatedRes;
  if (!updatedVoucher) {
    updatedVoucher = await anyDb.query.vouchers.findFirst({ where: eq(tables.vouchers.id, id) });
  }

  const auditOld = buildAuditPayload(existing);
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
    const hasAccess = staffCanModifyBranchRecord(existing.branch_ids, restrictToBranchIds, false);
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
    const hasAccess = staffCanModifyBranchRecord(existing.branch_ids, restrictToBranchIds, false);
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
    const hasAccess = staffCanModifyBranchRecord(existing.branch_ids, restrictToBranchIds, false);
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
