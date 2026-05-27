/**
 * Auto logout khi token hết hạn hoặc invalid
 * Gọi khi API trả về 401 Unauthorized
 */
export function handleAutoLogout() {
        if (typeof window === 'undefined') return;

        // Xóa user token và profile
        localStorage.removeItem('userToken');
        localStorage.removeItem('userProfile');

        // Xóa staff token và clear staff store
        localStorage.removeItem('staffToken');

        // Dispatch event để UI cập nhật
        window.dispatchEvent(new Event('user-auth-changed'));

        // Redirect về trang home
        window.location.href = '/';
}
