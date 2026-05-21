import { siteConfig } from '@/config/site';

// Sử dụng biến môi trường Next.js thay vì Vite syntax
// Trong SSR (Server-Side Rendering), luôn dùng NEXT_PUBLIC_API_URL để gọi API
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

// SERVER_BASE_URL dùng cho server-side API calls (IPN callbacks, v.v.)
export const SERVER_BASE_URL = process.env.NEXT_PUBLIC_SERVER_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? '';

export function buildUrl(path: string) {
        return API_BASE_URL ? `${API_BASE_URL}${path}` : path;
}

export async function request<T>(path: string, init: RequestInit = {}) {
        const url = buildUrl(path);
        const res = await fetch(url, {
                ...init,
                headers: {
                        "Content-Type": "application/json",
                        // Thêm User-Agent để giúp SEO bot nhận diện request
                        ...(typeof window === "undefined" && { "User-Agent": `Mozilla/5.0 (compatible; CinesphereBot/1.0; +${siteConfig.domain})` }),
                        ...(init.headers || {}),
                },
        });
        if (!res.ok) {
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

