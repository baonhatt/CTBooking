import { siteConfig } from '@/config/site';
import { handleAutoLogout } from '../auth-utils';
<<<<<<< HEAD
=======
import { getCookie } from '@/lib/cookies';
>>>>>>> preview

// Sử dụng biến môi trường Next.js thay vì Vite syntax
// Trong SSR (Server-Side Rendering), luôn dùng NEXT_PUBLIC_API_URL để gọi API
let API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

// Override for preview environment if env var not set
if (!API_BASE_URL && typeof window !== 'undefined') {
        const hostname = window.location.hostname;
<<<<<<< HEAD
        if (hostname.includes('preview.cinema-next.pages.dev') || hostname.endsWith('.cinema-next.pages.dev')) {
=======
        if (hostname.includes('preview') && hostname.endsWith('.pages.dev') && !hostname.includes('cinema-pages.pages.dev')) {
>>>>>>> preview
                API_BASE_URL = 'https://cinema-worker-preview.baonhat20.workers.dev';
        }
}

// Export for other modules to import
export { API_BASE_URL };

// SERVER_BASE_URL dùng cho server-side API calls (IPN callbacks, v.v.)
<<<<<<< HEAD
export const SERVER_BASE_URL = process.env.NEXT_PUBLIC_SERVER_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? API_BASE_URL;
=======
export const SERVER_BASE_URL =
        process.env.NEXT_PUBLIC_SERVER_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? API_BASE_URL;
>>>>>>> preview

export function buildUrl(path: string) {
        return API_BASE_URL ? `${API_BASE_URL}${path}` : path;
}

export async function request<T>(path: string, init: RequestInit = {}) {
        const url = buildUrl(path);

<<<<<<< HEAD
        // Get token from localStorage and send via Authorization header
        const token = typeof window !== 'undefined' ? localStorage.getItem('userToken') : null;
=======
        // Get token from cookie (user token or staff token)
        const userToken = typeof window !== 'undefined' ? getCookie('userToken') : null;
        const staffToken = typeof window !== 'undefined' ? getCookie('staffToken') : null;
        const token = staffToken || userToken;
>>>>>>> preview

        const res = await fetch(url, {
                ...init,
                credentials: 'include',
                headers: {
<<<<<<< HEAD
                        "Content-Type": "application/json",
                        ...(token && { "Authorization": `Bearer ${token}` }),
                        // Thêm User-Agent để giúp SEO bot nhận diện request
                        ...(typeof window === "undefined" && { "User-Agent": `Mozilla/5.0 (compatible; CinesphereBot/1.0; +${siteConfig.domain})` }),
                        ...(init.headers || {}),
                },
=======
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
>>>>>>> preview
        });
        if (!res.ok) {
                // Auto logout khi 401 Unauthorized (token hết hạn hoặc invalid)
                if (res.status === 401 && typeof window !== 'undefined') {
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
<<<<<<< HEAD

=======
>>>>>>> preview
