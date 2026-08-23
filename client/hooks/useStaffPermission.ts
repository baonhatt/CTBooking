import { useCallback } from 'react';
import { useStaffStore } from '../store/staffStore';

/**
 * Hook to check if the current staff has a specific permission
 *
 * @param module - The module to check (e.g., 'staff', 'roles', 'movies')
 * @param action - The action to check (e.g., 'view', 'create', 'edit', 'delete')
 * @returns true if staff has permission, false otherwise
 */
export function useStaffPermission(module: string, action: string): boolean {
  const hasPermission = useStaffStore((state) => state.hasPermission);
  const isSuperAdmin = useStaffStore((state) => state.staff?.isSuperAdmin ?? false);
  if (isSuperAdmin) return true;
  return hasPermission(module, action);
}

/** Checker có bypass super admin — dùng cho nút/hành động trong component */
export function useHasStaffPermission() {
  const hasPermission = useStaffStore((state) => state.hasPermission);
  const isSuperAdmin = useStaffStore((state) => state.staff?.isSuperAdmin ?? false);
  return useCallback(
    (module: string, action: string) => {
      if (isSuperAdmin) return true;
      return hasPermission(module, action);
    },
    [hasPermission, isSuperAdmin]
  );
}

/**
 * Hook to check if the current staff is a super admin
 *
 * @returns true if staff is super admin, false otherwise
 */
export function useIsSuperAdmin(): boolean {
  const staff = useStaffStore((state) => state.staff);
  return staff?.isSuperAdmin || false;
}

/**
 * Hook to get the current staff's permissions
 *
 * @returns Array of permissions
 */
export function useStaffPermissions(): Array<{ module: string; action: string }> {
  return useStaffStore((state) => state.permissions);
}

/**
 * Hook to get the current staff's branch IDs
 *
 * @returns Array of branch IDs
 */
export function useStaffBranchIds(): number[] {
  return useStaffStore((state) => state.branchIds);
}
