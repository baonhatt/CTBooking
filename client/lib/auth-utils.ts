/**
 * Auto logout khi token hết hạn hoặc invalid
 * Gọi khi API trả về 401 Unauthorized
 */
export function handleAutoLogout() {
  if (typeof window === 'undefined') return;

  // Tránh vòng lặp redirect nếu đang ở trang login rồi
  if (window.location.pathname === '/login') return;

  // Xóa user token và profile
  localStorage.removeItem('userToken');
  localStorage.removeItem('userProfile');

  // Xóa staff token và clear staff store
  localStorage.removeItem('staffToken');
  localStorage.removeItem('staff-storage');

  // Dispatch event để UI cập nhật
  window.dispatchEvent(new Event('user-auth-changed'));

  // Redirect về trang login kèm thông báo
  window.location.href = '/login?reason=session_expired';
}
