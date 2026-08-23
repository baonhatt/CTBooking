<<<<<<< HEAD
import { eq, desc, and, inArray, sql, or } from 'drizzle-orm';
import { formatDateForDb } from '../../lib/date-utils';

export async function createMovieImpl(
        anyDb: any,
        tables: { movies: any },
=======
import { eq, desc, and, inArray, sql, or, isNull, isNotNull, like, count } from 'drizzle-orm';
import { formatDateForDb } from '../../lib/date-utils';
import { logAuditAction } from '../../lib/audit-logger';
import { buildAuditPayload } from '../../lib/audit-utils';
import {
        enrichWithParsedBranchIds,
        enrichItemsWithParsedBranchIds,
        parseBranchIds,
        resolveBranchIdsInput,
        staffCanAccessBranchIds,
        sqlBranchIdsMatchFilter,
        sqlBranchIdsStaffAccessFilter
} from '../../lib/branch-ids';

export async function createMovieImpl(
        anyDb: any,
        tables: { movies: any; auditLogs: any },
>>>>>>> preview
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
<<<<<<< HEAD
        },
        config?: any,
        RUN_ENV?: any,
        uploader?: (base64: string, folder: string) => Promise<{ url: string }>
=======
                branch_id?: number | null;
                branch_ids?: number[] | null;
        },
        config?: any,
        RUN_ENV?: any,
        uploader?: (base64: string, folder: string) => Promise<{ url: string }>,
        staffInfo?: { id: number; email: string; fullname: string }
>>>>>>> preview
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
<<<<<<< HEAD
=======
        const branchFields = resolveBranchIdsInput(data.branch_ids, data.branch_id);
>>>>>>> preview
        const baseData: any = {
                title: data.title,
                description: data.description,
                cover_image: coverImageUrl,
                detail_images: Array.isArray(data.detail_images) ? JSON.stringify(data.detail_images) : data.detail_images,
                genres: Array.isArray(data.genres) ? JSON.stringify(data.genres) : data.genres,
                rating: data.rating ?? null,
                duration_min: data.duration_min,
<<<<<<< HEAD
=======
                branch_id: branchFields.branch_id ?? null,
                branch_ids: branchFields.branch_ids ?? null,
>>>>>>> preview
                is_active: data.is_active === undefined ? true : Boolean(data.is_active),
                release_date: data.release_date ? formatDateForDb(data.release_date) : null,
                created_at: formatDateForDb(now),
                updated_at: formatDateForDb(now)
        };
        try {
                const movieInsert = await anyDb.insert(tables.movies).values(baseData).returning();
                let movie: any = Array.isArray(movieInsert) ? movieInsert[0] : movieInsert;
                if (!movie) throw new Error('Không thể tạo phim');

                if (RUN_ENV && RUN_ENV.KV_BINDING) {
                        await RUN_ENV.KV_BINDING.delete('active_movies_v2');
                }

<<<<<<< HEAD
                return { movie };
=======
                const auditNew = buildAuditPayload(movie);

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

                return { movie: enrichWithParsedBranchIds(movie) };
>>>>>>> preview
        } catch (err: any) {
                throw err;
        }
}

export async function updateMovieImpl(
        anyDb: any,
<<<<<<< HEAD
        tables: { movies: any; ticket_packages: any },
=======
        tables: { movies: any; ticket_packages: any; auditLogs: any },
>>>>>>> preview
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
<<<<<<< HEAD
=======
                branch_id?: number | null;
                branch_ids?: number[] | null;
>>>>>>> preview
        },
        config?: any,
        RUN_ENV?: any,
        uploader?: (base64: string, folder: string) => Promise<{ url: string }>,
<<<<<<< HEAD
        deleter?: (url: string) => Promise<void>
=======
        deleter?: (url: string) => Promise<void>,
        staffInfo?: { id: number; email: string; fullname: string },
        restrictToBranchIds: number[] | null = null
