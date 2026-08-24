import { eq, desc, or, count, and, isNull, isNotNull, like, sql, sum, inArray } from 'drizzle-orm';
import { formatDateForDb } from '../../lib/date-utils';
import { logAuditAction } from '../../lib/audit-logger';
import { buildAuditPayload } from '../../lib/audit-utils';
import { sqlBranchIdsStaffAccessFilter, staffCanAccessBranchIds } from '../../lib/branch-ids';

function parseJsonArrayNullable(value: any): string | null | undefined {
        if (value === undefined) return undefined;
        if (value === null) return null;
        if (Array.isArray(value)) return JSON.stringify(value);
        if (typeof value === 'string') return value;
        return undefined;
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
        } catch { }
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

export async function listVouchersImpl(
        anyDb: any,
        tables: { vouchers: any; voucher_redemption_logs?: any },
        args: { page: number; pageSize: number; q: string; scope?: string; is_active?: string; sale_staff_id?: string | number; restrictToBranchIds?: number[] | null }
) {
        const { page, pageSize, q, scope, is_active, sale_staff_id, restrictToBranchIds = null } = args;
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
                conditions.push(sql`${tables.vouchers.description} LIKE ${`%"sale_staff_id":${targetStaffId}%`} OR ${tables.vouchers.description} LIKE ${`%"sale_staff_id": ${targetStaffId}%`}`);
        }

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
                orderBy: [desc(tables.vouchers.created_at)],
                limit: pageSize,
                offset: (page - 1) * pageSize
        });

        // Get revenue stats per voucher from voucher_redemption_logs if table available
        const items = await Promise.all(
                rawItems.map(async (v: any) => {
                        const meta = parseVoucherMetadata(v.description);
                        let total_revenue = 0;
                        let redemptions_count = v.used_count || 0;

                        if (tables.voucher_redemption_logs) {
                                try {
                                        const [stats] = await anyDb
                                                .select({
                                                        total_revenue: sum(tables.voucher_redemption_logs.order_total_after_discount),
                                                        total_count: count()
                                                })
                                                .from(tables.voucher_redemption_logs)
                                                .where(eq(tables.voucher_redemption_logs.voucher_id, v.id));
                                        if (stats) {
                                                total_revenue = Number(stats.total_revenue || 0);
                                                if (Number(stats.total_count || 0) > redemptions_count) {
                                                        redemptions_count = Number(stats.total_count);
                                                }
                                        }
                                } catch { }
                        }

                        return {
                                ...v,
                                note: meta.note,
                                sale_staff_id: meta.sale_staff_id,
                                sale_name: meta.sale_name,
                                sale_email: meta.sale_email,
                                total_revenue,
                                used_count: redemptions_count
                        };
                })
        );

        return { items, page, pageSize, total };
}

