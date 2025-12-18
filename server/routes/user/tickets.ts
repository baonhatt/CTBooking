import { eq, asc } from "drizzle-orm";

export async function listActiveTicketPackages(anyDb: any, tables: { ticket_packages: any }) {
  const items = await anyDb.query.ticket_packages.findMany({
    where: eq(tables.ticket_packages.is_active, true),
    orderBy: [asc(tables.ticket_packages.display_order), asc(tables.ticket_packages.price)],
  });
  return { items };
}

