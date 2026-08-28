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

export function BranchMultiSelect({
  branches,
  value,
  onChange,
  disabled,
  isLoading,
  className
}: BranchMultiSelectProps) {
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

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-blue-600 font-medium px-3 py-2 bg-blue-50/50 rounded-lg border border-blue-100">
        <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
        <span>Đang tải danh sách chi nhánh...</span>
      </div>
    );
  }

  if (branches.length === 0) {
    return <p className="text-xs text-gray-500 py-1">Không có chi nhánh</p>;
  }

  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-3 shadow-sm ${className || ''}`}>
      {/* "Tất cả chi nhánh" Checkbox */}
      <div className="flex items-center gap-2.5 pb-2.5 border-b border-gray-100">
        <Checkbox
          id="branch-select-all"
          checked={allSelected}
          disabled={disabled || branches.length === 0}
          onCheckedChange={(checked) => toggleAll(Boolean(checked))}
        />
        <Label htmlFor="branch-select-all" className="text-sm font-semibold text-gray-900 cursor-pointer select-none">
          Tất cả chi nhánh
        </Label>
      </div>

      {/* List of Branches */}
      <div className="pt-2 max-h-44 overflow-y-auto space-y-0.5">
        {branches.map((branch) => {
          const checked = isAll || selectedIds.includes(branch.id);
          return (
            <div
              key={branch.id}
              className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-gray-50 transition-colors"
            >
              <Checkbox
                id={`branch-${branch.id}`}
                checked={checked}
                disabled={disabled}
                onCheckedChange={(next) => toggleBranch(branch.id, Boolean(next))}
              />
              <Label
                htmlFor={`branch-${branch.id}`}
                className="text-sm font-medium text-gray-700 cursor-pointer select-none flex-1"
              >
                {branch.name}
              </Label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
