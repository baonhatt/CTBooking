import { useMemo, useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  Sparkles,
  Waves,
  Clock,
  Star,
  Calendar,
  Ticket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { getAllActiveMoviesToday, getMovieById } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { movieStore } from "@/store/movieStore";
// @ts-ignore
import heroImage1 from "@/assets/images/1.PNG";
// @ts-ignore
import heroImage9 from "@/assets/images/9.PNG";
import { toast } from "@/components/ui/use-toast";
import { getSiteMediaApi } from "@/lib/api/uploads";
import { optimizeCloudinaryUrl } from "@/lib/utils";

export default function HeroSection() {
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const [currentPosterIndex, setCurrentPosterIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const navigate = useNavigate();
  const [selectedMovieId, setSelectedMovieId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [storeUpdateTrigger, setStoreUpdateTrigger] = useState(0);

  const { data } = useQuery({
    queryKey: ["activeMovies"],
    queryFn: ({ signal }) => getAllActiveMoviesToday({ signal }),
    staleTime: 60000,
  });
  const { data: heroMedia } = useQuery({
    queryKey: ["siteMedia", "hero_section"],
    queryFn: ({ signal }) =>
      getSiteMediaApi({
        section: "hero_section",
        type: "video",
        active: true,
        signal,
      }),
  });
  const heroVideoSrc = optimizeCloudinaryUrl(
    heroMedia?.items?.[0]?.url as string,
    1280,
  );

  // Use static images and map to movies from API
  const moviePosters = useMemo(() => {
    return [heroImage1, heroImage9];
  }, []);

  // Get movies from API
  const movies = useMemo(() => {
    return (data?.activeMovies || []) as any[];
  }, [data]);

  // Auto-rotate posters every 5 seconds
  useEffect(() => {
    if (moviePosters.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentPosterIndex((prev) => (prev + 1) % moviePosters.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [moviePosters.length]);

  // Pause video on mount and set preview frame
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const PREVIEW_TIME = 1; // Giây thứ 2 làm ảnh preview

    const handleLoadedMetadata = () => {
      video.currentTime = PREVIEW_TIME;
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);

    // Pause video when component mounts
    video.pause();
    setIsVideoPlaying(false);

    // If metadata is already loaded, seek immediately
    if (video.readyState >= 1) {
      video.currentTime = PREVIEW_TIME;
    }

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, [heroVideoSrc]);

  // Intersection Observer for hero video - pause when scrolled out of viewport
  useEffect(() => {
    if (!videoRef.current || !videoContainerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            // Video is out of viewport, pause it
            videoRef.current?.pause();
            setIsVideoPlaying(false);
          }
        });
      },
      {
        threshold: 0.1, // Trigger when less than 10% visible
      },
    );

    observer.observe(videoContainerRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  // Toggle play/pause function
  const toggleVideoPlayback = async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      if (video.paused) {
        await video.play();
        setIsVideoPlaying(true);
      } else {
        video.pause();
        setIsVideoPlaying(false);
      }
    } catch (error) {
      console.error("Error toggling video playback:", error);
    }
  };

  const currentPoster = moviePosters[currentPosterIndex];
  const currentMovie = movies[currentPosterIndex] || null;

  const onMove = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    const { clientX, clientY, currentTarget } = e;
    const rect = currentTarget.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width - 0.5) * 20;
    const y = ((clientY - rect.top) / rect.height - 0.5) * 20;
    setPointer({ x, y });
  };

  const handlePosterClick = async (index: number) => {
    const movie = movies[index];
    if (!movie || !movie.id) return;

    setSelectedMovieId(movie.id);
    setIsModalOpen(true);

    // Check if movie is in store, if not fetch and store it
    const cachedMovie = movieStore.getMovie(movie.id);
    if (!cachedMovie) {
      setIsLoadingDetails(true);
      try {
        const details = await getMovieById(movie.id);
        if (details) {
          movieStore.setMovie(details);
          setStoreUpdateTrigger((prev) => prev + 1);
        }
      } catch (error) {
        console.error(`Failed to fetch details for movie ${movie.id}:`, error);
      } finally {
        setIsLoadingDetails(false);
      }
    }
  };

  // Get movie details from store
  const movieDetails = useMemo(() => {
    if (!selectedMovieId) return null;
    return movieStore.getMovie(selectedMovieId);
  }, [selectedMovieId, storeUpdateTrigger]);

  const handleBookTicket = () => {
    if (!movieDetails) return;
    try {
      const movie = movies.find((m: any) => m.id === movieDetails.id);
      if (movie) {
        localStorage.setItem(
          "selectedFilm",
          JSON.stringify({
            id: movie.id,
            title: movie.title,
            poster: movie.cover_image,
          }),
        );
      }
    } catch {}
    setIsModalOpen(false);
    navigate("/booking");
  };

  return (
    <section
      id="hero"
      className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#050915] via-[#0b1226] to-[#0e1b3d] text-white pt-24"
      onMouseMove={onMove}
    >
      {/* Gradient overlays */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.4),transparent_30%),radial-gradient(circle_at_80%_30%,rgba(236,72,153,0.3),transparent_35%),radial-gradient(circle_at_50%_70%,rgba(34,211,238,0.35),transparent_30%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/50 to-[#050915]/95" />
        <div className="absolute inset-0 neon-noise opacity-30" />
      </div>

      {/* Animated background blobs */}
      <div className="absolute -left-24 top-10 w-[520px] h-[520px] rounded-full bg-cyan-500/15 blur-[120px] animate-pulse" />
      <motion.div
        className="absolute -right-16 top-32 w-[420px] h-[420px] rounded-full bg-fuchsia-500/15 blur-[120px]"
        animate={{
          x: pointer.x * -0.5,
          y: pointer.y * -0.5,
        }}
        transition={{ type: "spring", stiffness: 50, damping: 20 }}
      />

      <div className="container mx-auto px-4 relative z-10 min-h-[calc(100vh-6rem)] flex flex-col justify-center py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="max-w-3xl space-y-6"
          >
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-6xl md:text-6xl lg:text-7xl font-extrabold leading-none tracking-tight flex flex-col gap-2"
            >
              <span className="bg-gradient-to-r from-cyan-300 via-blue-400 to-fuchsia-400 bg-clip-text text-transparent drop-shadow-[0_10px_40px_rgba(56,189,248,0.5)] py-2">
                CINESPHERE
              </span>
              <span className="text-white text-3xl md:text-3xl lg:text-5xl">
                Huyễn cảnh không gian
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-lg md:text-xl text-gray-200 leading-relaxed max-w-2xl"
            >
              Dùng không gian nhỏ mô phỏng thế giới vô biên. Mỗi suất chiếu là
              một hành trình nhập vai với độ phân giải 8K và âm thanh đa tầng
              bao quanh
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="flex flex-wrap items-center gap-4 pt-2"
            >
              <Button
                className="group rounded-2xl px-9 py-8 text-base md:text-lg font-semibold bg-gradient-to-r from-cyan-400 via-blue-600 to-fuchsia-500 hover:from-fuchsia-500 hover:via-cyan-400 hover:to-blue-600 text-white shadow-[0_0_40px_rgba(59,130,246,0.6)] transition-all duration-500 hover:shadow-[0_0_60px_rgba(236,72,153,0.8)] hover:scale-105"
                onClick={() => {
                  const bookingSection = document.getElementById("promotions");
                  bookingSection?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                <span className="flex items-center gap-2">
                  Đặt vé ngay
                  <Play className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </span>
              </Button>
            </motion.div>

            {/* Feature Cards */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl pt-4"
            >
              {[
                {
                  icon: Waves,
                  title: "Âm thanh đa tầng",
                  desc: "Định vị 360° bao quanh",
                },
                {
                  icon: Sparkles,
                  title: "Hiệu ứng vũ trụ",
                  desc: "Hào quang, photon, nebula",
                },
                {
                  icon: Play,
                  title: "Độ phân giải 8K",
                  desc: "Màn hình đa chiều siêu nét",
                },
              ].map(({ icon: Icon, title, desc }, idx) => (
                <motion.div
                  key={title}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 + idx * 0.1, duration: 0.45 }}
                  whileHover={{ scale: 1.05, y: -5 }}
                  className="glass-tile rounded-2xl p-5 border border-white/15 bg-white/10 backdrop-blur-md hover:border-cyan-300/50 transition-all duration-300 cursor-pointer"
                  style={{
                    transform: `translate(${pointer.x * 0.08}px, ${pointer.y * 0.08}px)`,
                  }}
                >
                  <div className="flex flex-col gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-400/80 to-fuchsia-500/80 flex items-center justify-center shadow-lg">
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-white mb-1">{title}</p>
                      <p className="text-sm text-gray-300">{desc}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>

          {/* Right Video Section */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
            className="relative hidden lg:block z-40"
          >
            <div
              ref={videoContainerRef}
              className="relative w-full max-w-md mx-auto aspect-[9/16] rounded-3xl overflow-hidden border-2 border-white/20 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl shadow-2xl group"
            >
              {/* Video Container */}
              <div className="absolute inset-0">
                <video
                  ref={videoRef}
                  src={heroVideoSrc}
                  className="w-full h-full object-cover"
                  loop
                  playsInline
                  preload="auto"
                  muted={false}
                  onPlay={() => setIsVideoPlaying(true)}
                  onPause={() => setIsVideoPlaying(false)}
                />
                {/* Video overlay gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-80" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/40" />

                {/* Play/Pause button overlay */}
                <button
                  onClick={toggleVideoPlayback}
                  className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/10 transition-colors z-20 group/play"
                  aria-label={isVideoPlaying ? "Pause video" : "Play video"}
                >
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{
                      scale: isVideoPlaying ? 0 : 1,
                      opacity: isVideoPlaying ? 0 : 1,
                    }}
                    transition={{ duration: 0.2 }}
                    className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border-2 border-white/30 shadow-xl group-hover/play:scale-110 transition-transform"
                  >
                    <Play className="h-10 w-10 text-white ml-1" fill="white" />
                  </motion.div>
                </button>
              </div>

              {/* Decorative elements */}
              <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-30">
                <div className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_10px_rgba(34,197,94,0.8)] animate-pulse" />
                <div className="px-3 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/20">
                  <span className="text-xs text-white font-medium">LIVE</span>
                </div>
              </div>

              {/* Bottom info */}
              <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-tto-transparent z-30">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br flex items-center justify-center">
                      <Play className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">
                        Experience 8K
                      </p>
                      <p className="text-gray-300 text-xs">Cinematic Quality</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Glow effect on hover */}
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-fuchsia-500/0 to-cyan-500/0 group-hover:from-cyan-500/20 group-hover:via-fuchsia-500/20 group-hover:to-cyan-500/20 transition-all duration-500 pointer-events-none" />
            </div>

            {/* Poster indicators */}
            {/* {moviePosters.length > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                {moviePosters.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setCurrentPosterIndex(index);
                      handlePosterClick(index);
                    }}
                    className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${index === currentPosterIndex
                      ? "w-8 bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]"
                      : "w-2 bg-white/30 hover:bg-white/50"
                      }`}
                    aria-label={`Go to poster ${index + 1}`}
                  />
                ))}
              </div>
            )} */}
          </motion.div>
        </div>
      </div>

      {/* Movie Details Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col bg-gradient-to-br from-[#0b1226] via-[#0e1b3d] to-[#050915] border border-cyan-500/30 text-white p-0 shadow-[0_0_50px_rgba(59,130,246,0.3)]">
          <div className="overflow-y-auto scrollbar-neon flex-1 px-6 pt-6 pb-4">
            {!movieDetails ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-400 mx-auto mb-4"></div>
                  <p className="text-gray-400">Đang tải thông tin phim...</p>
                </div>
              </div>
            ) : (
              <>
                <DialogHeader className="mb-4">
                  <DialogTitle className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-blue-400 to-fuchsia-400 mb-2">
                    {movieDetails.title}
                  </DialogTitle>
                  <DialogDescription className="text-gray-300 text-sm">
                    {(() => {
                      try {
                        const genres = Array.isArray(movieDetails.genres)
                          ? movieDetails.genres
                          : typeof movieDetails.genres === "string"
                            ? JSON.parse(movieDetails.genres)
                            : [];
                        return Array.isArray(genres) && genres.length > 0
                          ? genres.join(" • ")
                          : "Chưa phân loại";
                      } catch {
                        return "Chưa phân loại";
                      }
                    })()}
                  </DialogDescription>
                </DialogHeader>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Movie Poster */}
                  <div className="relative rounded-xl overflow-hidden border border-cyan-500/30 aspect-[2/3] shadow-[0_0_30px_rgba(59,130,246,0.2)]">
                    <img
                      src={
                        movieDetails.cover_image ||
                        "https://images.unsplash.com/photo-1464375117522-1311d6a5b81f?auto=format&fit=crop&w=900&q=80"
                      }
                      alt={movieDetails.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                  </div>

                  {/* Movie Info */}
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-base font-semibold text-cyan-300 mb-2 flex items-center gap-2">
                        <span className="w-1 h-4 bg-gradient-to-b from-cyan-400 to-blue-500 rounded-full"></span>
                        Mô tả
                      </h3>
                      <p className="text-gray-300 leading-relaxed text-sm">
                        {movieDetails.description ||
                          "Chưa có mô tả cho bộ phim này."}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                      {movieDetails.rating !== null &&
                        movieDetails.rating !== undefined && (
                          <div className="flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-white/10">
                            <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                            <span className="text-white font-medium text-sm">
                              {movieDetails.rating.toFixed(1)} / 10
                            </span>
                          </div>
                        )}
                      {movieDetails.duration_min && (
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-white/10">
                          <Clock className="h-4 w-4 text-cyan-400" />
                          <span className="text-white font-medium text-sm">
                            {movieDetails.duration_min} phút
                          </span>
                        </div>
                      )}
                      {movieDetails.release_date && (
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-white/10">
                          <Calendar className="h-4 w-4 text-fuchsia-400" />
                          <span className="text-white font-medium text-sm">
                            {new Date(
                              movieDetails.release_date,
                            ).toLocaleDateString("vi-VN")}
                          </span>
                        </div>
                      )}
                    </div>

                    {movieDetails.stats && (
                      <div className="pt-4 border-t border-white/10">
                        <h4 className="text-sm font-semibold text-cyan-300 mb-3 flex items-center gap-2">
                          <span className="w-1 h-4 bg-gradient-to-b from-cyan-400 to-blue-500 rounded-full"></span>
                          Thống kê
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                            <div className="text-xs text-gray-400 mb-1">
                              Vé đã bán
                            </div>
                            <div className="text-lg font-bold text-cyan-300">
                              {movieDetails.stats.totalTicketsSold}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Fixed Footer with Buttons */}
          {movieDetails && (
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/10 bg-gradient-to-br from-[#0b1226] via-[#0e1b3d] to-[#050915] shrink-0">
              <Button
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                className="border-white/20 text-white hover:bg-white/10 hover:text-white hover:border-cyan-400/50 transition-all"
              >
                Đóng
              </Button>
              <Button
                onClick={handleBookTicket}
                className="bg-gradient-to-r from-cyan-400 via-blue-600 to-fuchsia-500 hover:from-fuchsia-500 hover:via-cyan-400 hover:to-blue-600 text-white font-semibold shadow-[0_0_30px_rgba(59,130,246,0.4)] hover:shadow-[0_0_40px_rgba(236,72,153,0.6)] transition-all duration-300 hover:scale-105"
              >
                <Ticket className="h-4 w-4 mr-2" />
                Đặt vé ngay
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
