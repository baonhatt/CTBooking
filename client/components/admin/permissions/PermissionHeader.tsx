import React, { useMemo } from 'react';
import { Check, Minus } from 'lucide-react';
import { PermissionHeaderProps, PermissionAction } from './types';

const ACTION_LABELS: Record<PermissionAction, string> = {
  view: 'Xem',
  create: 'Tạo',
  edit: 'Sửa',
  delete: 'Xóa',
  publish: 'Xuất bản'
};

export default function PermissionHeader({
  actions,
  selectedPermissions,
  allPermissions,
  onColumnToggle,
  onToggleAll,
  onClearAll
}: PermissionHeaderProps) {
  const columnStates = useMemo(() => {
    return actions.map(action => {
      const actionPermissions = allPermissions.filter(p => p.action === action);
      const selectedCount = actionPermissions.filter(p => selectedPermissions.has(p.key)).length;
      const totalCount = actionPermissions.length;
      
      return {
        action,
        checked: selectedCount === totalCount && totalCount > 0,
        indeterminate: selectedCount > 0 && selectedCount < totalCount,
        selectedCount,
        totalCount
      };
    });
  }, [actions, selectedPermissions, allPermissions]);

  const allChecked = useMemo(() => {
    return allPermissions.length > 0 && allPermissions.every(p => selectedPermissions.has(p.key));
  }, [allPermissions, selectedPermissions]);

  const allIndeterminate = useMemo(() => {
    const selectedCount = allPermissions.filter(p => selectedPermissions.has(p.key)).length;
    return selectedCount > 0 && selectedCount < allPermissions.length;
  }, [allPermissions, selectedPermissions]);

  return (
    <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
      <tr>
        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-48 border-r border-slate-200">
          Chức năng
        </th>
        {actions.map(action => {
          const state = columnStates.find(s => s.action === action);
          return (
            <th
              key={action}
              className="px-4 py-3 text-center min-w-[100px] border-r border-slate-200 last:border-r-0"
            >
              <span className="text-xs font-semibold text-slate-600 uppercase">
                {ACTION_LABELS[action]}
              </span>
            </th>
          );
        })}
      </tr>
      {(onToggleAll || onClearAll) && (
        <tr>
          <th colSpan={actions.length + 1} className="px-4 py-2 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={onToggleAll}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  Chọn tất cả
                </button>
                <span className="text-slate-300">|</span>
                <button
                  onClick={onClearAll}
                  className="text-xs text-slate-600 hover:text-slate-700 font-medium"
                >
                  Bỏ chọn
                </button>
              </div>
              <div className="text-xs text-slate-500">
                Đã chọn: {selectedPermissions.size} / {allPermissions.length}
              </div>
            </div>
          </th>
        </tr>
      )}
    </thead>
  );
}
