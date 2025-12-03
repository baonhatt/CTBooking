import type { RequestHandler } from "express";
import { prisma } from "../lib/prisma";

export const listTicketPackages: RequestHandler = async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const pageSize = Number(req.query.pageSize || 20);
    const q = String(req.query.q || "").toLowerCase();
    const where: any = q
      ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
          { type: { contains: q, mode: "insensitive" } },
        ],
      }
      : {};
    const total = await (prisma as any).ticket_packages.count({ where });
    const items = await (prisma as any).ticket_packages.findMany({
      where,
      orderBy: [{ display_order: "asc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    res.status(200).json({ items, page, pageSize, total });
  } catch {
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};

export const listActiveTicketPackages: RequestHandler = async (_req, res) => {
  try {
    const items = await (prisma as any).ticket_packages.findMany({
      where: { is_active: true },
      orderBy: [{ display_order: "asc" }, { price: "asc" }],
    });
    res.status(200).json({ items });
  } catch {
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};

export const getTicketPackage: RequestHandler = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const item = await (prisma as any).ticket_packages.findUnique({
      where: { id },
    });
    if (!item) return res.status(404).json({ message: "Không tìm thấy" });
    res.status(200).json({ item });
  } catch {
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};

export const createTicketPackage: RequestHandler = async (req, res) => {
  try {
    const {
      name,
      code,
      description,
      price,
      features,
      type,
      min_group_size,
      max_group_size,
      is_member_only,
      is_active,
      display_order,
    } = req.body as any;
    if (!name || price === undefined) {
      return res.status(400).json({ message: "Thiếu dữ liệu bắt buộc" });
    }
    const priceNum = Number(price);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      return res.status(400).json({ message: "Giá không hợp lệ" });
    }
    if (priceNum > 99999999.99) {
      return res
        .status(400)
        .json({ message: "Giá vượt quá giới hạn (tối đa 99,999,999.99)" });
    }
    let featuresJson: any = undefined;
    if (features !== undefined) {
      if (Array.isArray(features)) featuresJson = features;
      else if (typeof features === "string") {
        featuresJson = features
          .split(",")
          .map((x: string) => x.trim())
          .filter(Boolean);
      }
    }
    const item = await (prisma as any).ticket_packages.create({
      data: {
        name,
        code,
        description,
        price: priceNum,
        features: featuresJson,
        type,
        min_group_size: min_group_size !== undefined ? Number(min_group_size) : undefined,
        max_group_size: max_group_size !== undefined ? Number(max_group_size) : undefined,
        is_member_only: is_member_only ? Boolean(is_member_only) : false,
        is_active: is_active === undefined ? true : Boolean(is_active),
        display_order: display_order !== undefined ? Number(display_order) : 0,
      },
    });
    res.status(201).json({ message: "Thêm gói vé thành công", item });
  } catch (err: any) {
    res.status(500).json({ message: err?.message || "Lỗi máy chủ nội bộ" });
  }
};

export const updateTicketPackage: RequestHandler = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const {
      name,
      code,
      description,
      price,
      features,
      type,
      min_group_size,
      max_group_size,
      is_member_only,
      is_active,
      display_order,
    } = req.body as any;
    const data: any = { updated_at: new Date() };
    if (name !== undefined) data.name = name;
    if (code !== undefined) data.code = code;
    if (description !== undefined) data.description = description;
    if (price !== undefined) {
      const p = Number(price);
      if (!Number.isFinite(p) || p < 0)
        return res.status(400).json({ message: "Giá không hợp lệ" });
      if (p > 99999999.99)
        return res
          .status(400)
          .json({ message: "Giá vượt quá giới hạn (tối đa 99,999,999.99)" });
      data.price = p;
    }
    if (features !== undefined) {
      if (Array.isArray(features)) data.features = features;
      else if (typeof features === "string") {
        data.features = features
          .split(",")
          .map((x: string) => x.trim())
          .filter(Boolean);
      }
    }
    if (type !== undefined) data.type = type;
    if (min_group_size !== undefined)
      data.min_group_size = Number(min_group_size);
    if (max_group_size !== undefined)
      data.max_group_size = Number(max_group_size);
    if (is_member_only !== undefined)
      data.is_member_only = Boolean(is_member_only);
    if (is_active !== undefined) data.is_active = Boolean(is_active);
    if (display_order !== undefined)
      data.display_order = Number(display_order);
    const item = await (prisma as any).ticket_packages.update({
      where: { id },
      data,
    });
    res.status(200).json({ message: "Cập nhật gói vé thành công", item });
  } catch (err: any) {
    if (err?.code === "P2025")
      return res.status(404).json({ message: "Không tìm thấy" });
    res.status(500).json({ message: err?.message || "Lỗi máy chủ nội bộ" });
  }
};

export const deleteTicketPackage: RequestHandler = async (req, res) => {
  try {
    const id = Number(req.params.id);
    await (prisma as any).ticket_packages.delete({ where: { id } });
    res.status(200).json({ message: "Xóa gói vé thành công", ok: true });
  } catch (err: any) {
    if (err?.code === "P2025")
      return res.status(404).json({ message: "Không tìm thấy" });
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};

