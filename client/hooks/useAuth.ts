import {
  forgetPassApi,
  loginApi,
  registerApi,
  resetPasswordApi,
} from "@/lib/api";

export function useAuth() {
  async function login(email: string, password: string) {
    return loginApi({ email, password });
  }

  async function register(email: string, password: string, name?: string) {
    return registerApi({ email, password });
  }

  async function forgetPass(email: string) {
    return forgetPassApi({ email });
  }

  async function resetPass(token: string, newPassword: string) {
    return resetPasswordApi({ token, newPassword });
  }

  return { login, register, forgetPass, resetPass };
}
