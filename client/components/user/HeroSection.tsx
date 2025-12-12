import { useMemo, useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, Sparkles, Waves } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroVideo from "@/assets/videos/video.mp4";
// @ts-ignore
import heroImage1 from "@/assets/images/1.PNG";
// @ts-ignore
import heroImage9 from "@/assets/images/9.PNG";

export default function HeroSection() {
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const [currentPosterIndex, setCurrentPosterIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  // Use static images instead of API
  const moviePosters = useMemo(() => {
    return [heroImage1, heroImage9];
  }, []);

  // Auto-rotate posters every 5 seconds
  useEffect(() => {
    if (moviePosters.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentPosterIndex((prev) => (prev + 1) % moviePosters.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [moviePosters.length]);

  // Pause video on mount
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Pause video when component mounts
    video.pause();
    setIsVideoPlaying(false);
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

  const onMove = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    const { clientX, clientY, currentTarget } = e;
    const rect = currentTarget.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width - 0.5) * 20;
    const y = ((clientY - rect.top) / rect.height - 0.5) * 20;
    setPointer({ x, y });
  };

  return (
    <section
      id="hero"
      className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#050915] via-[#0b1226] to-[#0e1b3d] text-white pt-24"
      onMouseMove={onMove}
    >
      {/* Dynamic Background Images */}
      <div className="absolute inset-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPosterIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
            className="absolute inset-0"
          >
            <img
              src={currentPoster}
              alt="Cinematic backdrop"
              className="w-full h-full object-cover"
            />
          </motion.div>
        </AnimatePresence>
        
        {/* Gradient overlays */}
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
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 backdrop-blur-md shadow-lg"
            >
              <Sparkles className="h-4 w-4 text-cyan-300 animate-pulse" />
              <span className="uppercase tracking-[0.32em] text-xs text-gray-100 font-medium">
                CINESPHERE
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-4xl md:text-6xl lg:text-7xl font-extrabold leading-tight tracking-tight"
            >
              <span className="bg-gradient-to-r from-cyan-300 via-blue-400 to-fuchsia-400 bg-clip-text text-transparent drop-shadow-[0_10px_40px_rgba(56,189,248,0.5)]">
                CINESPHERE
              </span>
              <br />
              <span className="text-white">Viễn cảnh không gian</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-lg md:text-xl text-gray-200 leading-relaxed max-w-2xl"
            >
              Chạm vào vũ trụ riêng của bạn. Mỗi suất chiếu là một hành trình nhập vai
              với độ phân giải 8K và âm thanh đa tầng bao quanh, mở ra thế giới vô biên ngay
              trong không gian nhỏ.
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
                  const bookingSection = document.getElementById("films");
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
                { icon: Waves, title: "Âm thanh đa tầng", desc: "Định vị 360° bao quanh" },
                { icon: Sparkles, title: "Hiệu ứng vũ trụ", desc: "Hào quang, photon, nebula" },
                { icon: Play, title: "Độ phân giải 8K", desc: "Màn hình đa chiều siêu nét" },
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
            <div className="relative w-full max-w-md mx-auto aspect-[9/16] rounded-3xl overflow-hidden border-2 border-white/20 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl shadow-2xl group">
              {/* Video Container */}
              <div className="absolute inset-0">
                <video
                  ref={videoRef}
                  src={heroVideo}
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
                      opacity: isVideoPlaying ? 0 : 1 
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
                      <p className="text-white font-semibold text-sm">Experience 8K</p>
                      <p className="text-gray-300 text-xs">Cinematic Quality</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Glow effect on hover */}
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-fuchsia-500/0 to-cyan-500/0 group-hover:from-cyan-500/20 group-hover:via-fuchsia-500/20 group-hover:to-cyan-500/20 transition-all duration-500 pointer-events-none" />
            </div>

            {/* Poster indicators */}
            {moviePosters.length > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                {moviePosters.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentPosterIndex(index)}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      index === currentPosterIndex
                        ? "w-8 bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]"
                        : "w-2 bg-white/30 hover:bg-white/50"
                    }`}
                    aria-label={`Go to poster ${index + 1}`}
                  />
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
