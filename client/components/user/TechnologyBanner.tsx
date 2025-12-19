import { motion } from "framer-motion";
import { Play, Pause, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { cn, optimizeCloudinaryUrl } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { getSiteMediaApi } from "@/lib/api/uploads";
import useEmblaCarousel from "embla-carousel-react";
import type { EmblaCarouselType } from "embla-carousel";

// Decorative space elements
const spaceElements = [
  { id: 1, size: "w-32 h-32", position: "top-20 left-4", delay: 0, duration: 8 },
  { id: 2, size: "w-24 h-24", position: "top-40 left-8", delay: 1, duration: 10 },
  { id: 3, size: "w-20 h-20", position: "top-60 left-12", delay: 2, duration: 12 },
  { id: 4, size: "w-28 h-28", position: "top-80 left-6", delay: 0.5, duration: 9 },
  { id: 5, size: "w-36 h-36", position: "top-20 right-4", delay: 1.5, duration: 11 },
  { id: 6, size: "w-24 h-24", position: "top-40 right-8", delay: 2.5, duration: 13 },
  { id: 7, size: "w-20 h-20", position: "top-60 right-12", delay: 0.8, duration: 10 },
  { id: 8, size: "w-32 h-32", position: "top-80 right-6", delay: 1.2, duration: 9 },
];

const preview1 = "";
const preview2 = "";
const preview3 = "";
const preview4 = "";
const preview5 = "";

const videoPreviews = [];

// Video/Hình ảnh chính bên trái
const mainVisualDefault = {
  type: "video" as const,
  src: preview5,
};

export default function TechnologyBanner() {
  const { data: techMain } = useQuery({
    queryKey: ["siteMedia", "technology_section1"],
    queryFn: ({ signal }) =>
      getSiteMediaApi({
        section: "technology_section1",
        type: "video",
        active: true,
        signal,
      }),
  });
  const { data: techList } = useQuery({
    queryKey: ["siteMedia", "technology_section2"],
    queryFn: ({ signal }) =>
      getSiteMediaApi({
        section: "technology_section2",
        type: "video",
        active: true,
        signal,
      }),
  });
  const mainVisual = {
    type: "video" as const,
    src: optimizeCloudinaryUrl((techMain?.items?.[0]?.url as string) || mainVisualDefault.src, 1280),
  };
  const videoPreviewsDb = Array.isArray(techList?.items)
    ? techList!.items.map((it: any) => ({
        src: optimizeCloudinaryUrl(it.url as string, 640),
        title: it.title || "Video",
        description: it.description || "",
      }))
    : [];
  const videoPreviewsMerged =
    videoPreviewsDb.length > 0 ? videoPreviewsDb : videoPreviews;
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);
  const videoRefs = useRef<HTMLVideoElement[]>([]);
  const mainVideoRef = useRef<HTMLVideoElement | null>(null);
  const mainVideoContainerRef = useRef<HTMLDivElement | null>(null);
  const [mainAspect, setMainAspect] = useState<number | null>(null);
  const [isMainVideoPlaying, setIsMainVideoPlaying] = useState(false);
  const [durations, setDurations] = useState<number[]>([]);
  const [progresses, setProgresses] = useState<number[]>([]);
  const [playingArr, setPlayingArr] = useState<boolean[]>([]);
  
  // Initialize arrays based on videoPreviewsMerged length
  useEffect(() => {
    const n = videoPreviewsMerged.length || videoPreviews.length;
    setDurations(Array(n).fill(0));
    setProgresses(Array(n).fill(0));
    setPlayingArr(Array(n).fill(false));
  }, [videoPreviewsMerged.length]);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  
  const formatTime = (s: number) => {
    if (!isFinite(s) || s <= 0) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec < 10 ? "0" : ""}${sec}`;
  };
  
  // Embla Carousel setup with optimized options for mobile
  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      align: "start",
      dragFree: false,
      containScroll: "trimSnaps",
      slidesToScroll: 1,
      breakpoints: {
        "(min-width: 640px)": { slidesToScroll: 1 },
        "(min-width: 1024px)": { slidesToScroll: 2 },
        "(min-width: 1280px)": { slidesToScroll: 3 },
      },
    },
    []
  );

  // Update scroll buttons state
  const onSelect = useCallback((emblaApi: EmblaCarouselType) => {
    if (!emblaApi) return;
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, []);

  // Setup Embla event listeners
  useEffect(() => {
    if (!emblaApi) return;
    
    onSelect(emblaApi);
    emblaApi.on("reInit", onSelect);
    emblaApi.on("select", onSelect);
    
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, onSelect]);

  // Navigation handlers
  const scrollPrev = useCallback(() => {
    emblaApi?.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    emblaApi?.scrollNext();
  }, [emblaApi]);

  // Pause videos that are not visible in carousel
  useEffect(() => {
    if (!emblaApi) return;
    
    const slidesInView = emblaApi.slidesInView();
    
    videoRefs.current.forEach((el, i) => {
      if (!el) return;
      if (!slidesInView.includes(i)) {
        el.pause();
        setPlayingArr((prev) => {
          const arr = [...prev];
          arr[i] = false;
          return arr;
        });
      }
    });
  }, [emblaApi]);

  // Intersection Observer for carousel videos - pause when scrolled out of viewport
  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    
    videoRefs.current.forEach((el, i) => {
      if (!el) return;
      
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) {
              // Video is out of viewport, pause it
              el.pause();
              setPlayingArr((prev) => {
                const arr = [...prev];
                arr[i] = false;
                return arr;
              });
            }
          });
        },
        {
          threshold: 0.1, // Trigger when less than 10% visible
        }
      );
      
      observer.observe(el);
      observers.push(observer);
    });
    
    return () => {
      observers.forEach((observer) => observer.disconnect());
    };
  }, [videoPreviewsMerged.length]);

  // Intersection Observer for main video - pause when scrolled out of viewport
  useEffect(() => {
    if (!mainVideoRef.current || !mainVideoContainerRef.current) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            // Main video is out of viewport, pause it
            mainVideoRef.current?.pause();
            setIsMainVideoPlaying(false);
          }
        });
      },
      {
        threshold: 0.1, // Trigger when less than 10% visible
      }
    );
    
    observer.observe(mainVideoContainerRef.current);
    
    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (playingVideo === "main") {
      mainVideoRef.current?.play().catch(() => {});
    }
  }, [playingVideo]);
  
  const onMainLoadedMetadata = () => {
    const el = mainVideoRef.current;
    if (!el) return;
    const w = (el as any).videoWidth || 0;
    const h = (el as any).videoHeight || 0;
    if (w > 0 && h > 0) setMainAspect(w / h);
    el.currentTime = 1;
  };

  useEffect(() => {
    const el = mainVideoRef.current;
    if (el && el.readyState >= 1) {
      el.currentTime = 0.5;
    }
  }, [mainVisual.src]);

  const toggleMainVideo = () => {
    const el = mainVideoRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().catch(() => {});
      setIsMainVideoPlaying(true);
    } else {
      el.pause();
      setIsMainVideoPlaying(false);
    }
  };

  const togglePlay = (i: number) => {
    const el = videoRefs.current[i];
    if (!el) return;
    if (el.paused) {
      videoRefs.current.forEach((v, k) => {
        if (v && k !== i) v.pause();
      });
      el.muted = false;
      el.play().catch(() => {});
      {
        const n = videoPreviewsMerged.length || videoPreviews.length;
        setPlayingArr(Array(n).fill(false).map((_, idx) => idx === i));
      }
    } else {
      el.pause();
      setPlayingArr((prev) => {
        const arr = [...prev];
        arr[i] = false;
        return arr;
      });
    }
  };

  const onLoadedMetadata = (i: number) => {
    const el = videoRefs.current[i];
    if (!el) return;
    setDurations((prev) => {
      const arr = [...prev];
      arr[i] = el.duration || 0;
      return arr;
    });
  };

  const onTimeUpdate = (i: number) => {
    const el = videoRefs.current[i];
    if (!el) return;
    setProgresses((prev) => {
      const arr = [...prev];
      arr[i] = el.currentTime || 0;
      return arr;
    });
  };

  const onSeek = (i: number, value: number) => {
    const el = videoRefs.current[i];
    if (!el) return;
    el.currentTime = value;
    setProgresses((prev) => {
      const arr = [...prev];
      arr[i] = value;
      return arr;
    });
  };

  return (
    <section
      id="technology"
      className="relative py-24 bg-gradient-to-b from-[#060915] via-[#0b1426] to-[#0f1d3a] overflow-hidden"
    >
      <div className="absolute inset-0 neon-noise opacity-50 pointer-events-none" />
      <div className="absolute -left-10 top-16 w-72 h-72 bg-cyan-500/20 blur-[120px]" />
      <div className="absolute right-0 bottom-10 w-80 h-80 bg-purple-500/20 blur-[130px]" />

      {/* Decorative Space Elements - Left Side */}
      <div className="absolute inset-0 pointer-events-none hidden lg:block">
        {spaceElements.slice(0, 4).map((element) => (
          <motion.div
            key={`left-${element.id}`}
            className={`absolute ${element.position} ${element.size} opacity-30`}
            animate={{
              y: [0, -20, 0],
              x: [0, 10, 0],
              rotate: [0, 180, 360],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: element.duration,
              repeat: Infinity,
              ease: "easeInOut",
              delay: element.delay,
            }}
          >
            {/* Planet/Celestial Body */}
            <div className="w-full h-full rounded-full bg-gradient-to-br from-cyan-400/40 via-blue-500/30 to-purple-500/40 relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.3),transparent)]" />
              <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-white/60 rounded-full blur-sm" />
              <div className="absolute top-1/3 right-1/4 w-1.5 h-1.5 bg-white/40 rounded-full blur-sm" />
              {/* Rings for some planets */}
              {element.id % 2 === 0 && (
                <div className="absolute inset-0 border-2 border-cyan-300/20 rounded-full" style={{ transform: 'scale(1.2)' }} />
              )}
            </div>
          </motion.div>
        ))}

        {/* Stars/Sparkles */}
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={`star-left-${i}`}
            className="absolute w-1 h-1 bg-cyan-300 rounded-full"
            style={{
              left: `${5 + (i % 4) * 3}%`,
              top: `${20 + Math.floor(i / 4) * 25}%`,
            }}
            animate={{
              opacity: [0.3, 1, 0.3],
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: 2 + (i % 3),
              repeat: Infinity,
              delay: i * 0.2,
            }}
          />
        ))}

        {/* Decorative Space Elements - Right Side */}
        {spaceElements.slice(4, 8).map((element) => (
          <motion.div
            key={`right-${element.id}`}
            className={`absolute ${element.position} ${element.size} opacity-30`}
            animate={{
              y: [0, -20, 0],
              x: [0, -10, 0],
              rotate: [0, -180, -360],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: element.duration,
              repeat: Infinity,
              ease: "easeInOut",
              delay: element.delay,
            }}
          >
            {/* Planet/Celestial Body */}
            <div className="w-full h-full rounded-full bg-gradient-to-br from-purple-400/40 via-pink-500/30 to-fuchsia-500/40 relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.3),transparent)]" />
              <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-white/60 rounded-full blur-sm" />
              <div className="absolute top-1/3 right-1/4 w-1.5 h-1.5 bg-white/40 rounded-full blur-sm" />
              {/* Rings for some planets */}
              {element.id % 2 === 1 && (
                <div className="absolute inset-0 border-2 border-purple-300/20 rounded-full" style={{ transform: 'scale(1.2)' }} />
              )}
            </div>
          </motion.div>
        ))}

        {/* Stars/Sparkles - Right Side */}
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={`star-right-${i}`}
            className="absolute w-1 h-1 bg-purple-300 rounded-full"
            style={{
              right: `${5 + (i % 4) * 3}%`,
              top: `${20 + Math.floor(i / 4) * 25}%`,
            }}
            animate={{
              opacity: [0.3, 1, 0.3],
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: 2 + (i % 3),
              repeat: Infinity,
              delay: i * 0.2,
            }}
          />
        ))}

        {/* Nebula/Cloud Effects */}
        <motion.div
          className="absolute top-1/4 left-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl"
          animate={{
            x: [0, 30, 0],
            y: [0, -20, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute top-1/3 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl"
          animate={{
            x: [0, -30, 0],
            y: [0, 20, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="text-center mb-16 max-w-4xl mx-auto"
        >
          <p className="text-sm uppercase tracking-[0.28em] text-cyan-200 mb-4">
            CINESPHERE EXPERIENCE
          </p>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold mb-6 lg:leading-[1.25]">
            <span className="bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">
              Chạm tới Vô Cực
            </span>{" "}
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              cùng Vũ Trụ Đa Chiều 8K
            </span>
          </h2>
          <p className="text-lg md:text-xl whitespace-break-spaces text-gray-200 leading-relaxed">
            Chào mừng bạn đến với Huyễn Cảnh Không Gian, nơi những giới hạn về vật lý bị xóa nhòa để nhường chỗ cho những trải nghiệm thị giác đỉnh cao. Không đơn thuần là một phòng chiếu phim, đây là "cánh cửa thần kỳ" đưa bạn bước vào những chiều không gian mà thực tại chưa bao giờ chạm tới.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="max-w-6xl mx-auto mb-16"
        >
          <div className="flex flex-col md:flex-row items-start md:items-center gap-8">
            <div className="w-full md:basis-7/12 lg:basis-7/12 md:max-w-[640px] lg:max-w-[780px]">
              <div
                ref={mainVideoContainerRef}
                className="relative w-full rounded-2xl overflow-hidden border border-white/10 bg-white/5 shadow-xl group"
                style={{ aspectRatio: mainAspect ? String(mainAspect) : "16/9", maxHeight: "85vh" }}
              >
                <video
                  ref={mainVideoRef}
                  src={mainVisual.src as any}
                  className="w-full h-full object-cover"
                  playsInline
                  preload="metadata"
                  loop
                  onLoadedMetadata={onMainLoadedMetadata}
                  onPlay={() => setIsMainVideoPlaying(true)}
                  onPause={() => setIsMainVideoPlaying(false)}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />
                <button
                  onClick={toggleMainVideo}
                  className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/20 transition-colors z-10 group/play"
                  aria-label={isMainVideoPlaying ? "Pause video" : "Play video"}
                >
                  <motion.div
                    animate={{
                      scale: isMainVideoPlaying ? 0.8 : 1,
                      opacity: isMainVideoPlaying ? 0 : 1
                    }}
                    transition={{ duration: 0.2 }}
                    className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/25 backdrop-blur-md flex items-center justify-center border-2 border-white/40 shadow-2xl group-hover/play:scale-110 group-hover/play:bg-white/35 transition-all ${
                      isMainVideoPlaying ? "pointer-events-none" : ""
                    }`}
                  >
                    {isMainVideoPlaying ? (
                      <Pause className="h-8 w-8 sm:h-10 sm:w-10 text-white" fill="white" />
                    ) : (
                      <Play className="h-8 w-8 sm:h-10 sm:w-10 text-white ml-0.5" fill="white" />
                    )}
                  </motion.div>
                </button>
                {isMainVideoPlaying && (
                  <button
                    onClick={toggleMainVideo}
                    className="absolute top-4 right-4 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center border border-white/30 hover:bg-black/80 hover:border-white/50 transition-all z-20"
                    aria-label="Pause video"
                  >
                    <Pause className="h-5 w-5 sm:h-6 sm:w-6 text-white" fill="white" />
                  </button>
                )}
              </div>
            </div>
            <div className="w-full md:basis-5/12 lg:basis-5/12 space-y-4">
              <h3 className="text-3xl md:text-4xl font-bold text-white">
                ✨ Tại sao bạn không nên bỏ lỡ?
              </h3>
              <p className="text-lg text-gray-300 leading-relaxed">
                <span className="text-white font-semibold">Trải Nghiệm Đắm Chìm Không Giới Hạn:</span> Với hệ thống màn hình đa diện bao quanh, chúng tôi tái tạo những khung cảnh vĩ đại, từ sự tĩnh lặng của vũ trụ bao la đến nhịp sống sôi động của những thành phố tương lai, tất cả gói gọn trong một không gian tinh tế.
              </p>
              <p className="text-lg text-gray-300 leading-relaxed">
                <span className="text-white font-semibold">Siêu Định Dạng 8K+8K:</span> Hãy chuẩn bị để ngỡ ngàng trước những thước phim CG siêu phân giải 8K. Mọi chi tiết đều chân thực đến mức khó tin, cho phép bạn đắm mình vào cảnh vật mà không cần đeo bất kỳ thiết bị hỗ trợ nào.
              </p>
              <p className="text-lg text-gray-300 leading-relaxed">
                <span className="text-white font-semibold">Xuyên Không Trong Chớp Mắt:</span> Chỉ một cái chạm, bối cảnh sẽ thay đổi tức thì. Bạn có thể đang dạo bước giữa rừng nguyên sinh rồi ngay lập tức lao vút qua những thiên hà xa xôi với tốc độ và cảm giác chân thực tuyệt đối.
              </p>
              <p className="text-lg text-gray-300 leading-relaxed">
                <span className="text-white font-semibold">Thánh Địa "Check-in" Nghệ Thuật:</span> Không chỉ để xem, Huyễn Cảnh Không Gian còn là studio hoàn hảo để bạn sở hữu những thước phim TikTok "triệu view" hay những bức ảnh nghệ thuật đầy ảo diệu, khẳng định phong cách riêng trên mạng xã hội.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Video Preview Gallery - Carousel */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex flex-col items-center md:flex-row md:items-end md:justify-between gap-4 mb-6 md:mb-11">
            <h3 className="text-3xl md:text-3xl font-bold text-white text-center md:text-left">
              Khám phá không gian CineSphere
            </h3>
            <div className="hidden md:flex items-center justify-center gap-3">
              <button
                onClick={scrollPrev}
                disabled={!canScrollPrev}
                className="rounded-full w-10 h-10 md:w-12 md:h-12 bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center hover:bg-black/80 hover:border-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg"
                aria-label="Previous slide"
              >
                <ChevronLeft className="h-5 w-5 md:h-6 md:w-6 text-white" />
              </button>
              <button
                onClick={scrollNext}
                disabled={!canScrollNext}
                className="rounded-full w-10 h-10 md:w-12 md:h-12 bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center hover:bg-black/80 hover:border-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg"
                aria-label="Next slide"
              >
                <ChevronRight className="h-5 w-5 md:h-6 md:w-6 text-white" />
              </button>
            </div>
          </div>
          
          <div className="relative">
            {/* Carousel Container */}
            <div ref={emblaRef} className="overflow-hidden rounded-2xl">
              <div className="flex gap-3 md:gap-4">
                {videoPreviewsMerged.map((item, gi) => {
                  return (
                    <div
                      key={`${item.title}-${gi}`}
                      className="flex-[0_0_auto] w-[180px] sm:w-[220px] md:w-[260px] lg:w-[280px]"
                    >
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.3 }}
                        className="relative w-full h-full rounded-xl overflow-hidden border border-white/10 bg-black/20 group"
                      >
                        <video
                          ref={(el) => {
                            if (el) videoRefs.current[gi] = el;
                          }}
                          src={item.src as any}
                          className="w-full h-full object-cover"
                          playsInline
                          preload={"metadata"}
                          loop
                          onPlay={() => {
                            setPlayingArr((prev) => {
                              const arr = [...prev];
                              arr[gi] = true;
                              return arr;
                            });
                          }}
                          onPause={() => {
                            setPlayingArr((prev) => {
                              const arr = [...prev];
                              arr[gi] = false;
                              return arr;
                            });
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />
                        <button
                          onClick={() => togglePlay(gi)}
                          className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/20 transition-colors z-10 group/play"
                          aria-label={playingArr[gi] ? "Pause video" : "Play video"}
                        >
                          <motion.div
                            animate={{
                              scale: playingArr[gi] ? 0.8 : 1,
                              opacity: playingArr[gi] ? 0 : 1
                            }}
                            transition={{ duration: 0.2 }}
                            className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white/25 backdrop-blur-md flex items-center justify-center border-2 border-white/40 shadow-2xl group-hover/play:scale-110 group-hover/play:bg-white/35 transition-all ${
                              playingArr[gi] ? "pointer-events-none" : ""
                            }`}
                          >
                            {playingArr[gi] ? (
                              <Pause className="h-6 w-6 sm:h-7 sm:w-7 text-white" fill="white" />
                            ) : (
                              <Play className="h-6 w-6 sm:h-7 sm:w-7 text-white ml-0.5" fill="white" />
                            )}
                          </motion.div>
                        </button>
                        {playingArr[gi] && (
                          <button
                            onClick={() => togglePlay(gi)}
                            className="absolute top-2 right-2 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center border border-white/30 hover:bg-black/80 hover:border-white/50 transition-all z-20"
                            aria-label="Pause video"
                          >
                            <Pause className="h-4 w-4 sm:h-5 sm:w-5 text-white" fill="white" />
                          </button>
                        )}
                      </motion.div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Mobile navigation buttons - shown below carousel on small screens */}
            <div className="flex md:hidden items-center justify-center gap-3 mt-12">
              <button
                onClick={scrollPrev}
                disabled={!canScrollPrev}
                className="rounded-full w-10 h-10 bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center hover:bg-black/80 hover:border-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg"
                aria-label="Previous slide"
              >
                <ChevronLeft className="h-5 w-5 text-white" />
              </button>
              <button
                onClick={scrollNext}
                disabled={!canScrollNext}
                className="rounded-full w-10 h-10 bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center hover:bg-black/80 hover:border-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg"
                aria-label="Next slide"
              >
                <ChevronRight className="h-5 w-5 text-white" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

