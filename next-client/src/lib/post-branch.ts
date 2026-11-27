// A post can be offered at every branch (all_branches) or only at some branches (branch_ids).
// isPostForBranch only decides what is SHOWN IN LISTS for the branch the visitor chose. It never changes a post's URL,
// its sitemap entry or whether the page can be opened (see BranchScoped for why).
// A post with all_branches false and an empty branch_ids is not assigned to any branch yet: it is never shown
// (not in lists, search, related posts, the sitemap, and its article page answers "not found").

export type PostBranchScope = {
  // Offered at every branch, including branches opened later
  all_branches?: boolean;
  // The branches when all_branches is false (empty = not assigned to any branch yet)
  branch_ids?: number[];
};

// Offered at every branch or at least at one branch
export function isPostAssigned(scope: PostBranchScope): boolean {
  return Boolean(scope.all_branches) || (scope.branch_ids ?? []).length > 0;
}

export function isPostForBranch(scope: PostBranchScope, branchId: number | null | undefined): boolean {
  if (!isPostAssigned(scope)) return false;
  if (scope.all_branches) return true;
  if (branchId === null || branchId === undefined) return true;
  return (scope.branch_ids ?? []).map(Number).includes(Number(branchId));
}
