import { eq, or, ilike, desc, asc, count, sql } from "drizzle-orm";

export async function listTicketPackagesImpl(anyDb: any, tables: { ticket_packages: any }, args: { page: number; pageSize: number; q: string }) {
  const { page, pageSize, q } = args;
  const whereCondition = q
    ? or(ilike(tables.ticket_packages.name, `%${q}%`), ilike(tables.ticket_packages.description, `%${q}%`), ilike(tables.ticket_packages.type, `%${q}%`))
    : undefined;
  const [totalResult] = await anyDb.select({ count: count() }).from(tables.ticket_packages).where(whereCondition);
  const total = totalResult ? totalResult.count : 0;
  const items = await anyDb.select().from(tables.ticket_packages).where(whereCondition).orderBy(asc(tables.ticket_packages.display_order), desc(tables.ticket_packages.id)).limit(pageSize).offset((page - 1) * pageSize);
  return { items, page, pageSize, total };
}

export async function getTicketPackageImpl(anyDb: any, tables: { ticket_packages: any }, id: number) {
  const [item] = await anyDb.select().from(tables.ticket_packages).where(eq(tables.ticket_packages.id, id)).limit(1);
  return item || null;
}

export async function createTicketPackageImpl(anyDb: any, tables: { ticket_packages: any }, args: { name: string; code?: string; description?: string; price: number; features?: any; type?: string; min_group_size?: number; max_group_size?: number; is_member_only?: boolean; is_active?: boolean; display_order?: number }) {
  const { name, code, description, price, features, type, min_group_size, max_group_size, is_member_only, is_active, display_order } = args;
  const priceNum = Number(price);
  let featuresJson: any = undefined;
  if (features !== undefined) {
    if (Array.isArray(features)) featuresJson = features;
    else if (typeof features === "string") {
      featuresJson = (features as string).split(",").map((x: string) => x.trim()).filter(Boolean);
    }
  }
  const nowIso = new Date().toISOString();
  // Try .returning() to fetch created item when supported; fallback for D1/SQLite
  const inserted = await anyDb.insert(tables.ticket_packages).values({
    name,
    code,
    description,
    price: priceNum.toString(),
    features: featuresJson,
    type,
    min_group_size: min_group_size !== undefined ? Number(min_group_size) : undefined,
    max_group_size: max_group_size !== undefined ? Number(max_group_size) : undefined,
    is_member_only: is_member_only ? Boolean(is_member_only) : false,
    is_active: is_active === undefined ? true : Boolean(is_active),
    display_order: display_order !== undefined ? Number(display_order) : 0,
    created_at: nowIso,
    updated_at: nowIso,
  }).returning();

  let item: any = Array.isArray(inserted) ? inserted[0] : inserted;
  // if (!item) {
  //   // Fallback for DBs without returning()
  //   item = await anyDb.query.ticket_packages.findFirst({ orderBy: [desc(tables.ticket_packages.id)] });
  // }

  if (!item) throw new Error("Không thể tạo gói vé");
  return { item };
}

export async function updateTicketPackageImpl(anyDb: any, tables: { ticket_packages: any }, id: number, args: { name?: string; code?: string; description?: string; price?: number; features?: any; type?: string; min_group_size?: number; max_group_size?: number; is_member_only?: boolean; is_active?: boolean; display_order?: number }) {
  const { name, code, description, price, features, type, min_group_size, max_group_size, is_member_only, is_active, display_order } = args;
  const data: any = { updated_at: new Date().toISOString() };
  if (name !== undefined) data.name = name;
  if (code !== undefined) data.code = code;
  if (description !== undefined) data.description = description;
  if (price !== undefined) {
    const p = Number(price);
    data.price = p.toString();
  }
  if (features !== undefined) {
    if (Array.isArray(features)) data.features = features;
    else if (typeof features === "string") {
      data.features = (features as string).split(",").map((x: string) => x.trim()).filter(Boolean);
    }
  }
  if (type !== undefined) data.type = type;
  if (min_group_size !== undefined) data.min_group_size = Number(min_group_size);
  if (max_group_size !== undefined) data.max_group_size = Number(max_group_size);
  if (is_member_only !== undefined) data.is_member_only = Boolean(is_member_only);
  if (is_active !== undefined) data.is_active = Boolean(is_active);
  if (display_order !== undefined) data.display_order = Number(display_order);
  // Try to use .returning() for update, fallback to query
  const updatedRes = await anyDb.update(tables.ticket_packages).set(data).where(eq(tables.ticket_packages.id, id)).returning();
  let item: any = Array.isArray(updatedRes) ? updatedRes[0] : updatedRes;
  // if (!item) {
  //   item = await anyDb.query.ticket_packages.findFirst({ where: eq(tables.ticket_packages.id, id) });
  // }

  return item || null;
}

export async function deleteTicketPackageImpl(anyDb: any, tables: { ticket_packages: any }, id: number) {
  // Check if ticket package exists before deleting
  const existing = await anyDb.query.ticket_packages.findFirst({
    where: eq(tables.ticket_packages.id, id),
  });

  if (!existing) return null;

  // Delete ticket package (tương thích với D1/SQLite không hỗ trợ .returning())
  await anyDb.delete(tables.ticket_packages).where(eq(tables.ticket_packages.id, id));

  return { ok: true };
}

