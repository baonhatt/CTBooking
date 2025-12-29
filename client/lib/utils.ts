import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function optimizeCloudinaryUrl(url: string, width?: number) {
  if (!url || !url.includes("cloudinary.com")) return url;

  // Split at /upload/
  const parts = url.split("/upload/");
  if (parts.length !== 2) return url;

  const transformations = ["f_auto", "q_auto"];
  if (width) {
    transformations.push(`w_${width}`);
  }

  const transformString = transformations.join(",");

  return `${parts[0]}/upload/${transformString}/${parts[1]}`;
}

export function optimizeCloudinaryVideoUrl(
  url: string,
  width?: number,
  quality: string = "auto",
) {
  if (!url || !url.includes("cloudinary.com")) return url;
  const parts = url.split("/upload/");
  if (parts.length !== 2) return url;
  // f_auto: auto format (usually webm/mp4), q_{quality}, vc_auto: video codec auto
  // br_3m: limit bitrate to 3mbps to avoid huge files
  const transformations = [
    "f_auto",
    `q_${quality}`,
    "vc_auto",
    "c_limit",
    "br_3m",
  ];
  if (width) transformations.push(`w_${width}`);

  return `${parts[0]}/upload/${transformations.join(",")}/${parts[1]}`;
}
