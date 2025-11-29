import { useState, useEffect } from "react";
import { Star } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

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

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % featuredMovies.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const currentMovie = featuredMovies[currentIndex];

  return (
    <section id="hero" className="relative min-h-screen flex items-center justify-center bg-gradient-dark overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0">
        <motion.img
          key={currentIndex}
          src={currentMovie.image}
          alt={currentMovie.title}
          className="w-full h-full object-cover opacity-30"
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 0.3, scale: 1 }}
          transition={{ duration: 1 }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/30" />
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
            className="inline-block mb-6 px-6 py-2 border-2 border-blue-400/50 rounded-lg bg-black/30 backdrop-blur-sm"
          >
            <span className="text-blue-400 font-semibold tracking-wider">NOW SHOWING</span>
          </motion.div>

          {/* Movie Title */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="text-5xl md:text-7xl font-bold text-white mb-6"
          >
            {currentMovie.title}
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
              <span className="text-xl font-semibold text-white">{currentMovie.rating}</span>
            </div>
            <span className="text-gray-300">•</span>
            <span className="text-lg text-white">{currentMovie.duration}</span>
            <span className="text-gray-300">•</span>
            <span className="text-lg text-purple-400 font-medium">{currentMovie.genres}</span>
          </motion.div>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="text-xl text-gray-300 max-w-2xl mx-auto mb-8"
          >
            {currentMovie.description}
          </motion.p>
        </motion.div>

        {/* Carousel Indicators */}
        <div className="flex items-center justify-center gap-2 mt-12">
          {featuredMovies.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={cn(
                "w-2 h-2 rounded-full transition-all duration-300",
                index === currentIndex
                  ? "w-8 bg-blue-400"
                  : "bg-gray-600 hover:bg-gray-500"
              )}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
