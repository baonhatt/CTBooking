import { RequestHandler } from "express";
import type { Movie, ActiveMoviesTodayResponse } from "@shared/api";
import { prisma } from '../lib/prisma'

export const handleMovies2025: RequestHandler = (_req, res) => {
  const movies: Movie[] = [
    {
      id: "mv-2025-01",
      title: "CineSphere234234: Ocean Depths",
      year: 2025,
      duration: "15 phút",
      genres: ["Adventure", "Sci-Fi"],
      posterUrl:
        "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=1200&h=800&fit=crop",
    },
    {
      id: "mv-2025-02",
      title: "Jurassic Rise",
      year: 2025,
      duration: "12 phút",
      genres: ["Action", "Thriller"],
      posterUrl:
        "https://images.unsplash.com/photo-1446776653964-20c1d3a81b06?w=1200&h=800&fit=crop",
    },
    {
      id: "mv-2025-03",
      title: "Mountain Adventure",
      year: 2025,
      duration: "10 phút",
      genres: ["Adventure", "Nature"],
      posterUrl:
        "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&h=800&fit=crop",
    },
    {
      id: "mv-2025-04",
      title: "City Lights",
      year: 2025,
      duration: "14 phút",
      genres: ["Sci-Fi", "Action"],
      posterUrl:
        "https://images.unsplash.com/photo-1514565131-fce0801e5785?w=1200&h=800&fit=crop",
    },
    {
      id: "mv-2025-05",
      title: "Skyward Drift",
      year: 2025,
      duration: "11 phút",
      genres: ["Sci-Fi", "Adventure"],
      posterUrl:
        "https://images.unsplash.com/photo-1497515114625-6f0e333e283b?w=1200&h=800&fit=crop",
    },
    {
      id: "mv-2025-06",
      title: "Aurora Trails",
      year: 2025,
      duration: "13 phút",
      genres: ["Fantasy", "Nature"],
      posterUrl:
        "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200&h=800&fit=crop",
    },
  ];

  res.status(200).json({ year: 2025, count: movies.length, items: movies });
};

export const getAllActiveMoviesToday: RequestHandler = async (_req, res) => {
  let activeMovies: ActiveMoviesTodayResponse[] = [];
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  try {
    const active_movies = await (prisma as any).movies.findMany({
      where: {
        is_active: true,
        showtimes: {
          some: {
            start_time: {
              gte: todayStart,
              lte: todayEnd,
            },
          },
        },
      },
      include: {
        showtimes: {
          where: {
            start_time: {
              gte: todayStart,
              lte: todayEnd,
            },
          },
          select: {
            id: true,
            start_time: true,
            total_sold: true,
            price: true,
          },
        },
      },
      orderBy: {
        release_date: "desc"
      }
    });
    if (active_movies.length !== 0) {
      activeMovies = active_movies.map((m) => ({
        title: m.title,
        description: m.description ?? "",
        cover_image: m.cover_image ?? "",
        detail_images: JSON.stringify(m.detail_images ?? []),
        genres: JSON.stringify(m.genres ?? []),
        rating: m.rating?.toString() ?? "0",
        duration_min: m.duration_min ?? 0,
        price: Number(m.price),
        release_date: m.release_date,
        showtimes: m.showtimes.map((s) => ({
          id: s.id,
          start_time: s.start_time,
          total_sold: s.total_sold,
          price: Number(s.price),
        })),
      }));
      return res.status(200).json({ activeMovies });
    } else {
      return res.status(200).json({ activeMovies: [] });
    }
  } catch (error) {
    return res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};

export const createMovie: RequestHandler = async (req, res) => {
  let baseData: any
  try {
    const {
      title,
      description,
      cover_image,
      detail_images,
      genres,
      rating,
      duration_min,
      price,
      is_active,
      release_date,
    } = req.body as any
    if (!title || price === undefined) {
      return res.status(400).json({ message: "Thiếu dữ liệu bắt buộc" })
    }
    const priceNum = Number(price)
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      return res.status(400).json({ message: "Giá không hợp lệ" })
    }
    if (priceNum > 99999999.99) {
      return res.status(400).json({ message: "Giá vượt quá giới hạn (tối đa 99,999,999.99)" })
    }
    let ratingNum: number | undefined = undefined
    if (rating !== undefined && rating !== null && rating !== "") {
      ratingNum = Number(rating)
      if (!Number.isFinite(ratingNum) || ratingNum < 0 || ratingNum > 10) {
        return res.status(400).json({ message: "Điểm đánh giá không hợp lệ" })
      }
    }
    const durationNum = duration_min === undefined ? undefined : Number(duration_min)
    if (durationNum !== undefined && (!Number.isInteger(durationNum) || durationNum < 0)) {
      return res.status(400).json({ message: "Thời lượng không hợp lệ" })
    }
    baseData = {
      title,
      description,
      cover_image,
      detail_images,
      genres,
      rating: ratingNum,
      duration_min: durationNum,
      price: priceNum,
      is_active: is_active === undefined ? true : Boolean(is_active),
      release_date: release_date ? new Date(release_date) : undefined,
    }
    let movie = await (prisma as any).movies.create({ data: baseData })
    res.status(201).json({ movie })
  } catch (err: any) {
    if (err?.code === "P2002" && String(err?.meta?.target || "").includes("id")) {
      try {
        const last = await (prisma as any).movies.findFirst({ orderBy: { id: "desc" } })
        const nextId = ((last?.id as number) || 0) + 1
        const movie = await (prisma as any).movies.create({ data: { ...baseData, id: nextId } })

        return res.status(201).json({ movie })
      } catch (retryErr: any) {
        return res.status(500).json({ message: retryErr?.message || "Lỗi máy chủ nội bộ" })
      }
    }
    res.status(500).json({ message: err?.message || "Lỗi máy chủ nội bộ" })
  }
}

