/** Browser storage keys that belong to a signed-in staff session or hold per-person screen settings. */
const SESSION_STORAGE_KEYS = [
  'userToken',
  'userProfile',
  'staffToken',
  'staff-storage',
  // Keys from the old admin login. Some pages still clear them, so clear them here too.
  'adminToken',
  'adminEmail',
  // Saved screen filters belong to the person who set them, not to the next person using this browser
  'admin_transactions_filters',
  'dashboard_selected_branch_id',
  'dashboard_selected_year'
];

/** Removes the staff session and the per-person screen settings from this browser. */
export function clearSessionStorage() {
  if (typeof window === 'undefined') return;
  for (const storageKey of SESSION_STORAGE_KEYS) {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Storage can be blocked (private window); nothing more to do
    }
  }

  // Every saved admin list filter (admin_movies_filters, admin_vouchers_filters, ...) belongs to the person who set it
  try {
    for (let index = localStorage.length - 1; index >= 0; index--) {
      const storageKey = localStorage.key(index);
      if (storageKey && /^admin_.+_filters$/.test(storageKey)) localStorage.removeItem(storageKey);
    }
  } catch {
    // Storage can be blocked; nothing more to do
  }
}

/**
 * Auto logout khi token hết hạn hoặc invalid
 * Gọi khi API trả về 401 Unauthorized
 */
export function handleAutoLogout() {
  if (typeof window === 'undefined') return;

  // Tránh vòng lặp redirect nếu đang ở trang login rồi
  if (window.location.pathname === '/login') return;

  clearSessionStorage();

  // Dispatch event để UI cập nhật
  window.dispatchEvent(new Event('user-auth-changed'));

  // Redirect về trang login kèm thông báo
  window.location.href = '/login?reason=session_expired';
}

/**
 * Signs the staff member out for real: tells the server to revoke the token, clears this browser,
 * and returns to the login screen. Used by every "Đăng xuất" button.
 * A network failure does not stop the local sign-out.
 */
export async function performLogout() {
  if (typeof window === 'undefined') return;

  try {
    // Imported here because http.ts imports this file (a static import would be circular)
    const { request } = await import('@/lib/api/http');
    await request('/api/admin/auth/logout', { method: 'POST' });
  } catch {
    // Offline, or the token had already expired: the browser is cleared below either way
  }

  clearSessionStorage();
  window.dispatchEvent(new Event('user-auth-changed'));
  window.location.href = '/login';
}
