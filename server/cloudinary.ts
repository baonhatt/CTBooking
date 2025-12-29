import "dotenv/config";
// @ts-ignore
import cloudinaryLib from "cloudinary";

const cloudinary = cloudinaryLib.v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const cloudinaryEnvOk = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET,
);

export { cloudinary, cloudinaryEnvOk };

export function getPublicIdFromUrl(url: string) {
  if (!url || !url.includes("cloudinary.com")) return null;
  try {
    const parts = url.split("/upload/");
    if (parts.length < 2) return null;
    const rightPart = parts[1];
    // Remove version (v1234567890/) if present
    const versionRegex = /^v\d+\//;
    let path = rightPart.replace(versionRegex, "");
    // Remove extension
    const lastDotIndex = path.lastIndexOf(".");
    if (lastDotIndex !== -1) {
      path = path.substring(0, lastDotIndex);
    }
    return path;
  } catch (e) {
    return null;
  }
}
