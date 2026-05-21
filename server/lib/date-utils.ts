export const formatDateForDb = (date: Date | string | null) => {
        if (!date) return null;

        const dateObj = date instanceof Date ? date : new Date(date);
        const iso = dateObj.toISOString();

        // Tất cả logic đã chuyển sang Cloudflare Worker + D1 (SQLite)
        // D1 yêu cầu timestamp được insert dưới dạng chuỗi
        // SQLite chuẩn format: YYYY-MM-DD HH:MM:SS (không có milliseconds)
        // Khớp với CURRENT_TIMESTAMP mặc định của SQLite
        return iso.replace('T', ' ').replace('Z', '').split('.')[0];
};
