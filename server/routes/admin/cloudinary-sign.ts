import type { Request, Response } from "express";
import { cloudinary } from "../../cloudinary";

export function generateCloudinarySignature(req: Request, res: Response) {
  try {
    const { folder, resource_type } = req.body || {};
    if (!folder || !resource_type) {
      return res.status(400).json({ message: "Thiếu tham số cần thiết" });
    }
    const timestamp = Math.floor(Date.now() / 1000);
    const paramsToSign = {
      timestamp,
      folder: String(folder),
      use_filename: "true",
      unique_filename: "false",
      overwrite: "true",
    } as Record<string, string | number>;
    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET || ""
    );
    res.json({ timestamp, signature, api_key: process.env.CLOUDINARY_API_KEY || "" });
  } catch (err: any) {
    res.status(500).json({ message: err?.message || "Internal error" });
  }
}
