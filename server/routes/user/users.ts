import { eq, and, inArray, gte, lte, or, desc, asc, count, SQL } from "drizzle-orm";

export async function updateUserProfileImpl(anyDb: any, tables: { accounts: any; users: any }, payload: { email?: string; name?: string; phone?: string; gender?: string; dob?: string }) {
  const { email, name, phone, gender, dob } = payload;
  if (!email) return { status: "error", message: "Thiếu email" };
  const account = await anyDb.query.accounts.findFirst({ where: eq(tables.accounts.email, email) });
  if (!account) return { status: "error", message: "Không tìm thấy tài khoản" };
  const dobDate = (() => {
    try {
      if (!dob) return undefined;
      const d = new Date(dob);
      return isNaN(d.getTime()) ? undefined : d.toISOString();
    } catch {
      return undefined;
    }
  })();
  const normalizedGender = (() => { try { const g = typeof gender === "string" ? gender.trim().toLowerCase() : ""; return g === "male" || g === "female" ? g : undefined; } catch { return undefined; } })();

  const updateData: any = {
    updated_at: new Date().toISOString(),
  };
  if (typeof name === "string") updateData.fullname = name;
  if (typeof phone === "string") updateData.phone = phone;
  if (normalizedGender) updateData.gender = normalizedGender;
  if (dobDate) updateData.dob = dobDate;
  // Update user (tương thích với D1/SQLite không hỗ trợ .returning())
  await anyDb.update(tables.users)
    .set(updateData)
    .where(eq(tables.users.id, account.user_id));

  console.log(9999)
  // Query lại user vừa update
  const user = await anyDb.query.users.findFirst({
    where: eq(tables.users.id, account.user_id),
  });

  if (!user) throw new Error("Không thể cập nhật thông tin người dùng");
  return { ok: true, user: { id: user.id, fullname: user.fullname, phone: user.phone, gender: user.gender ?? null, dob: user.dob ?? null, email } };
}

export async function getUserProfileByEmailImpl(anyDb: any, tables: { accounts: any; users: any }, emailRaw: string) {
  const email = (() => { try { return decodeURIComponent(emailRaw || ""); } catch { return String(emailRaw || ""); } })();
  if (!email) return { status: "error", message: "Thiếu email" };
  const account = await anyDb.query.accounts.findFirst({ where: eq(tables.accounts.email, email) });
  if (!account) return { status: "error", message: "Không tìm thấy tài khoản" };
  const user = await anyDb.query.users.findFirst({ where: eq(tables.users.id, account.user_id) });
  return {
    id: user?.id ?? account.user_id,
    fullname: user?.fullname || "",
    phone: user?.phone || "",
    gender: user?.gender ?? null,
    dob: user?.dob ?? null,
    email,
    is_active: account.is_active ?? true,
    login_type: account.login_type || "email",
    user_created_at: user?.created_at ?? null,
    user_updated_at: user?.updated_at ?? null,
    account_created_at: account.created_at ?? null,
  };
}

export async function listUserTransactionsImpl(anyDb: any, tables: { accounts: any; bookings: any }, args: { email: string; status: string; page: number; pageSize: number; sort: string; dir: "asc" | "desc"; payment_method: string; from?: string; to?: string }) {
  const { email: emailRaw, status, page, pageSize, sort, dir, payment_method, from: fromStr, to: toStr } = args;
  const skip = (page - 1) * pageSize;
  const email = (() => { try { return decodeURIComponent(emailRaw || ""); } catch { return String(emailRaw || ""); } })();
  if (!email) return { items: [], page, pageSize, total: 0 };
  const account = await anyDb.query.accounts.findFirst({ where: eq(tables.accounts.email, email) });
  if (!account) return { items: [], page, pageSize, total: 0 };
  const conditions: SQL[] = [eq(tables.bookings.user_id, account.user_id)];
  if (status) {
    const s = status.toLowerCase();
    if (s === "paid") conditions.push(inArray(tables.bookings.payment_status, ["paid"]));
  }
  if (payment_method) conditions.push(eq(tables.bookings.payment_method, payment_method));
  if (fromStr || toStr) {
    const from = fromStr ? new Date(fromStr).toISOString() : undefined;
    const to = toStr ? new Date(toStr).toISOString() : undefined;
    const dateConditions: SQL[] = [];
    if (from && to) {
      dateConditions.push(and(gte(tables.bookings.created_at, from as any), lte(tables.bookings.created_at, to as any))!);
      dateConditions.push(and(gte(tables.bookings.paid_at, from as any), lte(tables.bookings.paid_at, to as any))!);
    } else if (from) {
      dateConditions.push(gte(tables.bookings.created_at, from as any));
      dateConditions.push(gte(tables.bookings.paid_at, from as any));
    } else if (to) {
      dateConditions.push(lte(tables.bookings.created_at, to as any));
      dateConditions.push(lte(tables.bookings.paid_at, to as any));
    }
    if (dateConditions.length > 0) conditions.push(or(...dateConditions)!);
  }
  const whereClause = and(...conditions);
  const [totalResult] = await anyDb.select({ count: count() }).from(tables.bookings).where(whereClause);
  const total = totalResult?.count ?? 0;
  const items = await anyDb.query.bookings.findMany({
    where: whereClause,
    with: { movie: true, ticket_package: true },
    orderBy: sort === "paid_at" ? (dir === "asc" ? asc(tables.bookings.paid_at) : desc(tables.bookings.paid_at)) : (dir === "asc" ? asc(tables.bookings.created_at) : desc(tables.bookings.created_at)),
    offset: skip,
    limit: pageSize,
  });
  const mapped = items.map((b: any) => {
    try {
      const movie = b?.movie;
      const amount = (() => { try { return Number(b?.total_price ?? 0); } catch { return 0; } })();
      const coverImage = movie?.cover_image || null;
      const now = new Date();
      const expiryAt = b?.expiry_date ? new Date(b.expiry_date as any) : null;
      const expired = Boolean(expiryAt && now.getTime() > expiryAt.getTime());
      const daysLeft = expiryAt ? Math.ceil((expiryAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
      return {
        booking_id: b.id,
        booking_code: b.booking_code || null,
        user_id: b.user_id,
        movie: movie?.title || "",
        ticket_package: b?.ticket_package?.name || "",
        quantity: Number(b?.ticket_count ?? 0),
        amount,
        method: b?.payment_method || "",
        payment_status: b?.payment_status || "",
        created_at: b?.created_at || null,
        paid_at: b?.paid_at || null,
        expiry_date: b?.expiry_date || null,
        expired,
        days_left: daysLeft,
        is_used: !!b?.is_used,
        name: b?.name || "",
        phone: b?.phone || "",
        email,
        poster_url: coverImage,
      };
    } catch {
      return {
        booking_id: Number(b?.id ?? 0),
        booking_code: b?.booking_code || null,
        user_id: Number(b?.user_id ?? 0),
        movie: b?.movie?.title || "",
        ticket_package: b?.ticket_package?.name || "",
        quantity: Number(b?.ticket_count ?? 0),
        amount: 0,
        method: b?.payment_method || "",
        payment_status: b?.payment_status || "",
        created_at: b?.created_at || null,
        paid_at: b?.paid_at || null,
        name: b?.name || "",
        phone: b?.phone || "",
        email,
        poster_url: null,
      };
    }
  });
  return { items: mapped, page, pageSize, total };
}
