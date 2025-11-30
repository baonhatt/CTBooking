import type { RequestHandler } from "express"
import { prisma } from "../lib/prisma"

export const listToys: RequestHandler = async (req, res) => {
  try {
    const page = Number(req.query.page || 1)
    const pageSize = Number(req.query.pageSize || 20)
    const q = String(req.query.q || "").toLowerCase()
    const where: any = q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { category: { contains: q, mode: "insensitive" } },
            { status: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}
    const total = await (prisma as any).toys.count({ where })
    const items = await (prisma as any).toys.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    })
    res.status(200).json({ items, page, pageSize, total })
  } catch (err) {
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" })
  }
}

export const getToy: RequestHandler = async (req, res) => {
  try {
    const id = Number(req.params.id)
    const toy = await (prisma as any).toys.findUnique({ where: { id } })
    if (!toy) return res.status(404).json({ message: "Không tìm thấy" })
    res.status(200).json({ toy })
  } catch {
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" })
  }
}

export const createToy: RequestHandler = async (req, res) => {
  try {
    const { name, category, price, stock, status, image_url } = req.body as any
    if (!name || price === undefined) {
      return res.status(400).json({ message: "Thiếu dữ liệu bắt buộc" })
    }
    const priceNum = Number(price)
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      return res.status(400).json({ message: "Giá không hợp lệ" })
    }
    if (priceNum > 99999999.99) {
      return res.status(400).json({ message: "Giá vượt quá giới hạn (tối đa 99,999,999.99)" })
    }
    const toy = await (prisma as any).toys.create({
      data: {
        name,
        category,
        price: priceNum,
        stock: Number(stock ?? 0),
        status: status ?? "active",
        image_url,
      },
    })
    res.status(201).json({ toy })
  } catch (err: any) {
    res.status(500).json({ message: err?.message || "Lỗi máy chủ nội bộ" })
  }
}

export const updateToy: RequestHandler = async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { name, category, price, stock, status, image_url } = req.body as any
    const priceNum = price === undefined ? undefined : Number(price)
    if (priceNum !== undefined) {
      if (!Number.isFinite(priceNum) || priceNum < 0) {
        return res.status(400).json({ message: "Giá không hợp lệ" })
      }
      if (priceNum > 99999999.99) {
        return res.status(400).json({ message: "Giá vượt quá giới hạn (tối đa 99,999,999.99)" })
      }
    }
    const toy = await (prisma as any).toys.update({
      where: { id },
      data: { name, category, price: priceNum, stock, status, image_url, updated_at: new Date() },
    })
    res.status(200).json({ toy })
  } catch (err: any) {
    if (err?.code === "P2025") return res.status(404).json({ message: "Không tìm thấy" })
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" })
  }
}

export const deleteToy: RequestHandler = async (req, res) => {
  try {
    const id = Number(req.params.id)
    await (prisma as any).toys.delete({ where: { id } })
    res.status(200).json({ ok: true })
  } catch (err: any) {
    if (err?.code === "P2025") return res.status(404).json({ message: "Không tìm thấy" })
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" })
  }
}

export const listActiveToys: RequestHandler = async (_req, res) => {
  try {
    const items = await (prisma as any).toys.findMany({
      where: { status: { in: ["active", "ACTIVE"] } },
      orderBy: { created_at: "desc" },
      take: 24,
    })
    res.status(200).json({ items })
  } catch {
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" })
  }
}
