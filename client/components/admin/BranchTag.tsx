import { parseBranchIdsFromApi } from '@/lib/branch-ids';

type BranchTagProps = {
  branch_ids?: unknown;
  branch_id?: unknown;
  branches: { id: number; name: string }[];
  className?: string;
};

// "CN Hà Nội" -> "Hà Nội": the tag is tiny, the prefix adds nothing
function short_branch_name(name: string): string {
  return name.replace(/^(CN|Chi nhánh)\s+/i, '').trim() || name;
}

// Branch ids of an item as the pick-lists read them: branch_ids (array or JSON text) plus a single branch_id.
// No branch at all means the item is global (all branches).
export function branch_ids_of_item(branch_ids: unknown, branch_id: unknown): number[] {
  const parsed = parseBranchIdsFromApi(branch_ids);
  const ids: number[] = Array.isArray(parsed) ? [...parsed] : [];
  const single = Number(branch_id);
  if (branch_id !== null && branch_id !== undefined && !Number.isNaN(single) && single > 0 && !ids.includes(single)) {
    ids.push(single);
  }
  return ids;
}

// A small grey tag telling which branch(es) a package or movie belongs to. Used in pick-lists where several branches
// show at once and two items can have the same name.
export function BranchTag({ branch_ids, branch_id, branches, className }: BranchTagProps) {
  const ids = branch_ids_of_item(branch_ids, branch_id);
  const names = ids.map((id) => {
    const found = branches.find((branch) => Number(branch.id) === id);
    return found ? short_branch_name(found.name) : 'CN khác';
  });

  let label: string;
  let full_label: string;
  if (ids.length === 0) {
    label = 'Tất cả CN';
    full_label = 'Áp dụng cho tất cả chi nhánh';
  } else if (names.length <= 2) {
    label = names.join(' · ');
    full_label = names.join(', ');
  } else {
    label = `${names[0]} +${names.length - 1}`;
    full_label = names.join(', ');
  }

  const tone = ids.length === 0 ? 'border-blue-100 bg-blue-50 text-blue-600' : 'border-slate-200 bg-slate-100 text-slate-600';
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded border px-1.5 py-px text-[10px] font-medium leading-4 ${tone} ${className || ''}`}
      title={full_label}
    >
      {label}
    </span>
  );
}
