export const formatDateForDb = (date: Date | string | null) => {
  if (!date) return null;

  const dateObj = date instanceof Date ? date : new Date(date);

  // Tất cả logic đã chuyển sang Cloudflare Worker + D1 (SQLite)
  // D1 yêu cầu timestamp được insert dưới dạng chuỗi
  return dateObj.toISOString();
};
