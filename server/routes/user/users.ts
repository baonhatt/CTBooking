import { eq, and, inArray, sql, gte, lte, or, desc, asc, count, SQL } from 'drizzle-orm';
import { formatDateForDb } from '../../lib/date-utils';
import { vnRangeFromInputs, sqlListedInRange } from '../../lib/vn-time';
import { isPaymentReceivedLate } from './booking/access';

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
  if (typeof name === 'string') {
    // Same rules as registration (registerSchema in userRouter.ts): no < or >, so a name can never carry HTML
    // into an email or an admin page
    const trimmedName = name.trim();
    if (!trimmedName) return { status: 400, message: 'Tên không được để trống' };
    if (trimmedName.length > 100) return { status: 400, message: 'Tên tối đa 100 ký tự' };
    if (/[<>]/.test(trimmedName)) return { status: 400, message: 'Tên không được chứa ký tự < hoặc >' };
    updateData.fullname = trimmedName;
  }
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
    booking_vr_items?: any;
    vouchers?: any;
    branches?: any;
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
    /**
     * Makes the per-order token for one of the customer's own unpaid orders, so "continue payment" works from the
     * history. Left out when the signing secret is not configured: the history still loads, just without the token.
     */
    getOrderToken?: (booking: { id: number; pay_txt_code: string }) => Promise<string>;
  }
) {
  const { accountId, status, page, pageSize, sort, dir, payment_method, from: fromStr, to: toStr, getOrderToken } = args;
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
    and(sql`lower(${tables.bookings.payment_status}) = 'pending'`, gte(tables.bookings.created_at, tenMinutesAgoStr)),
    // A closed order whose money arrived late stays in the list, so the customer sees it is awaiting confirmation
    // (same rule as isPaymentReceivedLate in booking/access.ts)
    and(
      sql`lower(${tables.bookings.payment_status}) in ('failed', 'cancelled', 'expired')`,
      sql`trim(coalesce(${tables.bookings.transaction_id}, '')) <> ''`
    )
  );

  conditions.push(mainFilter);

  if (payment_method && payment_method.toLowerCase() !== 'all') {
    conditions.push(sql`lower(${tables.bookings.payment_method}) = ${payment_method.toLowerCase()}`);
  }
  // Xử lý ngày tháng (Đảm bảo formatDateForDb trả về string ISO hoặc format SQLite hiểu)
  if (fromStr || toStr) {
    // Vietnam time: a date alone is the whole day. Paid orders by the day paid, the others by the day created.
    conditions.push(sqlListedInRange(tables.bookings, vnRangeFromInputs(fromStr, toStr)));
  }
  const whereClause = and(...conditions);

  // 4. Lấy Total Count
  const [totalResult] = await anyDb.select({ count: count() }).from(tables.bookings).where(whereClause);
  const total = totalResult?.count ?? 0;

  // 5. Query chính sử dụng JOIN thay vì `with` (Để tránh lỗi D1 json_array)
  const sortCol = sort === 'paid_at' ? tables.bookings.paid_at : tables.bookings.created_at;
  const sortDir = dir === 'asc' ? asc(sortCol) : desc(sortCol);

  // Only the booking columns the account page reads (the movie title, poster and package name are copied onto the
  // booking when it is made, so no join is needed)
  const bookings = tables.bookings;
  const rows = await anyDb
    .select({
      booking: {
        id: bookings.id,
        booking_code: bookings.booking_code,
        pay_txt_code: bookings.pay_txt_code,
        payment_expires_at: bookings.payment_expires_at,
        branch_id: bookings.branch_id,
        booking_type: bookings.booking_type,
        movie_title: bookings.movie_title,
        ticket_package_name: bookings.ticket_package_name,
        ticket_count: bookings.ticket_count,
        total_price: bookings.total_price,
        original_total_price: bookings.original_total_price,
        voucher_discount_amount: bookings.voucher_discount_amount,
        voucher_code_snapshot: bookings.voucher_code_snapshot,
        voucher_id: bookings.voucher_id,
        payment_method: bookings.payment_method,
        payment_status: bookings.payment_status,
        transaction_id: bookings.transaction_id,
        created_at: bookings.created_at,
        updated_at: bookings.updated_at,
        paid_at: bookings.paid_at,
        expiry_date: bookings.expiry_date,
        is_used: bookings.is_used,
        combo: bookings.combo
      }
    })
    .from(bookings)
    .where(whereClause)
    .orderBy(sortDir)
    .offset(skip)
    .limit(pageSize);

  // 5b. Batch-load VR items for returned bookings
  const bookingIds = rows.map((r: any) => r.booking.id).filter(Boolean);
  const vrItemsMap: Record<number, any[]> = {};

  if (bookingIds.length > 0 && tables.booking_vr_items) {
    try {
      // The columns the ticket dialog and the payment page read (name, quantity, prices, package id)
      const vrRows = await anyDb
        .select({
          booking_id: tables.booking_vr_items.booking_id,
          vr_ticket_package_id: tables.booking_vr_items.vr_ticket_package_id,
          package_name: tables.booking_vr_items.package_name,
          quantity: tables.booking_vr_items.quantity,
          unit_price: tables.booking_vr_items.unit_price,
          line_total: tables.booking_vr_items.line_total
        })
        .from(tables.booking_vr_items)
        .where(inArray(tables.booking_vr_items.booking_id, bookingIds));

      for (const item of vrRows) {
        const bId = Number(item.booking_id);
        if (!vrItemsMap[bId]) vrItemsMap[bId] = [];
        const { booking_id: _bookingId, ...line } = item;
        vrItemsMap[bId].push(line);
      }
    } catch (e) {
      console.warn('[listUserTransactionsImpl] Could not batch load booking_vr_items:', e);
    }
  }

  // 5b2. The branch of each order: a ticket is only good at the branch it was bought for, so the ticket shows it
  const branchMap: Record<number, { name: string; address: string }> = {};
  const branchIds = [...new Set(rows.map((r: any) => Number(r.booking.branch_id)).filter((id: number) => id > 0))];
  if (branchIds.length > 0 && tables.branches) {
    try {
      const branchRows = await anyDb
        .select({ id: tables.branches.id, name: tables.branches.name, address: tables.branches.address })
        .from(tables.branches)
        .where(inArray(tables.branches.id, branchIds));
      for (const branch of branchRows) {
        branchMap[Number(branch.id)] = { name: branch.name || '', address: branch.address || '' };
      }
    } catch (e) {
      console.warn('[listUserTransactionsImpl] Could not load branches:', e);
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
  // Only what marks the discounted lines of the ticket: the voucher's scope and its packages. Its description is
  // not sent (it is JSON that also holds the Sales person's id and email).
  const voucherMap: Record<number, { scope: string; applicable_ids: any }> = {};

  if (voucherIds.length > 0 && tables.vouchers) {
    try {
      const voucherRows = await anyDb
        .select({
          id: tables.vouchers.id,
          scope: tables.vouchers.scope,
          applicable_ticket_package_ids: tables.vouchers.applicable_ticket_package_ids
        })
        .from(tables.vouchers)
        .where(inArray(tables.vouchers.id, voucherIds));

      for (const v of voucherRows) {
        voucherMap[Number(v.id)] = {
          scope: v.scope || 'all',
          applicable_ids: v.applicable_ticket_package_ids ?? null
        };
      }
    } catch (e) {
      console.warn('[listUserTransactionsImpl] Could not batch load vouchers:', e);
    }
  }

  // 5d. Order tokens for the customer's own unpaid orders (the list only holds the account's own orders)
  const orderTokens = new Map<number, string>();
  if (getOrderToken) {
    for (const row of rows) {
      const b = row.booking;
      if (String(b.payment_status || '').toLowerCase() === 'pending' && b.pay_txt_code) {
        try {
          orderTokens.set(Number(b.id), await getOrderToken({ id: Number(b.id), pay_txt_code: b.pay_txt_code }));
        } catch (tokenError) {
          console.error('[listUserTransactions] Could not make an order token:', tokenError);
        }
      }
    }
  }

  // 6. Map lại dữ liệu về cấu trúc chuẩn
  const mapped = rows.map((row: any) => {
    const b = row.booking;
    const voucherDetails =
      b.voucher_id && voucherMap[Number(b.voucher_id)] ? voucherMap[Number(b.voucher_id)] : null;

    return {
      booking_id: b.id,
      booking_code: b.booking_code,
      pay_txt_code: b.pay_txt_code,
      order_token: orderTokens.get(Number(b.id)) ?? null,
      payment_expires_at: b.payment_expires_at ?? null,
      branch_id: b.branch_id ?? null,
      branch_name: branchMap[Number(b.branch_id)]?.name || null,
      branch_address: branchMap[Number(b.branch_id)]?.address || null,
      booking_type: b.booking_type || 'movie',
      movie: b.movie_title || '',
      ticket_package: b.ticket_package_name || '',
      quantity: Number(b.ticket_count || 0),
      amount: Number(b.total_price || 0),
      original_amount: Number(b.original_total_price || b.total_price || 0),
      discount_amount: Number(b.voucher_discount_amount || 0),
      voucher_code: b.voucher_code_snapshot || null,
      voucher_details: voucherDetails,
      method: b.payment_method || '',
      payment_status: b.payment_status || '',
      payment_received_late: isPaymentReceivedLate(b),
      created_at: b.created_at,
      updated_at: b.updated_at,
      paid_at: b.paid_at,
      expiry_date: b.expiry_date,
      is_used: !!b.is_used,
      combo: b.combo || '',
      vr_items: vrItemsMap[b.id] || []
    };
  });

  // server_now lets the browser count the payment deadline against the server's clock
  return { items: mapped, page, pageSize, total, server_now: formatDateForDb(new Date()) };
}
