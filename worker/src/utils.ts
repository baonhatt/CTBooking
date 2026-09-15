import { Context } from 'hono';

export const RL_MAX = 100;
export const RL_WINDOW_MS = 60_000;
// export const attempts = new Map<string, number[]>(); // Removed in-memory map


export async function withCache(
  request: Request,
  env: any,
  ctx: any, // Thêm tham số ctx (đó chính là c.executionCtx)
  handler: () => Promise<Response>,
  ttl = 900
) {
  const cache = typeof caches !== 'undefined' ? (caches as any).default : null;

  if (!cache || request.method !== 'GET') {
    return await handler();
  }

  const cacheKey = new Request(request.url, request);
  let response = await cache.match(cacheKey);

  if (!response) {
    const originalResponse = await handler();

    if (originalResponse.status === 200) {
      response = new Response(originalResponse.body, originalResponse);
      response.headers.set('Cache-Control', `public, no-cache, s-maxage=${ttl}, must-revalidate`);

      // SỬ DỤNG Y: Ở ĐÂY:
      // Việc ghi vào cache sẽ không làm chậm request của khách
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
    } else {
      return originalResponse;
    }
  } else {
    response = new Response(response.body, response);
    response.headers.set('X-Cache', 'HIT');
  }

  return response;
}

export async function deleteCache(env: any, fullUrl: string) {
  const cache = typeof caches !== 'undefined' ? (caches as any).default : null;
  if (!cache || !fullUrl) return;
  try {
    // ✅ Xóa mọi URL variant (bỏ qua query param)
    await cache.delete(new Request(fullUrl), { ignoreSearch: true });
    console.log(`[deleteCache] Cleared: ${fullUrl} (ignoring query params)`);
  } catch (e) {
    // Fallback nếu ignoreSearch không hỗ trợ
    try {
      await cache.delete(fullUrl);
      console.log(`[deleteCache] Fallback deleted: ${fullUrl}`);
    } catch (e2) {
      console.error('Cache clean error:', e2);
    }
  }
}

