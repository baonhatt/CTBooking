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
 * Parses a media URL for local development. If the URL is a Cloudinary link and we are on LOCAL,
 * it maps to a local path and triggers a background download if the file is missing.
 */
export function parseMediaUrl(url: string | null | undefined, c: Context): string {
  if (!url || typeof url !== 'string') return '';
  if (!isLocal(c.req.url)) return url;

  if (url.startsWith('/uploads/')) return url;

  // Cloudinary URL mapping
  if (url.includes('cloudinary.com')) {
    try {
      const parts = url.split('/upload/');
      if (parts.length < 2) return url;

      const rightPart = parts[1].split('?')[0].split('#')[0];
      let pathStr = rightPart;

      // Prefer extracting from version segment if present: .../v123/... => take everything after v123/
      const versionMatch = /v\d+\//.exec(rightPart);
      if (versionMatch && typeof versionMatch.index === 'number') {
        pathStr = rightPart.slice(versionMatch.index + versionMatch[0].length);
      } else {
        // Otherwise strip the first segment if it looks like transformations (contains comma)
        const segs = rightPart.split('/').filter(Boolean);
        if (segs.length > 1 && segs[0].includes(',')) {
          segs.shift();
        }
        pathStr = segs.join('/');
      }

      // Unified Logic: Just prepend /uploads/ to the pathStr (the Public ID + extension)
      // Standardize: ensure pathStr starts with 'ctbooking/'
      if (!pathStr.startsWith('ctbooking/')) {
        pathStr = `ctbooking/${pathStr}`;
      }

      const localPath = `/uploads/${pathStr}`;

      return localPath;
    } catch (e) {
      console.error('Error parsing Cloudinary URL:', e);
      return url;
    }
  }

  return url;
}

/**
 * Handles local file upload. Uses dynamic imports to avoid breaking Cloudflare Worker builds.
 */
export async function localUploader(base64: string, folder: string): Promise<{ url: string }> {
  // Dynamic imports for Node.js modules
  const fs = await import('node:fs');
  const path = await import('node:path');

  // Check support
  if (!fs.writeFileSync || fs.writeFileSync.toString().includes('not implemented')) {
    throw new Error(
      'Local uploads are not supported in this environment. Please run the server in a Node.js-compatible runtime.'
    );
  }

  // folder format: "ctbooking/movies" or "ctbooking"
  // Requirement: Follow the Cloudinary folder structure locally
  const cleanFolder = folder.startsWith('ctbooking') ? folder : `ctbooking/${folder}`;

  const matches = base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) throw new Error('Invalid base64 string');

  const type = matches[1];
  const buffer = Buffer.from(matches[2], 'base64');

  const targetDir = path.resolve(process.cwd(), 'uploads', cleanFolder);
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

  const ext = type.split('/')[1] || (type.startsWith('video/') ? 'mp4' : 'jpg');
  const filename = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
  const filePath = path.join(targetDir, filename);

  fs.writeFileSync(filePath, buffer);

  return { url: `/uploads/${cleanFolder}/${filename}` };
}

/**
 * Handles local file deletion.
 */
export async function localDeleter(url: string): Promise<void> {
  if (!url || typeof url !== 'string' || !url.startsWith('/uploads/')) return;

  try {
    const fs = await import('node:fs');
    const path = await import('node:path');

    if (!fs.unlinkSync || fs.unlinkSync.toString().includes('not implemented')) return;

    const relativePath = url.startsWith('/') ? url.slice(1) : url;
    const filePath = path.resolve(process.cwd(), relativePath);

    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        console.error('Failed to delete local file:', filePath, e);
      }
    }
  } catch (err) {
    // Ignore errors in deletion in restricted environments
  }
}
