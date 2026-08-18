import { handleAutoLogout } from '../auth-utils';

export const API_BASE_URL = (() => {
  const env = (import.meta as any).env || {};
  const base = env?.VITE_API_BASE_URL || env?.VITE_API_URL || '';
  if (typeof window !== 'undefined') {
    const h = window.location.hostname || '';

    if (h === 'localhost' || h === '127.0.0.1') return '';

    if (h.endsWith('pages.dev') && h !== 'cinema-pages.pages.dev') {
      return 'https://cinema-worker-preview.baonhat20.workers.dev';
    }

    if (h === 'cinesphere.com.vn' || h === 'www.cinesphere.com.vn' || h === 'cinema-pages.pages.dev') {
      return '';
    }

    if (h === 'cinesphere.com.vn' || h === 'www.cinesphere.com.vn' || h === 'admin.cinesphere.com.vn') {
      return 'https://api.cinesphere.com.vn';
    }

    return base;
  }
  return base;
})();

export const SERVER_BASE_URL = (() => {
  const env = (import.meta as any).env || {};
  const base = env?.VITE_SERVER_BASE_URL || '';
  if (typeof window !== 'undefined') {
    const h = window.location.hostname || '';
    console.log('[DEBUG] hostname:', h, 'base:', base);

    if (h === 'localhost' || h === '127.0.0.1') return base;

    if (h.endsWith('pages.dev') && h !== 'cinema-pages.pages.dev') {
      const url = 'https://cinema-worker-preview.baonhat20.workers.dev';
      console.log('[DEBUG] Using preview worker:', url);
      return url;
    }

    if (h === 'cinesphere.com.vn' || h === 'www.cinesphere.com.vn' || h === 'cinema-pages.pages.dev') {
      const url = 'https://cinesphere.com.vn';
      console.log('[DEBUG] Using cinesphere:', url);
      return url;
    }

    if (h === 'cinesphere.com.vn' || h === 'www.cinesphere.com.vn' || h === 'admin.cinesphere.com.vn') {
      const url = 'https://api.cinesphere.com.vn';
      console.log('[DEBUG] Using api.cinesphere:', url);
      return url;
    }

    console.log('[DEBUG] Using base fallback:', base);
    return base;
  }
  return base;
})();

export function buildUrl(path: string) {
  return API_BASE_URL ? `${API_BASE_URL}${path}` : path;
}

export async function request<T>(path: string, init: RequestInit = {}) {
  const url = buildUrl(path);

  // Get token from localStorage (user token or staff token)
  const userToken = typeof window !== 'undefined' ? localStorage.getItem('userToken') : null;
  const staffToken = typeof window !== 'undefined' ? localStorage.getItem('staffToken') : null;
  const token = staffToken || userToken;

  // Build headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init.headers as Record<string, string>) || {})
  };

  // Send staff token via Authorization header for admin routes
  // Middleware supports both cookie and Authorization header
  const needsStaffAuth =
    path.startsWith('/api/admin') ||
    path.startsWith('/api/showtimes') ||
    path.startsWith('/api/bookings-code/') ||
    path === '/api/bookings-use' ||
    path === '/api/confirm-booking';
  if (staffToken && needsStaffAuth) {
    headers['Authorization'] = `Bearer ${staffToken}`;
  } else if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...init,
    credentials: 'include',
    headers
  });
  if (!res.ok) {
    // Auto logout khi 401 Unauthorized (token hết hạn hoặc invalid)
    // Loại trừ các API setup công khai để tránh loop
    const isPublicSetup = path.includes('/api/admin/setup/super-admin');
    if (res.status === 401 && typeof window !== 'undefined' && !isPublicSetup) {
      handleAutoLogout();
    }

    let errorMessage = `HTTP ${res.status}`;
    try {
      const errorData = await res.json();
      if (errorData?.message) {
        errorMessage = errorData.message;
      }
    } catch {
      // ignore parse error
    }
    throw new Error(errorMessage);
  }
  return (await res.json()) as T;
}
