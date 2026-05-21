import { eq, and, or, gte, lte, inArray, desc, asc, sum, count, sql } from 'drizzle-orm';
import { formatDateForDb } from '../../../server/lib/date-utils';

export async function getRevenueImpl(
        anyDb: any,
        tables: { bookings: any },
        args: { from?: string; to?: string; status?: string }
) {
        const from = args.from ? new Date(args.from) : undefined;
        const to = args.to ? new Date(args.to) : undefined;
        const status = String(args.status || 'paid').toLowerCase();
        const whereCondition = status === 'all' ? undefined : inArray(tables.bookings.payment_status, ['paid']);
        let dateCondition = undefined as any;
        if (from && to) {
                dateCondition = or(
                        and(
                                gte(tables.bookings.paid_at, formatDateForDb(from)),
                                lte(tables.bookings.paid_at, formatDateForDb(to))
                        ),
                        and(
                                gte(tables.bookings.created_at, formatDateForDb(from)),
                                lte(tables.bookings.created_at, formatDateForDb(to))
                        )
                );
        } else if (from) {
                dateCondition = or(
                        gte(tables.bookings.paid_at, formatDateForDb(from)),
                        gte(tables.bookings.created_at, formatDateForDb(from))
                );
        } else if (to) {
                dateCondition = or(
                        lte(tables.bookings.paid_at, formatDateForDb(to)),
                        lte(tables.bookings.created_at, formatDateForDb(to))
                );
        }
        const finalWhere = and(whereCondition, dateCondition);
        const [agg] = await anyDb
                .select({ total: sum(tables.bookings.total_price), count: count() })
                .from(tables.bookings)
                .where(finalWhere);
        const total = Number(agg?.total || 0);
        const countVal = agg?.count || 0;
        return { total, count: countVal };
}

