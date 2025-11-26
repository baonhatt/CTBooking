import { loginApi, registerApi } from "@/lib/api";

export function useAuth() {
  async function login(email: string, password: string) {
    return loginApi({ email, password });
  }

  async function register(email: string, password: string) {
    return registerApi({ email, password });
  }

  return { login, register };
}
