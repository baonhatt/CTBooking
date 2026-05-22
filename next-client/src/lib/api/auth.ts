import { request } from '@/lib/api/http';

export async function loginApi(body: { email: string; password: string }) {
        return request<{ status: string; message: string; user: any; token: string }>('/api/login', {
                method: 'POST',
                body: JSON.stringify(body),
                credentials: 'include'
        });
}

export async function logoutApi() {
        return request<{ status: string; message: string }>('/api/logout', {
                method: 'POST',
                credentials: 'include'
        });
}

export async function registerApi(body: {
        email: string;
        password: string;
        name?: string;
        gender?: string;
        dob?: string;
        phone?: string;
}) {
        return request<{ status: string; message: string; user: any }>('/api/register', {
                method: 'POST',
                body: JSON.stringify(body)
        });
}

export async function forgetPassApi(body: { email: string }) {
        return request<{ status: string; message: string }>('/api/forget-password', {
                method: 'POST',
                body: JSON.stringify(body)
        });
}

export async function resetPasswordApi(body: { token: string; newPassword: string }) {
        return request<{ status: string; message: string }>('/api/reset-password', {
                method: 'POST',
                body: JSON.stringify(body)
        });
}
