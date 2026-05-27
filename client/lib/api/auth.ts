import type { Login, Register } from '@shared/api';
import { request } from './http';

export async function loginApi(body: { email: string; password: string }) {
	const res = await request<any>('/api/admin/auth/login', {
		method: 'POST',
		body: JSON.stringify(body),
		credentials: 'include'
	});

	// Mapping staff -> user for frontend compatibility
	if (res.status === 'success' && res.staff && !res.user) {
		res.user = {
			...res.staff,
			username: res.staff.fullname // LoginDialog expects username
		};
	}

	return res;
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

export type { Login, Register };
