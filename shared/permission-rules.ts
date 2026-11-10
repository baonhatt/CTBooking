// Which permission needs which other permission, shared by the role editor (client) and the role API (server).
// A role that may edit a record but not open the list would only see 403 errors, so the rules keep them together.

export type PermissionKey = string; // "module:action"

// Modules with a "view" action: every other action of the module needs it
const MODULES_WITH_VIEW = [
  'staff',
  'roles',
  'dashboard',
  'users',
  'movies',
  'showtimes',
  'toys',
  'tickets',
  'vouchers',
  'posts',
  'branches',
  'uploads',
  'settings',
  'transactions',
  'email_logs',
  'audit_logs'
];

// Extra rules on top of "needs view"
const EXTRA_REQUIREMENTS: Record<PermissionKey, PermissionKey[]> = {
  // Restoring needs the deleted list to pick from
  'staff:restore': ['staff:view_deleted'],
  'roles:restore': ['roles:view_deleted'],
  'movies:restore': ['movies:view_deleted'],
  'toys:restore': ['toys:view_deleted'],
  'tickets:restore': ['tickets:view_deleted'],
  'vouchers:restore': ['vouchers:view_deleted'],
  'branches:restore': ['branches:view_deleted'],
  // Marking a ticket as used starts from looking the ticket up
  'ticket_check:validate': ['ticket_check:scan'],
  'ticket_check:history': ['ticket_check:scan']
};

// permission key -> the keys it needs (built once)
export function buildRequirements(allKeys: PermissionKey[]): Record<PermissionKey, PermissionKey[]> {
  const requirements: Record<PermissionKey, PermissionKey[]> = {};
  for (const key of allKeys) {
    const [moduleName, actionName] = key.split(':');
    const needed: PermissionKey[] = [];
    if (MODULES_WITH_VIEW.includes(moduleName) && actionName !== 'view') {
      needed.push(`${moduleName}:view`);
    }
    for (const extraKey of EXTRA_REQUIREMENTS[key] || []) {
      needed.push(extraKey);
    }
    if (needed.length > 0) requirements[key] = needed;
  }
  return requirements;
}

// Adds every permission that a selected permission needs, however deep the chain goes
export function addRequiredPermissions(selectedKeys: PermissionKey[], allKeys: PermissionKey[]): PermissionKey[] {
  const requirements = buildRequirements(allKeys);
  const knownKeys = new Set(allKeys);
  const result = new Set(selectedKeys);
  const pending = [...selectedKeys];
  while (pending.length > 0) {
    const key = pending.pop() as PermissionKey;
    for (const neededKey of requirements[key] || []) {
      if (knownKeys.has(neededKey) && !result.has(neededKey)) {
        result.add(neededKey);
        pending.push(neededKey);
      }
    }
  }
  return Array.from(result);
}

// Removes a permission together with every selected permission that needs it (directly or through a chain)
export function removePermissionWithDependents(
  removedKey: PermissionKey,
  selectedKeys: PermissionKey[],
  allKeys: PermissionKey[]
): PermissionKey[] {
  const requirements = buildRequirements(allKeys);
  const result = new Set(selectedKeys);
  result.delete(removedKey);
  const removedKeys = new Set([removedKey]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const key of Array.from(result)) {
      // Only keys that lean on something removed here go; older gaps unrelated to this click stay as they were
      const leansOnRemoved = (requirements[key] || []).some((neededKey) => removedKeys.has(neededKey));
      if (leansOnRemoved) {
        result.delete(key);
        removedKeys.add(key);
        changed = true;
      }
    }
  }
  return Array.from(result);
}
