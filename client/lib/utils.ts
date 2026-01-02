import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Helper to ensure valid quality values
function getAutoQuality(q: string) {
  if (q && q.startsWith("auto")) return q;
  return "auto:eco";
}

export function optimizeCloudinaryUrl(url: string, width?: number, quality: string = "auto:eco") {
  if (!url || !url.includes("cloudinary.com")) return url;

  const parts = url.split("/upload/");
  if (parts.length !== 2) return url;

  const pathSegments = parts[1].split("/");
  const versionIndex = pathSegments.findIndex(seg => seg.match(/^v\d+$/));
  
  const cleanPath = versionIndex !== -1 
    ? pathSegments.slice(versionIndex).join("/")
    : pathSegments.length > 1 && pathSegments[0].includes(",") 
      ? pathSegments.slice(1).join("/")
      : parts[1];

  const transformations = [
    "f_auto", 
    `q_${getAutoQuality(quality)}`, 
    "c_limit",
  ];
  
  if (width) {
    transformations.push(`w_${width}`);
  }

  return `${parts[0]}/upload/${transformations.join(",")}/${cleanPath}`;
}

export function generateCloudinarySrcSet(url: string, sizes: number[] = [400, 800, 1200, 1600]) {
  if (!url || !url.includes("cloudinary.com")) return undefined;
  
  return sizes
    .map(size => `${optimizeCloudinaryUrl(url, size)} ${size}w`)
    .join(", ");
}

export function optimizeCloudinaryVideoUrl(
  url: string,
  width?: number,
  quality: string = "auto:eco",
) {
  if (!url || !url.includes("cloudinary.com")) return url;
  const parts = url.split("/upload/");
  if (parts.length !== 2) return url;

  const pathSegments = parts[1].split("/");
  const versionIndex = pathSegments.findIndex(seg => seg.match(/^v\d+$/));
  const cleanPath = versionIndex !== -1 
    ? pathSegments.slice(versionIndex).join("/")
    : pathSegments.length > 1 && pathSegments[0].includes(",") 
      ? pathSegments.slice(1).join("/")
      : parts[1];

  const transformations = [
    "f_auto",
    `q_${getAutoQuality(quality)}`,
    "c_limit",
    "br_2m",
  ];
  if (width) transformations.push(`w_${width}`);

  return `${parts[0]}/upload/${transformations.join(",")}/${cleanPath}`;
}

export function getCloudinaryThumbnail(url: string, width?: number, quality: string = "auto:eco") {
  if (!url || !url.includes("cloudinary.com")) return url;
  
  const transformations = ["f_auto", `q_${getAutoQuality(quality)}`, "so_2"];
  if (width) transformations.push(`w_${width}`, "c_limit");
  
  // Replace existing transformations or inject new ones
  // Video thumbnail URLs might look like .../video/upload/v123...
  return url
    .replace(/\.(mp4|webm|mov|ogg)$/i, ".jpg")
    .replace(/\/upload\/([^\/]+\/)?/, `/upload/${transformations.join(",")}/`);
}

