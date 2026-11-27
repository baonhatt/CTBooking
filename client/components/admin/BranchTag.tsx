import { branch_scope_of } from '@/lib/branch-scope';

type BranchTagProps = {
  all_branches?: unknown;
  branch_ids?: unknown;
  branches: { id: number; name: string }[];
  className?: string;
};

// The tag is tiny: "HCM | CN AEON MALL Tân Phú Celadon" -> "Tân Phú Celadon", "CN Hà Nội" -> "Hà Nội".
// The region code, the "CN" prefix and the mall brand add nothing here; the full names are in the tooltip.
export function short_branch_name(name: string): string {
  const place = name
    .replace(/^[^|]*\|\s*/, '')
    .replace(/^(CN|Chi nhánh)\s+/i, '')
    .replace(/^AEON\s+MALL\s+/i, '')
    .trim();
  return place || name;
}

// A small grey tag telling which branch(es) a package or movie belongs to. Used in pick-lists where several branches
// show at once and two items can have the same name.
export function BranchTag({ all_branches, branch_ids, branches, className }: BranchTagProps) {
  const scope = branch_scope_of({ all_branches, branch_ids });
  const ids = scope.branch_ids;
  const names = ids.map((id) => {
    const found = branches.find((branch) => Number(branch.id) === id);
    return found ? short_branch_name(found.name) : 'CN khác';
  });

  const full_names = ids.map((id) => branches.find((branch) => Number(branch.id) === id)?.name || 'CN khác');
  let label: string;
  let full_label: string;
  if (scope.all_branches) {
    label = 'Tất cả CN';
    full_label = 'Áp dụng cho tất cả chi nhánh';
  } else if (ids.length === 0) {
    label = 'Chưa chọn CN';
    full_label = 'Chưa áp dụng cho chi nhánh nào';
  } else if (names.length <= 2) {
    label = names.join(' · ');
    full_label = full_names.join(', ');
  } else {
    label = `${names[0]} +${names.length - 1}`;
    full_label = full_names.join(', ');
  }

  const tone = scope.all_branches
    ? 'border-blue-100 bg-blue-50 text-blue-600'
    : ids.length === 0
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : 'border-slate-200 bg-slate-100 text-slate-600';
  return (
    // Never wider than half the row, cut with "…": the item name next to it always keeps its room
    <span
      className={`inline-block min-w-0 max-w-[50%] truncate whitespace-nowrap rounded border px-1.5 py-px text-[10px] font-medium leading-4 ${tone} ${className || ''}`}
      title={full_label}
    >
      {label}
    </span>
  );
}
