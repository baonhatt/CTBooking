// Where a movie, package, voucher, post or media item is offered, as the admin API sends and takes it:
// all_branches = every branch (also branches opened later); otherwise exactly the branches in branch_ids
// (an empty list with all_branches false = offered nowhere).
export type BranchScope = {
  all_branches: boolean;
  branch_ids: number[];
};

export type BranchScopeStatus = 'all' | 'specific' | 'none';

type BranchOption = { id: number; name: string };

export const NO_BRANCH_SCOPE: BranchScope = { all_branches: false, branch_ids: [] };
export const ALL_BRANCHES_SCOPE: BranchScope = { all_branches: true, branch_ids: [] };

function clean_ids(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const ids: number[] = [];
  for (const value of raw) {
    const id = Number(value);
    if (!Number.isNaN(id) && id > 0 && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

// Reads the two scope fields of an API item; tolerant of 0/1 for the flag and of missing fields
export function branch_scope_of(item: { all_branches?: unknown; branch_ids?: unknown } | null | undefined): BranchScope {
  if (!item) return NO_BRANCH_SCOPE;
  const all_branches = item.all_branches === true || item.all_branches === 1 || item.all_branches === '1';
  return { all_branches, branch_ids: all_branches ? [] : clean_ids(item.branch_ids) };
}

export function branch_scope_status(scope: BranchScope): BranchScopeStatus {
  if (scope.all_branches) return 'all';
  return scope.branch_ids.length > 0 ? 'specific' : 'none';
}

// Is the item offered at this branch?
export function scope_covers_branch(scope: BranchScope, branch_id: number | null | undefined): boolean {
  if (scope.all_branches) return true;
  if (branch_id === null || branch_id === undefined) return false;
  return scope.branch_ids.includes(Number(branch_id));
}

export function branch_scope_label(scope: BranchScope, branches: BranchOption[]): string {
  const status = branch_scope_status(scope);
  if (status === 'all') return 'Tất cả chi nhánh';
  if (status === 'none') return 'Chưa chọn chi nhánh';
  return scope.branch_ids
    .map((id) => branches.find((branch) => Number(branch.id) === id)?.name || `#${id}`)
    .join(', ');
}

// The body a form sends: { all_branches: true } or { all_branches: false, branch_ids: [...] }
export function branch_scope_payload(
  scope: BranchScope
): { all_branches: true; branch_ids?: undefined } | { all_branches: false; branch_ids: number[] } {
  if (scope.all_branches) return { all_branches: true };
  return { all_branches: false, branch_ids: [...scope.branch_ids] };
}

// The scope a new item starts with: a Super Admin starts with every branch, a branch staff member with their own
// branches. A staff member with no branch starts with none (never "all branches", which only a Super Admin may choose).
export function default_branch_scope(is_super_admin: boolean, staff_branch_ids: number[] | null | undefined): BranchScope {
  if (is_super_admin) return ALL_BRANCHES_SCOPE;
  return { all_branches: false, branch_ids: [...(staff_branch_ids || [])] };
}

export function same_branch_scope(left: BranchScope, right: BranchScope): boolean {
  if (left.all_branches !== right.all_branches) return false;
  if (left.all_branches) return true;
  const left_sorted = [...left.branch_ids].sort((a, b) => a - b);
  const right_sorted = [...right.branch_ids].sort((a, b) => a - b);
  return left_sorted.length === right_sorted.length && left_sorted.every((id, index) => id === right_sorted[index]);
}
