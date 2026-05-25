export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'publish';

export interface PermissionItem {
  key: string;
  name: string;
  action: PermissionAction;
  module: string;
}

export interface PermissionModule {
  name: string;
  label: string;
  permissions: PermissionItem[];
}

export interface PermissionMatrixProps {
  modules: PermissionModule[];
  selectedPermissions: Set<string>;
  onPermissionToggle: (key: string) => void;
  onModuleToggle?: (module: string, action: PermissionAction) => void;
  onRowToggle?: (module: string) => void;
  onColumnToggle?: (action: PermissionAction) => void;
  onToggleAll?: () => void;
  onClearAll?: () => void;
}

export interface PermissionRowProps {
  module: string;
  label: string;
  permissions: PermissionItem[];
  selectedPermissions: Set<string>;
  onPermissionToggle: (key: string) => void;
  onRowToggle?: (module: string) => void;
}

export interface PermissionGroupProps {
  module: PermissionModule;
  selectedPermissions: Set<string>;
  onPermissionToggle: (key: string) => void;
  onRowToggle?: (module: string) => void;
}

export interface PermissionHeaderProps {
  actions: PermissionAction[];
  selectedPermissions: Set<string>;
  allPermissions: PermissionItem[];
  onColumnToggle?: (action: PermissionAction) => void;
  onToggleAll?: () => void;
  onClearAll?: () => void;
}
