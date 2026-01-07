import type { Request, Response } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { cloudinary } from "../../cloudinary";

const tmpDir = path.join(process.cwd(), "tmp_uploads");
try { fs.mkdirSync(tmpDir, { recursive: true }); } catch { }

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, tmpDir),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}_${safe}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 2048 }, // 2GB
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("video/")) {
      return cb(new Error("Chỉ chấp nhận tệp video"));
    }
    cb(null, true);
  },
}).single("file");

export function uploadAdminVideo(req: Request, res: Response) {
  upload(req, res, async (err: any) => {
    if (err) {
      console.error("[UPLOAD] Multer error:", err?.message || err);
      return res.status(400).json({ message: err?.message || "Upload error" });
    }
    const file = (req as any).file as any;
    if (!file) {
      return res.status(400).json({ message: "Thiếu tệp video" });
    }
    console.log("[UPLOAD] Start upload to Cloudinary:", {
      name: file.originalname,
      mime: file.mimetype,
      size: file.size,
      path: file.path,
    });

    const folder = req.body.folder || req.query.folder || "ctbooking/videos";

    const options = {
      resource_type: "video" as const,
      folder: folder,
      use_filename: true,
      unique_filename: false,
      overwrite: true,
      eager: [
        { quality: "auto", width: 1280, height: 720, crop: "limit", video_codec: "h264", fetch_format: "mp4" },
      ],
      eager_async: true,
      transformation: [
        { quality: "auto:good", fetch_format: "auto" }
      ]
    };

    const isLarge = Number(file.size || 0) > 100 * 1024 * 1024;
    try {
      const result: any = isLarge
        ? await cloudinary.uploader.upload_large(file.path, { chunk_size: 6_000_000, ...options })
        : await cloudinary.uploader.upload(file.path, options as any);
      console.log("[UPLOAD] Cloudinary success:", {
        public_id: (result as any).public_id,
        url: (result as any).secure_url,
        bytes: (result as any).bytes,
        duration: (result as any).duration,
        format: (result as any).format,
      });
      res.status(200).json({
        public_id: (result as any).public_id,
        url: (result as any).secure_url,
        bytes: (result as any).bytes,
        duration: (result as any).duration,
        format: (result as any).format,
        width: (result as any).width,
        height: (result as any).height,
      });
    } catch (error: any) {
      console.error("[UPLOAD] Cloudinary error:", {
        message: error?.message,
        http_code: error?.http_code,
        name: error?.name,
      });
      res.status(500).json({ message: error?.message || "Cloudinary error", http_code: error?.http_code });
    } finally {
      try { fs.unlinkSync(file.path); } catch { }
    }
  });
}
