import { eq, desc, asc, count, and, or, sql } from 'drizzle-orm';
import { formatDateForDb } from '../../lib/date-utils';

export async function listBranchesImpl(
        anyDb: any,
        tables: { branches: any; movies: any; ticket_packages: any; bookings: any },
        args: { page: number; pageSize: number; q: string; includeInactive?: boolean }
) {
        const { page, pageSize, q, includeInactive = false } = args;

        let whereCondition = includeInactive ? undefined : eq(tables.branches.is_active, true);

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
                                .where(and(eq(tables.movies.branch_id, branch.id), eq(tables.movies.is_active, true)));

                        const [packageCount] = await anyDb
                                .select({ count: count() })
                                .from(tables.ticket_packages)
                                .where(and(eq(tables.ticket_packages.branch_id, branch.id), eq(tables.ticket_packages.is_active, true)));

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

export async function getBranchImpl(anyDb: any, tables: { branches: any }, id: number) {
        const [item] = await anyDb
                .select()
                .from(tables.branches)
                .where(eq(tables.branches.id, id))
                .limit(1);
        return item || null;
}

export async function getDefaultBranchImpl(anyDb: any, tables: { branches: any }) {
        const [item] = await anyDb
                .select()
                .from(tables.branches)
                .where(and(eq(tables.branches.is_default, true), eq(tables.branches.is_active, true)))
                .limit(1);
        return item || null;
}

export async function createBranchImpl(
        anyDb: any,
        tables: { branches: any },
        args: {
                name: string;
                code: string;
                address?: string;
                phone?: string;
                email?: string;
                is_default?: boolean;
                is_active?: boolean;
        }
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

        return { item };
}

export async function updateBranchImpl(
        anyDb: any,
        tables: { branches: any },
        id: number,
        args: {
                name?: string;
                code?: string;
                address?: string;
                phone?: string;
                email?: string;
                is_default?: boolean;
                is_active?: boolean;
        }
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

        const updatedRes = await anyDb
                .update(tables.branches)
                .set(data)
                .where(eq(tables.branches.id, id))
                .returning();

        const item = Array.isArray(updatedRes) ? updatedRes[0] : updatedRes;
        return item || null;
}

export async function deleteBranchImpl(
        anyDb: any,
        tables: { branches: any; movies: any; ticket_packages: any; bookings: any },
        id: number
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
                .where(and(eq(tables.movies.branch_id, id), eq(tables.movies.is_active, true)));

        if (activeMovies?.count > 0) {
                throw new Error(`Không thể xóa chi nhánh vì có ${activeMovies.count} phim đang hoạt động`);
        }

        const [activePackages] = await anyDb
                .select({ count: count() })
                .from(tables.ticket_packages)
                .where(and(eq(tables.ticket_packages.branch_id, id), eq(tables.ticket_packages.is_active, true)));

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

        await anyDb.delete(tables.branches).where(eq(tables.branches.id, id));

        return { ok: true };
}
