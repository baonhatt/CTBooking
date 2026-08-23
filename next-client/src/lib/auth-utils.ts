'use client';
import { deleteCookie } from '@/lib/cookies';

/**
 * Auto logout khi token hết hạn hoặc invalid
 * Gọi khi API trả về 401 Unauthorized
 */
export function handleAutoLogout() {
  if (typeof window === 'undefined') return;

  // Xóa token và profile
  localStorage.removeItem('userToken');
  localStorage.removeItem('userProfile');
  deleteCookie('userToken');
  deleteCookie('userProfile');

  // Dispatch event để UI cập nhật
  window.dispatchEvent(new Event('user-auth-changed'));

  // Redirect về trang home
  window.location.href = '/';
}
