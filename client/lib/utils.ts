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
