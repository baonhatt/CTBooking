import { RequestHandler } from "express";
import type { Movie, ActiveMoviesTodayResponse } from "@shared/api";
import { prisma } from "../lib/prisma";
import fs from "fs";
import path from "path";

export const handleMovies2025: RequestHandler = (_req, res) => { };

export const getAllActiveMoviesToday: RequestHandler = async (_req, res) => {
  
  let activeMovies: ActiveMoviesTodayResponse[] = [];
  // Use UTC date to avoid timezone issues
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  try {
    // Get all active movies with their showtimes (from today onwards)
    const active_movies = await (prisma as any).movies.findMany({
      where: {
        is_active: true,
      },
      include: {
        showtimes: {
          where: {
            start_time: {
              gte: todayStart,
            },
          },
          orderBy: {
            start_time: "asc",
          },
          select: {
            id: true,
            start_time: true,
            total_sold: true,
          },
        },
      },
      orderBy: {
        release_date: "desc",
      },
    });

    // Filter to only include movies that have showtimes from today onwards
    const moviesWithShowtimes = active_movies.filter(m => m.showtimes.length > 0);

    if (moviesWithShowtimes.length !== 0) {
      activeMovies = moviesWithShowtimes.map((m) => ({
        title: m.title,
        description: m.description ?? "",
        cover_image: m.cover_image ?? "",
        detail_images: JSON.stringify(m.detail_images ?? []),
        genres: JSON.stringify(m.genres ?? []),
        rating: m.rating?.toString() ?? "0",
        duration_min: m.duration_min ?? 0,
        price: 0,
        release_date: m.release_date,
        showtimes: m.showtimes.map((s) => ({
          id: s.id,
          start_time: s.start_time,
          total_sold: s.total_sold,
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
  let baseData: any;
  try {
    const {
      title,
      description,
      cover_image,
      cover_image_base64,
      detail_images,
      genres,
      rating,
      duration_min,
      price,
      is_active,
      release_date,
    } = req.body as any;
    // Verify required fields
    if (!title || title.trim() === "") {
      return res.status(400).json({ message: "Tên phim là bắt buộc" });
    }

    // Validate price
    if (price === undefined || price === null) {
      return res.status(400).json({ message: "Giá là bắt buộc" });
    }
    const priceNum = Number(price);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      return res.status(400).json({ message: "Giá không hợp lệ (phải là số dương)" });
    }
    if (priceNum === 0) {
      return res.status(400).json({ message: "Giá phải lớn hơn 0" });
    }
    if (priceNum > 99999999.99) {
      return res.status(400).json({ message: "Giá vượt quá giới hạn (tối đa 99,999,999.99)" });
    }

    // Validate duration
    if (duration_min === undefined || duration_min === null) {
      return res.status(400).json({ message: "Thời lượng là bắt buộc" });
    }
    const durationNum = Number(duration_min);
    if (!Number.isInteger(durationNum) || durationNum <= 0) {
      return res.status(400).json({ message: "Thời lượng phải là số nguyên dương" });
    }
    if (durationNum > 600) {
      return res.status(400).json({ message: "Thời lượng không hợp lệ (tối đa 600 phút)" });
    }

    // Validate release_date
    if (!release_date) {
      return res.status(400).json({ message: "Ngày phát hành là bắt buộc" });
    }

    // Validate rating
    let ratingNum: number | undefined = undefined;
    if (rating !== undefined && rating !== null && rating !== "") {
      ratingNum = Number(rating);
      if (!Number.isFinite(ratingNum) || ratingNum < 0 || ratingNum > 10) {
        return res.status(400).json({ message: "Điểm đánh giá phải từ 0 đến 10" });
      }
    }
    let savedCover = cover_image as string | undefined;
    if (cover_image_base64 && typeof cover_image_base64 === "string") {
      try {
        const match = cover_image_base64.match(/^data:(.+);base64,(.+)$/);
        const ext = match ? match[1].split("/")[1] || "png" : "png";
        const buf = Buffer.from(
          match ? match[2] : cover_image_base64,
          "base64",
        );
        const dir = path.resolve(process.cwd(), "uploads", "movies");
        try {
          fs.mkdirSync(dir, { recursive: true });
        } catch { }
        const filename = `movie_${Date.now()}.${ext}`;
        const filepath = path.join(dir, filename);
        fs.writeFileSync(filepath, buf);
        savedCover = `/uploads/movies/${filename}`;
      } catch { }
    }
    baseData = {
      title,
      description,
      cover_image: savedCover,
      detail_images,
      genres,
      rating: ratingNum,
      duration_min: durationNum,
      price: priceNum,
      is_active: is_active === undefined ? true : Boolean(is_active),
      release_date: release_date ? new Date(release_date) : undefined,
    };
    let movie = await (prisma as any).movies.create({ data: baseData });
    res.status(201).json({ message: "Thêm phim mới thành công", movie });
  } catch (err: any) {
    if (
      err?.code === "P2002" &&
      String(err?.meta?.target || "").includes("id")
    ) {
      try {
        const last = await (prisma as any).movies.findFirst({
          orderBy: { id: "desc" },
        });
        const nextId = ((last?.id as number) || 0) + 1;
        const movie = await (prisma as any).movies.create({
          data: { ...baseData, id: nextId },
        });

        return res.status(201).json({ message: "Thêm phim mới thành công", movie });
      } catch (retryErr: any) {
        return res
          .status(500)
          .json({ message: retryErr?.message || "Lỗi máy chủ nội bộ" });
      }
    }
    res.status(500).json({ message: err?.message || "Lỗi máy chủ nội bộ" });
  }
};

export const listMovies: RequestHandler = async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const pageSize = Number(req.query.pageSize || 20);
    const q = String(req.query.q || "").toLowerCase();
    const where: any = q
      ? {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      }
      : {};
    const total = await (prisma as any).movies.count({ where });
    const items = await (prisma as any).movies.findMany({
      where,
      orderBy: { id: "desc" },
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

export const updateMovie: RequestHandler = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const {
      title,
      description,
      cover_image,
      cover_image_base64,
      detail_images,
      genres,
      rating,
      duration_min,
      price,
      is_active,
      release_date,
    } = req.body as any;
    const data: any = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (cover_image !== undefined) data.cover_image = cover_image;
    if (cover_image_base64 && typeof cover_image_base64 === "string") {
      try {
        const match = cover_image_base64.match(/^data:(.+);base64,(.+)$/);
        const ext = match ? match[1].split("/")[1] || "png" : "png";
        const buf = Buffer.from(
          match ? match[2] : cover_image_base64,
          "base64",
        );
        const dir = path.resolve(process.cwd(), "uploads", "movies");
        try {
          fs.mkdirSync(dir, { recursive: true });
        } catch { }
        const filename = `movie_${Date.now()}.${ext}`;
        const filepath = path.join(dir, filename);
        fs.writeFileSync(filepath, buf);
        data.cover_image = `/uploads/movies/${filename}`;
      } catch { }
    }
    if (detail_images !== undefined) data.detail_images = detail_images;
    if (genres !== undefined) data.genres = genres;

    // Validate rating
    if (rating !== undefined) {
      const r = Number(rating);
      if (!Number.isFinite(r) || r < 0 || r > 10)
        return res.status(400).json({ message: "Điểm đánh giá phải từ 0 đến 10" });
      data.rating = r;
    }

    // Validate duration
    if (duration_min !== undefined) {
      const d = Number(duration_min);
      if (!Number.isInteger(d) || d <= 0)
        return res.status(400).json({ message: "Thời lượng phải là số nguyên dương" });
      if (d > 600)
        return res.status(400).json({ message: "Thời lượng không hợp lệ (tối đa 600 phút)" });
      data.duration_min = d;
    }

    // Validate price
    if (price !== undefined) {
      const p = Number(price);
      if (!Number.isFinite(p) || p < 0)
        return res.status(400).json({ message: "Giá không hợp lệ (phải là số dương)" });
      if (p === 0)
        return res.status(400).json({ message: "Giá phải lớn hơn 0" });
      if (p > 99999999.99)
        return res.status(400).json({ message: "Giá vượt quá giới hạn (tối đa 99,999,999.99)" });
      data.price = p;
    }

    if (is_active !== undefined) data.is_active = Boolean(is_active);
    if (release_date !== undefined)
      data.release_date = release_date ? new Date(release_date) : null;
    data.updated_at = new Date();
    const movie = await (prisma as any).movies.update({ where: { id }, data });

    // Update end_time for all showtimes of this movie if duration_min changed
    if (duration_min !== undefined) {
      const durationMinutes = Number(duration_min);
      const showtimes = await (prisma as any).showtimes.findMany({
        where: { movie_id: id },
      });
      for (const st of showtimes) {
        const startDate = new Date(st.start_time);
        const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
        await (prisma as any).showtimes.update({
          where: { id: st.id },
          data: { end_time: endDate },
        });
      }
    }

    res.status(200).json({ message: "Cập nhật phim thành công", movie });
  } catch (err: any) {
    if (err?.code === "P2025")
      return res.status(404).json({ message: "Không tìm thấy" });
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};

export const deleteMovie: RequestHandler = async (req, res) => {
  try {
    const id = Number(req.params.id);
    await (prisma as any).movies.delete({ where: { id } });
    res.status(200).json({ message: "Xóa phim thành công", ok: true });
  } catch (err: any) {
    if (err?.code === "P2025")
      return res.status(404).json({ message: "Không tìm thấy" });
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};

export const listShowtimes: RequestHandler = async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const pageSize = Number(req.query.pageSize || 20);
    const fromStr = String(req.query.from || "");
    const toStr = String(req.query.to || "");
    const todayFlag = String(req.query.today || "");
    const sortKey = String(req.query.sort || "start_time");
    const dir =
      String(req.query.dir || "asc").toLowerCase() === "desc" ? "desc" : "asc";
    let from = fromStr ? new Date(fromStr) : undefined;
    let to = toStr ? new Date(toStr) : undefined;
    if (!from && !to && (todayFlag === "1" || todayFlag === "true")) {
      const now = new Date();
      const tStart = new Date(now);
      tStart.setHours(0, 0, 0, 0);
      const tEnd = new Date(now);
      tEnd.setHours(23, 59, 59, 999);
      from = tStart;
      to = tEnd;
    }
    const where: any = {};
    if (from && to) where.start_time = { gte: from, lte: to };
    else if (from) where.start_time = { gte: from };
    else if (to) where.start_time = { lte: to };
    const total = await (prisma as any).showtimes.count({ where });
    const orderBy: any =
      sortKey === "created_at"
        ? { created_at: dir }
        : sortKey === "movie_title"
          ? [{ movie: { title: dir } }, { start_time: "asc" }]
          : { start_time: dir };
    const items = await (prisma as any).showtimes.findMany({
      where,
      include: { movie: true },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    res.status(200).json({ items, page, pageSize, total });
  } catch {
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};

export const createShowtime: RequestHandler = async (req, res) => {
  try {
    const { movie_id, start_time, price } = req.body as any;
    const start = new Date(start_time);
    if (!start_time || Number.isNaN(start.getTime())) {
      return res.status(400).json({ message: "Thời gian bắt đầu không hợp lệ" });
    }
    const mId = Number(movie_id);
    const priceNum = Number(price);

    // Validate movie_id
    if (!mId) {
      return res.status(400).json({ message: "Phim là bắt buộc" });
    }

    // Validate price
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      return res.status(400).json({ message: "Giá phải là số dương" });
    }
    if (priceNum > 9999999.99) {
      return res.status(400).json({ message: "Giá vượt quá giới hạn (tối đa 9,999,999.99)" });
    }

    const movie = await (prisma as any).movies.findUnique({
      where: { id: mId },
    });
    if (!movie) return res.status(404).json({ message: "Không tìm thấy phim" });

    // Verify start_time >= movie.release_date
    if (movie.release_date) {
      const releaseDate = new Date(movie.release_date);
      if (start < releaseDate) {
        return res.status(400).json({
          message: `Ngày bắt đầu suất chiếu không được nhỏ hơn ngày phát hành phim (${releaseDate.toLocaleDateString("vi-VN")})`,
        });
      }
    }

    const duration = Number(movie.duration_min || 0);
    const end = new Date(start.getTime() + duration * 60 * 1000);

    const dayStart = new Date(start);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(start);
    dayEnd.setHours(23, 59, 59, 999);

    const existing = await (prisma as any).showtimes.findMany({
      where: { start_time: { gte: dayStart, lte: dayEnd } },
      include: { movie: true },
      orderBy: { start_time: "asc" },
    });
    const overlaps = existing.some((s: any) => {
      const sDur = Number(s.movie?.duration_min || 0);
      const sEnd = new Date(
        new Date(s.start_time).getTime() + sDur * 60 * 1000,
      );
      return start < sEnd && new Date(s.start_time) < end;
    });
    if (overlaps)
      return res
        .status(409)
        .json({ message: "Thời gian lịch chiếu trùng với lịch khác" });
    try {
      const showtime = await (prisma as any).showtimes.create({
        data: {
          movie_id: mId,
          start_time: start,
          price: priceNum > 0 ? priceNum.toFixed(2) : "0.00",
        },
      });
      return res.status(201).json({ message: "Thêm lịch chiếu thành công", showtime });
    } catch (e: any) {
      if (e?.code === "P2002" && String(e?.meta?.target || "").includes("id")) {
        try {
          await (prisma as any).$executeRawUnsafe(
            'SELECT setval(pg_get_serial_sequence("showtimes", "id"), COALESCE((SELECT MAX(id) FROM "showtimes"), 1), true);',
          );
          const showtime = await (prisma as any).showtimes.create({
            data: {
              movie_id: mId,
              start_time: start,
              price: priceNum > 0 ? priceNum.toFixed(2) : "0.00",
            },
          });
          return res.status(201).json({ message: "Thêm lịch chiếu thành công", showtime });
        } catch (ee: any) {
          return res
            .status(500)
            .json({ message: ee?.message || "Lỗi máy chủ nội bộ" });
        }
      }
      return res
        .status(500)
        .json({ message: e?.message || "Lỗi máy chủ nội bộ" });
    }
  } catch (err: any) {
    return res
      .status(500)
      .json({ message: err?.message || "Lỗi máy chủ nội bộ" });
  }
};

export const updateShowtime: RequestHandler = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { movie_id, start_time, price } = req.body as any;
    const st = await (prisma as any).showtimes.findUnique({
      where: { id },
      include: { movie: true },
    });
    if (!st) return res.status(404).json({ message: "Không tìm thấy lịch" });

    const mId = movie_id !== undefined ? Number(movie_id) : st.movie_id;
    const start = start_time ? new Date(start_time) : new Date(st.start_time);
    const priceNum = price === undefined ? undefined : Number(price);

    // Validate price if provided
    if (priceNum !== undefined) {
      if (!Number.isFinite(priceNum) || priceNum <= 0) {
        return res.status(400).json({ message: "Giá phải là số dương" });
      }
      if (priceNum > 9999999.99) {
        return res.status(400).json({ message: "Giá vượt quá giới hạn (tối đa 9,999,999.99)" });
      }
    }

    const movie = await (prisma as any).movies.findUnique({
      where: { id: mId },
    });
    if (!movie) return res.status(404).json({ message: "Không tìm thấy phim" });

    const duration = Number(movie.duration_min || 0);
    const end = new Date(start.getTime() + duration * 60 * 1000);
    const dayStart = new Date(start);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(start);
    dayEnd.setHours(23, 59, 59, 999);
    const existing = await (prisma as any).showtimes.findMany({
      where: { start_time: { gte: dayStart, lte: dayEnd }, NOT: { id } },
      include: { movie: true },
      orderBy: { start_time: "asc" },
    });
    const overlaps = existing.some((s: any) => {
      const sDur = Number(s.movie?.duration_min || 0);
      const sEnd = new Date(
        new Date(s.start_time).getTime() + sDur * 60 * 1000,
      );
      return start < sEnd && new Date(s.start_time) < end;
    });
    if (overlaps)
      return res
        .status(409)
        .json({ message: "Thời gian lịch chiếu trùng với lịch khác" });
    const data: any = {
      movie_id: mId,
      start_time: start,
      updated_at: new Date(),
    };
    if (priceNum !== undefined)
      data.price = priceNum > 0 ? priceNum.toFixed(2) : "0.00";
    const showtime = await (prisma as any).showtimes.update({
      where: { id },
      data,
    });
    res.status(200).json({ message: "Cập nhật lịch chiếu thành công", showtime });
  } catch (err: any) {
    res.status(500).json({ message: err?.message || "Lỗi máy chủ nội bộ" });
  }
};

export const deleteShowtime: RequestHandler = async (req, res) => {
  try {
    const id = Number(req.params.id);
    await (prisma as any).showtimes.delete({ where: { id } });
    res.status(200).json({ message: "Xóa lịch chiếu thành công", ok: true });
  } catch (err: any) {
    if (err?.code === "P2025")
      return res.status(404).json({ message: "Không tìm thấy" });
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};

export const createShowtimesBatch: RequestHandler = async (req, res) => {
  try {
    const { movie_id, start_times, price } = req.body as any;
    const mId = Number(movie_id);
    const defaultPriceNum = Number(price ?? 0);

    // Validate movie_id
    if (!mId) {
      return res.status(400).json({ message: "Phim là bắt buộc" });
    }

    // Validate start_times array
    if (!Array.isArray(start_times) || start_times.length === 0) {
      return res.status(400).json({ message: "Phải có ít nhất một thời gian chiếu" });
    }

    // Validate default price
    if (!Number.isFinite(defaultPriceNum) || defaultPriceNum <= 0) {
      return res.status(400).json({ message: "Giá phải là số dương" });
    }
    if (defaultPriceNum > 9999999.99) {
      return res.status(400).json({ message: "Giá vượt quá giới hạn (tối đa 9,999,999.99)" });
    }

    const movie = await (prisma as any).movies.findUnique({
      where: { id: mId },
    });
    if (!movie) return res.status(404).json({ message: "Không tìm thấy phim" });

    const duration = Number(movie.duration_min || 0);
    const created: any[] = [];
    const skipped: any[] = [];

    for (const item of start_times) {
      const stStr = typeof item === "string" ? item : item?.start_time;
      const rowPrice =
        typeof item === "object" && item
          ? Number(item.price ?? defaultPriceNum)
          : defaultPriceNum;
      const start = new Date(stStr);

      // Validate start_time format
      if (!stStr || Number.isNaN(start.getTime())) {
        skipped.push({ start_time: stStr, reason: "Thời gian không hợp lệ" });
        continue;
      }

      // Validate row price
      if (!Number.isFinite(rowPrice) || rowPrice <= 0) {
        skipped.push({ start_time: stStr, reason: "Giá phải là số dương" });
        continue;
      }
      if (rowPrice > 9999999.99) {
        skipped.push({ start_time: stStr, reason: "Giá vượt quá giới hạn" });
        continue;
      }

      // Verify start_time >= movie.release_date
      if (movie.release_date) {
        const releaseDate = new Date(movie.release_date);
        if (start < releaseDate) {
          skipped.push({
            start_time: stStr,
            reason: `Ngày bắt đầu không được nhỏ hơn ngày phát hành (${releaseDate.toLocaleDateString("vi-VN")})`,
          });
          continue;
        }
      }

      const end = new Date(start.getTime() + duration * 60 * 1000);
      const dayStart = new Date(start);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(start);
      dayEnd.setHours(23, 59, 59, 999);
      const existing = await (prisma as any).showtimes.findMany({
        where: { start_time: { gte: dayStart, lte: dayEnd } },
        include: { movie: true },
        orderBy: { start_time: "asc" },
      });
      const overlaps = existing.some((s: any) => {
        const sDur = Number(s.movie?.duration_min || 0);
        const sEnd = new Date(
          new Date(s.start_time).getTime() + sDur * 60 * 1000,
        );
        return start < sEnd && new Date(s.start_time) < end;
      });
      if (overlaps) {
        skipped.push({ start_time: stStr, reason: "trùng lịch" });
        continue;
      }
      try {
        const showtime = await (prisma as any).showtimes.create({
          data: {
            movie_id: mId,
            start_time: start,
            price: rowPrice > 0 ? rowPrice.toFixed(2) : "0.00",
          },
        });
        created.push(showtime);
      } catch (e: any) {
        skipped.push({ start_time: stStr, reason: e?.message || "lỗi tạo" });
      }
    }
    return res.status(201).json({ created, skipped });
  } catch (err: any) {
    return res
      .status(500)
      .json({ message: err?.message || "Lỗi máy chủ nội bộ" });
  }
};

export const getMovieById: RequestHandler = async (req, res) => {
  try {
    const movieId = Number(req.params.id);

    const movie = await (prisma as any).movies.findUnique({
      where: { id: movieId },
      include: {
        showtimes: {
          select: {
            id: true,
            start_time: true,
            price: true,
            total_sold: true,
          },
        },
      },
    });

    if (!movie) {
      return res.status(404).json({ message: "Không tìm thấy phim" });
    }

    // Calculate stats
    const totalShowtimes = movie.showtimes.length;
    const totalTicketsSold = movie.showtimes.reduce(
      (sum, st) => sum + (st.total_sold || 0),
      0
    );
    const totalRevenue = await (prisma as any).bookings.aggregate({
      where: {
        showtime: {
          movie_id: movieId,
        },
        payment_status: { in: ["paid", "PAID", "success", "SUCCESS"] },
      },
      _sum: { total_price: true },
    });

    const successfulBookings = await (prisma as any).bookings.count({
      where: {
        showtime: {
          movie_id: movieId,
        },
        payment_status: { in: ["paid", "PAID", "success", "SUCCESS"] },
      },
    });

    const mapped = {
      id: movie.id,
      title: movie.title,
      description: movie.description || "Không có mô tả",
      cover_image: movie.cover_image,
      genres: movie.genres || [],
      rating: Number(movie.rating || 0),
      duration_min: movie.duration_min || 0,
      price: Number(movie.price),
      is_active: movie.is_active,
      release_date: movie.release_date,
      created_at: movie.created_at,
      updated_at: movie.updated_at,
      stats: {
        totalShowtimes,
        totalTicketsSold,
        totalRevenue: Number(totalRevenue._sum?.total_price || 0),
        successfulBookings,
      },
    };

    res.status(200).json(mapped);
  } catch (err: any) {
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};
