export interface AdminProfile {
  role: string;
  permissions: string[];
}

export function getAdminProfileFromStorage(): AdminProfile | null {
  try {
    const p = localStorage.getItem('adminProfile');
    if (!p) return null;
    const parsed = JSON.parse(p);
    return {
      role: parsed?.role || '',
      permissions: Array.isArray(parsed?.permissions) ? parsed.permissions : []
    };
  } catch {
    return null;
  }
}

export function getAdminRole(): string {
  const profile = getAdminProfileFromStorage();
  return profile?.role || '';
}

export function getAdminPermissions(): string[] {
  const profile = getAdminProfileFromStorage();
  return profile?.permissions || [];
}
