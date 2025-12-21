import { eq, or, ilike, desc, asc, count, sql, inArray } from "drizzle-orm";
import { formatDateForDb } from "../../lib/date-utils";

export async function listTicketPackagesImpl(
  anyDb: any,
  tables: { ticket_packages: any; movies: any }, // Thêm tables.movies vào đây
  args: { page: number; pageSize: number; q: string }
) {
  const { page, pageSize, q } = args;

  // 1. Điều kiện tìm kiếm (D1 dùng like, Postgres dùng ilike)
  const whereCondition = q
    ? or(
      ilike(tables.ticket_packages.name, `%${q}%`),
      ilike(tables.ticket_packages.description, `%${q}%`),
      ilike(tables.ticket_packages.type, `%${q}%`)
    )
    : undefined;

  // 2. Đếm tổng số bản ghi
  const [totalResult] = await anyDb.select({ count: count() }).from(tables.ticket_packages).where(whereCondition);
  const total = totalResult ? Number(totalResult.count) : 0;
  // 3. Lấy danh sách gói vé
  const packages = await anyDb
    .select()
    .from(tables.ticket_packages)
    .where(whereCondition)
    .orderBy(asc(tables.ticket_packages.display_order), desc(tables.ticket_packages.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  // 4. Xử lý lấy thông tin Movies kèm theo
  // Thu thập tất cả Movie ID từ tất cả các gói vé (đã lưu dạng JSON "[1,3]")
  let comboIds: any[] = [];
  packages.forEach((pkg: any) => {
    if (pkg.combo) {
      try {
        comboIds = typeof pkg.combo === 'string' ? JSON.parse(pkg.combo) : pkg.combo;
      } catch (e) {
        comboIds = [];
      }
    }
  });
  if (!Array.isArray(comboIds)) comboIds = [];
  // 5. Truy vấn bảng Movies để lấy id, name, code
  let movieMap: Record<number, { id: number; name: string; code: string }> = {};
  if (comboIds.length > 0) {
    const movieData = await anyDb
      .select({
        id: tables.movies.id,
        name: tables.movies.name,
        code: tables.movies.code,
      })
      .from(tables.movies)
      .where(inArray(tables.movies.id, Array.from(comboIds)));

      movieData.forEach((m: any) => {
      movieMap[m.id] = m;
    });
  }
  
  // 6. Map lại Movies vào từng Item
  const items = packages.map((pkg: any) => {
    let comboIds: number[] = [];
    try {
      comboIds = typeof pkg.combo === 'string' ? JSON.parse(pkg.combo) : (pkg.combo || []);
    } catch (e) {
      comboIds = [];
    }

    return {
      ...pkg,
      movies: comboIds.map(id => movieMap[id]).filter(Boolean) // Chỉ lấy những phim tồn tại
    };
  });

  return { items, page, pageSize, total };
}

export async function getTicketPackageImpl(
  anyDb: any,
  tables: { ticket_packages: any },
  id: number,
) {
  const [item] = await anyDb
    .select()
    .from(tables.ticket_packages)
    .where(eq(tables.ticket_packages.id, id))
    .limit(1);
  return item || null;
}

export async function createTicketPackageImpl(
  anyDb: any,
  tables: { ticket_packages: any; movies?: any },
  args: {
    name: string;
    code?: string;
    description?: string;
    price: number;
    features?: any;
    combo?: any;
    type?: string;
    min_group_size?: number;
    max_group_size?: number;
    is_member_only?: boolean;
    is_active?: boolean;
    display_order?: number;
  },
  RUNTIME_ENV?: string,
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
  } = args;

  const now = new Date();
  const formattedNow = formatDateForDb(now, RUNTIME_ENV);

  // 1. Tối ưu xử lý Features (Chuyển thành mảng string hoặc undefined)
  let processedFeatures = undefined;
  if (features) {
    processedFeatures = Array.isArray(features)
      ? features
      : String(features)
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
  }

  // 2. Tối ưu xử lý Combo (Mảng ID -> Chuỗi "1|2|3")
  let processedCombo = "";
  if (combo) {
    let comboArr: number[] = Array.isArray(combo)
      ? combo.map((v) => Number(v))
      : String(combo)
        .split(",")
        .map((x) => Number(x.trim()));

    // Loại bỏ các giá trị NaN và trùng lặp
    comboArr = Array.from(new Set(comboArr.filter((v) => !Number.isNaN(v))));

    if (comboArr.length > 0) {
      // Xác thực ID phim tồn tại trong database
      const [movieCountRes] = await anyDb
        .select({ count: count() })
        .from(tables.movies)
        .where(inArray(tables.movies.id, comboArr));

      const movieCount = movieCountRes ? Number(movieCountRes.count) : 0;
      if (movieCount !== comboArr.length) {
        throw new Error("Một hoặc nhiều ID phim trong combo không tồn tại");
      }
      processedCombo = comboArr.join("|");
    }
  }

  // 3. Thực hiện Insert
  const inserted = await anyDb
    .insert(tables.ticket_packages)
    .values({
      name,
      code,
      description,
      combo: processedCombo || null, // Lưu null hoặc chuỗi "1|2|3"
      price: Number(price).toString(),
      features: processedFeatures,
      type,
      min_group_size:
        min_group_size !== undefined ? Number(min_group_size) : null,
      max_group_size:
        max_group_size !== undefined ? Number(max_group_size) : null,
      is_member_only: Boolean(is_member_only),
      is_active: is_active ?? true, // Default là true nếu undefined
      display_order: Number(display_order ?? 0),
      created_at: formattedNow,
      updated_at: formattedNow,
    })
    .returning();

  const item = Array.isArray(inserted) ? inserted[0] : inserted;

  if (!item) throw new Error("Không thể tạo gói vé");
  return { item };
}

export async function updateTicketPackageImpl(
  anyDb: any,
  tables: { ticket_packages: any; movies?: any },
  id: number,
  args: {
    name?: string;
    code?: string;
    description?: string;
    price?: number;
    features?: any;
    combo?: any;
    type?: string;
    min_group_size?: number;
    max_group_size?: number;
    is_member_only?: boolean;
    is_active?: boolean;
    display_order?: number;
  },
  RUNTIME_ENV?: string,
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
  } = args;

  const now = new Date();
  // Khởi tạo object data với ngày cập nhật
  const data: any = { updated_at: formatDateForDb(now, RUNTIME_ENV) };

  // 1. Tối ưu gán giá trị cơ bản (Chỉ gán nếu không phải undefined)
  if (name !== undefined) data.name = name;
  if (code !== undefined) data.code = code;
  if (description !== undefined) data.description = description;
  if (type !== undefined) data.type = type;
  if (price !== undefined) data.price = Number(price).toString();
  if (min_group_size !== undefined)
    data.min_group_size = Number(min_group_size);
  if (max_group_size !== undefined)
    data.max_group_size = Number(max_group_size);
  if (is_member_only !== undefined)
    data.is_member_only = Boolean(is_member_only);
  if (is_active !== undefined) data.is_active = Boolean(is_active);
  if (display_order !== undefined) data.display_order = Number(display_order);

  // 2. Tối ưu xử lý Features
  if (features !== undefined) {
    data.features = Array.isArray(features)
      ? features
      : String(features)
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
  }

  // 3. Tối ưu xử lý Combo (Lưu dạng chuỗi "1|3")
  if (combo !== undefined) {
    let comboArr: (number | string)[] = [];

    if (Array.isArray(combo)) {
      // Giữ nguyên mảng nếu FE gửi lên [1, 3]
      comboArr = combo.filter((v) => v !== null && v !== undefined);
    } else if (typeof combo === "string") {
      comboArr = combo
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
    }

    // Loại bỏ ID trùng lặp
    comboArr = Array.from(new Set(comboArr));

    if (comboArr.length > 0) {
      // Kiểm tra tính hợp lệ của phim (Chuyển sang Number để query DB)
      const numericIds = comboArr
        .map((v) => Number(v))
        .filter((v) => !Number.isNaN(v));
      const [movieCountRes] = await anyDb
        .select({ count: count() })
        .from(tables.movies)
        .where(inArray(tables.movies.id, numericIds));

      const movieCount = movieCountRes ? Number(movieCountRes.count) : 0;
      if (movieCount !== numericIds.length) {
        throw new Error("Một hoặc nhiều ID phim trong combo không tồn tại");
      }
    }
    data.combo = comboArr;
  }
  // 4. Thực thi Update
  const updatedRes = await anyDb
    .update(tables.ticket_packages)
    .set(data)
    .where(eq(tables.ticket_packages.id, id))
    .returning();

  // D1/SQLite trả về array khi dùng .returning()
  const item = Array.isArray(updatedRes) ? updatedRes[0] : updatedRes;

  return item || null;
}

export async function deleteTicketPackageImpl(
  anyDb: any,
  tables: { ticket_packages: any },
  id: number,
) {
  // Check if ticket package exists before deleting
  const existing = await anyDb.query.ticket_packages.findFirst({
    where: eq(tables.ticket_packages.id, id),
  });

  if (!existing) return null;

  // Delete ticket package (tương thích với D1/SQLite không hỗ trợ .returning())
  await anyDb
    .delete(tables.ticket_packages)
    .where(eq(tables.ticket_packages.id, id));

  return { ok: true };
}
