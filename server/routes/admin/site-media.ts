import type { RequestHandler } from "express";
import { prisma } from "../../lib/prisma";

export const createSiteMedia: RequestHandler = async (req, res) => {
  try {
    const {
      section,
      type,
      title,
      description,
      public_id,
      url,
      format,
      width,
      height,
      duration,
      display_order,
      is_active,
    } = req.body || {};
    if (!section || !type || !url) {
      return res.status(400).json({ message: "Thiếu section/type/url" });
    }
    const item = await (prisma as any).site_media.create({
      data: {
        section: String(section),
        type: String(type),
        title: title ? String(title) : null,
        description: description ? String(description) : null,
        public_id: public_id ? String(public_id) : null,
        url: String(url),
        format: format ? String(format) : null,
        width: width ? Number(width) : null,
        height: height ? Number(height) : null,
        duration: duration ? Number(duration) : null,
        display_order: display_order ? Number(display_order) : 0,
        is_active: typeof is_active === "boolean" ? is_active : true,
      },
    });
    return res.status(200).json({ item });
  } catch (err: any) {
    return res.status(500).json({ message: err?.message || "Internal error" });
  }
};

export const listSiteMedia: RequestHandler = async (req, res) => {
  try {
    const { section, type, active } = req.query || {};
    const where: any = {};
    if (section) where.section = String(section);
    if (type) where.type = String(type);
    if (active) where.is_active = String(active) === "true";
    const items = await (prisma as any).site_media.findMany({
      where,
      orderBy: [{ display_order: "asc" }, { created_at: "desc" }],
    });
    return res.status(200).json({ items });
  } catch (err: any) {
    return res.status(500).json({ message: err?.message || "Internal error" });
  }
};

