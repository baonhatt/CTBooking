// A post can be limited to some branches (branch_ids). null, undefined or an empty list means "all branches".
// This only decides what is SHOWN IN LISTS for the branch the visitor chose. It never changes a post's URL, its
// sitemap entry or whether the page can be opened (see BranchScoped for why).

export type PostBranchIds = number[] | null | undefined;

export function isPostForBranch(branchIds: PostBranchIds, branchId: number | null | undefined): boolean {
  if (!Array.isArray(branchIds) || branchIds.length === 0) return true;
  if (branchId === null || branchId === undefined) return true;
  return branchIds.map(Number).includes(Number(branchId));
}
