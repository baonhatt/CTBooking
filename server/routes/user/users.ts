import { RequestHandler } from "express";
import { prisma } from "../../lib/prisma";

export const updateUserProfile: RequestHandler = async (req, res) => {
  try {
    const { email, name, phone } = req.body as { email?: string; name?: string; phone?: string };
    if (!email) return res.status(400).json({ message: "Thiếu email" });
    const account = await prisma.accounts.findUnique({ where: { email } });
    if (!account) return res.status(404).json({ message: "Không tìm thấy tài khoản" });
    const user = await prisma.users.update({
      where: { id: account.user_id },
      data: {
        fullname: typeof name === "string" ? name : undefined,
        phone: typeof phone === "string" ? phone : undefined,
        updated_at: new Date(),
      },
    });
    return res.status(200).json({ ok: true, user: { id: user.id, fullname: user.fullname, phone: user.phone, email } });
  } catch (err) {
    try {
      console.error("listUserTransactions error:", err);
    } catch { }
    return res.status(200).json({ items: [] });
  }
};

export const listUserTransactions: RequestHandler = async (req, res) => {
  try {
    const emailRaw = String(req.query.email || "");
    const status = String(req.query.status || "paid");
    const page = Number(req.query.page || 1);
    const pageSize = Number(req.query.pageSize || 10);
    const sortKey = String(req.query.sort || "created_at");
    const dir = String(req.query.dir || "desc").toLowerCase() === "asc" ? "asc" : "desc";
    const paymentMethod = String(req.query.payment_method || "");
    const fromStr = String(req.query.from || "");
    const toStr = String(req.query.to || "");
    const skip = (page - 1) * pageSize;

    const email = (() => { try { return decodeURIComponent(emailRaw); } catch { return emailRaw; } })();
    if (!email) return res.status(200).json({ items: [], page, pageSize, total: 0 });

    const account = await prisma.accounts.findUnique({ where: { email } });
    if (!account) return res.status(200).json({ items: [], page, pageSize, total: 0 });

    const where: any = { user_id: account.user_id };
    if (status) {
      const s = status.toLowerCase();
      if (s === "paid") {
        where.payment_status = { in: ["paid"] };
      }
    }
    if (paymentMethod) where.payment_method = paymentMethod;
    if (fromStr || toStr) {
      const from = fromStr ? new Date(fromStr) : undefined;
      const to = toStr ? new Date(toStr) : undefined;
      if (from && to) {
        where.OR = [
          { created_at: { gte: from, lte: to } },
          { paid_at: { gte: from, lte: to } },
        ];
      } else if (from) {
        where.OR = [
          { created_at: { gte: from } },
          { paid_at: { gte: from } },
        ];
      } else if (to) {
        where.OR = [
          { created_at: { lte: to } },
          { paid_at: { lte: to } },
        ];
      }
    }

    const total = await prisma.bookings.count({ where });
    const orderBy: any = sortKey === "paid_at" ? { paid_at: dir } : { created_at: dir };
    const items = await prisma.bookings.findMany({
      where,
      include: { showtime: { include: { movie: true } } },
      orderBy,
      skip,
      take: pageSize,
    });

    const mapped = items.map((b: any) => {
      try {
        const movie = b?.showtime?.movie;
        const start = (() => {
          const v = b?.showtime?.start_time;
          if (!v) return null;
          return v instanceof Date ? v : new Date(v);
        })();
        const dateDisplay = (() => {
          try { return start ? start.toLocaleDateString("vi-VN") : ""; } catch { return ""; }
        })();
        const showtimeStr = (() => {
          try { return start ? start.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : ""; } catch { return ""; }
        })();
        const amount = (() => {
          try { return Number(b?.total_price ?? 0); } catch { return 0; }
        })();
        const coverImage = movie?.cover_image || movie?.coverImage || movie?.poster || null;
        return {
          booking_id: b.id,
          booking_code: b.booking_code || null,
          user_id: b.user_id,
          movie: movie?.title || "",
          dateDisplay,
          showtime: showtimeStr,
          quantity: Number(b?.ticket_count ?? 0),
          amount,
          method: b?.payment_method || "",
          payment_status: b?.payment_status || "",
          name: b?.name || "",
          phone: b?.phone || "",
          email: b?.email || email,
          poster_url: coverImage,
        };
      } catch {
        return {
          booking_id: Number(b?.id ?? 0),
          booking_code: b?.booking_code || null,
          user_id: Number(b?.user_id ?? 0),
          movie: b?.showtime?.movie?.title || "",
          dateDisplay: "",
          showtime: "",
          quantity: Number(b?.ticket_count ?? 0),
          amount: 0,
          method: b?.payment_method || "",
          payment_status: b?.payment_status || "",
          name: b?.name || "",
          phone: b?.phone || "",
          email: b?.email || email,
          poster_url: null,
        };
      }
    });
    return res.status(200).json({ items: mapped, page, pageSize, total });
  } catch (err) {
    console.error("listUserTransactions error:", err);
    return res.status(500).json({ message: "Lỗi máy chủ nội bộ", error: (err as Error).message });
  }
};