export async function hmacHex(algo: 'SHA-256' | 'SHA-512', key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: algo }, false, [
    'sign'
  ]);
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message));
  const bytes = new Uint8Array(signature as ArrayBuffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function logSystemError(context: string, error: any, payload?: any) {
  const timestamp = new Date().toISOString();
  const errorMsg = error?.message || String(error);
  const stack = error?.stack || 'No stack trace';
  const safePayload = payload ? { ...payload } : 'No payload';

  // Mask sensitive fields
  if (typeof safePayload === 'object' && safePayload !== null) {
    if ('password' in safePayload) safePayload.password = '***';
    if ('token' in safePayload) safePayload.token = '***';
  }

  console.error(`[${timestamp}] [ERROR] [${context}]`);
  console.error(`Message: ${errorMsg}`);
  console.error(`Stack: ${stack}`);
  console.error(`Payload:`, JSON.stringify(safePayload, null, 2));
}

// sendMail was moved to server/routes/mail-service.ts

export function formatCurrencyVi(amount: number): string {
  return `${Number(amount || 0).toLocaleString('vi-VN')}đ`;
}

export {
  getBookingEmailTemplate,
  getWelcomeEmailTemplate,
  getResetPasswordEmailTemplate
} from '../../server/lib/email-templates';

export async function sha1Hex(input: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-1', enc.encode(input));
  const bytes = new Uint8Array(buf as ArrayBuffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hasCloudinary(env: any) {
  const cloudName = String(env.CLOUDINARY_CLOUD_NAME || '');
  const apiKey = String(env.CLOUDINARY_API_KEY || '');
  const apiSecret = String(env.CLOUDINARY_API_SECRET || '');
  return Boolean(cloudName && apiKey && apiSecret);
}

export async function cloudinarySignedParams(env: any, params: Record<string, string | number>) {
  const apiKey = String(env.CLOUDINARY_API_KEY || '');
  const apiSecret = String(env.CLOUDINARY_API_SECRET || '');
  const keys = Object.keys(params).sort();
  const toSign = keys.map((k) => `${k}=${params[k]}`).join('&') + apiSecret;
  const signature = await sha1Hex(toSign);
  return { signature, api_key: apiKey };
}

export function optimizeCloudinaryUrl(url: string, width?: number) {
  if (!url || typeof url !== 'string' || !url.includes('cloudinary.com')) return url;
  const parts = url.split('/upload/');
  if (parts.length !== 2) return url;
  const transformations = ['f_auto', 'q_auto'];
  if (width) transformations.push(`w_${width}`);
  const transformString = transformations.join(',');
  return `${parts[0]}/upload/${transformString}/${parts[1]}`;
}

export function getPublicIdFromUrl(url: string) {
  if (!url || typeof url !== 'string' || !url.includes('cloudinary.com')) return null;
  try {
    const parts = url.split('/upload/');
    if (parts.length < 2) return null;
    const rightPart = parts[1];
    // Remove version (v1234567890/) if present
    const versionRegex = /^v\d+\//;
    let path = rightPart.replace(versionRegex, '');
    // Remove extension
    const lastDotIndex = path.lastIndexOf('.');
    if (lastDotIndex !== -1) {
      path = path.substring(0, lastDotIndex);
    }
    return path;
  } catch (e) {
    return null;
  }
}

export function optimizeCloudinaryVideoUrl(url: string, width?: number, quality: string = 'auto') {
  if (!url || typeof url !== 'string' || !url.includes('cloudinary.com')) return url;
  const parts = url.split('/upload/');
  if (parts.length !== 2) return url;
  const transformations = ['f_auto', `q_${quality}`, 'vc_auto', 'c_limit', 'br_3m'];
  if (width) transformations.push(`w_${width}`);
  return `${parts[0]}/upload/${transformations.join(',')}/${parts[1]}`;
}

export async function uploadCloudinaryImageDataURI(env: any, dataUri: string, folder: string) {
  const cloudName = String(env.CLOUDINARY_CLOUD_NAME || '');
  const timestamp = Math.floor(Date.now() / 1000);
  const params = {
    timestamp,
    folder,
    use_filename: 'true',
    unique_filename: 'false',
    overwrite: 'true',
    transformation: 'q_auto,f_webp,w_1280,c_limit'
  };
  const signed = await cloudinarySignedParams(env, params);
  const form = new FormData();
  form.append('file', dataUri);
  form.append('folder', folder);
  form.append('use_filename', 'true');
  form.append('unique_filename', 'false');
  form.append('overwrite', 'true');
  form.append('timestamp', String(timestamp));
  form.append('api_key', signed.api_key);
  form.append('signature', signed.signature);
  form.append('transformation', 'q_auto,f_webp,w_1280,c_limit');
  const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
  const res = await fetch(endpoint, { method: 'POST', body: form });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(String(json?.error?.message || `Cloudinary ${res.status}`));
  return {
    url: String(json.secure_url || json.url || ''),
    height: Number(json.height || 0)
  };
}

export async function deleteCloudinaryImage(env: any, publicId: string, type: 'image' | 'video' = 'image') {
  const cloudName = String(env.CLOUDINARY_CLOUD_NAME || '');
  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = {
    public_id: publicId,
    timestamp
  };
  const signed = await cloudinarySignedParams(env, paramsToSign);

  const form = new FormData();
  form.append('public_id', publicId);
  form.append('timestamp', String(timestamp));
  form.append('api_key', signed.api_key);
  form.append('signature', signed.signature);

  const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/${type}/destroy`;
  const res = await fetch(endpoint, { method: 'POST', body: form });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) console.error('Cloudinary delete error:', json);
  return json;
}

export { isLocal, parseMediaUrl, localUploader, localDeleter } from '../../server/lib/media-utils';

export async function pingIndexNow(env: any, urls: string[]): Promise<void> {
  const key = String(env.INDEXNOW_KEY || '');
  const baseHost = String(env.VITE_CLIENT_BASE_URL || 'https://cinesphere.com.vn').replace(/\/$/, '');
  if (!key || !urls.length) return;
  try {
    const hostname = new URL(baseHost).hostname;
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: hostname,
        key,
        keyLocation: `${baseHost}/${key}.txt`,
        urlList: urls
      })
    });
    console.log(`[IndexNow] ping ${urls.join(', ')} → ${res.status}`);
  } catch (e) {
    console.error('[IndexNow] ping failed:', e);
  }
}

export async function generateSessionToken(): Promise<string> {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

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

export function calculateSessionExpiry(days: number = 30): string {
  const now = new Date();
  now.setDate(now.getDate() + days);
  return formatDateForDb(now);
}

export function calculateSessionExpiryFromNow(hours: number = 24): string {
  const now = new Date();
  now.setHours(now.getHours() + hours);
  return formatDateForDb(now);
}
