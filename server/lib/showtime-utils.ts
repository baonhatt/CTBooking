const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function normalizeTime(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .slice(0, 5);
}

export function isValidTime(value: string | null | undefined): value is string {
  return TIME_RE.test(normalizeTime(value));
}

export function timeToMinutes(value: string): number {
  const [hours, minutes] = normalizeTime(value).split(':').map(Number);
  return hours * 60 + minutes;
}

export function addMinutesToTime(value: string, minutes: number): string | null {
  if (!isValidTime(value) || !Number.isFinite(minutes)) return null;
  const total = timeToMinutes(value) + Math.round(minutes);
  if (total < 0 || total >= 24 * 60) return null;
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}
