export const API_BASE_URL = (() => {
        const env = (import.meta as any).env || {};
        const base = env?.VITE_API_BASE_URL || env?.VITE_API_URL || "";
        if (typeof window !== "undefined") {
                const h = window.location.hostname || "";

                if (h === "localhost" || h === "127.0.0.1") return "";

                if (h.endsWith("pages.dev") && h !== "cinema-pages.pages.dev") {
                        return "https://cinema-worker-preview.baonhat20.workers.dev";
                }

                if (h === "cinesphere.com.vn" || h === "www.cinesphere.com.vn" || h === "cinema-pages.pages.dev") {
                        return "";
                }

                if (h === "cinesphere.com.vn" || h === "www.cinesphere.com.vn" || h === "admin.cinesphere.com.vn") {
                        return "https://api.cinesphere.com.vn";
                }

                return base;
        }
        return base;
})();

export const SERVER_BASE_URL = (() => {
        const env = (import.meta as any).env || {};
        const base = env?.VITE_SERVER_BASE_URL || "";
        if (typeof window !== "undefined") {
                const h = window.location.hostname || "";
                console.log('[DEBUG] hostname:', h, 'base:', base);

                if (h === "localhost" || h === "127.0.0.1") return base;

                if (h.endsWith("pages.dev") && h !== "cinema-pages.pages.dev") {
                        const url = "https://cinema-worker-preview.baonhat20.workers.dev";
                        console.log('[DEBUG] Using preview worker:', url);
                        return url;
                }

                if (h === "cinesphere.com.vn" || h === "www.cinesphere.com.vn" || h === "cinema-pages.pages.dev") {
                        const url = "https://cinesphere.com.vn";
                        console.log('[DEBUG] Using cinesphere:', url);
                        return url;
                }

                if (h === "cinesphere.com.vn" || h === "www.cinesphere.com.vn" || h === "admin.cinesphere.com.vn") {
                        const url = "https://api.cinesphere.com.vn";
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
        const res = await fetch(url, {
                ...init,
                headers: {
                        "Content-Type": "application/json",
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

