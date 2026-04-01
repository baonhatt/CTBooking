// Import các hàm cần thiết từ thư viện
import { eq, or, desc, asc, count, inArray, and, sql } from 'drizzle-orm';
import { formatDateForDb } from '../../lib/date-utils';
import { deleteCache } from '../../../worker/src/utils';

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
  tables: { ticket_packages: any; movies: any },
  args: { page: number; pageSize: number; q: string; includeInactive?: boolean }
) {
  const { page, pageSize, q, includeInactive = false } = args;

  // 1. Xây dựng điều kiện where
  let whereCondition = includeInactive ? undefined : eq(tables.ticket_packages.is_active, true);

  if (q) {
    const lowerSearch = q.toLowerCase();
    const searchCondition = or(
      sql`LOWER(${tables.ticket_packages.name}) LIKE ${`%${lowerSearch}%`}`,
      sql`LOWER(${tables.ticket_packages.description}) LIKE ${`%${lowerSearch}%`}`,
      sql`LOWER(${tables.ticket_packages.type}) LIKE ${`%${lowerSearch}%`}`
    );

    whereCondition = whereCondition ? and(whereCondition, searchCondition) : searchCondition;
  }

  // 2. Lấy dữ liệu phân trang
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

  // 3. Xử lý combo cho từng gói vé
  const items = packages.map((pkg: any) => ({
    ...pkg,
    // Giữ nguyên giá trị combo từ database
    // Nếu cần đảm bảo combo là mảng, có thể thêm:
    combo: Array.isArray(pkg.combo) ? pkg.combo : undefined
  }));

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
export async function getTicketPackageImpl(anyDb: any, tables: { ticket_packages: any }, id: number) {
  const [item] = await anyDb
    .select()
    .from(tables.ticket_packages)
    .where(eq(tables.ticket_packages.id, id)) // Tìm theo ID
    .limit(1); // Chỉ lấy 1 bản ghi
  return item || null; // Trả về null nếu không tìm thấy
}

/**
 * Tạo mới một gói vé
 * @param anyDb Kết nối database
 * @param tables Danh sách các bảng cần sử dụng
 * @param args Thông tin gói vé cần tạo
 * @param RUNTIME_ENV Môi trường chạy (tùy chọn)
 * @returns Thông tin gói vé vừa tạo
 */
export async function createTicketPackageImpl(
  anyDb: any,
  tables: { ticket_packages: any; movies: any },
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
  },
  RUN_ENV: any
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
    display_order
  } = args;

  // 1. Chuẩn bị thời gian tạo và cập nhật
  const now = new Date();
  const formattedNow = formatDateForDb(now, RUN_ENV?.RUNTIME_ENV);

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
      // Lưu danh sách ID phim dưới dạng mảng hoặc null nếu không có
      combo: processedCombo.length > 0 ? processedCombo : null,
      // Đảm bảo giá luôn là chuỗi
      price: Number(price).toString(),
      // Danh sách tính năng đã xử lý
      features: processedFeatures,
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

  return { item };
}

/**
 * Cập nhật thông tin gói vé
 * @param anyDb Kết nối database
 * @param tables Danh sách các bảng cần sử dụng
 * @param id ID của gói vé cần cập nhật
 * @param args Thông tin cập nhật
 * @param RUNTIME_ENV Môi trường chạy (tùy chọn)
 * @returns Thông tin gói vé đã được cập nhật
 */
export async function updateTicketPackageImpl(
  anyDb: any,
  tables: { ticket_packages: any; movies: any },
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
  },
  RUN_ENV: any
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
    display_order
  } = args;

  const now = new Date();
  // Khởi tạo object data với ngày cập nhật
  const data: any = { updated_at: formatDateForDb(now, RUN_ENV?.RUNTIME_ENV) };

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

  // 2. Tối ưu xử lý Features
  if (features !== undefined) {
    data.features = Array.isArray(features)
      ? features
      : String(features)
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean);
  }

  // 3. Tối ưu xử lý Combo (Lưu dạng chuỗi "1|3")
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

  if (RUN_ENV && RUN_ENV.KV_BINDING) {
    await RUN_ENV.KV_BINDING.delete('activeTicketPackages');
  }

  return item || null;
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
  tables: { ticket_packages: any; bookings: any },
  id: number,
  RUN_ENV: any
) {
  try {
    // 1. Kiểm tra gói vé có tồn tại không
    const existing = await anyDb.query.ticket_packages.findFirst({
      where: eq(tables.ticket_packages.id, id)
    });

    // Nếu không tìm thấy gói vé, trả về null
    if (!existing) return null;

    // 2. Thực hiện soft delete (update is_active = false)
    await anyDb
      .update(tables.ticket_packages)
      .set({
        is_active: false,
        updated_at: new Date()
      })
      .where(eq(tables.ticket_packages.id, id));

    if (RUN_ENV && RUN_ENV.KV_BINDING) {
      await RUN_ENV.KV_BINDING.delete('activeTicketPackages');
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
