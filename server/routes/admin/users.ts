import { eq, or, desc, count, sql, and, inArray } from 'drizzle-orm';
import { formatDateForDb } from '../../lib/date-utils';
import { logAuditAction } from '../../lib/audit-logger';

export async function getUsersImpl(
  anyDb: any,
  tables: { users: any; accounts: any; bookings: any },
  args: { page: number; pageSize: number; q: string; status?: string }
) {
  const { page, pageSize, q, status } = args;
  const skip = (page - 1) * pageSize;
  const bookingCountSq = anyDb
    .select({
      userId: tables.bookings.user_id,
      count: count(tables.bookings.id).as('count'),
      lastBookingAt: sql<string | null>`max(${tables.bookings.created_at})`.as('last_booking_at_sq')
    })
    .from(tables.bookings)
    .groupBy(tables.bookings.user_id)
    .as('booking_counts');
  const conditions: any[] = [];
  if (q) {
    const lowerQ = q.toLowerCase();
    conditions.push(
      or(
        sql`LOWER(${tables.users.fullname}) LIKE ${`%${lowerQ}%`}`,
        sql`LOWER(${tables.accounts.email}) LIKE ${`%${lowerQ}%`}`,
        sql`LOWER(${tables.users.phone}) LIKE ${`%${lowerQ}%`}`
      )
    );
  }
  // Account status filter: 'active' or 'inactive' (anything else means all)
  if (status === 'active') conditions.push(eq(tables.accounts.is_active, true));
  if (status === 'inactive') conditions.push(eq(tables.accounts.is_active, false));
  const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;
  const itemsQuery = anyDb
    .select({
      user: tables.users,
      email: sql<string>`max(${tables.accounts.email})`.as('email'),
      is_active_agg: sql<number>`max(CASE WHEN ${tables.accounts.is_active} THEN 1 ELSE 0 END)`.as('is_active_agg'),
      bookings_count: sql<number>`coalesce(max(${bookingCountSq.count}), 0)`.as('bookings_count'),
      // Login type (email / google ...) and the time of the last booking, for the list columns
      login_type_agg: sql<string>`max(${tables.accounts.login_type})`.as('login_type_agg'),
      last_booking_at: sql<string | null>`max(${bookingCountSq.lastBookingAt})`.as('last_booking_at')
    })
    .from(tables.users)
    .innerJoin(tables.accounts, eq(tables.users.id, tables.accounts.user_id))
    .leftJoin(bookingCountSq, eq(tables.users.id, bookingCountSq.userId))
    .where(whereCondition)
    .groupBy(tables.users.id)
    .orderBy(desc(tables.users.created_at))
    .limit(pageSize)
    .offset(skip);
  const items = await itemsQuery;
  const [totalRes] = await anyDb
    .select({
      count: sql<number>`count(distinct ${tables.users.id})`.as('count')
    })
    .from(tables.users)
    .innerJoin(tables.accounts, eq(tables.users.id, tables.accounts.user_id))
    .where(whereCondition);
  const total = totalRes?.count || 0;
  const mapped = items.map((item: any) => ({
    id: item.user.id,
    fullname: item.user.fullname || '',
    phone: item.user.phone || '',
    email: item.email || '',
    is_active: (item.is_active_agg ?? 1) > 0,
    total_bookings: Number(item.bookings_count || 0),
    login_type: item.login_type_agg || 'email',
    last_booking_at: item.last_booking_at || null,
    created_at: item.user.created_at,
    updated_at: item.user.updated_at
  }));
  return { items: mapped, page, pageSize, total };
}