export const listMovies: RequestHandler = async (req, res) => {
  try {
    const page = Number(req.query.page || 1)
    const pageSize = Number(req.query.pageSize || 20)
    const q = String(req.query.q || "").toLowerCase()
    const where: any = q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}
    const total = await (prisma as any).movies.count({ where })
    const items = await (prisma as any).movies.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    })
    res.status(200).json({ items, page, pageSize, total })
  } catch {
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" })
  }
}

export const getMovie: RequestHandler = async (req, res) => {
  try {
    const id = Number(req.params.id)
    const movie = await (prisma as any).movies.findUnique({ where: { id } })
    if (!movie) return res.status(404).json({ message: "Không tìm thấy" })
    res.status(200).json({ movie })
  } catch {
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" })
  }
}

export const updateMovie: RequestHandler = async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { title, description, cover_image, detail_images, genres, rating, duration_min, price, is_active, release_date } = req.body as any
    const data: any = {}
    if (title !== undefined) data.title = title
    if (description !== undefined) data.description = description
    if (cover_image !== undefined) data.cover_image = cover_image
    if (detail_images !== undefined) data.detail_images = detail_images
    if (genres !== undefined) data.genres = genres
    if (rating !== undefined) {
      const r = Number(rating)
      if (!Number.isFinite(r) || r < 0 || r > 10) return res.status(400).json({ message: "Điểm đánh giá không hợp lệ" })
      data.rating = r
    }
    if (duration_min !== undefined) {
      const d = Number(duration_min)
      if (!Number.isInteger(d) || d < 0) return res.status(400).json({ message: "Thời lượng không hợp lệ" })
      data.duration_min = d
    }
    if (price !== undefined) {
      const p = Number(price)
      if (!Number.isFinite(p) || p < 0) return res.status(400).json({ message: "Giá không hợp lệ" })
      if (p > 99999999.99) return res.status(400).json({ message: "Giá vượt quá giới hạn (tối đa 99,999,999.99)" })
      data.price = p
    }
    if (is_active !== undefined) data.is_active = Boolean(is_active)
    if (release_date !== undefined) data.release_date = release_date ? new Date(release_date) : null
    data.updated_at = new Date()
    const movie = await (prisma as any).movies.update({ where: { id }, data })
    res.status(200).json({ movie })
  } catch (err: any) {
    if (err?.code === "P2025") return res.status(404).json({ message: "Không tìm thấy" })
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" })
  }
}

export const deleteMovie: RequestHandler = async (req, res) => {
  try {
    const id = Number(req.params.id)
    await (prisma as any).movies.delete({ where: { id } })
    res.status(200).json({ ok: true })
  } catch (err: any) {
    if (err?.code === "P2025") return res.status(404).json({ message: "Không tìm thấy" })
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" })
  }
}
