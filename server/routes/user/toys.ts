import { RequestHandler } from "express";
import { prisma } from "../../lib/prisma";

export const listActiveToys: RequestHandler = async (_req, res) => {
  try {
    const items = await (prisma as any).toys.findMany({
      where: { status: { in: ["active", "ACTIVE"] } },
      orderBy: { created_at: "desc" },
      take: 24,
    });
    res.status(200).json({ items });
  } catch {
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};