export async function getUserByIdImpl(
  anyDb: any,
  tables: { users: any; bookings: any; movies: any; ticket_packages: any; auditLogs: any },
  id: number
) {
  const user = await anyDb.query.users.findFirst({
    where: eq(tables.users.id, id),
    with: {
      accounts: true
    }
  });

  if (!user) return null;

  // Get tracking data from audit logs
  const [createLog] = await anyDb
    .select()
    .from(tables.auditLogs)
    .where(
      and(
        eq(tables.auditLogs.entityType, 'user'),
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
        eq(tables.auditLogs.entityType, 'user'),
        eq(tables.auditLogs.entityId, String(id)),
        eq(tables.auditLogs.action, 'update')
      )
    )
    .orderBy(desc(tables.auditLogs.createdAt))
    .limit(1);

  const bookingsdata = await anyDb
    .select({
      booking: tables.bookings,
      movie: tables.movies,
      ticket_package: tables.ticket_packages
    })
    .from(tables.bookings)
    .leftJoin(tables.movies, eq(tables.bookings.movie_id, tables.movies.id))
    .leftJoin(tables.ticket_packages, eq(tables.bookings.ticket_package_id, tables.ticket_packages.id))
    .where(eq(tables.bookings.user_id, id))
    .orderBy(desc(tables.bookings.created_at))
    .limit(10);

  // Real totals: the list above is capped at 10 rows and now holds paid and unpaid bookings
  const [totalBookingsRow] = await anyDb
    .select({ count: count() })
    .from(tables.bookings)
    .where(eq(tables.bookings.user_id, id));
  const [paidBookingsRow] = await anyDb
    .select({ count: count() })
    .from(tables.bookings)
    .where(and(eq(tables.bookings.user_id, id), eq(tables.bookings.payment_status, 'paid')));
  // Money the customer really paid, and the time of the latest order (any status)
  const [paidTotalRow] = await anyDb
    .select({ total: sql<number>`coalesce(sum(${tables.bookings.total_price}), 0)` })
    .from(tables.bookings)
    .where(and(eq(tables.bookings.user_id, id), eq(tables.bookings.payment_status, 'paid')));
  const [lastBookingRow] = await anyDb
    .select({ lastAt: sql<string | null>`max(${tables.bookings.created_at})` })
    .from(tables.bookings)
    .where(eq(tables.bookings.user_id, id));
  const bookings = bookingsdata.map((row: any) => {
    return {
      ...row.booking,
      movie: row.movie,
      ticket_package: row.ticket_package
    };
  });
  const mapped = {
    id: user.id,
    fullname: user.fullname || '',
    phone: user.phone || '',
    avatar: user.avatar || null,
    gender: user.gender || null,
    dob: user.dob || null,
    email: user.accounts[0]?.email || '',
    is_active: user.accounts[0]?.is_active ?? true,
    login_type: user.accounts[0]?.login_type || 'email',
    account_created_at: user.accounts[0]?.created_at,
    user_created_at: user.created_at,
    user_updated_at: user.updated_at,
    recent_bookings: bookings.map((b: any) => ({
      id: b.id,
      booking_code: b.booking_code || '',
      movie_title: b.movie?.title || '',
      ticket_package_name: b.ticket_package?.name || '',
      ticket_count: b.ticket_count,
      total_price: Number(b.total_price),
      payment_method: b.payment_method,
      payment_status: b.payment_status,
      created_at: b.created_at
    })),
    total_bookings: Number(totalBookingsRow?.count || 0),
    paid_bookings: Number(paidBookingsRow?.count || 0),
    total_spent: Number(paidTotalRow?.total || 0),
    last_booking_at: lastBookingRow?.lastAt || null,
    created_by_staff_name: createLog?.staffFullname || null,
    updated_by_staff_name: updateLog?.staffFullname || null
  };

  return mapped;
}

// Lock or unlock a customer: sets accounts.is_active for every account of the user.
// Locking also deletes the user's tokens so every session ends at once. The reason goes into the audit log.
export async function setUserActiveImpl(
  anyDb: any,
  tables: { users: any; accounts: any; tokens: any; auditLogs: any },
  id: number,
  isActive: boolean,
  reason: string,
  staffInfo: { id: number; email: string; fullname: string }
) {
  const user = await anyDb.query.users.findFirst({
    where: eq(tables.users.id, id),
    with: { accounts: true }
  });
  if (!user || !user.accounts || user.accounts.length === 0) {
    const err: any = new Error('Không tìm thấy khách hàng');
    err.statusCode = 404;
    throw err;
  }

  const accountIds: number[] = user.accounts.map((account: any) => account.id);
  const wasActive = user.accounts.some((account: any) => account.is_active !== false);
  const cleanReason = String(reason || '').trim().slice(0, 500);

  await anyDb
    .update(tables.accounts)
    .set({ is_active: isActive, updated_at: formatDateForDb(new Date()) })
    .where(inArray(tables.accounts.id, accountIds));

  if (!isActive) {
    await anyDb.delete(tables.tokens).where(inArray(tables.tokens.account_id, accountIds));
  }

  const customerName = user.fullname || user.accounts[0]?.email || '';
  const newValues: Record<string, unknown> = {
    fullname: customerName,
    email: user.accounts[0]?.email || '',
    is_active: isActive
  };
  if (cleanReason) newValues.reason = cleanReason;
  await logAuditAction(
    anyDb,
    tables.auditLogs,
    isActive ? 'unlock' : 'lock',
    'user',
    id,
    `${isActive ? 'Mở khóa' : 'Khóa'} tài khoản khách hàng: ${customerName}${cleanReason ? ` - Lý do: ${cleanReason}` : ''}`,
    staffInfo.id,
    staffInfo.email,
    staffInfo.fullname,
    JSON.stringify({ fullname: customerName, email: user.accounts[0]?.email || '', is_active: wasActive }),
    JSON.stringify(newValues)
  );

  return {
    status: 'success',
    message: isActive ? 'Đã mở khóa tài khoản' : 'Đã khóa tài khoản',
    is_active: isActive
  };
}
