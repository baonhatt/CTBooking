import { eq, and, inArray, sql, gte, lte, or, desc, asc, count, SQL } from 'drizzle-orm';
import { formatDateForDb } from '../../lib/date-utils';

export async function updateUserProfileImpl(
  anyDb: any,
  tables: { accounts: any; users: any },
  payload: {
    accountId?: number;
    email?: string;
    name?: string;
    phone?: string;
    gender?: string;
    dob?: string;
  }
) {
  const { accountId, name, phone, gender, dob } = payload;
  if (!accountId) return { status: 401, message: 'Unauthorized' };
  const account = await anyDb.query.accounts.findFirst({
    where: eq(tables.accounts.id, accountId)
  });
  if (!account) return { status: 404, message: 'Không tìm thấy tài khoản' };
  const dobDate = (() => {
    try {
      if (!dob) return undefined;
      const d = new Date(dob);
      return d;
    } catch {
      return undefined;
    }
  })();
  const normalizedGender = (() => {
    try {
      const g = typeof gender === 'string' ? gender.trim().toLowerCase() : '';
      return g === 'male' || g === 'female' ? g : undefined;
    } catch {
      return undefined;
    }
  })();

  const updateData: any = {
    updated_at: formatDateForDb(new Date())
  };
  if (typeof name === 'string') updateData.fullname = name;
  if (typeof phone === 'string') updateData.phone = phone;
  if (normalizedGender) updateData.gender = normalizedGender;
  if (dobDate) updateData.dob = formatDateForDb(dobDate);
  // Try to use .returning() to fetch updated row when supported, fallback for D1/SQLite
  const updatedRes = await anyDb
    .update(tables.users)
    .set(updateData)
    .where(eq(tables.users.id, account.user_id))
    .returning();

  let user: any = Array.isArray(updatedRes) ? updatedRes[0] : updatedRes;

  if (!user) throw new Error('Không thể cập nhật thông tin người dùng');
  return {
    status: 200,
    user: {
      id: user.id,
      fullname: user.fullname,
      phone: user.phone,
      gender: user.gender ?? null,
      dob: user.dob ?? null,
      email: account.email
    }
  };
}

export async function getUserProfileByAccountIdImpl(anyDb: any, tables: { accounts: any; users: any }, accountId: number) {
  if (!accountId) return { status: 401, message: 'Unauthorized' };

  // Sử dụng JOIN để lấy dữ liệu trong 1 câu query
  const result = await anyDb
    .select({
      account: tables.accounts,
      user: tables.users
    })
    .from(tables.accounts)
    .leftJoin(tables.users, eq(tables.accounts.user_id, tables.users.id))
    .where(eq(tables.accounts.id, accountId))
    .limit(1);

  const data = result[0];

  // 3. Kiểm tra kết quả
  if (!data || !data.account) {
    return { status: 404, message: 'Không tìm thấy tài khoản' };
  }

  const { account, user } = data;

  return {
    status: 200,
    id: user?.id ?? account.user_id,
    fullname: user?.fullname || '',
    phone: user?.phone || '',
    gender: user?.gender ?? null,
    dob: user?.dob ?? null,
    email: account.email, // Trả về email gốc trong DB
    is_active: account.is_active ?? true,
    login_type: account.login_type || 'email',
    user_created_at: user?.created_at ?? null,
    user_updated_at: user?.updated_at ?? null,
    account_created_at: account.created_at ?? null
  };
}

