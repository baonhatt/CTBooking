import { useState, useEffect } from "react";

import { Star, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useMovies2025 } from "@/hooks/useMovies";

const featuredMovies = [
  {
    id: 1,
    title: "Kỷ Jura Trỗi Dậy",
    rating: 4.9,
    duration: "12 phút",
    genres: "Action / Thriller",
    image: "https://images.unsplash.com/photo-1446776653964-20c1d3a81b06?w=1200&h=800&fit=crop",
    description: "Đối mặt với khủng long bạo chúa trong rừng rậm nguyên sinh.",
  },
  {
    id: 2,
    title: "Ocean Depths",
    rating: 4.8,
    duration: "15 phút",
    genres: "Adventure / Sci-Fi",
    image: "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=1200&h=800&fit=crop",
    description: "Lặn sâu vào đại dương với trải nghiệm chân thực nhất",
  },
  {
    id: 3,
    title: "Mountain Adventure",
    rating: 4.9,
    duration: "10 phút",
    genres: "Adventure / Nature",
    image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&h=800&fit=crop",
    description: "Chinh phục đỉnh núi cao với cảm giác như thật",
  },
  {
    id: 4,
    title: "City Lights",
    rating: 4.7,
    duration: "14 phút",
    genres: "Sci-Fi / Action",
    image: "https://images.unsplash.com/photo-1514565131-fce0801e5785?w=1200&h=800&fit=crop",
    description: "Bay qua thành phố về đêm với ánh sáng rực rỡ",
  },
];

export default function HeroSection() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const { data: apiMovies = [] } = useMovies2025();

  useEffect(() => {
    const interval = setInterval(() => {
      const len = apiMovies.length ? apiMovies.length : featuredMovies.length;
      setCurrentIndex((prev) => (prev + 1) % len);
    }, 5000);
    return () => clearInterval(interval);
  }, [apiMovies]);

  // movies fetched via React Query; no manual effect needed
  const isApi = apiMovies.length > 0;
  const listLength = isApi ? apiMovies.length : featuredMovies.length;
  const idx = currentIndex % listLength;
  const imageSrc = isApi ? apiMovies[idx].posterUrl : featuredMovies[idx].image;
  const titleText = isApi ? apiMovies[idx].title : featuredMovies[idx].title;
  const durationText = isApi ? apiMovies[idx].duration : featuredMovies[idx].duration;
  const genresText = isApi ? apiMovies[idx].genres.join(" / ") : featuredMovies[idx].genres;
  const descText = isApi ? "" : featuredMovies[idx].description;
  const ratingValue = 4.8;

  return (
    <section id="hero" className="relative min-h-screen flex items-center justify-center bg-gradient-dark overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0">
        <motion.img
          key={currentIndex}
          src={imageSrc}
          alt={titleText}
          className="w-full h-full object-cover opacity-50"
          initial={{ opacity: 0, scale: 1.08 }}
          animate={{ opacity: 0.5, scale: 1 }}
          transition={{ duration: 1 }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/25 to-transparent" />
      </div>
      
      {/* Content */}
      <div className="container mx-auto px-4 py-20 relative z-10">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-4xl mx-auto text-center"
        >
          {/* NOW SHOWING Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="inline-block mb-6 px-6 py-2 border-2 border-cyan-400/60 rounded-lg bg-black/20 backdrop-blur-sm shadow-[0_0_20px_rgba(34,211,238,0.25)]"
          >
            <span className="text-cyan-400 font-semibold tracking-wider">NOW SHOWING</span>
          </motion.div>

          {/* Movie Title */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-cyan-300 via-sky-400 to-fuchsia-400 bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(99,102,241,0.35)] mb-6"
          >
            {titleText}
          </motion.h1>

          {/* Movie Details */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="flex items-center justify-center gap-6 mb-4 flex-wrap"
          >
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
              <span className="text-xl font-semibold text-white">{ratingValue}</span>
            </div>
            <span className="text-gray-300">•</span>
            <span className="text-lg text-cyan-300">{durationText}</span>
            <span className="text-gray-300">•</span>
            <span className="text-lg text-fuchsia-400 font-medium">{genresText}</span>
          </motion.div>

          {descText && (
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.6 }}
              className="text-xl text-gray-300 max-w-2xl mx-auto mb-8"
            >
              {descText}
            </motion.p>
          )}
        </motion.div>

        {/* Carousel Controls & Indicators */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-6 top-1/2 -translate-y-1/2 bg-black/30 border border-white/20 text-white hover:bg-cyan-500/20 hover:border-cyan-400/60 backdrop-blur-sm"
          onClick={() => setCurrentIndex((prev) => (prev - 1 + listLength) % listLength)}
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-6 top-1/2 -translate-y-1/2 bg-black/30 border border-white/20 text-white hover:bg-fuchsia-500/20 hover:border-fuchsia-400/60 backdrop-blur-sm"
          onClick={() => setCurrentIndex((prev) => (prev + 1) % listLength)}
        >
          <ChevronRight />
        </Button>
        <div className="flex items-center justify-center gap-2 mt-12">
          {Array.from({ length: listLength }).map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={cn(
                "w-3 h-3 rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(34,211,238,0.35)]",
                index === currentIndex
                  ? "w-10 bg-cyan-400"
                  : "bg-gray-500/70 hover:bg-gray-400"
              )}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
