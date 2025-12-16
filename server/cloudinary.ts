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
