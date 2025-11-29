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
      }));
      return res.status(200).json({ activeMovies });
    } else {
      return res.status(200).json({ activeMovies: [] });
    }
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
};
