export type BranchIdsValue = number[] | null;

/** null = all branches; [] = not configured */
export function normalizeBranchIdsInput(
        branch_ids: BranchIdsValue | undefined,
        branch_id?: number | null
): BranchIdsValue {
        if (branch_ids !== undefined) return branch_ids;
        if (branch_id === null || branch_id === undefined) return null;
        return [branch_id];
}

export function parseBranchIdsFromApi(raw: unknown): BranchIdsValue {
        if (raw === null || raw === undefined) return null;
        if (Array.isArray(raw)) {
                if (raw.length === 0) return [];
                return raw.map((v) => Number(v)).filter((id) => !Number.isNaN(id) && id > 0);
        }
        if (typeof raw === 'string') {
                try {
                        const parsed = JSON.parse(raw);
                        if (Array.isArray(parsed)) {
                                if (parsed.length === 0) return [];
                                return parsed.map((v) => Number(v)).filter((id) => !Number.isNaN(id) && id > 0);
                        }
                } catch {
                        return null;
                }
        }
        return null;
}

export type BranchIdsDisplayStatus = 'all' | 'specific' | 'unset';

export function getBranchIdsDisplayStatus(branch_ids: BranchIdsValue): BranchIdsDisplayStatus {
        if (branch_ids === null) return 'all';
        if (branch_ids.length === 0) return 'unset';
        return 'specific';
}

export function formatBranchIdsLabel(
        branch_ids: BranchIdsValue,
        branches: { id: number; name: string }[]
): string {
        const status = getBranchIdsDisplayStatus(branch_ids);
        if (status === 'all') return 'Tất cả chi nhánh';
        if (status === 'unset') return 'Chưa chọn chi nhánh';
        const names = branch_ids!
                .map((id) => branches.find((b) => b.id === id)?.name)
                .filter(Boolean);
        return names.length > 0 ? names.join(', ') : branch_ids!.join(', ');
}
