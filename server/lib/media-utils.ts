import { Context } from 'hono';

/**
 * Detects if the current request is coming from a local environment.
 */
export function isLocal(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname === 'localhost' || u.hostname === '127.0.0.1';
  } catch {
    return url.includes('localhost') || url.includes('127.0.0.1');
  }
}

/**
 * Returns the media URL directly (preserves Cloudinary CDN URLs in all environments).
 */
export function parseMediaUrl(url: string | null | undefined, _c?: Context): string {
  if (!url || typeof url !== 'string') return '';
  return url;
}

/**
 * Legacy local uploader stub (all uploads now route to Cloudinary).
 */
export async function localUploader(base64: string, _folder: string): Promise<{ url: string }> {
  return { url: base64 };
}

/**
 * Legacy local deleter stub (no-op).
 */
export async function localDeleter(_url: string): Promise<void> {
  // No-op for local deleter
}
