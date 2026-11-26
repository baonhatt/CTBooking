import { eq, and, or, inArray, desc, asc, count, sql } from 'drizzle-orm';
import { formatDateForDb } from '../../../server/lib/date-utils';
import { vnRangeFromInputs, sqlPaidInRange, sqlListedInRange, sqlCreatedInRange } from '../../../server/lib/vn-time';
import { chunk } from '../../../server/lib/paging';

export async function listTransactionsImpl(
  anyDb: any,
  tables: {
    bookings: any;
    users: any;
    accounts: any;
    movies: any;
    ticket_packages: any;
    vouchers?: any;
    booking_vr_items?: any;
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

  // Filter theo khoảng thời gian (giờ Việt Nam): a date alone is the whole day, both ends included.
  // Paid orders are found by the day they were paid, the others by the day they were created.
  if (from || to) {
    const range = vnRangeFromInputs(from, to);
    if (status === 'paid') {
      whereCondition.push(sqlPaidInRange(tables.bookings, range));
    } else if (status && status !== 'all') {
      whereCondition.push(sqlCreatedInRange(tables.bookings, range));
    } else {
      whereCondition.push(sqlListedInRange(tables.bookings, range));
    }
  }

  // Search
  if (searchText) {
    const isNumber = /^\d+$/.test(searchText);
    const lowerSearchText = searchText.toLowerCase();

    // Staff search by email, phone, booking code, pay code or voucher. A number can also be the booking's own id,
    // a phone number or part of a code, so those are all tried together.
    const textMatches = [
      sql`LOWER(${tables.bookings.email}) LIKE ${`%${lowerSearchText}%`}`,
      sql`${tables.bookings.phone} LIKE ${`%${searchText}%`}`,
      sql`LOWER(${tables.bookings.booking_code}) LIKE ${`%${lowerSearchText}%`}`,
      sql`LOWER(${tables.bookings.pay_txt_code}) LIKE ${`%${lowerSearchText}%`}`,
      sql`LOWER(${tables.bookings.voucher_code_snapshot}) LIKE ${`%${lowerSearchText}%`}`
    ];
    if (isNumber) textMatches.push(eq(tables.bookings.id, Number(searchText)));
    whereCondition.push(or(...textMatches));
  }

  const finalWhere = and(...whereCondition);

  // Query đếm tổng số bản ghi
  const [totalRes] = await anyDb.select({ count: count() }).from(tables.bookings).where(finalWhere);

  const total = totalRes?.count || 0;

  // Only the columns the list, the screen and the exports read. The join to accounts (several per user) is gone:
  // it doubled the rows of a user with two accounts, and nothing read its email.
  const bookingColumns = {
    id: tables.bookings.id,
    booking_code: tables.bookings.booking_code,
    pay_txt_code: tables.bookings.pay_txt_code,
    branch_id: tables.bookings.branch_id,
    email: tables.bookings.email,
    phone: tables.bookings.phone,
    ticket_package_name: tables.bookings.ticket_package_name,
    ticket_count: tables.bookings.ticket_count,
    is_used: tables.bookings.is_used,
    total_price: tables.bookings.total_price,
    original_total_price: tables.bookings.original_total_price,
    payment_method: tables.bookings.payment_method,
    payment_status: tables.bookings.payment_status,
    created_at: tables.bookings.created_at,
    paid_at: tables.bookings.paid_at,
    updated_at: tables.bookings.updated_at,
    expiry_date: tables.bookings.expiry_date,
    booking_type: tables.bookings.booking_type,
    voucher_code_snapshot: tables.bookings.voucher_code_snapshot,
    voucher_discount_amount: tables.bookings.voucher_discount_amount
  };
  const selectFields: any = {
    booking: bookingColumns,
    user_fullname: tables.users.fullname
  };

  if (tables.vouchers) {
    // The voucher description holds the sale person as JSON
    selectFields.voucher_code = tables.vouchers.code;
    selectFields.voucher_description = tables.vouchers.description;
  }

  let query = anyDb
    .select(selectFields)
    .from(tables.bookings)
    .leftJoin(tables.users, eq(tables.bookings.user_id, tables.users.id));

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

  const vrBookingIds = Array.from(new Set(itemsRaw.map((r: any) => r.booking.id)));
  let vrItemsByBooking: Record<number, Array<{ package_name: string; quantity: number }>> = {};
  if (tables.booking_vr_items && vrBookingIds.length > 0) {
    const vrRows: any[] = [];
    for (const idChunk of chunk(vrBookingIds as number[], 100)) {
      const rowsOfChunk = await anyDb
        .select({
          booking_id: tables.booking_vr_items.booking_id,
          package_name: tables.booking_vr_items.package_name,
          quantity: tables.booking_vr_items.quantity
        })
        .from(tables.booking_vr_items)
        .where(inArray(tables.booking_vr_items.booking_id, idChunk));
      vrRows.push(...rowsOfChunk);
    }

    vrItemsByBooking = vrRows.reduce((acc: any, row: any) => {
      const bid = row.booking_id;
      if (!acc[bid]) acc[bid] = [];
      acc[bid].push({
        package_name: row.package_name || 'Gói VR',
        quantity: Number(row.quantity || 1)
      });
      return acc;
    }, {} as Record<number, Array<{ package_name: string; quantity: number }>>);
  }

  const items = itemsRaw.map((row: any) => {
    const tx = row.booking;
    const now = new Date();
    const expiryAt = tx.expiry_date ? new Date(tx.expiry_date) : null;
    const expired = Boolean(expiryAt && now.getTime() > expiryAt.getTime());

    let sale_name = null;
    let sale_email = null;

    if (row.voucher_description) {
      try {
        const trimmed = row.voucher_description.trim();
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
          const meta = JSON.parse(trimmed);
          sale_name = meta.sale_name || null;
          sale_email = meta.sale_email || null;
        }
      } catch {}
    }

    // The number of tickets is what the order itself says. Adding the VR lines on top counted them twice.
    const vrItems = vrItemsByBooking[tx.id] || [];
    const finalTicketCount = Number(tx.ticket_count || 0);

    // Only what the list screen and the exports read
    return {
      id: tx.id,
      booking_code: tx.booking_code || tx.pay_txt_code || `BK${tx.id}`,
      branch_id: tx.branch_id,
      email: tx.email || '',
      phone: tx.phone || '',
      userName: row.user_fullname || 'Khách Vãng Lai',
      ticket_package_name: tx.ticket_package_name || '',
      vr_items: vrItems,
      ticketCount: finalTicketCount,
      is_used: tx.is_used,
      totalPrice: Number(tx.total_price),
      originalTotalPrice: Number(tx.original_total_price || tx.total_price || 0),
      paymentMethod: tx.payment_method,
      paymentStatus: tx.payment_status,
      createdAt: tx.created_at,
      paidAt: tx.paid_at,
      updatedAt: tx.updated_at,
      expired,
      booking_type: tx.booking_type || 'movie',
      voucher_code: tx.voucher_code_snapshot || row.voucher_code || null,
      voucher_discount_amount: Number(tx.voucher_discount_amount || 0),
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
    staffs?: any;
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
        payment_expires_at: tables.bookings.payment_expires_at,
        confirmed_by_staff_id: tables.bookings.confirmed_by_staff_id,
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
      },
      movie: {
        title: tables.movies.title
      }
    })
    .from(tables.bookings)
    .leftJoin(tables.users, eq(tables.bookings.user_id, tables.users.id))
    .leftJoin(tables.accounts, eq(tables.users.id, tables.accounts.user_id))
    .leftJoin(tables.ticket_packages, eq(tables.bookings.ticket_package_id, tables.ticket_packages.id))
    .leftJoin(tables.branches, eq(tables.bookings.branch_id, tables.branches.id))
    .leftJoin(tables.movies, eq(tables.bookings.movie_id, tables.movies.id))
    .where(
      // null = Super Admin (every branch). A list, even an empty one, limits the order to those branches.
      restrictToBranchIds
        ? and(eq(tables.bookings.id, id), inArray(tables.bookings.branch_id, restrictToBranchIds))
        : eq(tables.bookings.id, id)
    );

  if (!rows || rows.length === 0) return null;

  const { booking, account, ticket_package, branch, movie } = rows[0];

  // Name of the staff member who confirmed the payment (cash or manual confirmation)
  let confirmedByStaffName: string | null = null;
  if (booking.confirmed_by_staff_id && tables.staffs) {
    const [confirmedStaff] = await anyDb
      .select({ fullname: tables.staffs.fullname })
      .from(tables.staffs)
      .where(eq(tables.staffs.id, booking.confirmed_by_staff_id))
      .limit(1);
    confirmedByStaffName = confirmedStaff?.fullname || null;
  }

  // 2. Tính toán thời gian và trạng thái
  const now = new Date();
  const expiryAt = booking.expiry_date ? new Date(booking.expiry_date) : null;
  const expired = Boolean(expiryAt && now.getTime() > expiryAt.getTime());
  const daysLeft = expiryAt ? Math.ceil((expiryAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;

  // 4. Audit logs
  const [createLog] = await anyDb
    .select({ staffFullname: tables.auditLogs.staffFullname })
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
    .select({ staffFullname: tables.auditLogs.staffFullname })
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
      // Only the columns the detail screen reads for a VR line
      vr_items = await anyDb
        .select({
          id: tables.booking_vr_items.id,
          vr_ticket_package_id: tables.booking_vr_items.vr_ticket_package_id,
          package_name: tables.booking_vr_items.package_name,
          quantity: tables.booking_vr_items.quantity,
          unit_price: tables.booking_vr_items.unit_price,
          discounted_unit_price: tables.booking_vr_items.discounted_unit_price,
          line_total: tables.booking_vr_items.line_total
        })
        .from(tables.booking_vr_items)
        .where(eq(tables.booking_vr_items.booking_id, id))
        .orderBy(tables.booking_vr_items.id);
    } catch (e) {
      console.warn('Could not load vr_items for transaction:', e);
    }
  }

  // 6. Load voucher and sale info (the description holds the sale person as JSON; it is read here, not sent)
  let sale_name = null;
  let sale_email = null;
  let voucher_scope: string | null = null;
  let voucher_applicable_ids: any = null;

  if (booking.voucher_id && tables.vouchers) {
    try {
      const [v] = await anyDb
        .select({
          scope: tables.vouchers.scope,
          description: tables.vouchers.description,
          applicable_ticket_package_ids: tables.vouchers.applicable_ticket_package_ids
        })
        .from(tables.vouchers)
        .where(eq(tables.vouchers.id, booking.voucher_id))
        .limit(1);
      if (v) {
        voucher_scope = v.scope || 'all';
        voucher_applicable_ids = v.applicable_ticket_package_ids ?? null;
        if (v.description) {
          const trimmed = v.description.trim();
          if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            const meta = JSON.parse(trimmed);
            sale_name = meta.sale_name || null;
            sale_email = meta.sale_email || null;
          }
        }
      }
    } catch {}
  }

  return {
    id: booking.id,
    payment_expires_at: booking.payment_expires_at || null,
    booking_type: bType,
    vr_items,
    ticket_package_name: booking.ticket_package_name,
    // Title of the booked movie, so the detail screen does not have to load the ticket packages to show it
    movie_title: movie?.title || null,
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
      ticket_unit_price: booking.ticket_unit_price
    },
    voucher_info: {
      voucher_id: booking.voucher_id,
      voucher_code: booking.voucher_code_snapshot || null,
      voucher_discount_amount: Number(booking.voucher_discount_amount || 0),
      original_total_price: Number(booking.original_total_price || booking.total_price || 0),
      scope: voucher_scope,
      applicable_ids: voucher_applicable_ids,
      sale_name,
      sale_email
    },
    booking_details: {
      ticket_count: booking.ticket_count,
      total_price: Number(booking.total_price),
      original_total_price: Number(booking.original_total_price || booking.total_price || 0),
      pay_txt_code: booking?.pay_txt_code,
      booking_code: booking?.booking_code,
      confirmed_by_staff_name: confirmedByStaffName,
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
