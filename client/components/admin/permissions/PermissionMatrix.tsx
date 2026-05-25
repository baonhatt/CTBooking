import React, { useMemo } from 'react';
import { PermissionMatrixProps, PermissionAction } from './types';
import PermissionHeader from './PermissionHeader';
import PermissionRow from './PermissionRow';

const DEFAULT_ACTIONS: PermissionAction[] = ['view', 'create', 'edit', 'delete'];

export default function PermissionMatrix({
  modules,
  selectedPermissions,
  onPermissionToggle,
  onModuleToggle,
  onRowToggle,
  onColumnToggle,
  onToggleAll,
  onClearAll
}: PermissionMatrixProps) {
  const allPermissions = useMemo(() => {
    return modules.flatMap(module => module.permissions);
  }, [modules]);

  const actions = useMemo(() => {
    const uniqueActions = new Set<PermissionAction>();
    modules.forEach(module => {
      module.permissions.forEach(permission => {
        uniqueActions.add(permission.action);
      });
    });
    return Array.from(uniqueActions).sort((a, b) => {
      const order = ['view', 'create', 'edit', 'delete', 'publish'];
      return order.indexOf(a) - order.indexOf(b);
    });
  }, [modules]);

  const handleToggleAll = () => {
    if (onToggleAll) {
      onToggleAll();
    }
  };

  const handleClearAll = () => {
    if (onClearAll) {
      onClearAll();
    }
  };

  const handleColumnToggle = (action: PermissionAction) => {
    if (onColumnToggle) {
      onColumnToggle(action);
    }
  };

  const handleRowToggle = (module: string) => {
    if (onRowToggle) {
      onRowToggle(module);
    }
  };

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
      <div className="overflow-x-auto">
        <table className="w-full">
          <PermissionHeader
            actions={actions}
            selectedPermissions={selectedPermissions}
            allPermissions={allPermissions}
            onColumnToggle={onColumnToggle ? handleColumnToggle : undefined}
            onToggleAll={onToggleAll ? handleToggleAll : undefined}
            onClearAll={onClearAll ? handleClearAll : undefined}
          />
          <tbody>
            {modules.map(module => (
              <PermissionRow
                key={module.name}
                module={module.name}
                label={module.label}
                permissions={module.permissions}
                selectedPermissions={selectedPermissions}
                onPermissionToggle={onPermissionToggle}
                onRowToggle={onRowToggle ? handleRowToggle : undefined}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