>>>>>>> preview
) {
        if (config) {
                process.env = config;
        }
        const now = new Date();
        // Fetch old movie to check for image changes
        const oldMovie = await anyDb.query.movies.findFirst({
                where: eq(tables.movies.id, id)
        });
<<<<<<< HEAD
=======
        if (oldMovie && restrictToBranchIds && restrictToBranchIds.length > 0 && !staffCanAccessBranchIds(oldMovie.branch_ids, restrictToBranchIds, false)) {
                const err: any = new Error('Bạn không có quyền sửa phim thuộc chi nhánh khác');
                err.statusCode = 403;
                throw err;
        }
>>>>>>> preview
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
<<<<<<< HEAD
        if (data.detail_images !== undefined) payload.detail_images = Array.isArray(data.detail_images) ? JSON.stringify(data.detail_images) : data.detail_images;
        if (data.genres !== undefined) payload.genres = Array.isArray(data.genres) ? JSON.stringify(data.genres) : data.genres;
        if (data.rating !== undefined) payload.rating = data.rating ?? null;
        if (data.duration_min !== undefined) payload.duration_min = data.duration_min;
=======
        if (data.detail_images !== undefined)
                payload.detail_images = Array.isArray(data.detail_images) ? JSON.stringify(data.detail_images) : data.detail_images;
        if (data.genres !== undefined)
                payload.genres = Array.isArray(data.genres) ? JSON.stringify(data.genres) : data.genres;
        if (data.rating !== undefined) payload.rating = data.rating ?? null;
        if (data.duration_min !== undefined) payload.duration_min = data.duration_min;
        if (data.branch_ids !== undefined || data.branch_id !== undefined) {
                const branchFields = resolveBranchIdsInput(data.branch_ids, data.branch_id);
                if (branchFields.branch_ids !== undefined) payload.branch_ids = branchFields.branch_ids;
                if (branchFields.branch_id !== undefined) payload.branch_id = branchFields.branch_id;
        }
>>>>>>> preview
        if (data.is_active !== undefined) payload.is_active = data.is_active;
        if (data.release_date !== undefined) {
                payload.release_date = data.release_date ? formatDateForDb(data.release_date) : null;
        }
        if (data.is_active === false) {
                const searchId = String(id);
                const activePackages = await anyDb
                        .select({ name: tables.ticket_packages.name, combo: tables.ticket_packages.combo })
                        .from(tables.ticket_packages)
<<<<<<< HEAD
                        .where(eq(tables.ticket_packages.is_active, true));
=======
                        .where(and(eq(tables.ticket_packages.is_active, true), isNull(tables.ticket_packages.deleted_at)));
>>>>>>> preview

                const conflictPackages = activePackages.filter((p: any) => {
                        let comboArr: any[] = [];
                        try {
                                if (Array.isArray(p.combo)) {
                                        comboArr = p.combo;
                                } else if (typeof p.combo === 'string') {
                                        // Handle old format: "1|2|3" or JSON array
                                        if (p.combo.includes('|')) {
<<<<<<< HEAD
                                                comboArr = p.combo.split('|').map((x: string) => x.trim()).filter(Boolean);
=======
                                                comboArr = p.combo
                                                        .split('|')
                                                        .map((x: string) => x.trim())
                                                        .filter(Boolean);
>>>>>>> preview
                                        } else {
                                                comboArr = JSON.parse(p.combo);
                                        }
                                }
                        } catch (e) {
                                console.error('Error parsing combo for package check:', e);
                        }
                        return Array.isArray(comboArr) && comboArr.map(String).includes(searchId);
                });

                if (conflictPackages.length > 0) {
                        const packageNames = conflictPackages.map((p: any) => p.name).join(', ');
                        const conflictErr: any = new Error(`Không thể ẩn phim vì phim đang được sử dụng trong các gói: ${packageNames}`);
                        conflictErr.statusCode = 400;
                        throw conflictErr;
                }
        }
        try {
                const updated = await anyDb.update(tables.movies).set(payload).where(eq(tables.movies.id, id)).returning();

                let movie: any = Array.isArray(updated) ? updated[0] : updated;
                // Fallback: D1/SQLite sometimes returns empty array from .returning()
                if (!movie) {
                        movie = await anyDb.query.movies.findFirst({ where: eq(tables.movies.id, id) });
                }
                if (!movie) throw new Error('Không tìm thấy phim để cập nhật');

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
<<<<<<< HEAD
                return { movie };
=======

                const auditOld = buildAuditPayload(oldMovie);
                const auditNew = buildAuditPayload(movie);

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

                return { movie: enrichWithParsedBranchIds(movie) };
>>>>>>> preview
        } catch (err: any) {
                throw err;
        }
}

