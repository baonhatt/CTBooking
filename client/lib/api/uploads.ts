import { SERVER_BASE_URL, request } from './http';

export interface UploadResult {
  url: string;
  public_id: string;
  bytes: number;
  duration?: number;
  format?: string;
  width?: number;
  height?: number;
}

export function uploadAdminImage(
  file: File,
  folder?: string,
  onProgress?: (percent: number) => void
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const baseUrl = SERVER_BASE_URL || '';
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${baseUrl}/api/admin/uploads/image`);
    const staffToken = typeof window !== 'undefined' ? localStorage.getItem('staffToken') : null;
    if (staffToken) xhr.setRequestHeader('Authorization', `Bearer ${staffToken}`);
    xhr.withCredentials = true;
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

export function uploadAdminVideo(
  file: File,
  folder?: string,
  onProgress?: (percent: number) => void
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const baseUrl = SERVER_BASE_URL || '';
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${baseUrl}/api/admin/uploads/video`);
    const staffToken = typeof window !== 'undefined' ? localStorage.getItem('staffToken') : null;
    if (staffToken) xhr.setRequestHeader('Authorization', `Bearer ${staffToken}`);
    xhr.withCredentials = true;
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
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '';
    const presetVideo = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET_VIDEO || 'ctbooking_videos_unsigned';
    const presetImage = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET_IMAGE || 'ctbooking_images_unsigned';
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

    const trySigned = async () => {
      try {
        const data = await request<any>('/api/admin/cloudinary/sign', {
          method: 'POST',
          body: JSON.stringify({ folder, resource_type: resourceType })
        });
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
      const signed = await trySigned();
      if (signed) {
        // Signed upload: append required payload
        form.append('api_key', signed.api_key);
        form.append('timestamp', String(signed.timestamp));
        form.append('signature', signed.signature);
        form.append('use_filename', 'true');
        form.append('unique_filename', 'false');
        form.append('overwrite', 'true');
        form.append('allowed_formats', isVideo ? 'mp4,webm,mov' : 'jpg,jpeg,png,webp,gif');
      } else {
        reject(new Error('Lỗi ký gửi signature từ Server, không thể upload file ảnh.'));
        return;
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
  return request<{ item: any }>('/api/admin/site-media', {
    method: 'POST',
    body: JSON.stringify(body)
  });
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
  return request<{ item: any; success: boolean }>('/api/admin/site-media', {
    method: 'PUT',
    body: JSON.stringify(body)
  });
}

export async function getSiteMediaApi(options?: {
  section?: 'hero_section' | 'technology_section1' | 'technology_section2';
  type?: 'image' | 'video';
  active?: boolean;
  signal?: AbortSignal;
}) {
  const params = new URLSearchParams();
  if (options?.section) params.set('section', options.section);
  if (options?.type) params.set('type', options.type);
  if (typeof options?.active === 'boolean') params.set('active', String(options.active));
  const path = `/api/admin/site-media${params.toString() ? `?${params.toString()}` : ''}`;
  return request<{ items: any[] }>(path, { signal: options?.signal });
}

export async function deleteSiteMediaApi(id: number) {
  return request<{ ok: boolean; item?: any }>(`/api/admin/site-media/${id}`, { method: 'DELETE' });
}
