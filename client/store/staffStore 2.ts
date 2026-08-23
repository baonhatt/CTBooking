import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Staff {
  id: number;
  email: string;
  fullname: string;
  phone?: string;
  avatar?: string;
  isSuperAdmin: boolean;
  forcePasswordChange: boolean;
  lastLoginAt?: string;
}

interface StaffState {
  staff: Staff | null;
  permissions: Array<{ module: string; action: string }>;
  branchIds: number[];
  token: string | null;
  isAuthenticated: boolean;
  setStaff: (
    staff: Staff,
    permissions: Array<{ module: string; action: string }>,
    branchIds: number[],
    token: string
  ) => void;
  clearStaff: () => void;
  hasPermission: (module: string, action: string) => boolean;
}

export const useStaffStore = create<StaffState>()(
  persist(
    (set, get) => ({
      staff: null,
      permissions: [],
      branchIds: [],
      token: null,
      isAuthenticated: false,
      setStaff: (staff, permissions, branchIds, token) =>
        set({
          staff,
          permissions,
          branchIds,
          token,
          isAuthenticated: true
        }),
      clearStaff: () =>
        set({
          staff: null,
          permissions: [],
          branchIds: [],
          token: null,
          isAuthenticated: false
        }),
      hasPermission: (module, action) => {
        const { staff, permissions } = get();
        if (!staff) return false;
        if (staff.isSuperAdmin) return true;
        return permissions.some((p) => p.module === module && p.action === action);
      }
    }),
    {
      name: 'staff-storage'
    }
  )
);
