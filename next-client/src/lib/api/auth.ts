import { request } from '@/lib/api/http';

export async function loginApi(body: { email: string; password: string; turnstileToken?: string }) {
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
  turnstileToken?: string;
}) {
  return request<{ status: string; message: string; user: any }>('/api/register', {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

// Whether an email can still be registered (asked on the first step of the register form)
export async function checkEmailApi(email: string) {
  return request<{ status: string; available: boolean; message?: string }>('/api/check-email', {
    method: 'POST',
    body: JSON.stringify({ email })
  });
}

export async function forgetPassApi(body: { email: string; turnstileToken?: string }) {
  return request<{ status: string; message: string }>('/api/forget-password', {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

// Whether a reset link can still be used (asked when the reset page opens)
export async function checkResetTokenApi(token: string) {
  return request<{ status: string; valid: boolean; maskedEmail: string }>('/api/reset-password/check', {
    method: 'POST',
    body: JSON.stringify({ token })
  });
}

export async function resetPasswordApi(body: { token: string; newPassword: string }) {
  return request<{ status: string; message: string }>('/api/reset-password', {
    method: 'POST',
    body: JSON.stringify(body)
  });
}
