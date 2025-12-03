import { RequestHandler } from "express";
import { prisma } from "../lib/prisma";

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
            price: true,
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
      ["paid", "PAID", "success", "SUCCESS"].includes(b.payment_status)
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
      price: Number(showtime.price),
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
