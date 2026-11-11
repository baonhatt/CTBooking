import { branch_ids_of_item } from '@/components/admin/BranchTag';

export type BranchGroup<T> = {
  // 'multi' = items that belong to several branches, 'all' = items with no branch (every branch)
  key: string;
  label: string;
  items: T[];
};

type BranchOption = { id: number; name: string };

// Splits a pick-list into one group per branch so items are chosen branch by branch, not mixed by name.
// Order: each branch (in the order of `branches`) that has items of its own, then items shared by several
// branches, then items that apply to all branches. Empty groups are left out. Inside a group the order is kept.
export function group_items_by_branch<T>(
  items: T[],
  get_branch_ids: (item: T) => number[],
  branches: BranchOption[]
): BranchGroup<T>[] {
  const per_branch = new Map<number, T[]>();
  const shared: T[] = [];
  const everywhere: T[] = [];

  for (const item of items) {
    const ids = get_branch_ids(item);
    if (ids.length === 0) {
      everywhere.push(item);
    } else if (ids.length === 1) {
      per_branch.set(ids[0], [...(per_branch.get(ids[0]) || []), item]);
    } else {
      shared.push(item);
    }
  }

  const groups: BranchGroup<T>[] = [];
  const known_ids = new Set(branches.map((branch) => Number(branch.id)));
  for (const branch of branches) {
    const own = per_branch.get(Number(branch.id));
    if (own && own.length > 0) groups.push({ key: `branch-${branch.id}`, label: branch.name, items: own });
  }
  // A branch missing from the option list (for example inactive) still gets its group
  for (const [branch_id, own] of per_branch) {
    if (!known_ids.has(branch_id)) groups.push({ key: `branch-${branch_id}`, label: 'Chi nhánh khác', items: own });
  }
  if (shared.length > 0) groups.push({ key: 'multi', label: 'Nhiều chi nhánh', items: shared });
  if (everywhere.length > 0) groups.push({ key: 'all', label: 'Tất cả chi nhánh', items: everywhere });
  return groups;
}

type BranchGroupHeaderProps = {
  label: string;
  count: number;
  all_selected: boolean;
  on_toggle: () => void;
};

// Title row of one group with a "select the whole group" shortcut
export function BranchGroupHeader({ label, count, all_selected, on_toggle }: BranchGroupHeaderProps) {
  return (
    <div className="sticky top-0 z-[1] mb-1 mt-2 flex items-center justify-between rounded-md bg-slate-100 px-2 py-1">
      <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
        {label} <span className="font-semibold text-slate-400">· {count}</span>
      </span>
      <button type="button" onClick={on_toggle} className="text-[11px] font-semibold text-blue-600 hover:underline">
        {all_selected ? 'Bỏ chọn nhóm' : 'Chọn cả nhóm'}
      </button>
    </div>
  );
}
