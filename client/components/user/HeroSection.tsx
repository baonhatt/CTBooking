import { useEffect, useState, useRef } from "react";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getAllActiveMoviesToday } from "@/lib/api";

export default function HeroSection() {
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
    };
  });

  const displayMovies = movies.length > 0 ? movies : [
    {
      id: "sample-1",
      title: "Sample Movie 1",
      year: 2024,
      duration: "120",
      genres: ["Action", "Adventure"],
      posterUrl: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400&h=600&fit=crop",
    },
    {
      id: "sample-2",
      title: "Sample Movie 2",
      year: 2024,
      duration: "110",
      genres: ["Drama", "Thriller"],
      posterUrl: "https://images.unsplash.com/photo-1594908900066-3f47337549d8?w=400&h=600&fit=crop",
    },
    {
      id: "sample-3",
      title: "Sample Movie 3",
      year: 2024,
      duration: "95",
      genres: ["Comedy", "Romance"],
      posterUrl: "https://images.unsplash.com/photo-1598899134739-24c46f58b8c0?w=400&h=600&fit=crop",
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
      {/* Background blur effect */}
      <div className="absolute inset-0 bg-black/40" />
      
      <div className="container mx-auto px-4 relative z-10 min-h-screen flex flex-col justify-center py-16">

        {/* 3D Carousel */}
        <div className="relative h-[420px] sm:h-[460px] md:h-[500px] flex items-center justify-center perspective-[1000px]"
             onPointerDown={onPointerDown}
             onPointerMove={onPointerMove}
             onPointerUp={endDrag}
             onPointerLeave={endDrag}
        >
          <div className="relative w-full max-w-5xl h-full flex items-center justify-center touch-pan-y select-none">
            {displayMovies.map((movie, index) => {
              const style = getCardStyle(index);
              const diff = (index - currentIndex + displayMovies.length) % displayMovies.length;
              const isCenter = diff === 0;
              
              return (
                <div
                  key={movie.id}
                  className="absolute transition-all duration-700 ease-out cursor-pointer"
                  style={{
                    ...style,
                    pointerEvents: isCenter ? 'auto' : 'none',
                  }}
                  onClick={() => !isCenter && setCurrentIndex(index)}
                >
                  <div className="relative w-64 h-[24rem] sm:w-72 sm:h-[26rem] md:w-80 md:h-[30rem] lg:w-96 lg:h-[32rem] rounded-2xl overflow-hidden shadow-2xl bg-white transform-gpu">
                    <img
                      src={movie.posterUrl}
                      alt={movie.title}
                      className="w-full h-full object-cover"
                    />
                    
                    {/* Price tag (optional) */}
                    {/* {isCenter && (
                      <div className="absolute top-4 right-4 bg-black text-white px-4 py-2 rounded-lg font-bold text-lg">
                        $12
                      </div>
                    )} */}
                    
                    {/* Overlayed info inside image */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 sm:p-5 md:p-6">
                      <h3 className="text-white font-bold text-xl sm:text-2xl md:text-3xl mb-2">{movie.title}</h3>
                      <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm md:text-base text-gray-200">
                        <div className="flex items-center gap-1"><Star className="h-4 w-4 text-yellow-400 fill-yellow-400" /><span>4.8</span></div>
                        <span>•</span>
                        <span>{movie.duration} min</span>
                        <span>•</span>
                        <span className="text-purple-300">{movie.genres.join(" / ")}</span>
                      </div>
                      <p className="text-gray-400 text-[10px] sm:text-xs mt-2">{movie.year}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Navigation Buttons */}
          <button
            onClick={handlePrev}
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-40 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white p-2 md:p-3 rounded-full transition-all"
          >
            <ChevronLeft className="h-5 w-5 md:h-6 md:w-6" />
          </button>
          
          <button
            onClick={handleNext}
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-40 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white p-2 md:p-3 rounded-full transition-all"
          >
            <ChevronRight className="h-5 w-5 md:h-6 md:w-6" />
          </button>
        </div>

        {/* Dots Indicator */}
      </div>
    </section>
  );
}
