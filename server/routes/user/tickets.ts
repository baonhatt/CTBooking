import { customerBranchId, packagesAtBranch } from '../../lib/catalog-scope';

/**
 * The movie ticket packages sold at a branch (without a branch: the default branch), with the branch's price and,
 * for each package, the movies it covers there. The rules are in server/lib/catalog-scope.ts.
 */
export async function listActiveTicketPackages(anyDb: any, _tables: { ticket_packages: any; movies: any }, branch_id?: number) {
  const branchId = await customerBranchId(anyDb, branch_id);
  if (!branchId) return { items: [] };
  const items = await packagesAtBranch(anyDb, branchId, 'movie');
  return { items };
}
