export const formatDateForDb = (date: Date | string | null) => {
  if (!date) return null;

  const dateObj = date instanceof Date ? date : new Date(date);
  // Store ISO 8601 format with timezone info
  // SQLite stores as TEXT, JS will parse correctly
  return dateObj.toISOString();
};

const vnTimeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
  weekday: 'short' // Added explicit weekday formatting
});

const weekdayMap: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6
};

export const getVnParts = (date: Date | string | null) => {
  if (!date) return null;
  const dateObj = date instanceof Date ? date : new Date(date);
  const parts = vnTimeFormatter.formatToParts(dateObj);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '';

  const year = parseInt(getPart('year'), 10);
  const month = parseInt(getPart('month'), 10);
  const day = parseInt(getPart('day'), 10);
  let hour = parseInt(getPart('hour'), 10);
  if (hour === 24) hour = 0;

  const weekdayStr = getPart('weekday');
  const dayOfWeek = weekdayMap[weekdayStr] ?? 0;

  return {
    year,
    month,
    day,
    hour,
    dayOfWeek,
    // Provide string formatted YYYY-MM-DD
    dateString: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  };
};

export const formatVnDate = (date: Date | string | null) => {
  const parts = getVnParts(date);
  return parts ? parts.dateString : null;
};
