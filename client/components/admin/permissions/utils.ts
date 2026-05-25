import { PermissionModule, PermissionItem, PermissionAction } from './types';

const MODULE_VIETNAMESE_NAMES: Record<string, string> = {
  'branches': 'Chi nhánh',
  'movies': 'Phim',
  'posts': 'Bài viết',
  'transactions': 'Giao dịch',
  'tickets': 'Vé',
  'ticket_packages': 'Gói vé',
  'toys': 'Đồ chơi',
  'uploads': 'Tải lên',
  'email_logs': 'Log email',
  'settings': 'Cài đặt',
  'dashboard': 'Dashboard',
  'users': 'Người dùng',
  'bookings': 'Đặt vé'
};

export function transformPermissionsToMatrix(
  permGroups: Record<string, Array<{ key: string; name: string }>>
): PermissionModule[] {
  const modules: PermissionModule[] = [];
  
  Object.entries(permGroups).forEach(([groupName, permissions]) => {
    const moduleKey = groupName.toLowerCase().replace(/\s+/g, '_');
    const module: PermissionModule = {
      name: moduleKey,
      label: MODULE_VIETNAMESE_NAMES[moduleKey] || groupName,
      permissions: permissions.map(perm => {
        const action = extractActionFromKey(perm.key);
        return {
          key: perm.key,
          name: perm.name,
          action,
          module: moduleKey
        };
      })
    };
    modules.push(module);
  });
  
  return modules;
}

function extractActionFromKey(key: string): PermissionAction {
  const parts = key.split('.');
  const action = parts[parts.length - 1];
  
  if (['view', 'create', 'edit', 'delete', 'publish'].includes(action)) {
    return action as PermissionAction;
  }
  
  return 'view';
}

export function groupPermissionsByModule(
  permissions: PermissionItem[]
): Record<string, PermissionItem[]> {
  const grouped: Record<string, PermissionItem[]> = {};
  
  permissions.forEach(perm => {
    if (!grouped[perm.module]) {
      grouped[perm.module] = [];
    }
    grouped[perm.module].push(perm);
  });
  
  return grouped;
}

export function getModulePermissions(
  modules: PermissionModule[],
  moduleName: string
): PermissionItem[] {
  const module = modules.find(m => m.name === moduleName);
  return module?.permissions || [];
}

export function toggleModulePermissions(
  modules: PermissionModule[],
  moduleName: string,
  selectedPermissions: Set<string>,
  select: boolean
): Set<string> {
  const newSet = new Set(selectedPermissions);
  const module = modules.find(m => m.name === moduleName);
  
  if (module) {
    module.permissions.forEach(perm => {
      if (select) {
        newSet.add(perm.key);
      } else {
        newSet.delete(perm.key);
      }
    });
  }
  
  return newSet;
}

export function toggleActionPermissions(
  modules: PermissionModule[],
  action: PermissionAction,
  selectedPermissions: Set<string>,
  select: boolean
): Set<string> {
  const newSet = new Set(selectedPermissions);
  
  modules.forEach(module => {
    module.permissions.forEach(perm => {
      if (perm.action === action) {
        if (select) {
          newSet.add(perm.key);
        } else {
          newSet.delete(perm.key);
        }
      }
    });
  });
  
  return newSet;
}

export function toggleAllPermissions(
  modules: PermissionModule[],
  selectedPermissions: Set<string>,
  select: boolean
): Set<string> {
  const newSet = new Set(selectedPermissions);
  
  modules.forEach(module => {
    module.permissions.forEach(perm => {
      if (select) {
        newSet.add(perm.key);
      } else {
        newSet.delete(perm.key);
      }
    });
  });
  
  return newSet;
}
