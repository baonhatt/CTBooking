import { SERVER_BASE_URL } from "./http";

export interface UploadResult {
  url: string;
  public_id: string;
  bytes: number;
  duration?: number;
  format?: string;
  width?: number;
  height?: number;
}

export function uploadAdminVideo(
  file: File,
  folder?: string,
  onProgress?: (percent: number) => void
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
<<<<<<< HEAD
    const baseUrl = SERVER_BASE_URL || "";
=======
    const baseUrl = (import.meta as any).env?.VITE_SERVER_BASE_URL || '';
>>>>>>> nhat
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${baseUrl}/api/admin/uploads/video`);
    xhr.responseType = 'json';
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        const percent = Math.round((e.loaded / e.total) * 100);
        onProgress(percent);
      }
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.onload = () => {
      const status = xhr.status;
      const res = xhr.response;
      if (status >= 200 && status < 300) {
        resolve(res as UploadResult);
      } else {
        reject(new Error(res?.message || `Upload failed with status ${status}`));
      }
    };
    const form = new FormData();
    if (folder) form.append('folder', folder);
    form.append('file', file);
    xhr.send(form);
  });
}

export function uploadDirectToCloudinary(
  file: File,
  folderArg?: string,
  onProgress?: (percent: number) => void
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const env = (import.meta as any).env || {};
    const cloudName = env.VITE_CLOUDINARY_CLOUD_NAME || '';
    const presetVideo = env.VITE_CLOUDINARY_UPLOAD_PRESET_VIDEO || 'ctbooking_videos_unsigned';
    const presetImage = env.VITE_CLOUDINARY_UPLOAD_PRESET_IMAGE || 'ctbooking_images_unsigned';
    if (!cloudName) return reject(new Error('Thiếu VITE_CLOUDINARY_CLOUD_NAME'));
    const isVideo = /^video\//.test(file.type);
    const isImage = /^image\//.test(file.type);
    const uploadPreset = isVideo ? presetVideo : presetImage;
    const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/${isVideo ? 'video' : 'image'}/upload`;

    // Logic: If folderArg is provided, prepend "ctbooking/videos/" or similar if desired,
    // OR just use it as is if it's a full path.
    // The user wants 'videos/hero' etc.
    // Let's assume folderArg is just the subfolder name like "hero_section".
    // We construct the full path: "ctbooking/videos/<folderArg>" or "ctbooking/images/<folderArg>"
    let folder = isVideo ? 'ctbooking/videos' : 'ctbooking/images';
    if (folderArg) {
      // sanitize
      const safe = folderArg.replace(/[^a-zA-Z0-9._-]/g, '_');
      folder = `${folder}/${safe}`;
    }

    const resourceType = isVideo ? 'video' : 'image';
    const form = new FormData();
    form.append('file', file);
    form.append('folder', folder);
    form.append('use_filename', 'true');
    form.append('unique_filename', 'false');
    form.append('overwrite', 'true');

    const trySigned = async () => {
      try {
<<<<<<< HEAD
        const baseUrl = SERVER_BASE_URL || "";
=======
        const baseUrl = (import.meta as any).env?.VITE_SERVER_BASE_URL || '';
>>>>>>> nhat
        const resp = await fetch(`${baseUrl}/api/admin/cloudinary/sign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folder, resource_type: resourceType })
        });
        if (!resp.ok) return null;
        const data = await resp.json().catch(() => null);
        if (!data?.signature || !data?.timestamp || !data?.api_key) return null;
        return {
          signature: String(data.signature),
          timestamp: Number(data.timestamp),
          api_key: String(data.api_key)
        };
      } catch {
        return null;
      }
    };

    const xhr = new XMLHttpRequest();
    xhr.open('POST', endpoint);
    xhr.responseType = 'json';
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.onload = () => {
      const res = xhr.response;
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({
          public_id: res.public_id,
          url: res.secure_url || res.url,
          bytes: res.bytes || 0,
          duration: res.duration,
          format: res.format,
          width: res.width,
          height: res.height
        });
      } else {
        const msg = res?.error?.message || `Upload failed (${xhr.status})`;
        // If preset not found and we tried unsigned, advise to configure presets
        reject(new Error(msg));
      }
    };
    (async () => {
      // Prioritize unsigned preset if provided (for caching)
      if (uploadPreset) {
        form.append('upload_preset', uploadPreset);
      } else {
        const signed = await trySigned();
        if (signed) {
          // Signed upload: do NOT include upload_preset
          form.delete('upload_preset');
          form.append('api_key', signed.api_key);
          form.append('timestamp', String(signed.timestamp));
          form.append('signature', signed.signature);
        } else {
          // Neither signature nor preset available
          reject(new Error('Thiếu cấu hình upload: cần VITE_CLOUDINARY_UPLOAD_PRESET_* hoặc bật ký server'));
          return;
        }
      }
      xhr.send(form);
    })();
  });
}

export async function createSiteMediaApi(body: {
  section: 'hero_section' | 'technology_section1' | 'technology_section2';
  type: 'image' | 'video';
  title?: string;
  description?: string;
  public_id?: string;
  url: string;
  format?: string;
  width?: number;
  height?: number;
  duration?: number;
  display_order?: number;
  is_active?: boolean;
}) {
<<<<<<< HEAD
  const baseUrl = SERVER_BASE_URL || "";
=======
  const baseUrl = (import.meta as any).env?.VITE_SERVER_BASE_URL || '';
>>>>>>> nhat
  const res = await fetch(`${baseUrl}/api/admin/site-media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.message || `HTTP ${res.status}`);
  }
  return (await res.json()) as { item: any };
}

export async function updateSiteMediaApi(body: {
  id: number;
  section?: 'hero_section' | 'technology_section1' | 'technology_section2';
  type?: 'image' | 'video';
  title?: string;
  description?: string;
  public_id?: string;
  url?: string;
  format?: string;
  width?: number;
  height?: number;
  duration?: number;
  display_order?: number;
  is_active?: boolean;
}) {
<<<<<<< HEAD
  const baseUrl = SERVER_BASE_URL || "";
=======
  const baseUrl = (import.meta as any).env?.VITE_SERVER_BASE_URL || '';
>>>>>>> nhat
  const res = await fetch(`${baseUrl}/api/admin/site-media`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.message || `HTTP ${res.status}`);
  }
  return (await res.json()) as { item: any; success: boolean };
}

