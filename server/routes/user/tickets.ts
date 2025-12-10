import type { RequestHandler } from "express";
import { prisma } from "../../lib/prisma";

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

