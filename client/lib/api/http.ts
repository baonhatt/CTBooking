import { handleAutoLogout } from '../auth-utils';

export const API_BASE_URL = (() => {
  const env = (import.meta as any).env || {};
  const base = env?.VITE_API_BASE_URL || env?.VITE_API_URL || '';
  if (typeof window !== 'undefined') {
    const h = window.location.hostname || '';

    if (h === 'localhost' || h === '127.0.0.1') return '';

    // Preview admin (admin-preview.cinesphere.com.vn, or its *.pages.dev address) talks to the preview API.
    // Same site as the admin, so the login cookie is sent; from *.pages.dev it is not.
    if (h === 'admin-preview.cinesphere.com.vn' || (h.endsWith('pages.dev') && h !== 'cinema-pages.pages.dev')) {
      return 'https://api-preview.cinesphere.com.vn';
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


    if (h === 'localhost' || h === '127.0.0.1') return base;

    if (h === 'admin-preview.cinesphere.com.vn' || (h.endsWith('pages.dev') && h !== 'cinema-pages.pages.dev')) {
      const url = 'https://api-preview.cinesphere.com.vn';

      return url;
    }

    if (h === 'cinesphere.com.vn' || h === 'www.cinesphere.com.vn' || h === 'cinema-pages.pages.dev') {
      const url = 'https://cinesphere.com.vn';

      return url;
    }

    if (h === 'cinesphere.com.vn' || h === 'www.cinesphere.com.vn' || h === 'admin.cinesphere.com.vn') {
      const url = 'https://api.cinesphere.com.vn';

      return url;
    }


    return base;
  }
  return base;
})();

export function buildUrl(path: string) {
  return API_BASE_URL ? `${API_BASE_URL}${path}` : path;
}

export async function request<T>(path: string, init: RequestInit = {}) {
  const url = buildUrl(path);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init.headers as Record<string, string>) || {})
  };

  // The staff session is the HttpOnly staff_session cookie set by the API at login. The browser sends it by itself
  // (credentials: 'include'); page scripts never see or send the token.
  const res = await fetch(url, {
    ...init,
    credentials: 'include',
    headers
  });
  if (!res.ok) {
    // Read the server's message first: a refusal (403) should show the reason, not only a generic notice
    let errorMessage = `HTTP ${res.status}`;
    let serverMessage = '';
    try {
      const errorData = await res.json();
      if (errorData?.message) {
        serverMessage = String(errorData.message);
        errorMessage = serverMessage;
      }
    } catch {
      // ignore parse error
    }

    // Xử lý chung chặn 401 (Hết phiên, token invalid)
    if (res.status === 401 && typeof window !== 'undefined') {
      // Loại trừ các API setup công khai và API login để tránh redirect loop
      const isPublicSetup = path.includes('/api/admin/setup/super-admin');
      const isAuthApi = path.includes('/api/admin/auth/login');
      
      if (!isPublicSetup && !isAuthApi) {
        handleAutoLogout();
      }
    } else if (res.status === 403 && typeof window !== 'undefined') {
      // Xử lý chặn lỗi 403 (Không đủ quyền)
      import('sonner').then(({ toast }) => {
        toast.error(serverMessage || 'Bạn không có quyền thực hiện thao tác này.', { id: 'admin-access-denied' });
      });
    }

    throw new Error(errorMessage);
  }
  return (await res.json()) as T;
}
