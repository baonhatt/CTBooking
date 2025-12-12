import { RequestHandler } from "express";
import type { ActiveMoviesTodayResponse } from "@shared/api";
import { prisma } from "../../lib/prisma";

export const handleMovies2025: RequestHandler = (_req, res) => { };

export const getAllActiveMoviesToday: RequestHandler = async (_req, res) => {
  try {
    // Get all active movies only (no showtimes)
    const active_movies = await prisma.movies.findMany({
      where: {
        is_active: true,
      },
      orderBy: {
        release_date: "desc",
      },
    });

    const activeMovies: ActiveMoviesTodayResponse[] = active_movies.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description ?? "",
      cover_image: m.cover_image ?? "",
      detail_images: JSON.stringify(m.detail_images ?? []),
      genres: JSON.stringify(m.genres ?? []),
      rating: m.rating?.toString() ?? "0",
      duration_min: m.duration_min ?? 0,
      release_date: m.release_date,
      price: 0, // Not used anymore but kept for backward compatibility
      showtimes: [], // Empty array - no showtimes returned
    }));

    return res.status(200).json({ activeMovies });
  } catch (error: any) {
    console.error("Error in getAllActiveMoviesToday:", error);
    return res.status(500).json({ 
      message: "Lỗi máy chủ nội bộ",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
};

export const listMovies: RequestHandler = async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const pageSize = Number(req.query.pageSize || 20);
    const q = String(req.query.q || "").toLowerCase();
    const sortKey = String(req.query.sort || "updated_at");
    const dir = String(req.query.dir || "desc").toLowerCase() === "asc" ? "asc" : "desc";
    const where: any = q
      ? {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      }
      : {};
    const total = await (prisma as any).movies.count({ where });
    const orderBy: any =
      sortKey === "release_date"
        ? { release_date: dir }
        : sortKey === "title"
          ? { title: dir }
          : sortKey === "rating"
            ? { rating: dir }
            : { updated_at: dir };
    const items = await (prisma as any).movies.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    res.status(200).json({ items, page, pageSize, total });
  } catch {
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};

export const getMovie: RequestHandler = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const movie = await (prisma as any).movies.findUnique({ where: { id } });
    if (!movie) return res.status(404).json({ message: "Không tìm thấy" });
    res.status(200).json({ movie });
  } catch {
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};

