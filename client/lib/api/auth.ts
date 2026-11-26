import type { Login, Register } from '@shared/api';
import { buildUrl, request } from './http';

/**
 * Asks the API whether this browser still has a valid staff session (the HttpOnly staff_session cookie).
 * 'invalid': the server refused it (401/403), so the person must sign in again.
 * 'unknown': no answer (offline, server error); the screens stay and the next request decides.
 * Uses fetch directly, not request(), so a refusal here does not trigger the auto sign-out redirect.
 */
export async function checkStaffSessionApi(): Promise<'valid' | 'invalid' | 'unknown'> {
  try {
    const res = await fetch(buildUrl('/api/admin/auth/me'), { credentials: 'include' });
    if (res.status === 401 || res.status === 403) return 'invalid';
    return res.ok ? 'valid' : 'unknown';
  } catch {
    return 'unknown';
  }
}

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
