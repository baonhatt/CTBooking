/**
 * A film length for people. Whole minutes read "120 phút"; a fraction of a minute is turned into seconds, so
 * 5.34 reads "5 phút 20 giây" (not "5.34 phút", which nobody says aloud). Empty text when there is no length.
 */
export function formatDurationMinutes(minutes: number | string | null | undefined): string {
  const value = Number(minutes);
  if (!Number.isFinite(value) || value <= 0) return '';

  const totalSeconds = Math.round(value * 60);
  const wholeMinutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (seconds === 0) return `${wholeMinutes} phút`;
  if (wholeMinutes === 0) return `${seconds} giây`;
  return `${wholeMinutes} phút ${seconds} giây`;
}