export async function listTransactionsImpl(
        anyDb: any,
        tables: {
                bookings: any;
                users: any;
                accounts: any;
                movies: any;
                ticket_packages: any;
        },
        args: {
                page: number;
                pageSize: number;
                searchText: string;
                status: string;
                sort: string;
                dir: 'asc' | 'desc';
                payment_method: string;
                from?: string;
                to?: string;
        }
) {
        const { page, pageSize, searchText, status, sort, dir, payment_method, from, to } = args;
        const skip = (page - 1) * pageSize;
        const whereCondition: any[] = [];

        // Filter theo status
        if (status && status !== 'all') whereCondition.push(eq(tables.bookings.payment_status, status));

        // Filter theo phương thức thanh toán
        if (payment_method) whereCondition.push(eq(tables.bookings.payment_method, payment_method));

        // Filter theo khoảng thời gian
        if (from || to) {
                const f = from ? new Date(from) : undefined;
                const t = to ? new Date(to) : undefined;
                const createdField = tables.bookings.created_at;
                const paidField = tables.bookings.paid_at;

                if (f && t) {
                        whereCondition.push(
                                or(
                                        and(gte(createdField, formatDateForDb(f)), lte(createdField, formatDateForDb(t))),
                                        and(gte(paidField, formatDateForDb(f)), lte(paidField, formatDateForDb(t)))
                                )
                        );
                } else if (f) {
                        whereCondition.push(
                                or(gte(createdField, formatDateForDb(f)), gte(paidField, formatDateForDb(f)))
                        );
                } else if (t) {
                        whereCondition.push(
                                or(lte(createdField, formatDateForDb(t)), lte(paidField, formatDateForDb(t)))
                        );
                }
        }

        // --- CẬP NHẬT PHẦN SEARCH TẠI ĐÂY ---
        if (searchText) {
                const isNumber = /^\d+$/.test(searchText); // Kiểm tra nếu chỉ toàn là số
                const lowerSearchText = searchText.toLowerCase(); // Chuyển về lowercase

                if (isNumber) {
                        // Nếu là số: CHỈ tìm đích danh theo ID của booking
                        whereCondition.push(eq(tables.bookings.id, Number(searchText)));
                } else {
                        // Nếu có chứa ký tự chữ: Tìm theo Email, Booking Code, Pay Txt Code
                        // Sử dụng LOWER() để tương thích với cả PostgreSQL và SQLite/D1
                        whereCondition.push(
                                or(
                                        sql`LOWER(${tables.bookings.email}) LIKE ${`%${lowerSearchText}%`}`,
                                        sql`LOWER(${tables.bookings.booking_code}) LIKE ${`%${lowerSearchText}%`}`,
                                        sql`LOWER(${tables.bookings.pay_txt_code}) LIKE ${`%${lowerSearchText}%`}`
                                )
                        );
                }
        }
        // ------------------------------------

        const finalWhere = and(...whereCondition);

        // Query đếm tổng số bản ghi
        const [totalRes] = await anyDb.select({ count: count() }).from(tables.bookings).where(finalWhere);

        const total = totalRes?.count || 0;

        // Query lấy dữ liệu chi tiết
        const itemsRaw = await anyDb
                .select({
                        booking: tables.bookings,
                        user: tables.users,
                        account_email: tables.accounts.email,
                        movie_title: tables.movies.title,
                        ticket_package_name: tables.ticket_packages.name
                })
                .from(tables.bookings)
                .leftJoin(tables.users, eq(tables.bookings.user_id, tables.users.id))
                .leftJoin(tables.accounts, eq(tables.users.id, tables.accounts.user_id))
                .leftJoin(tables.movies, eq(tables.bookings.movie_id, tables.movies.id))
                .leftJoin(tables.ticket_packages, eq(tables.bookings.ticket_package_id, tables.ticket_packages.id))
                .where(finalWhere)
                .orderBy(
                        sort === 'paid_at'
                                ? dir === 'asc'
                                        ? asc(tables.bookings.paid_at)
                                        : desc(tables.bookings.paid_at)
                                : dir === 'asc'
                                        ? asc(tables.bookings.created_at)
                                        : desc(tables.bookings.created_at)
                )
                .limit(pageSize)
                .offset(skip);

        const items = itemsRaw.map((row: any) => {
                const tx = row.booking;
                const now = new Date();
                const expiryAt = tx.expiry_date ? new Date(tx.expiry_date) : null;
                const expired = Boolean(expiryAt && now.getTime() > expiryAt.getTime());
                const daysLeft = expiryAt ? Math.ceil((expiryAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;

                return {
                        id: tx.id,
                        bookingId: tx.id,
                        user_id: tx.user_id,
                        email: tx.email || '', // Ưu tiên email trong booking
                        phone: tx.phone || '',
                        name: tx.name || row.user?.fullname || '',
                        userName: row.user?.fullname || 'Khách Vãng Lai',
                        ticket_package_name: tx.ticket_package_name || '',
                        ticketCount: tx.ticket_count,
                        is_used: tx.is_used,
                        totalPrice: Number(tx.total_price),
                        paymentMethod: tx.payment_method,
                        paymentStatus: tx.payment_status,
                        transactionId: tx.transaction_id,
                        createdAt: tx.created_at,
                        paidAt: tx.paid_at,
                        updatedAt: tx.updated_at,
                        expiryDate: tx.expiry_date || null,
                        expired,
                        daysLeft
                };
        });

        return { items, page, pageSize, total };
}

export async function getTransactionByIdImpl(
        anyDb: any,
        tables: {
                bookings: any;
                users: any;
                accounts: any;
                movies: any;
                ticket_packages: any;
        },
        id: number
) {
        // 1. CHỈNH SỬA TRUY VẤN JOIN
        const rows = await anyDb
                .select({
                        booking: tables.bookings,
                        user: tables.users,
                        account: tables.accounts,
                        movie: tables.movies,
                        ticket_package: tables.ticket_packages
                })
                .from(tables.bookings)
                .leftJoin(tables.users, eq(tables.bookings.user_id, tables.users.id))
                .leftJoin(tables.accounts, eq(tables.users.id, tables.accounts.user_id))
                .leftJoin(tables.movies, eq(tables.bookings.movie_id, tables.movies.id))
                .leftJoin(tables.ticket_packages, eq(tables.bookings.ticket_package_id, tables.ticket_packages.id))
                .where(eq(tables.bookings.id, id));

        // Kiểm tra nếu không có kết quả
        if (!rows || rows.length === 0) return null;

        const { booking, user, account, movie, ticket_package } = rows[0];

        // 2. TÍNH TOÁN THỜI GIAN VÀ TRẠNG THÁI
        const now = new Date();
        const expiryAt = booking.expiry_date ? new Date(booking.expiry_date) : null;
        const expired = Boolean(expiryAt && now.getTime() > expiryAt.getTime());
        const daysLeft = expiryAt ? Math.ceil((expiryAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;

        // 3. XỬ LÝ COMBO PHIM
        let comboMovies = [];
        if (booking.combo) {
                try {
                        let movieIds: any[] = [];
                        if (Array.isArray(booking.combo)) {
                                movieIds = booking.combo;
                        } else if (typeof booking.combo === 'string') {
                                // Handle old format: "1|2|3" or JSON array
                                if (booking.combo.includes('|')) {
                                        movieIds = booking.combo.split('|').map((x: string) => x.trim()).filter(Boolean);
                                } else {
                                        movieIds = JSON.parse(booking.combo);
                                }
                        }
                        if (Array.isArray(movieIds) && movieIds.length > 0) {
                                comboMovies = await anyDb.select().from(tables.movies).where(inArray(tables.movies.id, movieIds));
                        }
                } catch (e) {
                        console.error('Lỗi parse combo:', e);
                }
        }

        // 4. MAPPING DỮ LIỆU ĐỂ HIỂN THỊ TRÊN GIAO DIỆN KIỂM SOÁT
        return {
                id: booking.id,
                user: {
                        email_auth: account?.email || '',
                        fullname: booking.name || 'Tên mặc định',
                        email: booking.email || '',
                        phone: booking.phone || '',
                        is_active: account?.is_active ?? true
                },
                ticket_package: {
                        name: ticket_package.name,
                        ticket_unit_price: booking.ticket_unit_price,
                        movies: comboMovies
                },
                booking_details: {
                        ticket_count: booking.ticket_count,
                        total_price: Number(booking.total_price),
                        combo: booking?.combo ? (Array.isArray(booking.combo) ? booking.combo : (() => {
                                try {
                                        if (typeof booking.combo === 'string' && booking.combo.includes('|')) {
                                                return booking.combo.split('|').map((x: string) => x.trim()).filter(Boolean);
                                        }
                                        return typeof booking.combo === 'string' ? JSON.parse(booking.combo) : [];
                                } catch { return []; }
                        })()) : [],
                        pay_txt_code: booking?.pay_txt_code,
                        booking_code: booking?.booking_code,
                        checked_in_at: booking?.checked_in_at,
                        is_used: booking?.is_used,
                        created_at: booking.created_at,
                        updated_at: booking.updated_at
                },
                payment_info: {
                        payment_method: booking.payment_method,
                        payment_status: booking.payment_status,
                        transaction_id: booking.transaction_id,
                        paid_at: booking.paid_at,
                        expiry_date: booking.expiry_date,
                        expired,
                        days_left: daysLeft
                }
        };
}
