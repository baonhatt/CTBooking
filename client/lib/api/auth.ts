import type { Login, Register } from '@shared/api';
import { request } from './http';

export async function loginApi(body: { email: string; password: string; turnstileToken?: string }) {
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

export async function verifyAdminLoginOtpApi(body: { otpChallenge: string; otp: string }) {
  const res = await request<any>('/api/admin/auth/verify-login-otp', {
    method: 'POST',
    body: JSON.stringify(body),
    credentials: 'include'
  });

  // Mapping staff -> user for frontend compatibility
  if (res.status === 'success' && res.staff && !res.user) {
    res.user = {
      ...res.staff,
      username: res.staff.fullname
    };
  }

  return res;
}


export async function forceChangePasswordApi(body: { newPassword: string }) {
  return request<{ status: string; message: string }>('/api/admin/auth/force-change-password', {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

export type { Login, Register };