export async function getSiteMediaApi(options?: {
  section?: 'hero_section' | 'technology_section1' | 'technology_section2';
  type?: 'image' | 'video';
  active?: boolean;
  signal?: AbortSignal;
}) {
  const params = new URLSearchParams();
<<<<<<< HEAD
  if (options?.section) params.set("section", options.section);
  if (options?.type) params.set("type", options.type);
  if (typeof options?.active === "boolean")
    params.set("active", String(options.active));
  const baseUrl = SERVER_BASE_URL || "";
  const path = `${baseUrl}/api/site-media${params.toString() ? `?${params.toString()}` : ""}`;
=======
  if (options?.section) params.set('section', options.section);
  if (options?.type) params.set('type', options.type);
  if (typeof options?.active === 'boolean') params.set('active', String(options.active));
  const baseUrl = (import.meta as any).env?.VITE_SERVER_BASE_URL || '';
  const path = `${baseUrl}/api/site-media${params.toString() ? `?${params.toString()}` : ''}`;
>>>>>>> nhat
  const res = await fetch(path, { signal: options?.signal });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.message || `HTTP ${res.status}`);
  }
  return (await res.json()) as { items: any[] };
}

export async function deleteSiteMediaApi(id: number) {
<<<<<<< HEAD
  const baseUrl = SERVER_BASE_URL || "";
  const res = await fetch(`${baseUrl}/api/admin/site-media/${id}`, { method: "DELETE" });
=======
  const baseUrl = (import.meta as any).env?.VITE_SERVER_BASE_URL || '';
  const res = await fetch(`${baseUrl}/api/admin/site-media/${id}`, { method: 'DELETE' });
>>>>>>> nhat
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || `HTTP ${res.status}`);
  }
  return data as { ok: boolean; item?: any };
}
