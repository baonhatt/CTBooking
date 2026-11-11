import { formatDateTimeVN } from '@/lib/utils';

// Small formatters shared by the account page and its ticket-detail dialog

// A JSON text from the server turned into data; a broken text gives an empty list
export function parseData(data: any) {
  try {
    return typeof data === 'string' ? JSON.parse(data) : data;
  } catch {
    return [];
  }
}

export function formatDateTime(dateStr: any) {
  if (!dateStr) return '--';
  return formatDateTimeVN(dateStr);
}

// The booking code of an order, whichever field the server filled
export function getBookingCode(tx: any | null) {
  return tx?.booking_code || tx?.bookingCode || tx?.code || tx?.bookingCodeEmail || '--';
}

export function formatMoney(value: number | string | undefined) {
  const num = Number(value || 0);
  return num.toLocaleString('vi-VN');
}
