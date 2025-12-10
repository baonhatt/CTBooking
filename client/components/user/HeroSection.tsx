import { useEffect, useState } from "react";
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

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + displayMovies.length) % displayMovies.length);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % displayMovies.length);
  };

  const getCardStyle = (index: number) => {
    const total = displayMovies.length;
    const diff = (index - currentIndex + total) % total;
    
    if (diff === 0) {
      // Center card
      return {
        transform: "translateX(0%) scale(1.1) rotateY(0deg)",
        zIndex: 30,
        opacity: 1,
      };
    } else if (diff === 1 || diff === -total + 1) {
      // Right card
      return {
        transform: "translateX(70%) scale(0.85) rotateY(-25deg)",
        zIndex: 20,
        opacity: 0.7,
      };
    } else if (diff === total - 1 || diff === -1) {
      // Left card
      return {
        transform: "translateX(-70%) scale(0.85) rotateY(25deg)",
        zIndex: 20,
        opacity: 0.7,
      };
    } else {
      // Hidden cards
      return {
        transform: "translateX(0%) scale(0.7)",
        zIndex: 10,
        opacity: 0,
      };
    }
  };

  const currentMovie = displayMovies[currentIndex];

  return (
    <section className="relative min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 overflow-hidden">
      {/* Background blur effect */}
      <div className="absolute inset-0 bg-black/40" />
      
      <div className="container mx-auto px-4 relative z-10 min-h-screen flex flex-col justify-center py-20">
        {/* Movie Info */}
        <div className="text-center mb-12 space-y-4">
          <div className="inline-block mb-4 px-6 py-2 border-2 border-blue-400/50 rounded-lg bg-black/30 backdrop-blur-sm">
            <span className="text-blue-400 font-semibold tracking-wider text-sm">
              NOW SHOWING
            </span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
            {currentMovie.title}
          </h1>
          
          <div className="flex items-center justify-center gap-6 flex-wrap text-gray-300">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
              <span className="text-xl font-semibold text-white">4.8</span>
            </div>
            <span>•</span>
            <span className="text-lg">{currentMovie.duration} min</span>
            <span>•</span>
            <span className="text-lg text-purple-400 font-medium">
              {currentMovie.genres.join(" / ")}
            </span>
          </div>
        </div>

        {/* 3D Carousel */}
        <div className="relative h-[500px] flex items-center justify-center perspective-[1000px]">
          <div className="relative w-full max-w-5xl h-full flex items-center justify-center">
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
                  <div className="relative w-72 h-96 rounded-2xl overflow-hidden shadow-2xl bg-white transform-gpu">
                    <img
                      src={movie.posterUrl}
                      alt={movie.title}
                      className="w-full h-full object-cover"
                    />
                    
                    {/* Price tag (optional) */}
                    {isCenter && (
                      <div className="absolute top-4 right-4 bg-black text-white px-4 py-2 rounded-lg font-bold text-lg">
                        $12
                      </div>
                    )}
                    
                    {/* Bottom info */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent p-6">
                      <h3 className="text-white font-bold text-xl mb-1">{movie.title}</h3>
                      <p className="text-gray-300 text-sm">{movie.year}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Navigation Buttons */}
          <button
            onClick={handlePrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-40 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white p-3 rounded-full transition-all"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          
          <button
            onClick={handleNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-40 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white p-3 rounded-full transition-all"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>

        {/* Dots Indicator */}
        <div className="flex items-center justify-center gap-2 mt-12">
          {displayMovies.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`transition-all duration-300 rounded-full ${
                index === currentIndex
                  ? "w-8 h-2 bg-blue-400"
                  : "w-2 h-2 bg-gray-600 hover:bg-gray-500"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}