import { eq, and, or, gte, lte, inArray, desc, asc, sum, count, sql } from 'drizzle-orm';
import { formatDateForDb } from '../../../server/lib/date-utils';

export async function getRevenueImpl(
  anyDb: any,
  tables: { bookings: any },
  args: { from?: string; to?: string; status?: string; restrictToBranchIds?: number[] | null }
) {
  const from = args.from ? new Date(args.from) : undefined;
  const to = args.to ? new Date(args.to) : undefined;
  const status = String(args.status || 'paid').toLowerCase();
  const whereParts: any[] = [];
  if (status !== 'all') whereParts.push(inArray(tables.bookings.payment_status, ['paid']));
  if (args.restrictToBranchIds !== null && args.restrictToBranchIds !== undefined) {
    if (args.restrictToBranchIds.length === 0) {
      whereParts.push(sql`1 = 0`);
    } else {
      whereParts.push(inArray(tables.bookings.branch_id, args.restrictToBranchIds));
    }
  }
  let dateCondition = undefined as any;
  if (from && to) {
    dateCondition = or(
      and(gte(tables.bookings.paid_at, formatDateForDb(from)), lte(tables.bookings.paid_at, formatDateForDb(to))),
      and(gte(tables.bookings.created_at, formatDateForDb(from)), lte(tables.bookings.created_at, formatDateForDb(to)))
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
  const finalWhere = and(...whereParts, dateCondition);
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
    vouchers?: any;
  },
  args: {
    page: number;
    pageSize: number;
    searchText: string;
    status: string;
    sort: string;
    dir: 'asc' | 'desc';
    payment_method: string;
    branch_id?: number | null;
    from?: string;
    to?: string;
    booking_type?: 'all' | 'movie' | 'vr';
    restrictToBranchIds?: number[] | null;
    sale_staff_id?: number | string | null;
  }
) {
  const {
    page,
    pageSize,
    searchText,
    status,
    sort,
    dir,
    payment_method,
    branch_id,
    from,
    to,
    booking_type = 'all',
    restrictToBranchIds = null
  } = args;
  const skip = (page - 1) * pageSize;
  const whereCondition: any[] = [];

  // Filter theo status
  if (status && status !== 'all') whereCondition.push(eq(tables.bookings.payment_status, status));

  // Filter theo phương thức thanh toán
  if (payment_method) whereCondition.push(eq(tables.bookings.payment_method, payment_method));

  // Filter theo loại booking (movie / vr)
  if (booking_type && booking_type !== 'all') {
    whereCondition.push(eq(tables.bookings.booking_type, booking_type));
  }

  // Filter theo chi nhánh
  if (branch_id !== undefined && branch_id !== null) {
    whereCondition.push(eq(tables.bookings.branch_id, Number(branch_id)));
  }
  if (restrictToBranchIds !== null && restrictToBranchIds !== undefined) {
    if (restrictToBranchIds.length === 0) {
      whereCondition.push(sql`1 = 0`);
    } else {
      whereCondition.push(inArray(tables.bookings.branch_id, restrictToBranchIds));
    }
  }

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
      whereCondition.push(or(gte(createdField, formatDateForDb(f)), gte(paidField, formatDateForDb(f))));
    } else if (t) {
      whereCondition.push(or(lte(createdField, formatDateForDb(t)), lte(paidField, formatDateForDb(t))));
    }
  }

  // Search
  if (searchText) {
    const isNumber = /^\d+$/.test(searchText);
    const lowerSearchText = searchText.toLowerCase();

    if (isNumber) {
      whereCondition.push(eq(tables.bookings.id, Number(searchText)));
    } else {
      whereCondition.push(
        or(
          sql`LOWER(${tables.bookings.email}) LIKE ${`%${lowerSearchText}%`}`,
          sql`LOWER(${tables.bookings.booking_code}) LIKE ${`%${lowerSearchText}%`}`,
          sql`LOWER(${tables.bookings.pay_txt_code}) LIKE ${`%${lowerSearchText}%`}`,
          sql`LOWER(${tables.bookings.voucher_code_snapshot}) LIKE ${`%${lowerSearchText}%`}`
        )
      );
    }
  }

  const finalWhere = and(...whereCondition);

  // Query đếm tổng số bản ghi
  const [totalRes] = await anyDb.select({ count: count() }).from(tables.bookings).where(finalWhere);

  const total = totalRes?.count || 0;

  // Query lấy dữ liệu chi tiết
  let selectFields: any = {
    booking: tables.bookings,
    user: tables.users,
    account_email: tables.accounts.email,
    movie_title: tables.movies.title,
    ticket_package_name: tables.ticket_packages.name
  };

  if (tables.vouchers) {
    selectFields.voucher = tables.vouchers;
  }

  let query = anyDb
    .select(selectFields)
    .from(tables.bookings)
    .leftJoin(tables.users, eq(tables.bookings.user_id, tables.users.id))
    .leftJoin(tables.accounts, eq(tables.users.id, tables.accounts.user_id))
    .leftJoin(tables.movies, eq(tables.bookings.movie_id, tables.movies.id))
    .leftJoin(tables.ticket_packages, eq(tables.bookings.ticket_package_id, tables.ticket_packages.id));

  if (tables.vouchers) {
    query = query.leftJoin(tables.vouchers, eq(tables.bookings.voucher_id, tables.vouchers.id));
  }

  const itemsRaw = await query
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

    let sale_staff_id = null;
    let sale_name = null;
    let sale_email = null;

    if (row.voucher?.description) {
      try {
        const trimmed = row.voucher.description.trim();
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
          const meta = JSON.parse(trimmed);
          sale_staff_id = meta.sale_staff_id ? Number(meta.sale_staff_id) : null;
          sale_name = meta.sale_name || null;
          sale_email = meta.sale_email || null;
        }
      } catch {}
    }

    return {
      id: tx.id,
      bookingId: tx.id,
      booking_code: tx.booking_code || `BK${tx.id}`,
      user_id: tx.user_id,
      branch_id: tx.branch_id,
      email: tx.email || '',
      phone: tx.phone || '',
      name: tx.name || row.user?.fullname || '',
      userName: row.user?.fullname || 'Khách Vãng Lai',
      ticket_package_name: tx.ticket_package_name || '',
      ticketCount: tx.ticket_count,
      is_used: tx.is_used,
      totalPrice: Number(tx.total_price),
      originalTotalPrice: Number(tx.original_total_price || tx.total_price || 0),
      paymentMethod: tx.payment_method,
      paymentStatus: tx.payment_status,
      transactionId: tx.transaction_id,
      createdAt: tx.created_at,
      paidAt: tx.paid_at,
      updatedAt: tx.updated_at,
      expiryDate: tx.expiry_date || null,
      expired,
      daysLeft,
      booking_type: tx.booking_type || 'movie',
      voucher_id: tx.voucher_id,
      voucher_code: tx.voucher_code_snapshot || row.voucher?.code || null,
      voucher_discount_amount: Number(tx.voucher_discount_amount || 0),
      payment_expires_at: tx.payment_expires_at || null,
      sale_staff_id,
      sale_name,
      sale_email
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
    branches: any;
    auditLogs: any;
    booking_vr_items?: any;
    vouchers?: any;
  },
  id: number,
  restrictToBranchIds: number[] | null = null
) {
  // 1. Truy vấn join
  const rows = await anyDb
    .select({
      booking: {
        id: tables.bookings.id,
        booking_type: tables.bookings.booking_type,
        name: tables.bookings.name,
        email: tables.bookings.email,
        phone: tables.bookings.phone,
        branch_id: tables.bookings.branch_id,
        ticket_unit_price: tables.bookings.ticket_unit_price,
        ticket_count: tables.bookings.ticket_count,
        total_price: tables.bookings.total_price,
        original_total_price: tables.bookings.original_total_price,
        voucher_id: tables.bookings.voucher_id,
        voucher_code_snapshot: tables.bookings.voucher_code_snapshot,
        voucher_discount_amount: tables.bookings.voucher_discount_amount,
        combo: tables.bookings.combo,
        pay_txt_code: tables.bookings.pay_txt_code,
        booking_code: tables.bookings.booking_code,
        checked_in_at: tables.bookings.checked_in_at,
        is_used: tables.bookings.is_used,
        created_at: tables.bookings.created_at,
        updated_at: tables.bookings.updated_at,
        payment_method: tables.bookings.payment_method,
        payment_status: tables.bookings.payment_status,
        transaction_id: tables.bookings.transaction_id,
        paid_at: tables.bookings.paid_at,
        expiry_date: tables.bookings.expiry_date,
        ticket_package_name: tables.bookings.ticket_package_name
      },
      account: {
        email: tables.accounts.email,
        is_active: tables.accounts.is_active
      },
      ticket_package: {
        name: tables.ticket_packages.name
      },
      branch: {
        name: tables.branches.name
      }
    })
    .from(tables.bookings)
    .leftJoin(tables.users, eq(tables.bookings.user_id, tables.users.id))
    .leftJoin(tables.accounts, eq(tables.users.id, tables.accounts.user_id))
    .leftJoin(tables.ticket_packages, eq(tables.bookings.ticket_package_id, tables.ticket_packages.id))
    .leftJoin(tables.branches, eq(tables.bookings.branch_id, tables.branches.id))
    .where(
      restrictToBranchIds && restrictToBranchIds.length > 0
        ? and(eq(tables.bookings.id, id), inArray(tables.bookings.branch_id, restrictToBranchIds))
        : eq(tables.bookings.id, id)
    );

  if (!rows || rows.length === 0) return null;

  const { booking, account, ticket_package, branch } = rows[0];

  // 2. Tính toán thời gian và trạng thái
  const now = new Date();
  const expiryAt = booking.expiry_date ? new Date(booking.expiry_date) : null;
  const expired = Boolean(expiryAt && now.getTime() > expiryAt.getTime());
  const daysLeft = expiryAt ? Math.ceil((expiryAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;

  // 3. Xử lý combo phim
  let comboMovies: any[] = [];
  if (booking.combo) {
    try {
      let movieIds: any[] = [];
      if (Array.isArray(booking.combo)) {
        movieIds = booking.combo;
      } else if (typeof booking.combo === 'string') {
        if (booking.combo.includes('|')) {
          movieIds = booking.combo
            .split('|')
            .map((x: string) => x.trim())
            .filter(Boolean);
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

  // 4. Audit logs
  const [createLog] = await anyDb
    .select()
    .from(tables.auditLogs)
    .where(
      and(
        eq(tables.auditLogs.entityType, 'booking'),
        eq(tables.auditLogs.entityId, String(id)),
        eq(tables.auditLogs.action, 'create')
      )
    )
    .orderBy(tables.auditLogs.createdAt)
    .limit(1);

  const [updateLog] = await anyDb
    .select()
    .from(tables.auditLogs)
    .where(
      and(
        eq(tables.auditLogs.entityType, 'booking'),
        eq(tables.auditLogs.entityId, String(id)),
        eq(tables.auditLogs.action, 'update')
      )
    )
    .orderBy(desc(tables.auditLogs.createdAt))
    .limit(1);

  // 5. Load vr_items từ bảng booking_vr_items
  let vr_items: any[] = [];
  const bType = booking.booking_type || 'movie';
  if (tables.booking_vr_items) {
    try {
      vr_items = await anyDb
        .select()
        .from(tables.booking_vr_items)
        .where(eq(tables.booking_vr_items.booking_id, id))
        .orderBy(tables.booking_vr_items.id);
    } catch (e) {
      console.warn('Could not load vr_items for transaction:', e);
    }
  }

  // 6. Load voucher and sale info
  let sale_staff_id = null;
  let sale_name = null;
  let sale_email = null;

  if (booking.voucher_id && tables.vouchers) {
    try {
      const v = await anyDb.query.vouchers.findFirst({ where: eq(tables.vouchers.id, booking.voucher_id) });
      if (v?.description) {
        const trimmed = v.description.trim();
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
          const meta = JSON.parse(trimmed);
          sale_staff_id = meta.sale_staff_id ? Number(meta.sale_staff_id) : null;
          sale_name = meta.sale_name || null;
          sale_email = meta.sale_email || null;
        }
      }
    } catch {}
  }

  return {
    id: booking.id,
    booking_type: bType,
    vr_items,
    user: {
      email_auth: account?.email || '',
      fullname: booking.name || 'Tên mặc định',
      email: booking.email || '',
      phone: booking.phone || '',
      is_active: account?.is_active ?? true
    },
    branch: {
      id: booking.branch_id,
      name: branch?.name || 'Vãng lai'
    },
    ticket_package: {
      name: ticket_package?.name || booking.ticket_package_name || '',
      ticket_unit_price: booking.ticket_unit_price,
      movies: comboMovies
    },
    voucher_info: {
      voucher_id: booking.voucher_id,
      voucher_code: booking.voucher_code_snapshot || null,
      voucher_discount_amount: Number(booking.voucher_discount_amount || 0),
      original_total_price: Number(booking.original_total_price || booking.total_price || 0),
      sale_staff_id,
      sale_name,
      sale_email
    },
    booking_details: {
      ticket_count: booking.ticket_count,
      total_price: Number(booking.total_price),
      original_total_price: Number(booking.original_total_price || booking.total_price || 0),
      combo: booking?.combo
        ? Array.isArray(booking.combo)
          ? booking.combo
          : (() => {
              try {
                if (typeof booking.combo === 'string' && booking.combo.includes('|')) {
                  return booking.combo
                    .split('|')
                    .map((x: string) => x.trim())
                    .filter(Boolean);
                }
                return typeof booking.combo === 'string' ? JSON.parse(booking.combo) : [];
              } catch {
                return [];
              }
            })()
        : [],
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
    },
    tracking: {
      created_by_staff_name: createLog?.staffFullname || null,
      updated_by_staff_name: updateLog?.staffFullname || null
    }
  };
}
