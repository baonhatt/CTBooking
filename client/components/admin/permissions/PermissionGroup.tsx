import React from 'react';
import { Folder } from 'lucide-react';
import { PermissionGroupProps } from './types';
import PermissionRow from './PermissionRow';

export default function PermissionGroup({
  module,
  selectedPermissions,
  onPermissionToggle,
  onRowToggle
}: PermissionGroupProps) {
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden mb-4">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
        <Folder className="w-4 h-4 text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
          {module.label}
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <tbody>
            {module.permissions.map(permission => (
              <PermissionRow
                key={permission.key}
                module={module.name}
                label={permission.name}
                permissions={[permission]}
                selectedPermissions={selectedPermissions}
                onPermissionToggle={onPermissionToggle}
                onRowToggle={onRowToggle}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
