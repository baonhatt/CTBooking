'use client';
import { forgetPassApi, loginApi, registerApi, resetPasswordApi, logoutApi } from '@/lib/api';

export function useAuth() {
  async function login(email: string, password: string, turnstileToken?: string) {
    return loginApi({ email, password, turnstileToken });
  }

  async function logout() {
    return logoutApi();
  }

  async function register(
    email: string,
    password: string,
    name?: string,
    turnstileToken?: string,
    options?: { gender?: string; dob?: string; phone?: string }
  ) {
    return registerApi({ email, password, name, turnstileToken, ...(options || {}) });
  }

  async function forgetPass(email: string, turnstileToken?: string) {
    return forgetPassApi({ email, turnstileToken });
  }

  async function resetPass(token: string, newPassword: string) {
    return resetPasswordApi({ token, newPassword });
  }

  return { login, logout, register, forgetPass, resetPass };
}