export async function deleteMovieImpl(
        anyDb: any,
<<<<<<< HEAD
        tables: { movies: any },
        id: number,
        RUN_ENV: any,
        deleter?: (url: string) => Promise<void>
=======
        tables: { movies: any; auditLogs: any; ticket_packages: any },
        id: number,
        RUN_ENV: any,
        deleter?: (url: string) => Promise<void>,
        staffInfo?: { id: number; email: string; fullname: string },
        restrictToBranchIds: number[] | null = null
>>>>>>> preview
) {
        // Check if movie exists before deleting
        const existing = await anyDb.query.movies.findFirst({
                where: eq(tables.movies.id, id)
        });

        if (!existing) return null;
<<<<<<< HEAD

        // Delete cover image
        if (existing.cover_image && deleter) {
                deleter(existing.cover_image).catch((e) => console.error('Failed to delete movie image:', e));
        }

        await anyDb.delete(tables.movies).where(eq(tables.movies.id, id));
=======
        if (restrictToBranchIds && restrictToBranchIds.length > 0 && !staffCanAccessBranchIds(existing.branch_ids, restrictToBranchIds, false)) {
                const err: any = new Error('Bạn không có quyền xóa phim thuộc chi nhánh khác');
                err.statusCode = 403;
                throw err;
        }

        // Check if movie is being used in active ticket packages
        const activePackages = await anyDb
                .select({ name: tables.ticket_packages.name, combo: tables.ticket_packages.combo })
                .from(tables.ticket_packages)
                .where(and(eq(tables.ticket_packages.is_active, true), isNull(tables.ticket_packages.deleted_at)));

        const conflictPackages = activePackages.filter((p: any) => {
                let comboArr: any[] = [];
                try {
                        if (Array.isArray(p.combo)) {
                                comboArr = p.combo;
                        } else if (typeof p.combo === 'string') {
                                if (p.combo.includes('|')) {
                                        comboArr = p.combo.split('|').map((id: string) => Number(id.trim()));
                                } else {
                                        comboArr = JSON.parse(p.combo);
                                }
                        }
                } catch (e) {
                        console.error('Error parsing combo:', e);
                }
                return comboArr.includes(Number(id));
        });

        if (conflictPackages.length > 0) {
                const packageNames = conflictPackages.map((p: any) => p.name).join(', ');
                const err: any = new Error(`Không thể xóa phim vì đang được sử dụng trong gói vé: ${packageNames}`);
                err.statusCode = 400;
                throw err;
        }

        // Soft delete by setting is_active = false and deleted_at
        await anyDb.update(tables.movies).set({ is_active: false, deleted_at: new Date().toISOString(), deleted_by_staff_id: staffInfo?.id }).where(eq(tables.movies.id, id));
>>>>>>> preview

        if (RUN_ENV && RUN_ENV.KV_BINDING) {
                await RUN_ENV.KV_BINDING.delete('active_movies_v2');
        }

<<<<<<< HEAD
        return { ok: true };
}

