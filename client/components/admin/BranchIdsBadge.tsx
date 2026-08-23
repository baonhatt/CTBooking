import { formatBranchIdsLabel, getBranchIdsDisplayStatus, parseBranchIdsFromApi, type BranchIdsValue } from '@/lib/branch-ids';

type BranchIdsBadgeProps = {
        branch_ids?: unknown;
        branch_id?: unknown;
        branches: { id: number; name: string }[];
        className?: string;
};

function toSingleBranchIdOrNull(raw: unknown): BranchIdsValue {
        if (raw === null || raw === undefined) return null;
        if (typeof raw === 'number') {
                return Number.isNaN(raw) || raw <= 0 ? null : [raw];
        }
        if (typeof raw === 'string') {
                const trimmed = raw.trim();
                if (trimmed.length === 0) return null;
                const n = Number(trimmed);
                if (!Number.isNaN(n) && n > 0) return [n];
                try {
                        const parsed = JSON.parse(trimmed);
                        if (typeof parsed === 'number') {
                                return Number.isNaN(parsed) || parsed <= 0 ? null : [parsed];
                        }
                        if (Array.isArray(parsed) && parsed.length > 0) {
                                const n2 = Number(parsed[0]);
                                return Number.isNaN(n2) || n2 <= 0 ? null : [n2];
                        }
                } catch {
                        return null;
                }
        }
        return null;
}

export function BranchIdsBadge({ branch_ids, branch_id, branches, className }: BranchIdsBadgeProps) {
        const normalized: BranchIdsValue =
                branch_ids !== undefined
                        ? parseBranchIdsFromApi(branch_ids)
                        : toSingleBranchIdOrNull(branch_id);
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
