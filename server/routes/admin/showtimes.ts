import { RequestHandler } from "express";
import { prisma } from "../../lib/prisma";

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
    const q = String(req.query.q || "");
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
    const voidFlag = String(req.query.void || "");
    if (voidFlag === "1" || voidFlag === "true") where.is_active = false;
    else where.is_active = true;
    const idStr = String(req.query.id || "");
    const idNum = Number(idStr);
    if (Number.isInteger(idNum) && idNum > 0) where.id = idNum;
    if (from && to) where.start_time = { gte: from, lte: to };
    else if (from) where.start_time = { gte: from };
    else if (to) where.start_time = { lte: to };
    if (q) where.movie = { title: { contains: q, mode: "insensitive" } };
    const total = await (prisma as any).showtimes.count({ where });
    const orderBy: any =
      sortKey === "created_at"
        ? { created_at: dir }
        : sortKey === "movie_title"
          ? [{ movie: { title: dir } }, { start_time: "asc" }]
          : { start_time: dir };
    const baseItems = await (prisma as any).showtimes.findMany({
      where,
      include: { movie: true },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    const items = await Promise.all(
      baseItems.map(async (s: any) => {
        const paidCount = await (prisma as any).bookings.count({
          where: { showtime_id: s.id, payment_status: { in: ["paid"] } },
        });
        const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
        const recentPendingCount = await (prisma as any).bookings.count({
          where: {
            showtime_id: s.id,
            payment_status: "pending",
            created_at: { gte: tenMinAgo },
          },
        });
        return {
          ...s,
          hasPaidBookings: paidCount > 0,
          hasRecentPending: recentPendingCount > 0,
        };
      })
    );
    res.status(200).json({ items, page, pageSize, total });
  } catch {
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};

export const createShowtime: RequestHandler = async (req, res) => {
  try {
    const { movie_id, start_time } = req.body as any;
    const start = new Date(start_time);
    if (!start_time || Number.isNaN(start.getTime())) {
      return res.status(400).json({ message: "Thời gian bắt đầu không hợp lệ" });
    }
    const mId = Number(movie_id);

    // Validate movie_id
    if (!mId) {
      return res.status(400).json({ message: "Phim là bắt buộc" });
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
          end_time: end,
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
              end_time: end,
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
    const { movie_id, start_time, is_active } = req.body as any;
    const st = await (prisma as any).showtimes.findUnique({
      where: { id },
      include: { movie: true },
    });
    if (!st) return res.status(404).json({ message: "Không tìm thấy lịch" });

    // Block edits if there are PAID bookings or recent PENDING bookings (<= 10 minutes)
    const paidCount = await (prisma as any).bookings.count({
      where: { showtime_id: id, payment_status: { in: ["paid"] } },
    });
    if (paidCount > 0) {
      return res.status(400).json({
        message: "Không thể sửa vì suất chiếu đã có đơn thanh toán (paid)",
      });
    }
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
    const recentPendingCount = await (prisma as any).bookings.count({
      where: {
        showtime_id: id,
        payment_status: "pending",
        created_at: { gte: tenMinAgo },
      },
    });
    if (recentPendingCount > 0) {
      return res.status(400).json({
        message:
          "Không thể sửa vì đang có đơn đặt vé pending trong 10 phút gần đây",
      });
    }

    const mId = movie_id !== undefined ? Number(movie_id) : st.movie_id;
    const start = start_time ? new Date(start_time) : new Date(st.start_time);

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
    const data: any = { updated_at: new Date() };
    if (movie_id !== undefined || start_time !== undefined) {
      data.movie_id = mId;
      data.start_time = start;
      data.end_time = end;
    }
    if (is_active !== undefined) {
      const paid = await (prisma as any).bookings.count({ where: { showtime_id: id, payment_status: { in: ["paid"] } } });
      const tenMinAgo2 = new Date(Date.now() - 10 * 60 * 1000);
      const recentPending = await (prisma as any).bookings.count({ where: { showtime_id: id, payment_status: "pending", created_at: { gte: tenMinAgo2 } } });
      if (paid > 0 || recentPending > 0) {
        return res.status(400).json({ message: "Không thể thay đổi trạng thái vì có booking paid hoặc pending 10 phút gần đây" });
      }
      data.is_active = Boolean(is_active);
    }
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

    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
    const paidCount = await prisma.bookings.count({
      where: { showtime_id: id, payment_status: { in: ["paid"] } },
    });
    const recentPendingCount = await prisma.bookings.count({
      where: {
        showtime_id: id,
        payment_status: "pending",
        created_at: { gte: tenMinAgo },
      },
    });
    if (paidCount > 0 || recentPendingCount > 0) {
      return res.status(400).json({
        message: "Không thể vô hiệu hóa vì có đơn paid hoặc pending 10 phút gần đây",
        ok: false,
      });
    }

    await (prisma as any).showtimes.update({ where: { id }, data: { is_active: false } });
    res.status(200).json({ message: "Đã vô hiệu hóa (inactive) lịch chiếu", ok: true });
  } catch (err: any) {
    if (err?.code === "P2025")
      return res.status(404).json({ message: "Không tìm thấy" });
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};

export const createShowtimesBatch: RequestHandler = async (req, res) => {
  try {
    const { movie_id, start_times } = req.body as any;
    const mId = Number(movie_id);

    // Validate movie_id
    if (!mId) {
      return res.status(400).json({ message: "Phim là bắt buộc" });
    }

    // Validate start_times array
    if (!Array.isArray(start_times) || start_times.length === 0) {
      return res.status(400).json({ message: "Phải có ít nhất một thời gian chiếu" });
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
      const start = new Date(stStr);

      // Validate start_time format
      if (!stStr || Number.isNaN(start.getTime())) {
        skipped.push({ start_time: stStr, reason: "Thời gian không hợp lệ" });
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
            end_time: end,
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

export const getShowtimeById: RequestHandler = async (req, res) => {
  try {
    const showtimeId = Number(req.params.id);

    const showtime = await (prisma as any).showtimes.findUnique({
      where: { id: showtimeId },
      include: {
        movie: {
          select: {
            id: true,
            title: true,
            cover_image: true,
            genres: true,
            rating: true,
            duration_min: true,
          },
        },
        bookings: {
          include: {
            user: {
              select: {
                id: true,
                fullname: true,
                phone: true,
                accounts: {
                  select: { email: true },
                },
              },
            },
          },
          orderBy: { created_at: "desc" },
        },
      },
    });

    if (!showtime) {
      return res.status(404).json({ message: "Không tìm thấy suất chiếu" });
    }

    // Calculate stats
    const totalBookings = showtime.bookings.length;
    const successfulBookings = showtime.bookings.filter((b) =>
      ["paid"].includes(b.payment_status)
    );
    const totalRevenue = successfulBookings.reduce(
      (sum, b) => sum + Number(b.total_price),
      0
    );
    const totalTickets = successfulBookings.reduce(
      (sum, b) => sum + b.ticket_count,
      0
    );

    const mapped = {
      id: showtime.id,
      movie: showtime.movie,
      start_time: showtime.start_time,
      end_time: showtime.end_time,
      total_sold: showtime.total_sold,
      created_at: showtime.created_at,
      updated_at: showtime.updated_at,
      stats: {
        totalBookings,
        successfulBookings: successfulBookings.length,
        failedBookings: totalBookings - successfulBookings.length,
        totalRevenue,
        totalTickets,
        averageTicketsPerBooking:
          successfulBookings.length > 0
            ? Math.round(totalTickets / successfulBookings.length)
            : 0,
      },
      recent_bookings: successfulBookings.slice(0, 10).map((b) => ({
        id: b.id,
        user: {
          id: b.user.id,
          fullname: b.user.fullname,
          email: b.user.accounts[0]?.email || "N/A",
          phone: b.user.phone,
        },
        ticket_count: b.ticket_count,
        total_price: Number(b.total_price),
        payment_method: b.payment_method,
        payment_status: b.payment_status,
        created_at: b.created_at,
      })),
    };

    res.status(200).json(mapped);
  } catch (err: any) {
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};