export async function updateMovieStatusImpl(
        anyDb: any,
        tables: { movies: any; ticket_packages: any },
        id: number,
        isActive: boolean,
        RUN_ENV?: any
=======
        const auditOld = buildAuditPayload(existing);
        const auditNew = buildAuditPayload({ ...existing, is_active: false, deleted_at: new Date().toISOString(), deleted_by_staff_id: staffInfo?.id });

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
        staffInfo?: { id: number; email: string; fullname: string }
) {
        const existing = await anyDb.query.movies.findFirst({
                where: eq(tables.movies.id, id)
        });

        if (!existing) {
                const err: any = new Error('Movie not found');
                err.statusCode = 404;
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
        options: { page?: number; pageSize?: number; search?: string; branch_id?: number | null; restrictToBranchIds?: number[] | null } = {}
) {
        const { movies, staffs } = tables;
        const { page = 1, pageSize = 10, search = '', branch_id, restrictToBranchIds = null } = options;

        const conditions = [];
        if (search) {
                conditions.push(like(movies.title, `%${search}%`));
        }
        if (branch_id) {
                conditions.push(sqlBranchIdsMatchFilter(movies.branch_ids, movies.branch_id, branch_id));
        }
        if (restrictToBranchIds && restrictToBranchIds.length > 0) {
                conditions.push(sqlBranchIdsStaffAccessFilter(movies.branch_ids, restrictToBranchIds));
        }
        conditions.push(isNotNull(movies.deleted_at));

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        const items = await anyDb
                .select({
                        id: movies.id,
                        title: movies.title,
                        description: movies.description,
                        cover_image: movies.cover_image,
                        genres: movies.genres,
                        rating: movies.rating,
                        duration_min: movies.duration_min,
                        branch_id: movies.branch_id,
                        branch_ids: movies.branch_ids,
                        created_at: movies.created_at,
                        updated_at: movies.updated_at,
                        is_active: movies.is_active,
                        release_date: movies.release_date,
                        deleted_at: movies.deleted_at,
                        deleted_by_staff_id: movies.deleted_by_staff_id,
                        deleted_by_staff_name: staffs.fullname
                })
                .from(movies)
                .leftJoin(staffs, eq(movies.deleted_by_staff_id, staffs.id))
                .where(whereClause)
                .limit(pageSize)
                .offset((page - 1) * pageSize)
                .orderBy(desc(movies.deleted_at));

        const [countResult] = await anyDb
                .select({ count: count() })
                .from(movies)
                .where(whereClause);

        return {
                status: 'success',
                items: enrichItemsWithParsedBranchIds(items),
                total: countResult?.count || 0,
                page,
                pageSize
        };
}

export async function updateMovieStatusImpl(
        anyDb: any,
        tables: { movies: any; ticket_packages: any; auditLogs: any },
        id: number,
        isActive: boolean,
        RUN_ENV?: any,
        restrictToBranchIds: number[] | null = null,
        staffInfo?: { id: number; email: string; fullname: string }
>>>>>>> preview
) {
        try {
                if (typeof isActive !== 'boolean') {
                        throw new Error('isActive must be a boolean');
                }
<<<<<<< HEAD
=======
                const existingMovie = await anyDb.query.movies.findFirst({
                        where: eq(tables.movies.id, id)
                });
                if (!existingMovie) {
                        throw new Error('Movie not found');
                }
                if (
                        restrictToBranchIds &&
                        restrictToBranchIds.length > 0 &&
                        !staffCanAccessBranchIds(existingMovie.branch_ids, restrictToBranchIds, false)
                ) {
                        const err: any = new Error('Bạn không có quyền thay đổi trạng thái phim thuộc chi nhánh khác');
                        err.statusCode = 403;
                        throw err;
                }
>>>>>>> preview
                if (isActive === false) {
                        const searchId = String(id);
                        const activePackages = await anyDb
                                .select({ name: tables.ticket_packages.name, combo: tables.ticket_packages.combo })
                                .from(tables.ticket_packages)
<<<<<<< HEAD
                                .where(eq(tables.ticket_packages.is_active, true));
=======
                                .where(and(eq(tables.ticket_packages.is_active, true), isNull(tables.ticket_packages.deleted_at)));
>>>>>>> preview

                        const conflictPackages = activePackages.filter((p: any) => {
                                let comboArr: any[] = [];
                                try {
                                        if (Array.isArray(p.combo)) {
                                                comboArr = p.combo;
                                        } else if (typeof p.combo === 'string') {
                                                // Handle old format: "1|2|3" or JSON array
                                                if (p.combo.includes('|')) {
<<<<<<< HEAD
                                                        comboArr = p.combo.split('|').map((x: string) => x.trim()).filter(Boolean);
=======
                                                        comboArr = p.combo
                                                                .split('|')
                                                                .map((x: string) => x.trim())
                                                                .filter(Boolean);
>>>>>>> preview
                                                } else {
                                                        comboArr = JSON.parse(p.combo);
                                                }
                                        }
                                } catch (e) {
                                        console.error('Error parsing combo for status check:', e);
                                }
                                return Array.isArray(comboArr) && comboArr.map(String).includes(searchId);
                        });

                        if (conflictPackages.length > 0) {
                                const packageNames = conflictPackages.map((p: any) => p.name).join(', ');
                                return {
                                        status: 400,
                                        message: `Không thể ẩn phim vì phim đang được sử dụng trong các gói: ${packageNames}`
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

<<<<<<< HEAD
=======
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

>>>>>>> preview
                return {
                        status: 200,
                        message: 'Đã thay đổi trạng thái thành công!',
                        item: updatedMovie
                };
        } catch (error) {
                console.error('Error updating movie status:', error);
                throw error;
        } finally {
                if (RUN_ENV && RUN_ENV.KV_BINDING) {
                        await RUN_ENV.KV_BINDING.delete('active_movies_v2');
                }
        }
}

export async function getMovieByIdImpl(
        anyDb: any,
<<<<<<< HEAD
        tables: { movies: any; bookings: any; ticket_packages: any },
        movieId: number
=======
        tables: { movies: any; bookings: any; ticket_packages: any; auditLogs: any },
        movieId: number,
        restrictToBranchIds: number[] | null = null
>>>>>>> preview
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

<<<<<<< HEAD
        const movie = await anyDb.query.movies.findFirst({
                where: eq(tables.movies.id, movieId)
=======
        const movieWhere =
                restrictToBranchIds && restrictToBranchIds.length > 0
                        ? and(
                                  eq(tables.movies.id, movieId),
                                  sqlBranchIdsStaffAccessFilter(tables.movies.branch_ids, restrictToBranchIds)
                          )
                        : eq(tables.movies.id, movieId);
        const movie = await anyDb.query.movies.findFirst({
                where: movieWhere,
                with: {
                        branch: true
                }
>>>>>>> preview
        });
        if (!movie) return null;

        const paid = await anyDb.query.bookings.findMany({
                where: and(eq(tables.bookings.movie_id, movieId), inArray(tables.bookings.payment_status, ['paid'])),
                columns: { ticket_count: true, total_price: true }
        });

        const totalTicketsSold = (paid || []).reduce(
                (sum: number, booking: any) => sum + (Number(booking.ticket_count) || 0),
                0
        );
        const totalRevenue = (paid || []).reduce((sum: number, booking: any) => sum + Number(booking.total_price || 0), 0);
        const successfulBookings = (paid || []).length;

        // Lấy các gói vé có chứa phim này
        const searchId = String(movieId);
        const activePackages = await anyDb
                .select({
                        id: tables.ticket_packages.id,
                        name: tables.ticket_packages.name,
                        combo: tables.ticket_packages.combo,
                        price: tables.ticket_packages.price,
                        is_active: tables.ticket_packages.is_active,
                        type: tables.ticket_packages.type,
                        description: tables.ticket_packages.description,
                        features: tables.ticket_packages.features
                })
                .from(tables.ticket_packages)
<<<<<<< HEAD
                .where(eq(tables.ticket_packages.is_active, true));
=======
                .where(
                        restrictToBranchIds && restrictToBranchIds.length > 0
                                ? and(
                                          eq(tables.ticket_packages.is_active, true),
                                          isNull(tables.ticket_packages.deleted_at),
                                          sqlBranchIdsStaffAccessFilter(tables.ticket_packages.branch_ids, restrictToBranchIds)
                                  )
                                : and(eq(tables.ticket_packages.is_active, true), isNull(tables.ticket_packages.deleted_at))
                );
>>>>>>> preview

        const applicablePackages = activePackages.filter((p: any) => {
                let comboArr: any[] = [];
                try {
                        if (Array.isArray(p.combo)) {
                                comboArr = p.combo;
                        } else if (typeof p.combo === 'string') {
                                // Handle old format: "1|2|3" or JSON array
                                if (p.combo.includes('|')) {
<<<<<<< HEAD
                                        comboArr = p.combo.split('|').map((x: string) => x.trim()).filter(Boolean);
=======
                                        comboArr = p.combo
                                                .split('|')
                                                .map((x: string) => x.trim())
                                                .filter(Boolean);
>>>>>>> preview
                                } else {
                                        comboArr = JSON.parse(p.combo);
                                }
                        }
                } catch (e) {
                        console.error('Error parsing combo for detail view:', e);
                }
                return Array.isArray(comboArr) && comboArr.map(String).includes(searchId);
        });

<<<<<<< HEAD
=======
        // Get tracking data from audit logs
        const [createLog] = await anyDb
                .select()
                .from(tables.auditLogs)
                .where(and(eq(tables.auditLogs.entityType, 'movie'), eq(tables.auditLogs.entityId, String(movieId)), eq(tables.auditLogs.action, 'create')))
                .orderBy(tables.auditLogs.createdAt)
                .limit(1);

        const [updateLog] = await anyDb
                .select()
                .from(tables.auditLogs)
                .where(and(eq(tables.auditLogs.entityType, 'movie'), eq(tables.auditLogs.entityId, String(movieId)), eq(tables.auditLogs.action, 'update')))
                .orderBy(desc(tables.auditLogs.createdAt))
                .limit(1);

>>>>>>> preview
        return {
                id: movie.id,
                title: movie.title,
                description: movie.description || 'Không có mô tả',
                cover_image: movie.cover_image,
                genres: safeParseJson(movie.genres),
                rating: Number(movie.rating || 0),
                duration_min: movie.duration_min || 0,
                is_active: movie.is_active,
                release_date: safeDate(movie.release_date),
                created_at: safeDate(movie.created_at),
                updated_at: safeDate(movie.updated_at),
<<<<<<< HEAD
                stats: { totalTicketsSold, totalRevenue, successfulBookings },
                applicable_packages: applicablePackages || [],
                detail_images: safeParseJson(movie.detail_images)
=======
                created_by_staff_name: createLog?.staffFullname || null,
                updated_by_staff_name: updateLog?.staffFullname || null,
                stats: { totalTicketsSold, totalRevenue, successfulBookings },
                applicable_packages: applicablePackages || [],
                detail_images: safeParseJson(movie.detail_images),
                branch_id: movie.branch_id,
                branch_ids: parseBranchIds(movie.branch_ids)
>>>>>>> preview
        };
}
