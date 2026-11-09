import { and, eq, isNull } from 'drizzle-orm';

/**
 * Every new order must belong to a branch. When the request and the ticket package name none, the default branch is
 * used. When there is no default branch either, the order is refused instead of being saved without a branch.
 *
 * The default branch should be the branch that owns orders made before branches existed (HCM).
 */
export async function resolveOrderBranchId(
  anyDb: any,
  branchesTable: any,
  requestedBranchId: number | null | undefined
): Promise<number> {
  const requested = Number(requestedBranchId);
  if (Number.isInteger(requested) && requested > 0) return requested;

  const defaultBranch = await anyDb.query.branches.findFirst({
    where: and(eq(branchesTable.is_default, true), isNull(branchesTable.deleted_at))
  });
  if (defaultBranch?.id) return Number(defaultBranch.id);

  const error: any = new Error('Vui lòng chọn chi nhánh để đặt vé.');
  error.status = 400;
  throw error;
}
