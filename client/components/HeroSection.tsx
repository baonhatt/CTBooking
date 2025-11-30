import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi,
} from "@/components/ui/carousel";
import { useQuery } from "@tanstack/react-query";
import { getAllActiveMoviesToday } from "@/lib/api";

export default function HeroSection() {
  const [api, setApi] = useState<CarouselApi | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const { data } = useQuery({ queryKey: ["activeMovies", "today"], queryFn: ({ signal }) => getAllActiveMoviesToday({ signal }) });
  const movies = (data?.activeMovies || []).map((m) => {
    let genres: string[] = [];
    try {
      const parsed = JSON.parse(m.genres);
      if (Array.isArray(parsed)) genres = parsed as string[];
    } catch {}
    const id = m.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const year = new Date(m.release_date as any).getFullYear();
    return {
      id,
      title: m.title,
      year,
      duration: `${m.duration_min} phút`,
      genres,
      posterUrl: m.cover_image,
    };
  });

  const displayMovies = movies;

  useEffect(() => {
    if (!api) return;
    const updateIndex = () => setCurrentIndex(api.selectedScrollSnap());
    updateIndex();
    api.on("select", updateIndex);
    api.on("reInit", updateIndex);
    return () => {
      api.off("select", updateIndex);
      api.off("reInit", updateIndex);
    };
  }, [api]);

  useEffect(() => {
    if (!api) return;
    const interval = setInterval(() => api.scrollNext(), 5000);
    return () => clearInterval(interval);
  }, [api]);

  return (
    <section id="hero" className="relative min-h-[70vh] md:min-h-screen bg-gradient-dark overflow-hidden">
      <Carousel setApi={setApi} opts={{ loop: true }} className="w-full h-[70vh] md:h-screen">
        <CarouselContent>
          {displayMovies.map((m, idx) => (
            <CarouselItem key={m.id} className="relative h-screen flex items-center">
              <div className="absolute inset-0">
                <motion.img
                  key={idx}
                  src={m.posterUrl}
                  alt={m.title}
                  className="w-full h-full object-cover opacity-30"
                  initial={{ opacity: 0, scale: 1.1 }}
                  animate={{ opacity: 0.3, scale: 1 }}
                  transition={{ duration: 1 }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/30" />
              </div>
              <div className="container mx-auto px-4 relative z-10 w-full">
                <motion.div
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8 }}
                  className="max-w-4xl mx-auto text-center"
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2, duration: 0.5 }}
                    className="inline-block mb-6 px-6 py-2 border-2 border-blue-400/50 rounded-lg bg-black/30 backdrop-blur-sm"
                  >
                    <span className="text-blue-400 font-semibold tracking-wider">NOW SHOWING</span>
                  </motion.div>
                  <motion.h1
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.6 }}
                    className="text-3xl md:text-7xl font-bold text-white mb-6"
                  >
                    {m.title}
                  </motion.h1>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5, duration: 0.6 }}
                    className="flex items-center justify-center gap-6 mb-4 flex-wrap"
                  >
                    <div className="flex items-center gap-2">
                      <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
                      <span className="text-xl font-semibold text-white">4.8</span>
                    </div>
                    <span className="text-gray-300">•</span>
                    <span className="text-lg text-white">{m.duration}</span>
                    <span className="text-gray-300">•</span>
                    <span className="text-lg text-purple-400 font-medium">{Array.isArray((m as any).genres) ? (m as any).genres.join(" / ") : (m as any).genres}</span>
                  </motion.div>
                </motion.div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="text-white border-white/20 hover:border-blue-400" />
        <CarouselNext className="text-white border-white/20 hover:border-blue-400" />
      </Carousel>

      <div className="container mx-auto px-4 py-6 absolute bottom-4 md:bottom-10 left-0 right-0">
        <div className="flex items-center justify-center gap-2">
          {displayMovies.map((_, index) => (
            <button
              key={index}
              onClick={() => api?.scrollTo(index)}
              className={cn(
                "w-2 h-2 rounded-full transition-all duration-300",
                index === currentIndex ? "w-8 bg-blue-400" : "bg-gray-600 hover:bg-gray-500",
              )}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
