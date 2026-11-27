import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import type { BranchScope } from '@/lib/branch-scope';

type BranchOption = { id: number; name: string };

type BranchMultiSelectProps = {
  branches: BranchOption[];
  value: BranchScope;
  onChange: (value: BranchScope) => void;
  disabled?: boolean;
  isLoading?: boolean;
  className?: string;
  // false for a staff member limited to some branches: they cannot choose "all branches" and pick from their own
  allowAll?: boolean;
};

// Branch picker of a form: a "Tất cả chi nhánh" switch (every branch, also those opened later) and,
// when it is off, one checkbox per branch. Ticking every branch by hand is not the same as the switch.
export function BranchMultiSelect({
  branches,
  value,
  onChange,
  disabled,
  isLoading,
  className,
  allowAll = true
}: BranchMultiSelectProps) {
  const isAll = allowAll && value.all_branches;
  const selectedIds = value.all_branches ? [] : value.branch_ids;
  const allTicked = branches.length > 0 && branches.every((b) => selectedIds.includes(b.id));

  const setAll = (checked: boolean) => {
    if (checked) {
      onChange({ all_branches: true, branch_ids: [] });
      return;
    }
    onChange({ all_branches: false, branch_ids: [] });
  };

  const tickEvery = () => {
    onChange({ all_branches: false, branch_ids: allTicked ? [] : branches.map((b) => b.id) });
  };

  const toggleBranch = (branchId: number, checked: boolean) => {
    const next = checked
      ? [...selectedIds.filter((id) => id !== branchId), branchId]
      : selectedIds.filter((id) => id !== branchId);
    onChange({ all_branches: false, branch_ids: next });
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
      {/* "Tất cả chi nhánh" switch - only shown when allowAll is true */}
      {allowAll && (
        <div className="flex items-center justify-between gap-2.5 pb-2.5 border-b border-gray-100">
          <div className="min-w-0">
            <Label htmlFor="branch-select-all" className="text-sm font-semibold text-gray-900 cursor-pointer select-none">
              Tất cả chi nhánh
            </Label>
            <p className="text-[11px] text-gray-500">Gồm cả chi nhánh mở sau này</p>
          </div>
          <Switch
            id="branch-select-all"
            checked={isAll}
            disabled={disabled}
            onCheckedChange={(checked) => setAll(Boolean(checked))}
          />
        </div>
      )}

      {!isAll && branches.length > 1 && (
        <div className="flex justify-end pt-1.5">
          <button
            type="button"
            disabled={disabled}
            onClick={tickEvery}
            className="text-[11px] font-semibold text-blue-600 hover:underline disabled:opacity-50"
          >
            {allTicked ? 'Bỏ chọn hết' : 'Chọn hết các chi nhánh dưới đây'}
          </button>
        </div>
      )}

      {/* List of Branches */}
      <div className={`pt-2 max-h-44 overflow-y-auto space-y-0.5 ${isAll ? 'opacity-50' : ''}`}>
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
                disabled={disabled || isAll}
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

      {/* Switch off and nothing ticked: saved as "not at any branch yet" */}
      {!isAll && selectedIds.length === 0 && (
        <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700">
          Chưa chọn chi nhánh nào
        </p>
      )}
    </div>
  );
}
