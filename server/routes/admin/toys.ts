import { db } from "../../db";
import { toys } from "../../db/schema";
import { eq, desc, or, ilike, count } from "drizzle-orm";

export async function listToysImpl(anyDb: any, tables: { toys: any }, args: { page: number; pageSize: number; q: string }) {
  const { page, pageSize, q } = args;
  let whereCondition = undefined as any;
  if (q) {
    whereCondition = or(ilike(tables.toys.name, `%${q}%`), ilike(tables.toys.category, `%${q}%`), ilike(tables.toys.status, `%${q}%`));
  }
  const [totalRes] = await anyDb.select({ count: count() }).from(tables.toys).where(whereCondition);
  const total = totalRes?.count || 0;
  const items = await anyDb.query.toys.findMany({ where: whereCondition, orderBy: [desc(tables.toys.created_at)], limit: pageSize, offset: (page - 1) * pageSize });
  return { items, page, pageSize, total };
}

export async function getToyImpl(anyDb: any, tables: { toys: any }, id: number) {
  const toy = await anyDb.query.toys.findFirst({ where: eq(tables.toys.id, id) });
  return toy || null;
}

export async function createToyImpl(anyDb: any, tables: { toys: any }, args: { name: string; category?: string; price: number; stock?: number; status?: string; image_url?: string; image_base64?: string }) {
  const { name, category, price, stock, status, image_url, image_base64 } = args as any;
  const priceNum = Number(price);
  let savedImage = image_url as string | undefined;
  
  // Note: File system operations are not supported in Cloudflare Workers / D1 environment.
  // Please use an external storage service (like Cloudinary or R2) and pass the URL.
  /*
  if (image_base64 && typeof image_base64 === "string") {
    try {
      // ...fs logic removed for D1 compatibility...
    } catch { }
  }
  */

  // Insert toy (tương thích với D1/SQLite không hỗ trợ .returning())
  await anyDb.insert(tables.toys).values({
    name,
    category,
    price: String(priceNum),
    stock: Number(stock ?? 0),
    status: status ?? "active",
    image_url: savedImage,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  // Query lại toy vừa tạo
  const toy = await anyDb.query.toys.findFirst({
    orderBy: [desc(tables.toys.id)],
  });

  if (!toy) throw new Error("Không thể tạo đồ chơi");
  return { toy };
}

export async function updateToyImpl(anyDb: any, tables: { toys: any }, id: number, args: { name?: string; category?: string; price?: number; stock?: number; status?: string; image_url?: string; image_base64?: string }) {
  const { name, category, price, stock, status, image_url, image_base64 } = args as any;
  const priceNum = price === undefined ? undefined : Number(price);
  const data: any = { updated_at: new Date().toISOString() };
  if (name !== undefined) data.name = name;
  if (category !== undefined) data.category = category;
  if (priceNum !== undefined) data.price = String(priceNum);
  if (stock !== undefined) data.stock = stock;
  if (status !== undefined) data.status = status;
  if (image_url !== undefined) data.image_url = image_url;
  
  /*
  if (image_base64 && typeof image_base64 === "string") {
     // ...fs logic removed for D1 compatibility...
  }
  */

  // Update toy (tương thích với D1/SQLite không hỗ trợ .returning())
  await anyDb.update(tables.toys).set(data).where(eq(tables.toys.id, id));

  // Query lại toy vừa update
  const toy = await anyDb.query.toys.findFirst({
    where: eq(tables.toys.id, id),
  });

  return toy || null;
}

export async function deleteToyImpl(anyDb: any, tables: { toys: any }, id: number) {
  // Check if toy exists before deleting
  const existing = await anyDb.query.toys.findFirst({
    where: eq(tables.toys.id, id),
  });

  if (!existing) return null;

  // Delete toy (tương thích với D1/SQLite không hỗ trợ .returning())
  await anyDb.delete(tables.toys).where(eq(tables.toys.id, id));

  return { ok: true };
}


