import { eq, and, or, gte, lte, inArray, desc, asc, sum, count, ilike } from "drizzle-orm";

export async function getRevenueImpl(anyDb: any, tables: { bookings: any }, args: { from?: string; to?: string; status?: string }) {
  const fromStr = String(args.from || "");
  const toStr = String(args.to || "");
  const from = fromStr ? new Date(fromStr).toISOString() : undefined;
  const to = toStr ? new Date(toStr).toISOString() : undefined;
  const status = String(args.status || "paid").toLowerCase();
  const whereCondition = status === "all" ? undefined : inArray(tables.bookings.payment_status, ["success", "paid"]);
  let dateCondition = undefined as any;
  if (from && to) {
    dateCondition = or(
      and(gte(tables.bookings.paid_at, from), lte(tables.bookings.paid_at, to)),
      and(gte(tables.bookings.created_at, from), lte(tables.bookings.created_at, to))
    );
  } else if (from) {
    dateCondition = or(gte(tables.bookings.paid_at, from), gte(tables.bookings.created_at, from));
  } else if (to) {
    dateCondition = or(lte(tables.bookings.paid_at, to), lte(tables.bookings.created_at, to));
  }
  const finalWhere = and(whereCondition, dateCondition);
  const [agg] = await anyDb
    .select({ total: sum(tables.bookings.total_price), count: count() })
    .from(tables.bookings)
    .where(finalWhere);
  const total = Number(agg?.total || 0);
  const countVal = agg?.count || 0;
  return { total, count: countVal };
}

