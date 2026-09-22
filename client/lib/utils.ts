import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatToVNDatetimeLocal(dateStr?: string | Date | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  
  const parts = formatter.formatToParts(d);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';
  
  const hour = getPart('hour') === '24' ? '00' : getPart('hour');
  return `${getPart('year')}-${getPart('month')}-${getPart('day')}T${hour}:${getPart('minute')}`;
}

export function vnDatetimeLocalToUTC(localStr: string): string | null {
  if (!localStr) return null;
  try {
    const timeStr = localStr.length === 16 ? `${localStr}:00` : localStr;
    const d = new Date(`${timeStr}+07:00`);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}

export function formatDateTimeVN(dateString?: string | Date | null): string {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatDateVN(dateString?: string | Date | null): string {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '';
  const formatter = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  });
  const parts = formatter.formatToParts(d);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';
  return `${getPart('day')} Tháng ${getPart('month')}, ${getPart('year')}`;
}

export function getVNYear(dateString?: string | Date | null): number {
  if (!dateString) return new Date().getFullYear();
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return new Date().getFullYear();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric'
  });
  return Number(formatter.format(d));
}

export const getTodayStartIso = () => {
  const d = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
  });
  const parts = formatter.formatToParts(d);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';
  const dateStr = `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
  return new Date(`${dateStr}T00:00:00+07:00`).toISOString();
};

export const getTodayEndIso = () => {
  const d = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
  });
  const parts = formatter.formatToParts(d);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';
  const dateStr = `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
  return new Date(`${dateStr}T23:59:59+07:00`).toISOString();
};

// Helper to ensure valid quality values
function getAutoQuality(q: string) {
  if (q && q.startsWith('auto')) return q;
  return 'auto:best';
}

export function optimizeCloudinaryUrl(
  url: string,
  width?: number,
  quality: string = 'auto:best',
  cacheMaxAge?: number // in seconds, default: 86400 (1 day)
) {
  if (!url || !url.includes('cloudinary.com')) return url;

  // Convert .heic or .heif to .jpg so all web browsers can display it
  const formattedUrl = url.replace(/\.(heic|heif)$/i, '.jpg');

  const parts = formattedUrl.split('/upload/');
  if (parts.length !== 2) return formattedUrl;

  const pathSegments = parts[1].split('/');
  const versionIndex = pathSegments.findIndex((seg) => seg.match(/^v\d+$/));

  const cleanPath =
    versionIndex !== -1
      ? pathSegments.slice(versionIndex).join('/')
      : pathSegments.length > 1 && pathSegments[0].includes(',')
        ? pathSegments.slice(1).join('/')
        : parts[1];

  const transformations = ['f_auto', `q_${getAutoQuality(quality)}`, 'dpr_auto', 'c_limit'];

  if (width) {
    transformations.push(`w_${width}`);
  }

  return `${parts[0]}/upload/${transformations.join(',')}/${cleanPath}`;
}

export function generateCloudinarySrcSet(url: string, sizes: number[] = [400, 800, 1200, 1600]) {
  if (!url || !url.includes('cloudinary.com')) return undefined;

  return sizes.map((size) => `${optimizeCloudinaryUrl(url, size)} ${size}w`).join(', ');
}

export function optimizeCloudinaryVideoUrl(
  url: string,
  width?: number,
  quality: string = 'auto:eco',
  cacheMaxAge?: number // in seconds, default: 5184000 (60 days)
) {
  if (!url || !url.includes('cloudinary.com')) return url;
  const parts = url.split('/upload/');
  if (parts.length !== 2) return url;

  const pathSegments = parts[1].split('/');
  const versionIndex = pathSegments.findIndex((seg) => seg.match(/^v\d+$/));
  const cleanPath =
    versionIndex !== -1
      ? pathSegments.slice(versionIndex).join('/')
      : pathSegments.length > 1 && pathSegments[0].includes(',')
        ? pathSegments.slice(1).join('/')
        : parts[1];

  const transformations = ['f_auto', `q_${getAutoQuality(quality)}`, 'c_limit', 'br_2m'];
  if (width) transformations.push(`w_${width}`);

  return `${parts[0]}/upload/${transformations.join(',')}/${cleanPath}`;
}

export function getCloudinaryThumbnail(
  url: string,
  width?: number,
  quality: string = 'auto:eco',
  cacheMaxAge?: number // in seconds, default: 86400 (1 day)
) {
  if (!url || !url.includes('cloudinary.com')) return url;

  const transformations = ['f_auto', `q_${getAutoQuality(quality)}`, 'so_2'];
  if (width) transformations.push(`w_${width}`, 'c_limit');

  // Replace existing transformations or inject new ones
  // Video thumbnail URLs might look like .../video/upload/v123...
  return url
    .replace(/\.(mp4|webm|mov|ogg)$/i, '.jpg')
    .replace(/\/upload\/([^\/]+\/)?/, `/upload/${transformations.join(',')}/`);
}
