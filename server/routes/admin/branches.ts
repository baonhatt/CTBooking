import { eq, desc, asc, count, and, or, sql, isNull, isNotNull, like } from 'drizzle-orm';
import { formatDateForDb } from '../../lib/date-utils';
import { logAuditAction } from '../../lib/audit-logger';

export async function listBranchesImpl(
        anyDb: any,
        tables: { branches: any; movies: any; ticket_packages: any; bookings: any },
        args: { page: number; pageSize: number; q: string; includeInactive?: boolean }
) {
        const { page, pageSize, q, includeInactive = false } = args;

        let whereCondition = includeInactive ? undefined : and(eq(tables.branches.is_active, true), isNull(tables.branches.deleted_at));

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

        const itemsWithStats = await Promise.all(
                branches.map(async (branch: any) => {
                        const [movieCount] = await anyDb
                                .select({ count: count() })
                                .from(tables.movies)
                                .where(and(eq(tables.movies.branch_id, branch.id), eq(tables.movies.is_active, true), isNull(tables.movies.deleted_at)));

                        const [packageCount] = await anyDb
                                .select({ count: count() })
                                .from(tables.ticket_packages)
                                .where(and(eq(tables.ticket_packages.branch_id, branch.id), eq(tables.ticket_packages.is_active, true), isNull(tables.ticket_packages.deleted_at)));

                        const [bookingCount] = await anyDb
                                .select({ count: count() })
                                .from(tables.bookings)
                                .where(eq(tables.bookings.branch_id, branch.id));

                        return {
                                ...branch,
                                movie_count: movieCount?.count || 0,
                                package_count: packageCount?.count || 0,
                                booking_count: bookingCount?.count || 0
                        };
                })
        );

        return {
                items: itemsWithStats,
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize)
        };
}

export async function getBranchImpl(anyDb: any, tables: { branches: any; auditLogs: any }, id: number) {
        const [item] = await anyDb.select().from(tables.branches).where(eq(tables.branches.id, id)).limit(1);
        if (!item) return null;

        // Get tracking data from audit logs
        const [createLog] = await anyDb
                .select()
                .from(tables.auditLogs)
                .where(and(eq(tables.auditLogs.entityType, 'branch'), eq(tables.auditLogs.entityId, String(id)), eq(tables.auditLogs.action, 'create')))
                .orderBy(tables.auditLogs.createdAt)
                .limit(1);

        const [updateLog] = await anyDb
                .select()
                .from(tables.auditLogs)
                .where(and(eq(tables.auditLogs.entityType, 'branch'), eq(tables.auditLogs.entityId, String(id)), eq(tables.auditLogs.action, 'update')))
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
                .where(and(eq(tables.branches.is_default, true), eq(tables.branches.is_active, true), isNull(tables.branches.deleted_at)))
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
        },
        staffInfo?: { id: number; email: string; fullname: string }
) {
        const { name, code, address, phone, email, is_default, is_active } = args;
        const now = new Date();

        if (is_default) {
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
                        is_default: is_default || false,
                        is_active: is_active ?? true,
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
        tables: { branches: any; auditLogs: any },
        id: number,
        args: {
                name?: string;
                code?: string;
                address?: string;
                phone?: string;
                email?: string;
                is_default?: boolean;
                is_active?: boolean;
        },
        staffInfo?: { id: number; email: string; fullname: string }
) {
        const { name, code, address, phone, email, is_default, is_active } = args;
        const now = new Date();
        const data: any = { updated_at: formatDateForDb(now) };

        if (name !== undefined) data.name = name;
        if (code !== undefined) data.code = code;
        if (address !== undefined) data.address = address;
        if (phone !== undefined) data.phone = phone;
        if (email !== undefined) data.email = email;
        if (is_active !== undefined) data.is_active = is_active;

        if (is_default !== undefined && is_default === true) {
                await anyDb
                        .update(tables.branches)
                        .set({ is_default: false, updated_at: formatDateForDb(now) })
                        .where(and(eq(tables.branches.is_default, true), eq(tables.branches.id, id)));
                data.is_default = true;
        }

        const updatedRes = await anyDb.update(tables.branches).set(data).where(eq(tables.branches.id, id)).returning();

        const item = Array.isArray(updatedRes) ? updatedRes[0] : updatedRes;
        if (!item) return null;

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
                        staffInfo.fullname
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
                .where(and(eq(tables.ticket_packages.branch_id, id), eq(tables.ticket_packages.is_active, true), isNull(tables.ticket_packages.deleted_at)));

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

        // Soft delete by setting is_active = false and deleted_at
        await anyDb.update(tables.branches).set({ is_active: false, deleted_at: new Date().toISOString(), deleted_by_staff_id: staffInfo?.id }).where(eq(tables.branches.id, id));

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
                        staffInfo.fullname
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
                        staffInfo.fullname
                );
        }

        return { ok: true };
}

export async function listDeletedBranchesImpl(
        anyDb: any,
        tables: { branches: any; staffs: any },
        options: { page?: number; pageSize?: number; search?: string } = {}
) {
        const { branches, staffs } = tables;
        const { page = 1, pageSize = 10, search = '' } = options;

        const conditions = [];
        if (search) {
                conditions.push(like(branches.name, `%${search}%`));
        }
        conditions.push(isNotNull(branches.deleted_at));

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
                        is_active: branches.is_active,
                        created_at: branches.created_at,
                        updated_at: branches.updated_at,
                        deleted_at: branches.deleted_at,
                        deleted_by_staff_id: branches.deleted_by_staff_id,
                        deleted_by_staff_name: staffs.fullname
                })
                .from(branches)
                .leftJoin(staffs, eq(branches.deleted_by_staff_id, staffs.id))
                .where(whereClause)
                .limit(pageSize)
                .offset((page - 1) * pageSize)
                .orderBy(desc(branches.deleted_at));

        const [countResult] = await anyDb
                .select({ count: count() })
                .from(branches)
                .where(whereClause);

        return {
                status: 'success',
                items,
                total: countResult?.count || 0,
                page,
                pageSize
        };
}
