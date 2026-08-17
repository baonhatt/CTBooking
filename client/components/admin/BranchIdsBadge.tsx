import { formatBranchIdsLabel, getBranchIdsDisplayStatus, type BranchIdsValue } from '@/lib/branch-ids';

type BranchIdsBadgeProps = {
        branch_ids?: BranchIdsValue | null;
        branch_id?: number | null;
        branches: { id: number; name: string }[];
        className?: string;
};

export function BranchIdsBadge({ branch_ids, branch_id, branches, className }: BranchIdsBadgeProps) {
        const normalized =
                branch_ids !== undefined
                        ? branch_ids
                        : branch_id
                          ? [branch_id]
                          : null;
        const status = getBranchIdsDisplayStatus(normalized);
        const label = formatBranchIdsLabel(normalized, branches);

        const style =
                status === 'unset'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : status === 'all'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200';

        return (
                <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium max-w-[180px] truncate ${style} ${className || ''}`}
                        title={label}
                >
                        {label}
                </span>
        );
}
