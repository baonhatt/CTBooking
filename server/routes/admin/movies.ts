import { RequestHandler } from "express";
import { prisma } from "../../lib/prisma";
import fs from "fs";
import path from "path";
import sharp from "sharp";

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
      is_active,
      release_date,
    } = req.body as any;
    // Verify required fields
    if (!title || title.trim() === "") {
      return res.status(400).json({ message: "Tên phim là bắt buộc" });
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
        const raw = match ? match[2] : cover_image_base64;
        const inputBuf = Buffer.from(raw, "base64");
        const dir = path.resolve(process.cwd(), "uploads", "movies");
        try {
          fs.mkdirSync(dir, { recursive: true });
        } catch { }
        const filenameBase = `movie_${Date.now()}`;
        const outPath = path.join(dir, `${filenameBase}.webp`);
        await sharp(inputBuf).webp({ quality: 75 }).toFile(outPath);
        savedCover = `/uploads/movies/${path.basename(outPath)}`;
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
        const raw = match ? match[2] : cover_image_base64;
        const inputBuf = Buffer.from(raw, "base64");
        const dir = path.resolve(process.cwd(), "uploads", "movies");
        try {
          fs.mkdirSync(dir, { recursive: true });
        } catch { }
        const filenameBase = `movie_${Date.now()}`;
        const outPath = path.join(dir, `${filenameBase}.webp`);
        await sharp(inputBuf).webp({ quality: 75 }).toFile(outPath);
        data.cover_image = `/uploads/movies/${path.basename(outPath)}`;
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

    // Check khi thay đổi is_active từ true sang false (tạm ẩn)
    if (is_active !== undefined && is_active === false) {
      const movie = await (prisma as any).movies.findUnique({
        where: { id },
      });

      data.is_active = false;
    } else if (is_active !== undefined) {
      data.is_active = Boolean(is_active);
    }

    // Cho phép sửa release_date
    if (release_date !== undefined) {
      if (release_date === null || release_date === "") {
        data.release_date = null;
      } else {
        const rd = new Date(release_date);
        if (Number.isNaN(rd.getTime())) {
          return res
            .status(400)
            .json({ message: "Ngày phát hành không hợp lệ" });
        }
        data.release_date = rd;
      }
    }

    data.updated_at = new Date();
    const movie = await (prisma as any).movies.update({ where: { id }, data });


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

export const getMovieById: RequestHandler = async (req, res) => {
  try {
    const movieId = Number(req.params.id);

    const movie = await (prisma as any).movies.findUnique({
      where: { id: movieId },
    });

    if (!movie) {
      return res.status(404).json({ message: "Không tìm thấy phim" });
    }

    // Calculate stats from bookings only (no showtimes needed)
    const paidBookings = await (prisma as any).bookings.findMany({
      where: {
        movie_id: movieId,
        payment_status: { in: ["paid"] },
      },
      select: {
        ticket_count: true,
        total_price: true,
      },
    });

    const totalTicketsSold = paidBookings.reduce(
      (sum: number, booking: any) => sum + (Number(booking.ticket_count) || 0),
      0
    );

    const totalRevenue = paidBookings.reduce(
      (sum: number, booking: any) => sum + Number(booking.total_price || 0),
      0
    );

    const successfulBookings = paidBookings.length;

    const mapped = {
      id: movie.id,
      title: movie.title,
      description: movie.description || "Không có mô tả",
      cover_image: movie.cover_image,
      genres: movie.genres || [],
      rating: Number(movie.rating || 0),
      duration_min: movie.duration_min || 0,
      is_active: movie.is_active,
      release_date: movie.release_date,
      created_at: movie.created_at,
      updated_at: movie.updated_at,
      stats: {
        totalTicketsSold,
        totalRevenue,
        successfulBookings,
      },
    };

    res.status(200).json(mapped);
  } catch (err: any) {
    console.error("Error in getMovieById:", err);
    res.status(500).json({ 
      message: "Lỗi máy chủ nội bộ",
      error: process.env.NODE_ENV === "development" ? err.message : undefined
    });
  }
};


