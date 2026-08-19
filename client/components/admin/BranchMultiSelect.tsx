import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import type { BranchIdsValue } from '@/lib/branch-ids';

type BranchOption = { id: number; name: string };

type BranchMultiSelectProps = {
        branches: BranchOption[];
        value: BranchIdsValue;
        onChange: (value: BranchIdsValue) => void;
        disabled?: boolean;
        isLoading?: boolean;
        className?: string;
};

export function BranchMultiSelect({ branches, value, onChange, disabled, isLoading, className }: BranchMultiSelectProps) {
        const isAll = value === null;
        const selectedIds = value ?? [];
        const allSelected = isAll || (branches.length > 0 && selectedIds.length === branches.length);

        const toggleAll = (checked: boolean) => {
                if (checked) {
                        onChange(null);
                        return;
                }
                onChange([]);
        };

        const toggleBranch = (branchId: number, checked: boolean) => {
                if (isAll) {
                        if (!checked) {
                                onChange(branches.map((b) => b.id).filter((id) => id !== branchId));
                        }
                        return;
                }

                const current = selectedIds;
                if (checked) {
                        const next = [...current, branchId];
                        if (next.length === branches.length) {
                                onChange(null);
                                return;
                        }
                        onChange(next);
                        return;
                }

                onChange(current.filter((id) => id !== branchId));
        };

        return (
                <div className={className}>
                        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                                <Checkbox
                                        id="branch-select-all"
                                        checked={allSelected}
                                        disabled={disabled || branches.length === 0 || isLoading}
                                        onCheckedChange={(checked) => toggleAll(Boolean(checked))}
                                />
                                <Label htmlFor="branch-select-all" className="text-sm font-medium text-gray-900 cursor-pointer">
                                        Tất cả chi nhánh
                                </Label>
                        </div>
                        <div className="mt-2 max-h-40 overflow-y-auto space-y-1 rounded-lg border border-gray-200 p-2">
                                {isLoading ? (
                                        <div className="flex items-center gap-2 text-xs text-blue-600 font-medium px-2 py-3">
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                <span>Đang tải danh sách chi nhánh...</span>
                                        </div>
                                ) : branches.length === 0 ? (
                                        <p className="text-sm text-gray-500 px-1 py-2">Không có chi nhánh</p>
                                ) : (
                                        branches.map((branch) => {
                                                const checked = isAll || selectedIds.includes(branch.id);
                                                return (
                                                        <div key={branch.id} className="flex items-center gap-2 rounded px-1 py-1 hover:bg-gray-50">
                                                                <Checkbox
                                                                        id={`branch-${branch.id}`}
                                                                        checked={checked}
                                                                        disabled={disabled}
                                                                        onCheckedChange={(next) => toggleBranch(branch.id, Boolean(next))}
                                                                />
                                                                <Label htmlFor={`branch-${branch.id}`} className="text-sm cursor-pointer flex-1">
                                                                        {branch.name}
                                                                </Label>
                                                        </div>
                                                );
                                        })
                                )}
                        </div>
                </div>
        );
}
