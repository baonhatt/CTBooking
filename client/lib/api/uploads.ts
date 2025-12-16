export interface UploadResult {
  url: string;
  public_id: string;
  bytes: number;
  duration?: number;
  format?: string;
  width?: number;
  height?: number;
}

export function uploadAdminVideo(file: File, onProgress?: (percent: number) => void): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/uploads/video");
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        const percent = Math.round((e.loaded / e.total) * 100);
        onProgress(percent);
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
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
    form.append("file", file);
    xhr.send(form);
  });
}

export function uploadDirectToCloudinary(file: File, onProgress?: (percent: number) => void): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const env = (import.meta as any).env || {};
    const cloudName = env.VITE_CLOUDINARY_CLOUD_NAME || "";
    const presetVideo = env.VITE_CLOUDINARY_UPLOAD_PRESET_VIDEO || "";
    const presetImage = env.VITE_CLOUDINARY_UPLOAD_PRESET_IMAGE || "";
    if (!cloudName) return reject(new Error("Thiếu VITE_CLOUDINARY_CLOUD_NAME"));
    const isVideo = /^video\//.test(file.type);
    const isImage = /^image\//.test(file.type);
    const uploadPreset = isVideo ? presetVideo : presetImage;
    const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/${isVideo ? "video" : "image"}/upload`;
    const folder = isVideo ? "ctbooking/videos" : "ctbooking/images";
    const resourceType = isVideo ? "video" : "image";
    const form = new FormData();
    form.append("file", file);
    form.append("folder", folder);
    form.append("use_filename", "true");
    form.append("unique_filename", "false");
    form.append("overwrite", "true");

    const trySigned = async () => {
      try {
        const resp = await fetch("/api/admin/cloudinary/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folder, resource_type: resourceType }),
        });
        if (!resp.ok) return null;
        const data = await resp.json().catch(() => null);
        if (!data?.signature || !data?.timestamp || !data?.api_key) return null;
        return { signature: String(data.signature), timestamp: Number(data.timestamp), api_key: String(data.api_key) };
      } catch {
        return null;
      }
    };

    const xhr = new XMLHttpRequest();
    xhr.open("POST", endpoint);
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
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
          height: res.height,
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
        // Signed upload: do NOT include upload_preset
        form.delete("upload_preset");
        form.append("api_key", signed.api_key);
        form.append("timestamp", String(signed.timestamp));
        form.append("signature", signed.signature);
      } else if (uploadPreset) {
        // Fallback unsigned upload when no signature available
        form.append("upload_preset", uploadPreset);
      } else {
        // Neither signature nor preset available
        reject(new Error("Thiếu cấu hình upload: cần VITE_CLOUDINARY_UPLOAD_PRESET_* hoặc bật ký server"));
        return;
      }
      xhr.send(form);
    })();
  });
}

export async function createSiteMediaApi(body: {
  section: "hero_section" | "technology_section1" | "technology_section2";
  type: "image" | "video";
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
  const res = await fetch("/api/admin/site-media", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.message || `HTTP ${res.status}`);
  }
  return (await res.json()) as { item: any };
}

export async function getSiteMediaApi(options?: {
  section?: "hero_section" | "technology_section1" | "technology_section2";
  type?: "image" | "video";
  active?: boolean;
  signal?: AbortSignal;
}) {
  const params = new URLSearchParams();
  if (options?.section) params.set("section", options.section);
  if (options?.type) params.set("type", options.type);
  if (typeof options?.active === "boolean") params.set("active", String(options.active));
  const path = `/api/site-media${params.toString() ? `?${params.toString()}` : ""}`;
  const res = await fetch(path, { signal: options?.signal });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.message || `HTTP ${res.status}`);
  }
  return (await res.json()) as { items: any[] };
}
