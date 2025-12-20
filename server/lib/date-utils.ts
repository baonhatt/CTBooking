export const formatDateForDb = (date: Date | string | null, RUNTIME_ENV?: string) => {
  if (!date) return null;
  
  const dateObj = date instanceof Date ? date : new Date(date);

  if(RUNTIME_ENV && RUNTIME_ENV === 'cloudflare-worker'){
    // SQLite D1 default timestamp format: YYYY-MM-DD HH:MM:SS
    // toISOString() returns YYYY-MM-DDTHH:mm:ss.sssZ, which is string-comparable > space-separated
    // But to be safe and match CURRENT_TIMESTAMP, let's use a custom format or just replace T and Z
    // Actually, SQLite's CURRENT_TIMESTAMP is UTC.
    // Example: 2024-12-20 10:00:00
    const iso = dateObj.toISOString();
    return iso.replace('T', ' ').replace('Z', '').split('.')[0];
  }

  return dateObj;
};
