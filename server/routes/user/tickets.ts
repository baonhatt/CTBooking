import { eq, asc, inArray, and, isNull, sql } from 'drizzle-orm';
import { enrichItemsWithParsedBranchIds, sqlBranchIdsMatchFilter } from '../../lib/branch-ids';

export async function listActiveTicketPackages(
        anyDb: any,
        tables: { ticket_packages: any; movies: any },
        branch_id?: number
) {
        const movieOnlyCondition = sql`(${tables.ticket_packages.type} IS NULL OR ${tables.ticket_packages.type} != 'vr')`;
        const baseCondition = and(eq(tables.ticket_packages.is_active, true), isNull(tables.ticket_packages.deleted_at), movieOnlyCondition);
        const whereCondition = branch_id
                ? and(baseCondition, sqlBranchIdsMatchFilter(tables.ticket_packages.branch_ids, tables.ticket_packages.branch_id, branch_id))
                : baseCondition;

        const items = await anyDb.query.ticket_packages.findMany({
                where: whereCondition,
                orderBy: [asc(tables.ticket_packages.display_order), asc(tables.ticket_packages.price)]
        });

        const allMovieIds = new Set<number>();

        // BƯỚC 1: Parse và gom ID (Xử lý trường hợp combo là mảng số [3, 5, 6, 1])
        const parsedItems = items.map((pkg: any) => {
                let comboIds: number[] = [];
                if (pkg.combo) {
                        try {
                                // Nếu DB trả về string thì parse, nếu đã là object/array thì dùng luôn
                                const parsed = typeof pkg.combo === 'string' ? JSON.parse(pkg.combo) : pkg.combo;

                                if (Array.isArray(parsed)) {
                                        // Vì dữ liệu thực tế là [3, 5, 6, 1], ta đưa về Number để đồng bộ
                                        comboIds = parsed.map((id: any) => Number(id)).filter((id) => !isNaN(id));
                                        comboIds.forEach((id) => allMovieIds.add(id));
                                }
                        } catch (e) {
                                console.error('Lỗi parse combo cho package', pkg.id, e);
                        }
                }
                return { ...pkg, combo: comboIds }; // Lưu lại combo dưới dạng mảng số đã sạch
        });

        // BƯỚC 2: Truy vấn thông tin phim từ danh sách ID đã gom
        const moviesMap = new Map<number, any>();
        if (allMovieIds.size > 0) {
                const movies = await anyDb.query.movies.findMany({
                        where: and(
                                inArray(tables.movies.id, Array.from(allMovieIds)),
                                eq(tables.movies.is_active, true),
                                isNull(tables.movies.deleted_at)
                        )
                });

                movies.forEach((movie: any) => {
                        moviesMap.set(movie.id, {
                                id: movie.id,
                                title: movie.title,
                                cover_image: movie.cover_image,
                                duration_min: movie.duration_min
                        });
                });
        }

        // BƯỚC 3: Map thông tin phim vào từng package
        const processedItems = parsedItems.map((pkg: any) => {
                // Duyệt qua mảng ID trong combo để lấy object movie tương ứng từ Map
                const movieDetails = pkg.combo.map((id: number) => moviesMap.get(id)).filter(Boolean); // Loại bỏ các giá trị undefined nếu không tìm thấy phim trong DB

                return {
                        ...pkg,
                        movies: movieDetails // Kết quả sẽ là [{id: 3, title: ...}, {id: 5, ...}]
                };
        });

        return { items: enrichItemsWithParsedBranchIds(processedItems) };
}