export async function listUserTransactionsImpl(
  anyDb: any,
  tables: {
    accounts: any;
    bookings: any;
    movies: any;
    ticket_packages: any;
    booking_vr_items?: any;
    vouchers?: any;
  },
  args: {
    accountId?: number;
    email?: string;
    status: string;
    page: number;
    pageSize: number;
    sort: string;
    dir: 'asc' | 'desc';
    payment_method: string;
    from?: string;
    to?: string;
  }
) {
  const { accountId, status, page, pageSize, sort, dir, payment_method, from: fromStr, to: toStr } = args;
  const skip = (page - 1) * pageSize;

  if (!accountId) return { items: [], page, pageSize, total: 0 };

  const account = await anyDb.query.accounts.findFirst({
    where: eq(tables.accounts.id, accountId)
  });

  if (!account) return { items: [], page, pageSize, total: 0 };

  // 3. Xây dựng điều kiện lọc (Theo user_id hoặc email của tài khoản)
  const userFilter = account.user_id
    ? or(
        eq(tables.bookings.user_id, account.user_id),
        sql`lower(${tables.bookings.email}) = ${account.email.toLowerCase()}`
      )
    : sql`lower(${tables.bookings.email}) = ${account.email.toLowerCase()}`;

  const conditions: any[] = [userFilter];

  // Calculate 10 minutes ago
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  const tenMinutesAgoStr = formatDateForDb(tenMinutesAgo);

  const mainFilter = or(
    eq(tables.bookings.payment_status, 'paid'),
    and(sql`lower(${tables.bookings.payment_status}) = 'pending'`, gte(tables.bookings.created_at, tenMinutesAgoStr))
  );

  conditions.push(mainFilter);

  if (payment_method && payment_method.toLowerCase() !== 'all') {
    conditions.push(sql`lower(${tables.bookings.payment_method}) = ${payment_method.toLowerCase()}`);
  }
  // Xử lý ngày tháng (Đảm bảo formatDateForDb trả về string ISO hoặc format SQLite hiểu)
  if (fromStr || toStr) {
    const from = fromStr ? formatDateForDb(new Date(fromStr)) : null;
    const to = toStr ? formatDateForDb(new Date(toStr)) : null;

    const dateConditions: any[] = [];
    if (from && to) {
      dateConditions.push(and(gte(tables.bookings.created_at, from), lte(tables.bookings.created_at, to)));
      dateConditions.push(and(gte(tables.bookings.paid_at, from), lte(tables.bookings.paid_at, to)));
    } else if (from) {
      dateConditions.push(gte(tables.bookings.created_at, from), gte(tables.bookings.paid_at, from));
    } else if (to) {
      dateConditions.push(lte(tables.bookings.created_at, to), lte(tables.bookings.paid_at, to));
    }
    if (dateConditions.length > 0) conditions.push(or(...dateConditions));
  }
  const whereClause = and(...conditions);

  // 4. Lấy Total Count
  const [totalResult] = await anyDb.select({ count: count() }).from(tables.bookings).where(whereClause);
  const total = totalResult?.count ?? 0;

  // 5. Query chính sử dụng JOIN thay vì `with` (Để tránh lỗi D1 json_array)
  const sortCol = sort === 'paid_at' ? tables.bookings.paid_at : tables.bookings.created_at;
  const sortDir = dir === 'asc' ? asc(sortCol) : desc(sortCol);

  const rows = await anyDb
    .select({
      booking: tables.bookings,
      movie: tables.movies,
      ticket_package: tables.ticket_packages
    })
    .from(tables.bookings)
    .leftJoin(tables.movies, eq(tables.bookings.movie_id, tables.movies.id))
    .leftJoin(tables.ticket_packages, eq(tables.bookings.ticket_package_id, tables.ticket_packages.id))
    .where(whereClause)
    .orderBy(sortDir)
    .offset(skip)
    .limit(pageSize);

  // 5b. Batch-load VR items for returned bookings
  const bookingIds = rows.map((r: any) => r.booking.id).filter(Boolean);
  const vrItemsMap: Record<number, any[]> = {};

  if (bookingIds.length > 0 && tables.booking_vr_items) {
    try {
      const vrRows = await anyDb
        .select()
        .from(tables.booking_vr_items)
        .where(inArray(tables.booking_vr_items.booking_id, bookingIds));

      for (const item of vrRows) {
        const bId = Number(item.booking_id);
        if (!vrItemsMap[bId]) vrItemsMap[bId] = [];
        vrItemsMap[bId].push(item);
      }
    } catch (e) {
      console.warn('[listUserTransactionsImpl] Could not batch load booking_vr_items:', e);
    }
  }

  // 5c. Batch-load voucher details for bookings that used a voucher
  const voucherIds = [
    ...new Set(
      rows
        .map((r: any) => r.booking.voucher_id)
        .filter((id: any) => id != null && Number(id) > 0)
        .map((id: any) => Number(id))
    )
  ];
  const voucherMap: Record<
    number,
    { scope: string; description: string | null; applicable_ids: any }
  > = {};

  if (voucherIds.length > 0 && tables.vouchers) {
    try {
      const voucherRows = await anyDb
        .select()
        .from(tables.vouchers)
        .where(inArray(tables.vouchers.id, voucherIds));

      for (const v of voucherRows) {
        voucherMap[Number(v.id)] = {
          scope: v.scope || 'all',
          description: v.description || null,
          applicable_ids: v.applicable_ticket_package_ids ?? null
        };
      }
    } catch (e) {
      console.warn('[listUserTransactionsImpl] Could not batch load vouchers:', e);
    }
  }

  // 6. Map lại dữ liệu về cấu trúc chuẩn
  const now = new Date();
  const mapped = rows.map((row: any) => {
    const b = row.booking;
    const movie = row.movie;
    const pkg = row.ticket_package;

    const expiryAt = b.expiry_date ? new Date(b.expiry_date) : null;
    const expired = !!(expiryAt && now.getTime() > expiryAt.getTime());
    const daysLeft = expiryAt ? Math.ceil((expiryAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
    const voucherDetails =
      b.voucher_id && voucherMap[Number(b.voucher_id)] ? voucherMap[Number(b.voucher_id)] : null;

    return {
      booking_id: b.id,
      booking_code: b.booking_code,
      pay_txt_code: b.pay_txt_code,
      booking_type: b.booking_type || 'movie',
      user_id: b.user_id,
      movie: b.movie_title || '',
      ticket_package: b.ticket_package_name || '',
      quantity: Number(b.ticket_count || 0),
      amount: Number(b.total_price || 0),
      original_amount: Number(b.original_total_price || b.total_price || 0),
      discount_amount: Number(b.voucher_discount_amount || 0),
      voucher_code: b.voucher_code_snapshot || null,
      voucher_details: voucherDetails,
      ticket_unit_price: Number(b.ticket_unit_price || 0),
      method: b.payment_method || '',
      payment_status: b.payment_status || '',
      created_at: b.created_at,
      updated_at: b.updated_at,
      paid_at: b.paid_at,
      expiry_date: b.expiry_date,
      expired,
      days_left: daysLeft,
      is_used: !!b.is_used,
      name: b.name || '',
      phone: b.phone || '',
      email: b.email,
      poster_url: b.movie_poster || '',
      combo: b.combo || '',
      movie_duration: b.movie_duration || '',
      vr_items: vrItemsMap[b.id] || []
    };
  });

  return { items: mapped, page, pageSize, total };
}
