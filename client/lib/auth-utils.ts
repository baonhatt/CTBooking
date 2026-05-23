/**
 * Auto logout khi token hết hạn hoặc invalid
 * Gọi khi API trả về 401 Unauthorized
 */
export function handleAutoLogout() {
  if (typeof window === 'undefined') return;

  // Xóa token và profile
  localStorage.removeItem('userToken');
  localStorage.removeItem('userProfile');
  localStorage.removeItem('adminToken');
  localStorage.removeItem('adminEmail');
  localStorage.removeItem('adminProfile');

  // Dispatch event để UI cập nhật
  window.dispatchEvent(new Event('user-auth-changed'));
  window.dispatchEvent(new Event('admin-auth-changed'));

  // Redirect về trang home
  window.location.href = '/';
}
