import { useEffect, useState, useRef } from "react";
import { Star, Play, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getAllActiveMoviesToday } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export default function HeroSection({ transitionSpeedMs = 1800 }: { transitionSpeedMs?: number }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const { data } = useQuery({
    queryKey: ["activeMovies", "today"],
    queryFn: ({ signal }) => getAllActiveMoviesToday({ signal }),
  });
  
  const movies = (data?.activeMovies || []).map((m) => {
    let genres: string[] = [];
    try {
      const parsed = JSON.parse(m.genres);
      if (Array.isArray(parsed)) genres = parsed as string[];
    } catch {}
    const id = m.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const year = new Date(m.release_date as any).getFullYear();
    return {
      id,
      title: m.title,
      year,
      duration: `${m.duration_min}`,
      genres,
      posterUrl: m.cover_image,
      description: m.description,
    };
  });

  const displayMovies = movies.length > 0 ? movies : [
    { 
      id: "sample-1",
      title: "Sample Movie 1",
      year: 2024,
      duration: "120",
      description: 'description',
      genres: ["Action", "Adventure"],
      posterUrl: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400&h=600&fit=crop",
    },
   
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % displayMovies.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [displayMovies.length]);

  const [screen, setScreen] = useState<"xs" | "sm" | "md" | "lg" | "xl">("lg");
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      setScreen(w < 640 ? "xs" : w < 768 ? "sm" : w < 1024 ? "md" : w < 1280 ? "lg" : "xl");
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + displayMovies.length) % displayMovies.length);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % displayMovies.length);
  };

  const getCardStyle = (index: number) => {
    const total = displayMovies.length;
    const diff = (index - currentIndex + total) % total;
    const offset = screen === "xs" ? 40 : screen === "sm" ? 50 : screen === "md" ? 60 : 65;
    const centerScale = screen === "xs" ? 1.06 : screen === "sm" ? 1.12 : screen === "md" ? 1.18 : 1.2;
    
    if (diff === 0) {
      return {
        transform: `translateX(0%) scale(${centerScale}) rotateY(0deg)`,
        zIndex: 30,
        opacity: 1,
      };
    } else if (diff === 1 || diff === -total + 1) {
      return {
        transform: `translateX(${offset}%) scale(0.85) rotateY(-22deg)`,
        zIndex: 20,
        opacity: 0.7,
      };
    } else if (diff === total - 1 || diff === -1) {
      return {
        transform: `translateX(-${offset}%) scale(0.85) rotateY(22deg)`,
        zIndex: 20,
        opacity: 0.7,
      };
    } else {
      return {
        transform: "translateX(0%) scale(0.7)",
        zIndex: 10,
        opacity: 0,
      };
    }
  };

  const currentMovie = displayMovies[currentIndex];
  const fewMovies = displayMovies.length <= 3;
  const dragStartX = useRef<number | null>(null);
  const dragDelta = useRef<number>(0);
  const isDragging = useRef<boolean>(false);
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragDelta.current = 0;
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current || dragStartX.current === null) return;
    dragDelta.current = e.clientX - dragStartX.current;
  };
  const endDrag = () => {
    if (!isDragging.current) return;
    const delta = dragDelta.current;
    isDragging.current = false;
    dragStartX.current = null;
    dragDelta.current = 0;
    if (Math.abs(delta) > 50) {
      if (delta < 0) handleNext();
      else handlePrev();
    }
  };
  return (
    <section className="relative min-h-screen bg-gradient-dark overflow-hidden">
      <div className="absolute inset-0">
        <motion.img
          key={currentMovie.posterUrl}
          src={currentMovie.posterUrl}
          alt="bg"
          className="w-full h-full object-cover"
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: Math.max(1.5, Math.min(2.5, transitionSpeedMs / 1000)), ease: "easeInOut" }}
          style={{ filter: "url(#bg-sharpen) contrast(1.06) brightness(1.03) saturate(1.06)", willChange: "opacity, transform" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-transparent" />
      </div>

      <div className="container mx-auto px-4 relative z-10 min-h-screen flex flex-col justify-center py-20">

        <div className="mb-3 mt-[4rem] max-w-5xl">
          <h1 className="text-4xl md:text-6xl text-white">
            {currentMovie.title}
          </h1>
          <div className="mt-3 flex items-center gap-3 text-gray-200">
            <div className="flex items-center gap-1"><Star className="h-4 w-4 text-yellow-400" /><span>4.8</span></div>
            <span>•</span>
            <span>{currentMovie.year}</span>
            <span>•</span>
            <span>{currentMovie.duration} min</span>
            <span>•</span>
            <span className="text-purple-300">{currentMovie.genres.join(" / ")}</span>
          </div>
          <p className="mt-3 text-gray-300 text-lg md:text-xl">
           {currentMovie.description}
          </p>
          <div className="mt-6 flex items-center gap-3">
           
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handlePrev}
              className="w-10 h-10 rounded-md bg-white/10 border border-white/20 text-white backdrop-blur-sm hover:bg-white/20 transition-all"
            >
              <ChevronLeft className="h-5 w-5 mx-auto" />
            </button>
            <button
              onClick={handleNext}
              className="w-10 h-10 rounded-md bg-white/10 border border-white/20 text-white backdrop-blur-sm hover:bg-white/20 transition-all"
            >
              <ChevronRight className="h-5 w-5 mx-auto" />
            </button>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-x-16 -inset-y-8 bg-gradient-to-br from-cyan-500/15 via-purple-500/15 to-fuchsia-500/15 blur-3xl rounded-[3rem] pointer-events-none" />
          <div className="relative z-10 w-full max-w-6xl mx-auto">
            <div
              className={cn(
                "px-1 py-2 overflow-x-auto md:overflow-visible",
                fewMovies
                  ? "flex justify-end gap-3 md:flex"
                  : "flex justify-center gap-4 md:grid md:grid-cols-5 lg:grid-cols-6 md:justify-center md:gap-6 md:place-items-center",
              )}
            >
              {displayMovies.map((movie, index) => (
                <button
                  key={movie.id}
                  onClick={() => setCurrentIndex(index)}
                  className="group"
                >
                  <div
                    id={`movie-card-${index}`}
                    className="w-40 md:w-44 shrink-0 rounded-xl overflow-hidden border border-white/10 bg-black/20 shadow-lg hover:shadow-2xl transition-all duration-200 hover:-translate-y-1"
                  >
                    <div style={{ aspectRatio: "2 / 3" }}>
                      <img
                        src={movie.posterUrl}
                        alt={movie.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Dots Indicator */}
      </div>
    </section>
  );
}
