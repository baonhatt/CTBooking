function getCookieBaseOptions() {
  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
  return `path=/; samesite=lax${isHttps ? '; secure' : ''}`;
}

export function setCookie(name: string, value: string, maxAgeSeconds?: number) {
  if (typeof document === 'undefined') return;
  const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`, getCookieBaseOptions()];
  if (typeof maxAgeSeconds === 'number') parts.push(`max-age=${Math.max(0, Math.floor(maxAgeSeconds))}`);
  document.cookie = parts.join('; ');
}

export function getCookie(name: string) {
  if (typeof document === 'undefined') return null;
  const prefix = `${encodeURIComponent(name)}=`;
  const match = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : null;
}

export function deleteCookie(name: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${encodeURIComponent(name)}=; path=/; max-age=0; samesite=lax`;
}
