import { eq, ilike, or, desc, count, sql, and } from "drizzle-orm";

export async function getUsersImpl(anyDb: any, tables: { users: any; accounts: any; bookings: any }, args: { page: number; pageSize: number; q: string }) {
  const { page, pageSize, q } = args;
  const skip = (page - 1) * pageSize;
  const bookingCountSq = anyDb
    .select({ userId: tables.bookings.user_id, count: count(tables.bookings.id).as("count") })
    .from(tables.bookings)
    .groupBy(tables.bookings.user_id)
    .as("booking_counts");
  let whereCondition = undefined as any;
  if (q) {
    whereCondition = or(ilike(tables.users.fullname, `%${q}%`), ilike(tables.accounts.email, `%${q}%`), ilike(tables.users.phone, `%${q}%`));
  }
  const itemsQuery = anyDb
    .select({
      user: tables.users,
      email: sql<string>`max(${tables.accounts.email})`.as("email"),
      is_active_agg: sql<number>`max(CASE WHEN ${tables.accounts.is_active} THEN 1 ELSE 0 END)`.as("is_active_agg"),
      bookings_count: sql<number>`coalesce(max(${bookingCountSq.count}), 0)`.as("bookings_count"),
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
    .select({ count: sql<number>`count(distinct ${tables.users.id})`.as("count") })
    .from(tables.users)
    .innerJoin(tables.accounts, eq(tables.users.id, tables.accounts.user_id))
    .where(whereCondition);
  const total = totalRes?.count || 0;
  const mapped = items.map((item: any) => ({
    id: item.user.id,
    fullname: item.user.fullname || "",
    phone: item.user.phone || "",
    email: item.email || "",
    is_active: (item.is_active_agg ?? 1) > 0,
    total_bookings: Number(item.bookings_count || 0),
    created_at: item.user.created_at,
    updated_at: item.user.updated_at,
  }));
  return { items: mapped, page, pageSize, total };
}

export async function getUserByIdImpl(anyDb: any, tables: { users: any }, id: number) {
  const user = await anyDb.query.users.findFirst({
    where: eq(tables.users.id, id),
    with: {
      accounts: true,
      bookings: {
        with: { movie: true, ticket_package: true },
        orderBy: (bookingsTbl: any, { desc }: any) => [desc(bookingsTbl.created_at)],
        limit: 10,
      },
    },
  });
  if (!user) return null;
  const mapped = {
    id: user.id,
    fullname: user.fullname || "",
    phone: user.phone || "",
    avatar: user.avatar || null,
    email: user.accounts[0]?.email || "",
    is_active: user.accounts[0]?.is_active ?? true,
    login_type: user.accounts[0]?.login_type || "email",
    account_created_at: user.accounts[0]?.created_at,
    user_created_at: user.created_at,
    user_updated_at: user.updated_at,
    recent_bookings: user.bookings.map((b: any) => ({
      id: b.id,
      movie_title: b.movie?.title || "",
      ticket_package_name: b.ticket_package?.name || "",
      ticket_count: b.ticket_count,
      total_price: Number(b.total_price),
      payment_method: b.payment_method,
      payment_status: b.payment_status,
      created_at: b.created_at,
    })),
    total_bookings: user.bookings.length,
  };
  return mapped;
}
