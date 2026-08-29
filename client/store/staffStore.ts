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
  sessionExpiresAt: string | null;
  isAuthenticated: boolean;
  setStaff: (
    staff: Staff,
    permissions: Array<{ module: string; action: string }>,
    branchIds: number[],
    token: string,
    expiresAt?: string | null
  ) => void;
  setSessionExpiresAt: (expiresAt: string | null) => void;
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
      sessionExpiresAt: null,
      isAuthenticated: false,
      setStaff: (staff, permissions, branchIds, token, expiresAt) => {
        // If expiresAt not provided, default to now + 24 hours
        const defaultExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        set({
          staff,
          permissions,
          branchIds,
          token,
          sessionExpiresAt: expiresAt || defaultExpiry,
          isAuthenticated: true
        });
      },
      setSessionExpiresAt: (expiresAt) => set({ sessionExpiresAt: expiresAt }),
      clearStaff: () =>
        set({
          staff: null,
          permissions: [],
          branchIds: [],
          token: null,
          sessionExpiresAt: null,
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
