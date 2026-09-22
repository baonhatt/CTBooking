import { siteConfig } from '@/config/site';
import { getCookie } from '@/lib/cookies';

// Sử dụng biến môi trường Next.js thay vì Vite syntax
// Trong SSR (Server-Side Rendering), luôn dùng NEXT_PUBLIC_API_URL để gọi API
let API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

// Override for preview environment if env var not set
if (!API_BASE_URL && typeof window !== 'undefined') {
  const hostname = window.location.hostname;
  if (hostname.includes('preview') && hostname.endsWith('.pages.dev') && !hostname.includes('cinema-pages.pages.dev')) {
    API_BASE_URL = 'https://cinema-worker-preview.baonhat20.workers.dev';
  }
}

// Export for other modules to import
export { API_BASE_URL };

// SERVER_BASE_URL dùng cho server-side API calls (IPN callbacks, v.v.)
export const SERVER_BASE_URL =
  process.env.NEXT_PUBLIC_SERVER_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? API_BASE_URL;

export function buildUrl(path: string) {
  return API_BASE_URL ? `${API_BASE_URL}${path}` : path;
}

export async function request<T>(path: string, init: RequestInit = {}) {
  const url = buildUrl(path);

  // Get token from cookie (user token or staff token)
  const userToken = typeof window !== 'undefined' ? getCookie('userToken') : null;
  const staffToken = typeof window !== 'undefined' ? getCookie('staffToken') : null;
  const token = staffToken || userToken;

  const res = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      // Send staff token via Authorization header for admin routes
      ...(staffToken && path.startsWith('/api/admin') && { Authorization: `Bearer ${staffToken}` }),
      ...(token && !path.startsWith('/api/admin') && { Authorization: `Bearer ${token}` }),
      // Thêm User-Agent để giúp SEO bot nhận diện request
      ...(typeof window === 'undefined' && {
        'User-Agent': `Mozilla/5.0 (compatible; CinesphereBot/1.0; +${siteConfig.domain})`
      }),
      ...(init.headers || {})
    }
  });
  if (!res.ok) {
    // Xử lý interceptor 401 và 403 tập trung
    if (typeof window !== 'undefined') {
      if (res.status === 401) {
        // Loại trừ các API liên quan đến auth để tránh vòng lặp hoặc lỗi redirect
        const authPaths = [
          '/api/login',
          '/api/register',
          '/api/validate-otp',
          '/api/resend-otp',
          '/api/forget-password',
          '/api/reset-password'
        ];
        
        const isAuthApi = authPaths.some((p) => path.includes(p));

        if (!isAuthApi) {
          // Xóa token và profile ở client (cookie + localStorage)
          // Không gọi /api/logout vì 401 tức là token đã hết hạn trên server rồi
          // Gọi rườm rà thêm request là không cần thiết
          localStorage.removeItem('userToken');
          localStorage.removeItem('userProfile');
          
          // Import dynamic deleteCookie để đảm bảo an toàn nếu run-time khác
          // Tuy nhiên hàm getCookie được import tĩnh ở trên rồi.
          import('@/lib/cookies').then(({ deleteCookie }) => {
            deleteCookie('userToken');
            deleteCookie('userProfile');
          });

          // Dispatch event để UI cập nhật (ví dụ useAuthState)
          window.dispatchEvent(new Event('user-auth-changed'));
          
          // Mở Login dialog qua global event
          window.dispatchEvent(new CustomEvent('open-login-dialog', { 
            detail: { message: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.' } 
          }));
        }
      } else if (res.status === 403) {
        window.dispatchEvent(new CustomEvent('show-error-toast', { 
          detail: { message: 'Bạn không có quyền thực hiện thao tác này.' } 
        }));
      }
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
