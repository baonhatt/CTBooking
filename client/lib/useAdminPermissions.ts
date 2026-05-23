import { useMemo, useState, useEffect } from 'react';
import { getAdminProfileFromStorage } from '@/lib/admin-profile-utils';

export function useAdminPermissions() {
  const [adminRole, setAdminRole] = useState<string>(() => {
    const profile = getAdminProfileFromStorage();
    return profile?.role || '';
  });
  const [adminPermissions, setAdminPermissions] = useState<string[]>(() => {
    const profile = getAdminProfileFromStorage();
    return profile?.permissions || [];
  });

  useEffect(() => {
    const onAuthChanged = () => {
      const profile = getAdminProfileFromStorage();
      setAdminRole(profile?.role || '');
      setAdminPermissions(profile?.permissions || []);
    };
    window.addEventListener('admin-auth-changed', onAuthChanged as any);
    window.addEventListener('storage', onAuthChanged as any);
    return () => {
      window.removeEventListener('admin-auth-changed', onAuthChanged as any);
      window.removeEventListener('storage', onAuthChanged as any);
    };
  }, []);

  const adminPermissionsSet = useMemo(() => new Set(adminPermissions), [adminPermissions]);

  const isViewer = adminRole === 'viewer';
  const isSuperAdmin = adminRole === 'super_admin';

  const hasPermission = (key: string) => {
    if (isSuperAdmin) return true;
    return adminPermissionsSet.has(key);
  };

  const hasAnyPermission = (keys: string[]) => {
    if (isSuperAdmin) return true;
    return keys.some((k) => adminPermissionsSet.has(k));
  };

  return {
    adminRole,
    adminPermissions,
    isViewer,
    isSuperAdmin,
    hasPermission,
    hasAnyPermission
  };
}
