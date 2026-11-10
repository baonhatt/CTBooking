import { eq, and, gte, lte, desc, count, or, like } from 'drizzle-orm';

/**
 * Log an audit action
 * Records staff actions for security and compliance
 *
 * @param db - Drizzle database instance
 * @param auditLogsTable - Audit logs table
 * @param action - The action performed (e.g., 'create', 'update', 'delete')
 * @param module - The module affected (e.g., 'staff', 'roles', 'movies')
 * @param entityId - The ID of the entity affected
 * @param details - Additional details about the action
 * @param staffId - The ID of the staff performing the action
 * @param staffEmail - The email of the staff performing the action
 * @param staffFullname - The full name of the staff performing the action
 * @param oldValues - Old values before change (JSON string)
 * @param newValues - New values after change (JSON string)
 */
export async function logAuditAction(
  db: any,
  auditLogsTable: any,
  action: string,
  module: string,
  entityId: number | string | null,
  details: string,
  staffId: number,
  staffEmail: string,
  staffFullname: string,
  oldValues?: string,
  newValues?: string
) {
  const now = new Date().toISOString();

  try {
    await db.insert(auditLogsTable).values({
      staffId,
      staffEmail,
      staffFullname,
      action,
      entityType: module,
      entityId: String(entityId),
      oldValues: oldValues || details,
      newValues: newValues,
      createdAt: now
    });
  } catch (error) {
    // Log errors but don't throw - audit logging shouldn't break the main flow
    console.error('Failed to log audit action:', error);
  }
}

/**
 * Get audit logs with filtering
 *
 * @param db - Drizzle database instance
 * @param tables - Database tables object
 * @param params - Query parameters
 * @returns Paginated audit logs
 */
export async function getAuditLogsImpl(
  db: any,
  tables: any,
  params: {
    page: number;
    pageSize: number;
    module?: string;
    action?: string;
    staffId?: number;
    from?: string;
    to?: string;
    search?: string;
  }
) {
  const { auditLogs } = tables;
  const { page = 1, pageSize = 20, module, action, staffId, from, to, search } = params;
  const offset = (page - 1) * pageSize;

  // All filters go into one list and are joined with AND. (Calling .where() several times does not add up: each
  // call replaces the one before, so only the last filter used to apply.)
  const conditions: any[] = [];
  if (module) conditions.push(eq(auditLogs.entityType, module));
  if (action) conditions.push(eq(auditLogs.action, action));
  if (staffId) conditions.push(eq(auditLogs.staffId, staffId));
  // Date range filtering
  if (from) conditions.push(gte(auditLogs.createdAt, from));
  if (to) conditions.push(lte(auditLogs.createdAt, to));
  // Search across multiple fields
  if (search) {
    conditions.push(
      or(
        like(auditLogs.staffEmail, `%${search}%`),
        like(auditLogs.staffFullname, `%${search}%`),
        like(auditLogs.action, `%${search}%`),
        like(auditLogs.oldValues, `%${search}%`)
      )
    );
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const logs = await db
    .select()
    .from(auditLogs)
    .where(whereClause)
    .orderBy(desc(auditLogs.createdAt))
    .limit(pageSize)
    .offset(offset);

  // Total count with the same filters
  const [totalResult] = await db.select({ count: count() }).from(auditLogs).where(whereClause);

  return {
    items: logs,
    total: totalResult?.count || 0,
    page,
    pageSize
  };
}
