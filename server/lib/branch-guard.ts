import { eq, and, inArray } from 'drizzle-orm';
import { parseBranchIds, staffCanAccessBranchIds } from './branch-ids';

export { staffCanAccessBranchIds, parseBranchIds, matchesBranchFilter } from './branch-ids';

/**
 * Apply branch isolation filter to a query
 * This filters results to only include data from branches the staff has access to
 *
 * @param query - The Drizzle query builder
 * @param branchColumn - The column in the table that references branches (e.g., bookings.branchId)
 * @param staffBranchIds - Array of branch IDs the staff has access to
 * @param isSuperAdmin - Whether the staff is a super admin (bypasses branch filter)
 * @returns The modified query with branch filter applied
 */
export function applyBranchFilter(
  query: any,
  branchColumn: any,
  staffBranchIds: number[] | undefined,
  isSuperAdmin: boolean | undefined
) {
  // Super admins bypass branch filtering
  if (isSuperAdmin) {
    return query;
  }

  // If staff has no branch assignments, return empty result
  if (!staffBranchIds || staffBranchIds.length === 0) {
    return query.where(eq(branchColumn, -1)); // Will return no results
  }

  // Apply branch filter
  return query.where(inArray(branchColumn, staffBranchIds));
}

/**
 * Check if staff has access to a specific branch
 *
 * @param branchId - The branch ID to check
 * @param staffBranchIds - Array of branch IDs the staff has access to
 * @param isSuperAdmin - Whether the staff is a super admin
 * @returns true if staff has access, false otherwise
 */
export function hasBranchAccess(
  branchId: number,
  staffBranchIds: number[] | undefined,
  isSuperAdmin: boolean | undefined
): boolean {
  if (isSuperAdmin) return true;
  if (!staffBranchIds || staffBranchIds.length === 0) return false;
  return staffBranchIds.includes(branchId);
}

/**
 * Filter an array of items by branch
 * Useful for post-query filtering when branch filtering can't be done in SQL
 *
 * @param items - Array of items to filter
 * @param branchIdGetter - Function to extract branch ID from an item
 * @param staffBranchIds - Array of branch IDs the staff has access to
 * @param isSuperAdmin - Whether the staff is a super admin
 * @returns Filtered array of items
 */
export function filterItemsByBranchIds<T>(
        items: T[],
        branchIdsGetter: (item: T) => string | null | undefined,
        staffBranchIds: number[] | undefined,
        isSuperAdmin: boolean | undefined
): T[] {
        if (isSuperAdmin) return items;
        if (!staffBranchIds || staffBranchIds.length === 0) return [];
        return items.filter((item) => staffCanAccessBranchIds(branchIdsGetter(item), staffBranchIds, isSuperAdmin));
}