export async function listDeletedVouchersImpl(
        anyDb: any,
        tables: { vouchers: any },
        options: { page?: number; pageSize?: number; search?: string; restrictToBranchIds?: number[] | null } = {}
) {
        const { vouchers } = tables;
        const { page = 1, pageSize = 10, search = '', restrictToBranchIds = null } = options;
        const conditions = [] as any[];
        if (search) {
                const lowerQ = search.toLowerCase();
                conditions.push(
                        or(
                                sql`LOWER(${vouchers.code}) LIKE ${`%${lowerQ}%`}`,
                                sql`LOWER(${vouchers.name}) LIKE ${`%${lowerQ}%`}`
                        )
                );
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
        const items = await anyDb.query.vouchers.findMany({
                where: whereClause,
                orderBy: [desc(vouchers.deleted_at)],
                limit: pageSize,
                offset: (page - 1) * pageSize
        });
        const [countResult] = await anyDb.select({ count: count() }).from(vouchers).where(whereClause);
        return { status: 'success', items, total: countResult?.count || 0, page, pageSize };
}

export async function getVoucherImpl(
        anyDb: any,
        tables: { vouchers: any; auditLogs: any; voucher_redemption_logs: any },
        id: number,
        restrictToBranchIds?: number[] | null
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

        const recent_redemptions = await anyDb.query.voucher_redemption_logs.findMany({
                where: eq(tables.voucher_redemption_logs.voucher_id, id),
                orderBy: [desc(tables.voucher_redemption_logs.redeemed_at)],
                limit: 20
        });

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

        return {
                ...voucher,
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
                max_discount?: number;
                usage_limit?: number;
                per_user_limit?: number;
                is_active?: boolean;
                valid_from?: string;
                valid_until?: string;
                applicable_ticket_package_ids?: any;
                applicable_user_ids?: any;
                excluded_ticket_package_ids?: any;
                branch_ids?: any;
        },
        staffInfo?: { id: number; email: string; fullname: string }
) {
        const cleanCode = (args.code || '').trim().toUpperCase();
        if (!cleanCode) throw new Error('Mã voucher không được trống');
        if (!args.discount_type) throw new Error('Thiếu loại giảm giá');
        const dValue = Number(args.discount_value);
        if (!dValue || dValue <= 0) throw new Error('Giá trị giảm giá không hợp lệ');
        if (args.discount_type === 'percent' && dValue > 100) throw new Error('Phần trăm giảm không được vượt quá 100%');

        const formattedDesc = formatVoucherDescription(
                args.note || args.description,
                {
                        staff_id: args.sale_staff_id,
                        name: args.sale_name,
                        email: args.sale_email
                }
        );

        const nowIso = new Date();
        const payload: any = {
                code: cleanCode,
                name: args.name,
                description: formattedDesc,
                scope: args.scope || 'all',
                discount_type: args.discount_type,
                discount_value: String(dValue),
                min_order_value: String(Number(args.min_order_value ?? 0)),
                max_discount: args.max_discount !== undefined ? String(Number(args.max_discount)) : null,
                usage_limit: args.usage_limit !== undefined && args.usage_limit !== null ? Number(args.usage_limit) : null,
                per_user_limit: args.per_user_limit !== undefined && args.per_user_limit !== null ? Number(args.per_user_limit) : 1,
                is_active: args.is_active !== undefined ? (args.is_active ? 1 : 0) : 1,
                valid_from: args.valid_from || null,
                valid_until: args.valid_until || null,
                applicable_ticket_package_ids: (args.scope || 'all') === 'all' ? null : parseJsonArrayNullable(args.applicable_ticket_package_ids),
                applicable_user_ids: parseJsonArrayNullable(args.applicable_user_ids),
                excluded_ticket_package_ids: (args.scope || 'all') === 'all' ? null : parseJsonArrayNullable(args.excluded_ticket_package_ids),
                branch_ids: parseJsonArrayNullable(args.branch_ids),
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
                if (String(err.message || err).toLowerCase().includes('unique') || String(err.message || err).includes('UNIQUE')) {
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
                max_discount?: number;
                usage_limit?: number;
                per_user_limit?: number;
                is_active?: boolean;
                valid_from?: string;
                valid_until?: string;
                applicable_ticket_package_ids?: any;
                applicable_user_ids?: any;
                excluded_ticket_package_ids?: any;
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
                const hasAccess = staffCanAccessBranchIds(existing.branch_ids, restrictToBranchIds, false);
                if (!hasAccess) {
                        const err: any = new Error('Không có quyền chỉnh sửa voucher này');
                        err.statusCode = 403;
                        throw err;
                }
        }

        const existingMeta = parseVoucherMetadata(existing.description);
        const targetSaleStaffId = args.sale_staff_id !== undefined ? args.sale_staff_id : existingMeta.sale_staff_id;
        const targetSaleName = args.sale_name !== undefined ? args.sale_name : existingMeta.sale_name;
        const targetSaleEmail = args.sale_email !== undefined ? args.sale_email : existingMeta.sale_email;
        const targetNote = args.note !== undefined ? args.note : (args.description !== undefined ? args.description : existingMeta.note);

        const formattedDesc = formatVoucherDescription(
                targetNote,
                {
                        staff_id: targetSaleStaffId,
                        name: targetSaleName,
                        email: targetSaleEmail
                }
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
                data.max_discount = args.max_discount !== null ? String(Number(args.max_discount)) : null;
        if (args.usage_limit !== undefined)
                data.usage_limit = args.usage_limit !== null ? Number(args.usage_limit) : null;
        if (args.per_user_limit !== undefined)
                data.per_user_limit = args.per_user_limit !== null ? Number(args.per_user_limit) : null;
        if (args.is_active !== undefined) data.is_active = args.is_active ? 1 : 0;
        if (args.valid_from !== undefined) data.valid_from = args.valid_from || null;
        if (args.valid_until !== undefined) data.valid_until = args.valid_until || null;
        const targetScope = args.scope !== undefined ? args.scope : existing.scope;
        if (targetScope === 'all') {
                data.applicable_ticket_package_ids = null;
                data.excluded_ticket_package_ids = null;
        } else {
                if (args.applicable_ticket_package_ids !== undefined)
                        data.applicable_ticket_package_ids = parseJsonArrayNullable(args.applicable_ticket_package_ids);
                if (args.excluded_ticket_package_ids !== undefined)
                        data.excluded_ticket_package_ids = parseJsonArrayNullable(args.excluded_ticket_package_ids);
        }
        if (args.applicable_user_ids !== undefined) data.applicable_user_ids = parseJsonArrayNullable(args.applicable_user_ids);
        if (args.branch_ids !== undefined) data.branch_ids = parseJsonArrayNullable(args.branch_ids);

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
                const hasAccess = staffCanAccessBranchIds(existing.branch_ids, restrictToBranchIds, false);
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
                const hasAccess = staffCanAccessBranchIds(existing.branch_ids, restrictToBranchIds, false);
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
                const hasAccess = staffCanAccessBranchIds(existing.branch_ids, restrictToBranchIds, false);
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