export async function listTransactionsImpl(anyDb: any, tables: { bookings: any; users: any; accounts: any; movies: any; ticket_packages: any }, args: { page: number; pageSize: number; email: string; status: string; sort: string; dir: "asc" | "desc"; payment_method: string; from?: string; to?: string }) {
  const { page, pageSize, email, status, sort, dir, payment_method, from, to } = args;
  const skip = (page - 1) * pageSize;
  const whereCondition: any[] = [];
  if (status && status !== "all") whereCondition.push(eq(tables.bookings.payment_status, status));
  if (payment_method) whereCondition.push(eq(tables.bookings.payment_method, payment_method));
  if (from || to) {
    const f = from ? new Date(from).toISOString() : undefined;
    const t = to ? new Date(to).toISOString() : undefined;
    if (f && t) {
      whereCondition.push(or(and(gte(tables.bookings.created_at, f), lte(tables.bookings.created_at, t)), and(gte(tables.bookings.paid_at, f), lte(tables.bookings.paid_at, t))));
    } else if (f) {
      whereCondition.push(or(gte(tables.bookings.created_at, f), gte(tables.bookings.paid_at, f)));
    } else if (t) {
      whereCondition.push(or(lte(tables.bookings.created_at, t), lte(tables.bookings.paid_at, t)));
    }
  }
  const emailFilter = email ? ilike(tables.accounts.email, `%${email}%`) : undefined;
  if (emailFilter) whereCondition.push(emailFilter);
  const finalWhere = and(...whereCondition);
  const countQueryBase = anyDb.select({ count: count() }).from(tables.bookings);
  const countQuery = email ? countQueryBase.leftJoin(tables.users, eq(tables.bookings.user_id, tables.users.id)).leftJoin(tables.accounts, eq(tables.users.id, tables.accounts.user_id)) : countQueryBase;
  const [totalRes] = await countQuery.where(finalWhere);
  const total = totalRes?.count || 0;
  let queryBase = anyDb
    .select({
      booking: tables.bookings,
      user: tables.users,
      account_email: tables.accounts.email,
      movie_title: tables.movies.title,
      ticket_package_name: tables.ticket_packages.name
    })
    .from(tables.bookings)
    .leftJoin(tables.users, eq(tables.bookings.user_id, tables.users.id))
    .leftJoin(tables.accounts, eq(tables.users.id, tables.accounts.user_id))
    .leftJoin(tables.movies, eq(tables.bookings.movie_id, tables.movies.id))
    .leftJoin(tables.ticket_packages, eq(tables.bookings.ticket_package_id, tables.ticket_packages.id))
    .where(finalWhere);
  const orderedQuery = sort === "paid_at" ? queryBase.orderBy(dir === "asc" ? asc(tables.bookings.paid_at) : desc(tables.bookings.paid_at)) : queryBase.orderBy(dir === "asc" ? asc(tables.bookings.created_at) : desc(tables.bookings.created_at));
  const itemsRaw = await orderedQuery.limit(pageSize).offset(skip);
  const items = itemsRaw.map((row: any) => {
    const tx = row.booking;
    const now = new Date();
    const expiryAt = tx.expiry_date ? new Date(tx.expiry_date) : null;
    const expired = Boolean(expiryAt && now.getTime() > expiryAt.getTime());
    const daysLeft = expiryAt ? Math.ceil((expiryAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
    return {
      id: tx.id,
      bookingId: tx.id,
      email: tx.email || row.account_email || "",
      phone: tx.phone || "",
      name: tx.name || row.user?.fullname || "",
      userName: row.user?.fullname || "",
      movieTitle: row.movie_title || "",
      ticketPackageName: row.ticket_package_name || "",
      ticketCount: tx.ticket_count,
      totalPrice: Number(tx.total_price),
      paymentMethod: tx.payment_method,
      paymentStatus: tx.payment_status,
      transactionId: tx.transaction_id,
      createdAt: tx.created_at,
      paidAt: tx.paid_at,
      expiryDate: tx.expiry_date || null,
      expired,
      daysLeft,
    };
  });
  return { items, page, pageSize, total };
}

export async function getTransactionByIdImpl(anyDb: any, tables: { bookings: any; users: any; accounts: any; movies: any; ticket_packages: any }, id: number) {
  const booking = await anyDb.query.bookings.findFirst({
    where: eq(tables.bookings.id, id),
    with: {
      user: { with: { accounts: true } },
      movie: true,
      ticket_package: true
    }
  });
  if (!booking) return null;
  const now = new Date();
  const expiryAt = booking.expiry_date ? new Date(booking.expiry_date) : null;
  const expired = Boolean(expiryAt && now.getTime() > expiryAt.getTime());
  const daysLeft = expiryAt ? Math.ceil((expiryAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
  const mapped = {
    id: booking.id,
    user: {
      id: booking.user.id,
      fullname: booking.user.fullname || "",
      email: booking.email || booking.user.accounts[0]?.email || "",
      phone: booking.phone || booking.user.phone || "",
      name: booking.name || booking.user.fullname || "",
      is_active: booking.user.accounts[0]?.is_active ?? true,
      account_created_at: booking.user.accounts[0]?.created_at,
    },
    movie: booking.movie ? {
      id: booking.movie.id,
      title: booking.movie.title,
      cover_image: booking.movie.cover_image,
      genres: booking.movie.genres,
      rating: booking.movie.rating,
      duration_min: booking.movie.duration_min
    } : null,
    ticket_package: booking.ticket_package ? {
      id: booking.ticket_package.id,
      name: booking.ticket_package.name,
      price: booking.ticket_package.price
    } : null,
    booking_details: {
      ticket_count: booking.ticket_count,
      total_price: Number(booking.total_price),
      price_per_ticket: booking.ticket_count > 0 ? Number(booking.total_price) / booking.ticket_count : 0,
    },
    payment_info: {
      payment_method: booking.payment_method || "",
      payment_status: booking.payment_status || "pending",
      transaction_id: booking.transaction_id || "",
      created_at: booking.created_at,
      paid_at: booking.paid_at,
      expiry_date: booking.expiry_date || null,
      expired,
      days_left: daysLeft,
    },
  };
  return mapped;
}

