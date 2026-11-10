// Shared display formats for the admin screens, so every list, form and detail view shows dates, money and
// status in the same way. All times are shown in Vietnam time (Asia/Ho_Chi_Minh).

const VN_TIME_ZONE = 'Asia/Ho_Chi_Minh';

// Shown when a value is empty or not a valid date/number
export const EMPTY_VALUE = '-';

function to_valid_date(value?: string | Date | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// 10/11/2026 14:05
export function formatVnDateTime(value?: string | Date | null): string {
  const date = to_valid_date(value);
  if (!date) return EMPTY_VALUE;
  // The vi-VN formatter puts the time first, so the parts are put together here: date, then time
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: VN_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value || '';
  const hour = part('hour') === '24' ? '00' : part('hour');
  return `${part('day')}/${part('month')}/${part('year')} ${hour}:${part('minute')}`;
}

// 10/11/2026
export function formatVnDate(value?: string | Date | null): string {
  const date = to_valid_date(value);
  if (!date) return EMPTY_VALUE;
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: VN_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
}

// 1.250.000 đ
export function formatVnd(value?: number | string | null): string {
  if (value === null || value === undefined || value === '') return EMPTY_VALUE;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return EMPTY_VALUE;
  return `${amount.toLocaleString('vi-VN')} đ`;
}

// One wording for the active flag of every record (movies, packages, vouchers, branches, staff ...)
export function activeStatusLabel(isActive: boolean | null | undefined): string {
  return isActive === false ? 'Ngừng hoạt động' : 'Hoạt động';
}

// Raw payment method codes from the database, as a label
export function paymentMethodLabel(method?: string | null): string {
  const labels: Record<string, string> = { cash: 'Tiền mặt', vietqr: 'VietQR' };
  if (!method) return EMPTY_VALUE;
  return labels[method.toLowerCase()] || method;
}
