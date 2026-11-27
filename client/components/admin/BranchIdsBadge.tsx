import { BranchName } from '@/components/admin/BranchName';
import { branch_scope_label, branch_scope_of, branch_scope_status } from '@/lib/branch-scope';

type BranchIdsBadgeProps = {
  all_branches?: unknown;
  branch_ids?: unknown;
  branches: { id: number; name: string }[];
  className?: string;
};

export function BranchIdsBadge({ all_branches, branch_ids, branches, className }: BranchIdsBadgeProps) {
  const scope = branch_scope_of({ all_branches, branch_ids });
  const status = branch_scope_status(scope);
  const label = branch_scope_label(scope, branches);

  const style =
    status === 'none'
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : status === 'all'
        ? 'bg-blue-50 text-blue-700 border-blue-200'
        : 'bg-emerald-50 text-emerald-700 border-emerald-200';

  // Specific branches: one chip each (region on top, name on up to two lines), wrapping onto new lines,
  // so names like "HCM | CN AEON MALL Tân Phú Celadon" are not cut off
  if (status === 'specific') {
    return (
      <span className={`flex max-w-[260px] flex-wrap gap-1 ${className || ''}`} title={label}>
        {scope.branch_ids.map((id) => (
          <BranchName
            key={id}
            name={branches.find((branch) => branch.id === id)?.name || `Chi nhánh #${id}`}
            tone="bg-emerald-50 text-emerald-800 border-emerald-200"
            layout="inline"
          />
        ))}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium max-w-[180px] truncate ${style} ${className || ''}`}
      title={label}
    >
      {label}
    </span>
  );
}
