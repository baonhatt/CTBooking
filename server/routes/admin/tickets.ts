import { eq, or, desc, asc, count, inArray, and, sql, isNull, isNotNull, like } from 'drizzle-orm';
import { formatDateForDb } from '../../lib/date-utils';
import { deleteCache } from '../../../worker/src/utils';
import { logAuditAction } from '../../lib/audit-logger';
import { buildAuditPayload } from '../../lib/audit-utils';
import {
        enrichWithParsedBranchIds,
        enrichItemsWithParsedBranchIds,
        resolveBranchIdsInput,
        staffCanAccessBranchIds,
        sqlBranchIdsMatchFilter,
        sqlBranchIdsStaffAccessFilter
} from '../../lib/branch-ids';

/**
 * Hàm helper xử lý dữ liệu combo
 * @param combo Dữ liệu combo đầu vào (có thể là mảng hoặc chuỗi)
 * @returns Mảng các ID đã được xử lý và làm sạch
 */
function processComboInput(combo: any): number[] {
        if (!combo) return [];

        try {
                // Nếu là chuỗi, chuyển đổi thành mảng
                if (typeof combo === 'string') {
                        // Thử parse nếu là JSON string
                        try {
                                const parsed = JSON.parse(combo);
                                if (Array.isArray(parsed)) {
                                        return parsed.map(Number).filter((id) => !isNaN(id) && id > 0);
                                }
                        } catch {
                                // Nếu không phải JSON, xử lý như chuỗi thông thường
                                return combo
                                        .split(',')
                                        .map((x) => parseInt(x.trim(), 10))
                                        .filter((id) => !isNaN(id) && id > 0);
                        }
                }

                // Nếu là mảng, xử lý các phần tử
                if (Array.isArray(combo)) {
                        return combo
                                .map((item) => (typeof item === 'number' ? item : parseInt(item, 10)))
                                .filter((id) => !isNaN(id) && id > 0);
                }

                return [];
        } catch (error) {
                console.error('Lỗi khi xử lý combo:', error);
                return [];
        }
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
        args: { page: number; pageSize: number; q: string; includeInactive?: boolean; branch_id?: number; restrictToBranchIds?: number[] | null }
) {
        const { page, pageSize, q, includeInactive = false, branch_id, restrictToBranchIds = null } = args;

        // 1. Xây dựng điều kiện where
        let whereCondition = includeInactive ? undefined : and(eq(tables.ticket_packages.is_active, true), isNull(tables.ticket_packages.deleted_at));

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
                const branchFilter = sqlBranchIdsMatchFilter(tables.ticket_packages.branch_ids, tables.ticket_packages.branch_id, branch_id);
                whereCondition = whereCondition ? and(whereCondition, branchFilter) : branchFilter;
        }
        if (restrictToBranchIds && restrictToBranchIds.length > 0) {
                const staffFilter = sqlBranchIdsStaffAccessFilter(tables.ticket_packages.branch_ids, restrictToBranchIds);
                whereCondition = whereCondition ? and(whereCondition, staffFilter) : staffFilter;
        }
        // 2. Lấy dữ liệu phân trang - tạm thời bỏ join branches
        const [totalResArray, pkgList] = await Promise.all([
                anyDb.select({ count: count() }).from(tables.ticket_packages).where(whereCondition),
                anyDb
                        .select()
                        .from(tables.ticket_packages)
                        .where(whereCondition)
                        .orderBy(asc(tables.ticket_packages.display_order), desc(tables.ticket_packages.id))
                        .limit(pageSize)
                        .offset((page - 1) * pageSize)
        ]);
        const totalResult = totalResArray[0];
        const packages = pkgList;

        const total = totalResult ? Number(totalResult.count) : 0;

        // 3. Xử lý combo và features cho từng gói vé
        const items = packages.map((pkg: any) =>
                enrichWithParsedBranchIds({
                        ...pkg,
                // Parse JSON string to array (handle old data formats: JSON array or "1|2|3")
                combo: pkg.combo
                        ? Array.isArray(pkg.combo)
                                ? pkg.combo
                                : (() => {
                                        try {
                                                return JSON.parse(pkg.combo);
                                        } catch {
                                                // Handle old format: "1|2|3"
                                                if (typeof pkg.combo === 'string' && pkg.combo.includes('|')) {
                                                        return pkg.combo
                                                                .split('|')
                                                                .map((x: string) => x.trim())
                                                                .filter(Boolean);
                                                }
                                                return [];
                                        }
                                })()
                        : [],
                features: pkg.features
                        ? Array.isArray(pkg.features)
                                ? pkg.features
                                : (() => {
                                        try {
                                                return JSON.parse(pkg.features);
                                        } catch {
                                                return [];
                                        }
                                })()
                        : []
                })
        );

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
        tables: { ticket_packages: any; auditLogs: any; branches?: any },
        id: number,
        restrictToBranchIds: number[] | null = null
) {
        const whereClause =
                restrictToBranchIds && restrictToBranchIds.length > 0
                        ? and(
                                  eq(tables.ticket_packages.id, id),
                                  sqlBranchIdsStaffAccessFilter(tables.ticket_packages.branch_ids, restrictToBranchIds)
                          )
                        : eq(tables.ticket_packages.id, id);
        const [item] = await anyDb.select().from(tables.ticket_packages).where(whereClause).limit(1);
        if (!item) return null;

        // Get tracking data from audit logs
        const [createLog] = await anyDb
                .select()
                .from(tables.auditLogs)
                .where(and(eq(tables.auditLogs.entityType, 'ticket_package'), eq(tables.auditLogs.entityId, String(id)), eq(tables.auditLogs.action, 'create')))
                .orderBy(tables.auditLogs.createdAt)
                .limit(1);

        const [updateLog] = await anyDb
                .select()
                .from(tables.auditLogs)
                .where(and(eq(tables.auditLogs.entityType, 'ticket_package'), eq(tables.auditLogs.entityId, String(id)), eq(tables.auditLogs.action, 'update')))
                .orderBy(desc(tables.auditLogs.createdAt))
                .limit(1);

        // Parse JSON strings to arrays (handle old data formats: JSON array or "1|2|3")
        return enrichWithParsedBranchIds({
                ...item,
                created_by_staff_name: createLog?.staffFullname || null,
                updated_by_staff_name: updateLog?.staffFullname || null,
                combo: item.combo
                        ? Array.isArray(item.combo)
                                ? item.combo
                                : (() => {
                                        try {
                                                return JSON.parse(item.combo);
                                        } catch {
                                                // Handle old format: "1|2|3"
                                                if (typeof item.combo === 'string' && item.combo.includes('|')) {
                                                        return item.combo
                                                                .split('|')
                                                                .map((x: string) => x.trim())
                                                                .filter(Boolean);
                                                }
                                                return [];
                                        }
                                })()
                        : [],
                features: item.features
                        ? Array.isArray(item.features)
                                ? item.features
                                : (() => {
                                        try {
                                                return JSON.parse(item.features);
                                        } catch {
                                                return [];
                                        }
                                })()
                        : []
        });
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
                name: string; // Tên gói vé
                code?: string; // Mã gói vé
                description?: string; // Mô tả
                price: number; // Giá
                features?: any; // Các tính năng (dạng mảng)
                combo?: any; // Danh sách ID phim (dạng mảng hoặc chuỗi)
                type?: string; // Loại gói vé
                min_group_size?: number; // Số lượng tối thiểu
                max_group_size?: number; // Số lượng tối đa
                is_member_only?: boolean; // Chỉ dành cho thành viên
                is_active?: boolean; // Trạng thái hoạt động
                display_order?: number; // Thứ tự hiển thị
                branch_id?: number | null;
                branch_ids?: number[] | null;
        },
        RUN_ENV: any,
        staffInfo?: { id: number; email: string; fullname: string }
) {
        const {
                name,
                code,
                description,
                price,
                features,
                combo,
                type,
                min_group_size,
                max_group_size,
                is_member_only,
                is_active,
                display_order,
                branch_id,
                branch_ids
        } = args;

        const branchFields = resolveBranchIdsInput(branch_ids, branch_id);

        // 1. Chuẩn bị thời gian tạo và cập nhật
        const now = new Date();
        const formattedNow = formatDateForDb(now);

        // 2. Xử lý danh sách tính năng (features)
        // Chuyển đổi features thành mảng nếu là chuỗi, ngược lại giữ nguyên nếu đã là mảng
        let processedFeatures = undefined;
        if (features) {
                processedFeatures = Array.isArray(features)
                        ? features // Nếu đã là mảng thì giữ nguyên
                        : String(features) // Nếu là chuỗi thì tách thành mảng
                                .split(',')
                                .map((x) => x.trim()) // Xóa khoảng trắng thừa
                                .filter(Boolean); // Lọc bỏ các phần tử rỗng
        }

        // 3. Xử lý danh sách phim (combo)
        let processedCombo: (number | string)[] = [];

        if (combo !== undefined && combo !== null) {
                // Xử lý tùy theo kiểu dữ liệu của combo
                if (Array.isArray(combo)) {
                        // Nếu là mảng, lọc bỏ các giá trị null/undefined
                        processedCombo = combo.filter((v) => v !== null && v !== undefined);
                } else if (typeof combo === 'string') {
                        // Nếu là chuỗi, tách thành mảng dựa trên dấu phẩy
                        processedCombo = combo
                                .split(',')
                                .map((x) => x.trim()) // Xóa khoảng trắng thừa
                                .filter(Boolean); // Lọc bỏ các phần tử rỗng
                }

                // Loại bỏ các ID trùng lặp bằng cách chuyển qua Set
                processedCombo = Array.from(new Set(processedCombo));

                // Nếu có ID phim, kiểm tra tính hợp lệ
                if (processedCombo.length > 0) {
                        // Chuyển đổi tất cả ID sang số và lọc bỏ các giá trị không hợp lệ
                        const numericIds = processedCombo.map((v) => Number(v)).filter((v) => !Number.isNaN(v));

                        // Kiểm tra xem tất cả ID phim có tồn tại trong database không
                        const [movieCountRes] = await anyDb
                                .select({ count: count() })
                                .from(tables.movies)
                                .where(inArray(tables.movies.id, numericIds));

                        const movieCount = movieCountRes ? Number(movieCountRes.count) : 0;
                        if (movieCount !== numericIds.length) {
                                throw new Error('Một hoặc nhiều ID phim trong combo không tồn tại');
                        }

                        // Cập nhật lại danh sách ID đã được kiểm tra và chuyển đổi
                        processedCombo = numericIds;
                }
        }

        // 4. Thực hiện thêm mới gói vé vào database
        const inserted = await anyDb
                .insert(tables.ticket_packages)
                .values({
                        name, // Tên gói vé (bắt buộc)
                        code, // Mã gói vé
                        description, // Mô tả
                        // Lưu danh sách ID phim dưới dạng JSON string
                        combo: processedCombo.length > 0 ? JSON.stringify(processedCombo) : null,
                        // Đảm bảo giá luôn là chuỗi
                        price: Number(price).toString(),
                        // Danh sách tính năng đã xử lý - lưu dạng JSON string
                        features: processedFeatures ? JSON.stringify(processedFeatures) : null,
                        type, // Loại gói vé
                        // Xử lý giá trị mặc định cho các trường tùy chọn
                        min_group_size: min_group_size !== undefined ? Number(min_group_size) : null,
                        max_group_size: max_group_size !== undefined ? Number(max_group_size) : null,
                        // Đảm bảo giá trị boolean
                        is_member_only: Boolean(is_member_only),
                        // Mặc định là true nếu không xác định
                        is_active: is_active ?? true,
                        // Mặc định thứ tự hiển thị là 0 nếu không xác định
                        display_order: Number(display_order ?? 0),
                        branch_id: branchFields.branch_id ?? null,
                        branch_ids: branchFields.branch_ids ?? null,
                        // Thời gian tạo và cập nhật
                        created_at: formattedNow,
                        updated_at: formattedNow
                })
                .returning(); // Trả về bản ghi vừa được tạo

        // Xử lý kết quả trả về từ database
        const item = Array.isArray(inserted) ? inserted[0] : inserted;

        // Nếu không tạo được gói vé, ném lỗi
        if (!item) throw new Error('Không thể tạo gói vé');

        // Trả về thông tin gói vé vừa tạo
        // Tự động xóa cache trang active-ticket-packages
        const origin = 'https://cinesphere.com.vn'; // Default origin if not provided in env
        // NOTE: Server routes often don't have access to full Request object to get Origin header easily if not passed down.
        // We'll trust the worker to clear it or use a well-known key if we can.
        // In our worker setup, we use full URL as cache key.
        // We need to clear `${origin}/api/active-ticket-packages`.

        if (RUN_ENV && RUN_ENV.KV_BINDING) {
                // Direct KV delete if possible? No, we used Cache API or KV put manually.
                // If we manual `KV.put("activeTicketPackages")` in worker, we should delete it here.
                await RUN_ENV.KV_BINDING.delete('activeTicketPackages');
        }

        const auditNew = buildAuditPayload(item);

        // Log audit action
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
                        auditNew
                );
        }

        return { item: enrichWithParsedBranchIds(item) };
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
                name?: string; // Tên gói vé
                code?: string; // Mã gói vé
                description?: string; // Mô tả
                price?: number; // Giá
                features?: any; // Các tính năng
                combo?: any; // Danh sách ID phim
                type?: string; // Loại gói vé
                min_group_size?: number; // Số lượng tối thiểu
                max_group_size?: number; // Số lượng tối đa
                is_member_only?: boolean; // Chỉ dành cho thành viên
                is_active?: boolean; // Trạng thái hoạt động
                display_order?: number; // Thứ tự hiển thị
                branch_id?: number | null;
                branch_ids?: number[] | null;
        },
        RUN_ENV: any,
        staffInfo?: { id: number; email: string; fullname: string }
) {
        const existing = await anyDb.query.ticket_packages.findFirst({ where: eq(tables.ticket_packages.id, id) });
        if (!existing) {
                throw new Error('Không tìm thấy gói vé');
        }

        const {
                name,
                code,
                description,
                price,
                features,
                combo,
                type,
                min_group_size,
                max_group_size,
                is_member_only,
                is_active,
                display_order,
                branch_id,
                branch_ids
        } = args;

        const now = new Date();
        // Khởi tạo object data với ngày cập nhật
        const data: any = { updated_at: formatDateForDb(now) };

        // 1. Tối ưu gán giá trị cơ bản (Chỉ gán nếu không phải undefined)
        if (name !== undefined) data.name = name;
        if (code !== undefined) data.code = code;
        if (description !== undefined) data.description = description;
        if (type !== undefined) data.type = type;
        if (price !== undefined) data.price = Number(price).toString();
        if (min_group_size !== undefined) data.min_group_size = Number(min_group_size);
        if (max_group_size !== undefined) data.max_group_size = Number(max_group_size);
        if (is_member_only !== undefined) data.is_member_only = Boolean(is_member_only);
        if (is_active !== undefined) data.is_active = Boolean(is_active);
        if (display_order !== undefined) data.display_order = Number(display_order);
        if (branch_ids !== undefined || branch_id !== undefined) {
                const branchFields = resolveBranchIdsInput(branch_ids, branch_id);
                if (branchFields.branch_ids !== undefined) data.branch_ids = branchFields.branch_ids;
                if (branchFields.branch_id !== undefined) data.branch_id = branchFields.branch_id;
        }

        // 2. Tối ưu xử lý Features
        if (features !== undefined) {
                const featuresArr = Array.isArray(features)
                        ? features
                        : String(features)
                                .split(',')
                                .map((x) => x.trim())
                                .filter(Boolean);
                data.features = featuresArr.length > 0 ? JSON.stringify(featuresArr) : null;
        }

        // 3. Tối ưu xử lý Combo (Lưu dạng JSON string)
        if (combo !== undefined) {
                let comboArr: (number | string)[] = [];

                if (Array.isArray(combo)) {
                        // Giữ nguyên mảng nếu FE gửi lên [1, 3]
                        comboArr = combo.filter((v) => v !== null && v !== undefined);
                } else if (typeof combo === 'string') {
                        comboArr = combo
                                .split(',')
                                .map((x) => x.trim())
                                .filter(Boolean);
                }

                // Loại bỏ ID trùng lặp
                comboArr = Array.from(new Set(comboArr));

                if (comboArr.length > 0) {
                        // Kiểm tra tính hợp lệ của phim (Chuyển sang Number để query DB)
                        const numericIds = comboArr.map((v) => Number(v)).filter((v) => !Number.isNaN(v));
                        const [movieCountRes] = await anyDb
                                .select({ count: count() })
                                .from(tables.movies)
                                .where(inArray(tables.movies.id, numericIds));

                        const movieCount = movieCountRes ? Number(movieCountRes.count) : 0;
                        if (movieCount !== numericIds.length) {
                                throw new Error('Một hoặc nhiều ID phim trong combo không tồn tại');
                        }
                }
                data.combo = comboArr.length > 0 ? JSON.stringify(comboArr) : null;
        }
        // 4. Thực thi Update
        const updatedRes = await anyDb
                .update(tables.ticket_packages)
                .set(data)
                .where(eq(tables.ticket_packages.id, id))
                .returning();

        // D1/SQLite trả về array khi dùng .returning()
        let item = Array.isArray(updatedRes) ? updatedRes[0] : updatedRes;
        if (!item) {
                item = await anyDb.query.ticket_packages.findFirst({ where: eq(tables.ticket_packages.id, id) });
        }

        if (RUN_ENV && RUN_ENV.KV_BINDING) {
                await RUN_ENV.KV_BINDING.delete('activeTicketPackages');
        }

        const auditOld = buildAuditPayload(existing);
        const auditNew = buildAuditPayload(item);

        // Log audit action
        if (staffInfo) {
                await logAuditAction(
                        anyDb,
                        tables.auditLogs,
                        'update',
                        'ticket_package',
                        id,
                        `Cập nhật gói vé: ${name || id}`,
                        staffInfo.id,
                        staffInfo.email,
                        staffInfo.fullname,
                        auditOld,
                        auditNew
                );
        }

        if (!item) return null;
        return enrichWithParsedBranchIds(item);
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
        staffInfo?: { id: number; email: string; fullname: string }
) {
        try {
                // 1. Kiểm tra gói vé có tồn tại không
                const existing = await anyDb.query.ticket_packages.findFirst({
                        where: eq(tables.ticket_packages.id, id)
                });

                // Nếu không tìm thấy gói vé, trả về null
                if (!existing) return null;

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

                if (RUN_ENV && RUN_ENV.KV_BINDING) {
                        await RUN_ENV.KV_BINDING.delete('activeTicketPackages');
                }

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
        staffInfo?: { id: number; email: string; fullname: string }
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
        tables: { ticket_packages: any; staffs: any },
        options: { page?: number; pageSize?: number; search?: string; branch_id?: number | null; restrictToBranchIds?: number[] | null } = {}
) {
        const { ticket_packages, staffs } = tables;
        const { page = 1, pageSize = 10, search = '', branch_id, restrictToBranchIds = null } = options;

        const conditions = [];
        if (search) {
                conditions.push(like(ticket_packages.name, `%${search}%`));
        }
        if (branch_id) {
                conditions.push(sqlBranchIdsMatchFilter(ticket_packages.branch_ids, ticket_packages.branch_id, branch_id));
        }
        if (restrictToBranchIds && restrictToBranchIds.length > 0) {
                conditions.push(sqlBranchIdsStaffAccessFilter(ticket_packages.branch_ids, restrictToBranchIds));
        }
        conditions.push(isNotNull(ticket_packages.deleted_at));

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        const items = await anyDb
                .select({
                        id: ticket_packages.id,
                        name: ticket_packages.name,
                        code: ticket_packages.code,
                        description: ticket_packages.description,
                        price: ticket_packages.price,
                        features: ticket_packages.features,
                        type: ticket_packages.type,
                        combo: ticket_packages.combo,
                        min_group_size: ticket_packages.min_group_size,
                        max_group_size: ticket_packages.max_group_size,
                        is_member_only: ticket_packages.is_member_only,
                        is_active: ticket_packages.is_active,
                        display_order: ticket_packages.display_order,
                        branch_id: ticket_packages.branch_id,
                        branch_ids: ticket_packages.branch_ids,
                        created_at: ticket_packages.created_at,
                        updated_at: ticket_packages.updated_at,
                        deleted_at: ticket_packages.deleted_at,
                        deleted_by_staff_id: ticket_packages.deleted_by_staff_id,
                        deleted_by_staff_name: staffs.fullname
                })
                .from(ticket_packages)
                .leftJoin(staffs, eq(ticket_packages.deleted_by_staff_id, staffs.id))
                .where(whereClause)
                .limit(pageSize)
                .offset((page - 1) * pageSize)
                .orderBy(desc(ticket_packages.deleted_at));

        const [countResult] = await anyDb
                .select({ count: count() })
                .from(ticket_packages)
                .where(whereClause);

        return {
                status: 'success',
                items: enrichItemsWithParsedBranchIds(items),
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
        staffInfo?: { id: number; email: string; fullname: string }
) {
        const existing = await anyDb.query.ticket_packages.findFirst({
                where: eq(tables.ticket_packages.id, id)
        });

        if (!existing) {
                const err: any = new Error('Gói vé không tồn tại');
                err.statusCode = 404;
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

        if (RUN_ENV && RUN_ENV.KV_BINDING) {
                await RUN_ENV.KV_BINDING.delete('activeTicketPackages');
        }

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
