import { eq, asc, inArray, and, isNull, sql } from 'drizzle-orm';
import { enrichItemsWithParsedBranchIds, sqlBranchIdsMatchFilter, matchesBranchFilter } from '../../lib/branch-ids';

export async function listActiveTicketPackages(
  anyDb: any,
  tables: { ticket_packages: any; movies: any },
  branch_id?: number
) {
  const movieOnlyCondition = sql`(${tables.ticket_packages.type} IS NULL OR ${tables.ticket_packages.type} != 'vr')`;
  const baseCondition = and(
    eq(tables.ticket_packages.is_active, true),
    isNull(tables.ticket_packages.deleted_at),
    movieOnlyCondition
  );
  const whereCondition = branch_id
    ? and(
        baseCondition,
        sqlBranchIdsMatchFilter(tables.ticket_packages.branch_ids, tables.ticket_packages.branch_id, branch_id)
      )
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

  // BƯỚC 2: Lấy danh sách phim đang hoạt động của chi nhánh hiện tại (nếu có branch_id)
  let branchActiveMovies: any[] = [];
  if (branch_id) {
    const branchMoviesFromDb = await anyDb.query.movies.findMany({
      where: and(
        eq(tables.movies.is_active, true),
        isNull(tables.movies.deleted_at),
        sqlBranchIdsMatchFilter(tables.movies.branch_ids, tables.movies.branch_id, branch_id)
      ),
      orderBy: [asc(tables.movies.id)]
    });
    branchActiveMovies = branchMoviesFromDb.map((movie: any) => ({
      id: movie.id,
      title: movie.title,
      cover_image: movie.cover_image,
      duration_min: movie.duration_min,
      branch_id: movie.branch_id,
      branch_ids: movie.branch_ids
    }));
  }

  // Truy vấn thông tin các phim trong allMovieIds
  const moviesMap = new Map<number, any>();
  // Thêm sẵn các phim của chi nhánh vào moviesMap
  branchActiveMovies.forEach((m) => {
    moviesMap.set(m.id, m);
  });

  const missingMovieIds = Array.from(allMovieIds).filter((id) => !moviesMap.has(id));
  if (missingMovieIds.length > 0) {
    const extraMovies = await anyDb.query.movies.findMany({
      where: and(
        inArray(tables.movies.id, missingMovieIds),
        eq(tables.movies.is_active, true),
        isNull(tables.movies.deleted_at)
      )
    });

    extraMovies.forEach((movie: any) => {
      moviesMap.set(movie.id, {
        id: movie.id,
        title: movie.title,
        cover_image: movie.cover_image,
        duration_min: movie.duration_min,
        branch_id: movie.branch_id,
        branch_ids: movie.branch_ids
      });
    });
  }

  // BƯỚC 3: Map thông tin phim vào từng package và đảm bảo chỉ giữ phim đúng chi nhánh
  const processedItems = parsedItems.map((pkg: any) => {
    // Duyệt qua mảng ID trong combo để lấy object movie tương ứng từ Map và lọc theo chi nhánh
    const movieDetails = pkg.combo
      .map((id: number) => moviesMap.get(id))
      .filter((movie: any) => {
        if (!movie) return false;
        if (branch_id && !matchesBranchFilter(movie.branch_ids, movie.branch_id, branch_id)) {
          return false;
        }
        if (pkg.branch_id && !matchesBranchFilter(movie.branch_ids, movie.branch_id, pkg.branch_id)) {
          return false;
        }
        return true;
      });

    // Nếu combo không có phim nào của chi nhánh này (ví dụ gói chung có combo cũ chỉ chứa ID phim Hà Nội khi xem HCM),
    // tự động fallback sang toàn bộ phim đang chiếu tại chi nhánh đó
    const finalMovies =
      movieDetails.length > 0
        ? movieDetails
        : branch_id
          ? branchActiveMovies
          : [];

    return {
      ...pkg,
      movies: finalMovies
    };
  });

  return { items: enrichItemsWithParsedBranchIds(processedItems) };
}
