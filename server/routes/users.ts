import { RequestHandler } from "express";
import { prisma } from "../lib/prisma";
import bcrypt from "bcryptjs";

export const getUsers: RequestHandler = async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const pageSize = Number(req.query.pageSize || 10);
    const q = String(req.query.q || "");

    const skip = (page - 1) * pageSize;
    let where: any = {};

    // Search by fullname or email
    if (q) {
      where = {
        OR: [
          { fullname: { contains: q, mode: "insensitive" } },
          { accounts: { some: { email: { contains: q, mode: "insensitive" } } } },
          { phone: { contains: q, mode: "insensitive" } },
        ],
      };
    }

    const total = await (prisma as any).users.count({ where });
    const items = await (prisma as any).users.findMany({
      where,
      include: {
        accounts: {
          select: { email: true, is_active: true, created_at: true },
        },
        bookings: {
          select: { id: true },
        },
      },
      skip,
      take: pageSize,
      orderBy: { created_at: "desc" },
    });

    const mapped = items.map((u: any) => ({
      id: u.id,
      fullname: u.fullname || "N/A",
      phone: u.phone || "N/A",
      email: u.accounts[0]?.email || "N/A",
      is_active: u.accounts[0]?.is_active ?? true,
      total_bookings: u.bookings.length,
      created_at: u.created_at,
      updated_at: u.updated_at,
    }));

    res.status(200).json({
      items: mapped,
      page,
      pageSize,
      total,
    });
  } catch (err: any) {
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};

export const getUserById: RequestHandler = async (req, res) => {
  try {
    const userId = Number(req.params.id);

    const user = await (prisma as any).users.findUnique({
      where: { id: userId },
      include: {
        accounts: {
          select: {
            id: true,
            email: true,
            is_active: true,
            login_type: true,
            created_at: true,
          },
        },
        bookings: {
          include: {
            showtime: {
              include: {
                movie: {
                  select: { id: true, title: true },
                },
              },
            },
          },
          orderBy: { created_at: "desc" },
          take: 10,
        },
      },
    });

    if (!user) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    const mapped = {
      id: user.id,
      fullname: user.fullname || "N/A",
      phone: user.phone || "N/A",
      avatar: user.avatar || null,
      email: user.accounts[0]?.email || "N/A",
      is_active: user.accounts[0]?.is_active ?? true,
      login_type: user.accounts[0]?.login_type || "email",
      account_created_at: user.accounts[0]?.created_at,
      user_created_at: user.created_at,
      user_updated_at: user.updated_at,
      recent_bookings: user.bookings.map((b: any) => ({
        id: b.id,
        movie_title: b.showtime?.movie?.title || "N/A",
        ticket_count: b.ticket_count,
        total_price: Number(b.total_price),
        payment_method: b.payment_method,
        payment_status: b.payment_status,
        created_at: b.created_at,
      })),
      total_bookings: user.bookings.length,
    };

    res.status(200).json(mapped);
  } catch (err: any) {
    res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};

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
    } catch {}
    return res.status(200).json({ items: [] });
  }
};

export const changePassword: RequestHandler = async (req, res) => {
  try {
    const { email, oldPassword, newPassword } = req.body as { email?: string; oldPassword?: string; newPassword?: string };
    if (!email || !oldPassword || !newPassword) {
      return res.status(400).json({ message: "Thiếu thông tin đổi mật khẩu" });
    }
    const account = await prisma.accounts.findUnique({ where: { email } });
    if (!account || !account.password) {
      return res.status(404).json({ message: "Không tìm thấy tài khoản" });
    }
    const ok = await bcrypt.compare(oldPassword, account.password);
    if (!ok) return res.status(400).json({ message: "Mật khẩu hiện tại không đúng" });
    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.accounts.update({ where: { id: account.id }, data: { password: hashed, updated_at: new Date() } });
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
  }
};

export const listUserTransactions: RequestHandler = async (req, res) => {
  debugger
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
        return {
          booking_id: b.id,
          booking_code: b.booking_code || null,
          user_id: b.user_id,
          movie: b?.showtime?.movie?.title || "",
          dateDisplay,
          showtime: showtimeStr,
          quantity: Number(b?.ticket_count ?? 0),
          amount,
          method: b?.payment_method || "",
          payment_status: b?.payment_status || "",
          name: b?.name || "",
          phone: b?.phone || "",
          email: b?.email || email,
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
        };
      }
    });
    return res.status(200).json({ items: mapped, page, pageSize, total });
  } catch (err) {
    console.error("listUserTransactions error:", err);
    return res.status(500).json({ message: "Lỗi máy chủ nội bộ", error: (err as Error).message });
  }
};
