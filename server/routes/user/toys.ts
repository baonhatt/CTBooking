import { inArray, desc } from 'drizzle-orm';

export async function listActiveToys(anyDb: any, tables: { toys: any }) {
  const items = await anyDb.query.toys.findMany({
    where: inArray(tables.toys.status, ['active', 'ACTIVE']),
    orderBy: [desc(tables.toys.created_at)],
    limit: 24
  });
  return { items };
}
