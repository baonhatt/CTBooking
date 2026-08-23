import { forgetPassApi, loginApi, registerApi, resetPasswordApi, logoutApi } from '@/lib/api';

export function useAuth() {
        async function login(email: string, password: string) {
                return loginApi({ email, password });
        }

<<<<<<< HEAD
        async function logout() {
                return logoutApi();
        }
=======
  async function logout() {
    return logoutApi();
  }

  async function register(
    email: string,
    password: string,
    name?: string,
    options?: { gender?: string; dob?: string; phone?: string }
  ) {
    return registerApi({ email, password, name, ...(options || {}) });
  }
>>>>>>> preview

        async function register(
                email: string,
                password: string,
                name?: string,
                options?: { gender?: string; dob?: string; phone?: string }
        ) {
                return registerApi({ email, password, name, ...(options || {}) });
        }

        async function forgetPass(email: string) {
                return forgetPassApi({ email });
        }

<<<<<<< HEAD
        async function resetPass(token: string, newPassword: string) {
                return resetPasswordApi({ token, newPassword });
        }

        return { login, logout, register, forgetPass, resetPass };
=======
  return { login, logout, register, forgetPass, resetPass };
>>>>>>> preview
}
