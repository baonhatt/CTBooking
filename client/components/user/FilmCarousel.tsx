import { useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { getAllActiveMoviesToday } from "@/lib/api";
import { Button } from "@/components/ui/button";

interface FilmCarouselProps {
  onSelectFilm?: () => void;
}

export default function FilmCarousel({ onSelectFilm }: FilmCarouselProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ["activeMovies", "carousel"],
    queryFn: ({ signal }) => getAllActiveMoviesToday({ signal }),
  });

  const films = useMemo(() => {
    const fetched =
      data?.activeMovies?.map((m: any) => ({
        id: m.id,
        title: m.title,
        genre: (() => {
          try {
            const parsed = JSON.parse(m.genres);
            return Array.isArray(parsed) ? parsed.join(" • ") : "Sci‑Fi";
          } catch {
            return "Sci‑Fi";
          }
        })(),
        poster:
          m.cover_image ||
          "https://images.unsplash.com/photo-1464375117522-1311d6a5b81f?auto=format&fit=crop&w=900&q=80",
      })) || [];

    if (fetched.length > 0) return fetched;

    return [
      {
        id: "placeholder-1",
        title: "Aurora Beyond",
        genre: "Sci‑Fi • Space Opera",
        poster:
          "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=900&q=80",
      },
      {
        id: "placeholder-2",
        title: "Nebula Rising",
        genre: "Adventure • 8K",
        poster:
          "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80",
      },
      {
        id: "placeholder-3",
        title: "Photon Drift",
        genre: "Action • VR",
        poster:
          "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80",
      },
    ];
  }, [data]);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.6;
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  const handleOpen = (film: any) => {
    onSelectFilm?.();
    try {
      localStorage.setItem("selectedFilm", JSON.stringify(film));
    } catch { }
    navigate("/booking");
  };

  return (
    <section
      id="films"
      className="relative py-20 bg-gradient-to-b from-[#050915] via-[#0b1226] to-[#0e1b3d] overflow-hidden"
    >
      <div className="absolute inset-0 opacity-60 neon-noise pointer-events-none" />
      <div className="absolute -left-10 -top-10 w-72 h-72 rounded-full bg-cyan-500/15 blur-3xl" />
      <div className="absolute right-0 bottom-0 w-96 h-96 rounded-full bg-fuchsia-500/10 blur-[120px]" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-cyan-200">Phim</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white mt-2">
              Thư viện phim hologram 8K
            </h2>
            <p className="text-gray-300 mt-2 max-w-2xl">
              Lướt qua các suất chiếu đa chiều. Chọn phim để mở chi tiết và chuyển tới bước đặt vé ngay.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              className="rounded-full border border-white/15 text-white hover:border-cyan-300"
              onClick={() => scroll("left")}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              className="rounded-full border border-white/15 text-white hover:border-cyan-300"
              onClick={() => scroll("right")}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex gap-6 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-neon"
        >
          {films.map((film, index) => (
            <motion.button
              key={film.id}
              onClick={() => handleOpen(film)}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05, duration: 0.45 }}
              className="group relative min-w-[240px] md:min-w-[280px] snap-start rounded-3xl overflow-hidden border border-white/10 bg-white/5 backdrop-blur-lg shadow-[0_0_30px_rgba(59,130,246,0.2)] hover:shadow-[0_0_40px_rgba(236,72,153,0.25)] transition-all duration-300 hover:-translate-y-2"
            >
              <div className="relative h-80 w-full overflow-hidden">
                <img
                  src={film.poster}
                  alt={film.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 space-y-2 text-left">
                  <p className="text-xs uppercase tracking-[0.18em] text-cyan-200">
                    {film.genre}
                  </p>
                  <h3 className="text-xl font-semibold text-white drop-shadow-lg">
                    {film.title}
                  </h3>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-sm text-white">
                    <Play className="h-4 w-4 text-cyan-300" />
                    Mở chi tiết
                  </div>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </section>
  );
}

