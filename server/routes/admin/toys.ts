import { eq, desc, or, count, and, sql, isNotNull, like } from 'drizzle-orm';
import { formatDateForDb } from '../../lib/date-utils';
import { logAuditAction } from '../../lib/audit-logger';
import { buildAuditPayload } from '../../lib/audit-utils';

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

export async function getToyImpl(anyDb: any, tables: { toys: any; auditLogs: any }, id: number) {
  const toy = await anyDb.query.toys.findFirst({ where: eq(tables.toys.id, id) });
  if (!toy) return null;

  // Get tracking data from audit logs
  const [createLog] = await anyDb
    .select()
    .from(tables.auditLogs)
    .where(
      and(
        eq(tables.auditLogs.entityType, 'toy'),
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
        eq(tables.auditLogs.entityType, 'toy'),
        eq(tables.auditLogs.entityId, String(id)),
        eq(tables.auditLogs.action, 'update')
      )
    )
    .orderBy(desc(tables.auditLogs.createdAt))
    .limit(1);

  return {
    ...toy,
    created_by_staff_name: createLog?.staffFullname || null,
    updated_by_staff_name: updateLog?.staffFullname || null
  };
}

export async function createToyImpl(
  anyDb: any,
  tables: { toys: any; auditLogs: any },
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
  uploader?: (base64: string, folder: string) => Promise<{ url: string }>,
  staffInfo?: { id: number; email: string; fullname: string }
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



  const auditNew = buildAuditPayload(toy);

  // Log audit action
  if (staffInfo) {
    await logAuditAction(
      anyDb,
      tables.auditLogs,
      'create',
      'toy',
      toy.id,
      `Tạo đồ chơi: ${name}`,
      staffInfo.id,
      staffInfo.email,
      staffInfo.fullname,
      undefined,
      auditNew
    );
  }

  return { toy };
}

export async function updateToyImpl(
  anyDb: any,
  tables: { toys: any; auditLogs: any },
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
  deleter?: (url: string) => Promise<void>,
  staffInfo?: { id: number; email: string; fullname: string }
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



  const auditOld = buildAuditPayload(oldToy);
  const auditNew = buildAuditPayload(toy || (await anyDb.query.toys.findFirst({ where: eq(tables.toys.id, id) })));

  // Log audit action
  if (staffInfo) {
    await logAuditAction(
      anyDb,
      tables.auditLogs,
      'update',
      'toy',
      id,
      `Cập nhật đồ chơi: ${toy?.name || oldToy?.name}`,
      staffInfo.id,
      staffInfo.email,
      staffInfo.fullname,
      auditOld,
      auditNew
    );
  }

  return toy || null;
}

export async function deleteToyImpl(
  anyDb: any,
  tables: { toys: any; auditLogs: any },
  id: number,
  RUN_ENV: any,
  deleter?: (url: string) => Promise<void>,
  staffInfo?: { id: number; email: string; fullname: string }
) {
  // Check if toy exists before deleting
  const existing = await anyDb.query.toys.findFirst({
    where: eq(tables.toys.id, id)
  });

  if (!existing) return null;

  if (existing.image_url && deleter) {
    deleter(existing.image_url).catch((e) => console.error('Failed to delete toy image:', e));
  }

  // Soft delete by setting status to 'inactive' and deleted_at
  await anyDb
    .update(tables.toys)
    .set({
      status: 'inactive',
      deleted_at: new Date().toISOString(),
      updated_at: formatDateForDb(new Date())
    })
    .where(eq(tables.toys.id, id));



  const auditOld = buildAuditPayload(existing);

  // Log audit action
  if (staffInfo) {
    await logAuditAction(
      anyDb,
      tables.auditLogs,
      'delete',
      'toy',
      id,
      `Xóa đồ chơi: ${existing.name}`,
      staffInfo.id,
      staffInfo.email,
      staffInfo.fullname,
      auditOld,
      undefined
    );
  }

  return { ok: true };
}

export async function restoreToyImpl(
  anyDb: any,
  tables: { toys: any; auditLogs: any },
  id: number,
  staffInfo?: { id: number; email: string; fullname: string }
) {
  const { toys } = tables;

  const existing = await anyDb.query.toys.findFirst({
    where: and(eq(toys.id, id), isNotNull(toys.deleted_at))
  });

  if (!existing) {
    const err: any = new Error('Không tìm thấy đồ chơi hoặc đồ chơi chưa bị xóa');
    err.statusCode = 404;
    throw err;
  }

  // Restore by setting status to 'active' and deleted_at to null
  await anyDb
    .update(toys)
    .set({
      status: 'active',
      deleted_at: null,
      updated_at: formatDateForDb(new Date())
    })
    .where(eq(toys.id, id));

  const auditOld = buildAuditPayload(existing);
  const auditNew = buildAuditPayload({ ...existing, status: 'active', deleted_at: null });

  // Log audit action
  if (staffInfo) {
    await logAuditAction(
      anyDb,
      tables.auditLogs,
      'restore',
      'toy',
      id,
      `Khôi phục đồ chơi: ${existing.name}`,
      staffInfo.id,
      staffInfo.email,
      staffInfo.fullname,
      auditOld,
      auditNew
    );
  }

  return { ok: true };
}

export async function listDeletedToysImpl(
  anyDb: any,
  tables: { toys: any },
  options: { page?: number; pageSize?: number; search?: string } = {}
) {
  const { toys } = tables;
  const { page = 1, pageSize = 10, search = '' } = options;

  const conditions = [];
  if (search) {
    conditions.push(or(like(toys.name, `%${search}%`), like(toys.category, `%${search}%`)));
  }
  conditions.push(isNotNull(toys.deleted_at));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const items = await anyDb.query.toys.findMany({
    where: whereClause,
    orderBy: [desc(toys.deleted_at)],
    limit: pageSize,
    offset: (page - 1) * pageSize
  });

  const [countResult] = await anyDb.select({ count: count() }).from(toys).where(whereClause);

  return {
    status: 'success',
    items,
    total: countResult?.count || 0,
    page,
    pageSize
  };
}
