import { eq, desc, or, count, and, sql } from 'drizzle-orm';
import { formatDateForDb } from '../../lib/date-utils';

export async function listToysImpl(
  anyDb: any,
  tables: { toys: any },
  args: { page: number; pageSize: number; q: string; status?: string }
) {
  const { page, pageSize, q, status } = args;
  const conditions = [] as any[];

  if (q) {
    const lowerQ = q.toLowerCase();
    conditions.push(
      or(
        sql`LOWER(${tables.toys.name}) LIKE ${`%${lowerQ}%`}`,
        sql`LOWER(${tables.toys.category}) LIKE ${`%${lowerQ}%`}`
      )
    );
  }

  if (status && status !== 'all') {
    conditions.push(eq(tables.toys.status, status));
  }

  const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRes] = await anyDb.select({ count: count() }).from(tables.toys).where(whereCondition);
  const total = totalRes?.count || 0;
  const items = await anyDb.query.toys.findMany({
    where: whereCondition,
    orderBy: [desc(tables.toys.created_at)],
    limit: pageSize,
    offset: (page - 1) * pageSize
  });
  return { items, page, pageSize, total };
}

export async function getToyImpl(anyDb: any, tables: { toys: any }, id: number) {
  const toy = await anyDb.query.toys.findFirst({ where: eq(tables.toys.id, id) });
  return toy || null;
}

export async function createToyImpl(
  anyDb: any,
  tables: { toys: any },
  args: {
    name: string;
    category?: string;
    price: number;
    stock?: number;
    status?: string;
    image_url?: string;
    image_base64?: string;
  },
  RUN_ENV?: any,
  uploader?: (base64: string, folder: string) => Promise<{ url: string }>
) {
  const { name, category, price, stock, status, image_url, image_base64 } = args as any;
  const priceNum = Number(price);
  let savedImage = image_url as string | undefined;
  if (image_base64 && typeof image_base64 === 'string' && uploader) {
    try {
      const uploadResult = await uploader(image_base64, 'ctbooking/toys');
      savedImage = uploadResult.url;
    } catch (e) {
      console.error('Upload toy image failed', e);
    }
  }

  const nowIso = new Date();
  // Try to use .returning() to fetch created toy when supported; fallback for D1/SQLite
  const inserted = await anyDb
    .insert(tables.toys)
    .values({
      name,
      category,
      price: String(priceNum),
      stock: Number(stock ?? 0),
      status: status ?? 'active',
      image_url: savedImage,
      created_at: formatDateForDb(nowIso),
      updated_at: formatDateForDb(nowIso)
    })
    .returning();

  let toy: any = Array.isArray(inserted) ? inserted[0] : inserted;
  // if (!toy) {
  //   toy = await anyDb.query.toys.findFirst({ orderBy: [desc(tables.toys.id)] });
  // }

  if (!toy) throw new Error('Không thể tạo đồ chơi');

  if (RUN_ENV && RUN_ENV.KV_BINDING) {
    await RUN_ENV.KV_BINDING.delete('activeToys');
  }

  return { toy };
}

export async function updateToyImpl(
  anyDb: any,
  tables: { toys: any },
  id: number,
  args: {
    name?: string;
    category?: string;
    price?: number;
    stock?: number;
    status?: string;
    image_url?: string;
    image_base64?: string;
  },
  RUN_ENV?: any,
  uploader?: (base64: string, folder: string) => Promise<{ url: string }>,
  deleter?: (url: string) => Promise<void>
) {
  const { name, category, price, stock, status, image_url, image_base64 } = args as any;
  const priceNum = price === undefined ? undefined : Number(price);
  const now = new Date();
  const oldToy = await anyDb.query.toys.findFirst({
    where: eq(tables.toys.id, id)
  });
  const data: any = { updated_at: formatDateForDb(now) };
  if (name !== undefined) data.name = name;
  if (category !== undefined) data.category = category;
  if (priceNum !== undefined) data.price = String(priceNum);
  if (stock !== undefined) data.stock = stock;
  if (status !== undefined) data.status = status;
  if (image_url !== undefined) data.image_url = image_url;

  if (image_base64 && typeof image_base64 === 'string' && uploader) {
    try {
      const uploadResult = await uploader(image_base64, 'ctbooking/toys');
      data.image_url = uploadResult.url;
    } catch (e) {
      console.error('Upload toy image failed', e);
    }
  }

  // Try to use .returning() for update, fallback to query
  const updatedRes = await anyDb.update(tables.toys).set(data).where(eq(tables.toys.id, id)).returning();
  let toy: any = Array.isArray(updatedRes) ? updatedRes[0] : updatedRes;
  // if (!toy) toy = await anyDb.query.toys.findFirst({ where: eq(tables.toys.id, id) });

  if (oldToy && data.image_url && oldToy.image_url && oldToy.image_url !== data.image_url && deleter) {
    deleter(oldToy.image_url).catch((e) => console.error('Failed to delete old toy image:', e));
  }

  if (RUN_ENV && RUN_ENV.KV_BINDING) {
    await RUN_ENV.KV_BINDING.delete('activeToys');
  }

  return toy || null;
}

export async function deleteToyImpl(
  anyDb: any,
  tables: { toys: any },
  id: number,
  RUN_ENV: any,
  deleter?: (url: string) => Promise<void>
) {
  // Check if toy exists before deleting
  const existing = await anyDb.query.toys.findFirst({
    where: eq(tables.toys.id, id)
  });

  if (!existing) return null;

  if (existing.image_url && deleter) {
    deleter(existing.image_url).catch((e) => console.error('Failed to delete toy image:', e));
  }

  // Delete toy (tương thích với D1/SQLite không hỗ trợ .returning())
  await anyDb.delete(tables.toys).where(eq(tables.toys.id, id));

  if (RUN_ENV && RUN_ENV.KV_BINDING) {
    await RUN_ENV.KV_BINDING.delete('activeToys');
  }

  return { ok: true };
}
