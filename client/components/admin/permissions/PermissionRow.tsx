import React, { useMemo } from 'react';
import { Check, Minus, ChevronRight } from 'lucide-react';
import { PermissionRowProps, PermissionAction } from './types';

const ACTION_LABELS: Record<PermissionAction, string> = {
  view: 'Xem',
  create: 'Tạo',
  edit: 'Sửa',
  delete: 'Xóa',
  publish: 'Xuất bản'
};

export default function PermissionRow({
  module,
  label,
  permissions,
  selectedPermissions,
  onPermissionToggle,
  onRowToggle
}: PermissionRowProps) {
  const rowState = useMemo(() => {
    const selectedCount = permissions.filter(p => selectedPermissions.has(p.key)).length;
    const totalCount = permissions.length;
    
    return {
      checked: selectedCount === totalCount && totalCount > 0,
      indeterminate: selectedCount > 0 && selectedCount < totalCount,
      selectedCount,
      totalCount
    };
  }, [permissions, selectedPermissions]);

  const handleRowClick = () => {
    if (onRowToggle) {
      onRowToggle(module);
    }
  };

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors group">
      <td className="px-4 py-3 border-r border-slate-200">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-slate-900 truncate">{label}</div>
          <div className="text-xs text-slate-500 font-mono truncate">{module}</div>
        </div>
      </td>
      {permissions.map(permission => {
        const isChecked = selectedPermissions.has(permission.key);
        return (
          <td
            key={permission.key}
            className="px-4 py-3 text-center border-r border-slate-200 last:border-r-0"
          >
            <input
              type="checkbox"
              checked={isChecked}
              onChange={() => onPermissionToggle(permission.key)}
              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0 cursor-pointer"
              title={`${ACTION_LABELS[permission.action]} ${label}`}
            />
          </td>
        );
      })}
    </tr>
  );
}
