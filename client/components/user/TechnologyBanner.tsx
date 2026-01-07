import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { cn, optimizeCloudinaryUrl, optimizeCloudinaryVideoUrl, getCloudinaryThumbnail } from "@/lib/utils";
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

// Main video placeholder logic
const mainVisualPlaceholder = {
  type: "video" as const,
  src: "",
  thumbnail: "",
};

export default function TechnologyBanner() {
  // Consolidated query for all technology media
  const { data: siteMediaData, isLoading } = useQuery({
    queryKey: ["siteMedia", "all_active_videos"],
    queryFn: ({ signal }) =>
      getSiteMediaApi({
        active: true,
        type: "video",
        signal,
      }),
    staleTime: 600000,
  });

  const mainItem = useMemo(() =>
    siteMediaData?.items?.find((it: any) => it.section === "technology_section1"),
    [siteMediaData]
  );

  const listItemsData = useMemo(() =>
    siteMediaData?.items?.filter((it: any) => it.section === "technology_section2") || [],
    [siteMediaData]
  );

  const mainVideoUrl = mainItem?.url;
  const mainVisual = useMemo(() => ({
    type: "video" as const,
    src: mainVideoUrl ? optimizeCloudinaryVideoUrl(mainVideoUrl, 1080) : "",
    thumbnail: mainVideoUrl ? getCloudinaryThumbnail(mainVideoUrl, 480) : "",
  }), [mainVideoUrl]);

  const videoPreviewsMerged = useMemo(() => {
    return listItemsData.map((it: any) => ({
      src: optimizeCloudinaryVideoUrl(it.url as string, 480),
      thumbnail: getCloudinaryThumbnail(it.url as string, 300),
      title: it.title || "Công nghệ Cinesphere",
      description: it.description || "Trải nghiệm đỉnh cao",
    }));
  }, [listItemsData]);
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);
  const videoRefs = useRef<HTMLVideoElement[]>([]);
  const carouselItemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const mainVideoRef = useRef<HTMLVideoElement | null>(null);
  const mainVideoContainerRef = useRef<HTMLDivElement | null>(null);
  const [mainAspect, setMainAspect] = useState<number | null>(null);
  const [isMainVideoPlaying, setIsMainVideoPlaying] = useState(false);
  const [durations, setDurations] = useState<number[]>([]);
  const [progresses, setProgresses] = useState<number[]>([]);
  const [playingArr, setPlayingArr] = useState<boolean[]>([]);

  useEffect(() => {
    const n = videoPreviewsMerged.length;
    setDurations(Array(n).fill(0));
    setDurations(Array(n).fill(0));
    setProgresses(Array(n).fill(0));
    setPlayingArr(Array(n).fill(false));
    carouselItemRefs.current = Array(n).fill(null);
    setLoadedVideos(Array(n).fill(false));
  }, [videoPreviewsMerged.length]);
  const [loadedVideos, setLoadedVideos] = useState<boolean[]>([]);
  const [mainVideoLoaded, setMainVideoLoaded] = useState(false);
  const [isVideoBuffering, setIsVideoBuffering] = useState(false);
  const [galleryBuffering, setGalleryBuffering] = useState<boolean[]>([]);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const SECTION_ID = "tech-section";

  const isGalleryLoading = isLoading;

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

  // Global video exclusion logic
  useEffect(() => {
    const handleGlobalPlay = (e: any) => {
      const playId = e.detail?.id;
      if (!playId) return;

      // Pause everything here if the play signal is from outside OR a different sub-id within here
      // 1. Check main video
      const mainId = `${SECTION_ID}-main`;
      if (playId !== mainId) {
        if (mainVideoRef.current && !mainVideoRef.current.paused) {
          mainVideoRef.current.pause();
          setIsMainVideoPlaying(false);
        }
      }

      // 2. Check carousel videos
      videoRefs.current.forEach((v, idx) => {
        const carouselId = `${SECTION_ID}-carousel-${idx}`;
        if (playId !== carouselId) {
          if (v && !v.paused) {
            v.pause();
            setPlayingArr((prev) => {
              const arr = [...prev];
              arr[idx] = false;
              return arr;
            });
          }
        }
      });
    };

    window.addEventListener("cinesphere-video-play", handleGlobalPlay);
    return () => window.removeEventListener("cinesphere-video-play", handleGlobalPlay);
  }, []);

  const notifyGlobalPlay = useCallback((subId?: string) => {
    const id = subId ? `${SECTION_ID}-${subId}` : SECTION_ID;
    window.dispatchEvent(new CustomEvent("cinesphere-video-play", {
      detail: { id }
    }));
  }, []);

  // Intersection Observer for carousel videos - pause when scrolled out of viewport
  useEffect(() => {
    const currentObservers: IntersectionObserver[] = [];

    carouselItemRefs.current.forEach((el, i) => {
      if (!el) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setLoadedVideos((prev) => {
                const arr = [...prev];
                if (!arr[i]) arr[i] = true;
                return arr;
              });
            } else {
              // Video is out of viewport (any part), pause it immediately
              const video = videoRefs.current[i];
              if (video && !video.paused) {
                video.pause();
                setPlayingArr((prev) => {
                  const arr = [...prev];
                  arr[i] = false;
                  return arr;
                });
              }
            }
          });
        },
        { threshold: 0 } // Trigger as soon as even 1px is hidden
      );

      observer.observe(el);
      currentObservers.push(observer);
    });

    return () => {
      currentObservers.forEach((obs) => obs.disconnect());
    };
  }, [videoPreviewsMerged.length]); // Observe all containers in the carousel

  // Intersection Observer for main video - pause when scrolled out of viewport
  useEffect(() => {
    if (!mainVideoContainerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setMainVideoLoaded(true);
          } else {
            // Main video is out of viewport, pause it immediately
            if (mainVideoRef.current && !mainVideoRef.current.paused) {
              mainVideoRef.current.pause();
              setIsMainVideoPlaying(false);
            }
          }
        });
      },
      { threshold: 0 } // Trigger as soon as even 1px is hidden
    );

    observer.observe(mainVideoContainerRef.current);

    return () => {
      observer.disconnect();
    };
  }, []); // Observe container unconditionally from mount

  useEffect(() => {
    if (playingVideo === "main") {
      mainVideoRef.current?.play().catch(() => { });
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
    if (!isMainVideoPlaying) {
      setIsMainVideoPlaying(true);
      setMainVideoLoaded(true);
      notifyGlobalPlay("main");
    } else {
      const el = mainVideoRef.current;
      if (el) {
        if (el.paused) {
          el.play().catch(() => { });
          notifyGlobalPlay("main");
        }
        else el.pause();
      }
    }
  };

  const togglePlay = (i: number) => {
    if (!playingArr[i]) {
      setPlayingArr((prev) => {
        const arr = [...prev];
        arr[i] = true;
        return arr;
      });
      notifyGlobalPlay(`carousel-${i}`);
    } else {
      const el = videoRefs.current[i];
      if (el) {
        if (el.paused) {
          el.play().catch(() => { });
          notifyGlobalPlay(`carousel-${i}`);
        }
        else el.pause();
      }
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
            <div className="w-full md:basis-5/12 lg:basis-5/12 xl:max-w-[480px]">
              <div
                ref={mainVideoContainerRef}
                className="relative w-full aspect-[9/13] rounded-3xl overflow-hidden border border-white/10 bg-slate-900 shadow-2xl group cursor-pointer"
                onClick={!isMainVideoPlaying ? toggleMainVideo : undefined}
              >
                <AnimatePresence>
                  {!isMainVideoPlaying ? (
                    <motion.div
                      key="main-placeholder"
                      initial={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 z-10"
                    >
                      <img
                        src={mainVisual.thumbnail || "/placeholder-video.jpg"}
                        alt="Cinesphere Technology Experience"
                        width={480}
                        height={693}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-transparent pointer-events-none" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors">
                        <div className="w-24 h-24 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border-2 border-white/30 shadow-2xl group-hover:scale-110 transition-transform">
                          <Play className="h-12 w-12 text-white ml-2" fill="white" />
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="main-video"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="absolute inset-0 z-0 bg-black flex items-center justify-center"
                    >
                      {/* Loading Spinner for Video - Always visible when buffering */}
                      <AnimatePresence>
                        {isVideoBuffering && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px]"
                          >
                            <div className="flex flex-col items-center gap-4">
                              <div className="w-14 h-14 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
                              <span className="text-cyan-400 text-sm font-medium tracking-widest uppercase animate-pulse text-center px-4">Đang kết nối...</span>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {mainVisual.src ? (
                        <video
                          ref={mainVideoRef}
                          src={mainVisual.src}
                          className="w-full h-full object-cover"
                          playsInline
                          preload="auto"
                          loop
                          onWaiting={() => setIsVideoBuffering(true)}
                          onPlaying={() => setIsVideoBuffering(false)}
                          onCanPlay={() => setIsVideoBuffering(false)}
                          onLoadedData={() => setIsVideoBuffering(false)}
                          onPlay={() => setIsMainVideoPlaying(true)}
                          onPause={() => setIsMainVideoPlaying(false)}
                          autoPlay
                        />
                      ) : (
                        <div className="w-full h-full bg-slate-900/40 flex items-center justify-center">
                          {isLoading ? (
                            <div className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
                          ) : (
                            <p className="text-gray-500 font-medium italic">Sẽ sớm cập nhật</p>
                          )}
                        </div>
                      )}
                      <div
                        className="absolute inset-0 z-10"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleMainVideo();
                        }}
                      >
                        <button
                          className="absolute inset-0 flex items-center justify-center"
                          aria-label={isMainVideoPlaying ? "Pause video" : "Play video"}
                        >
                          {!isMainVideoPlaying && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.5 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="w-20 h-20 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center border border-white/20"
                            >
                              <Play className="h-10 w-10 text-white ml-1.5" fill="white" />
                            </motion.div>
                          )}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {isMainVideoPlaying && !isVideoBuffering && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMainVideo();
                    }}
                    className="absolute top-6 right-6 w-12 h-12 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center border border-white/30 hover:bg-black/80 hover:border-white/50 transition-all z-20"
                    aria-label="Pause video"
                  >
                    <Pause className="h-6 w-6 text-white" fill="white" />
                  </button>
                )}
              </div>
            </div>
            <div className="w-full md:basis-7/12 lg:basis-7/12 space-y-8">
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
            {videoPreviewsMerged.length > 1 && (
              <div className="hidden md:flex items-center justify-center gap-3">
                <button
                  onClick={scrollPrev}
                  disabled={!canScrollPrev}
                  className="rounded-full w-10 h-10 md:w-12 md:h-12 bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center hover:bg-black/80 hover:border-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg"
                  aria-label="Xem video trước đó"
                >
                  <ChevronLeft className="h-5 w-5 md:h-6 md:w-6 text-white" />
                </button>
                <button
                  onClick={scrollNext}
                  disabled={!canScrollNext}
                  className="rounded-full w-10 h-10 md:w-12 md:h-12 bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center hover:bg-black/80 hover:border-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg"
                  aria-label="Xem video tiếp theo"
                >
                  <ChevronRight className="h-5 w-5 md:h-6 md:w-6 text-white" />
                </button>
              </div>
            )}
          </div>

          <div className="relative">
            {/* Carousel Container */}
            <div ref={emblaRef} className="overflow-hidden rounded-2xl">
              <div className="flex gap-3 md:gap-4">
                {isGalleryLoading ? (
                  // Skeleton Loading State
                  [...Array(4)].map((_, i) => (
                    <div key={`skeleton-${i}`} className="flex-[0_0_auto] w-[180px] sm:w-[220px] md:w-[260px] lg:w-[300px]">
                      <div className="w-full aspect-[10/16] rounded-2xl bg-white/5 animate-pulse border border-white/10 flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-white/5 border-2 border-white/10" />
                      </div>
                    </div>
                  ))
                ) : videoPreviewsMerged.length === 0 ? (
                  <div className="w-full min-w-[300px] py-16 flex flex-col items-center justify-center bg-white/5 rounded-2xl border border-dashed border-white/10">
                    <p className="text-gray-500 italic">Thư viện video đang được cập nhật</p>
                  </div>
                ) : (
                  videoPreviewsMerged.map((item, gi) => {
                    return (
                      <div
                        key={`${item.title}-${gi}`}
                        ref={(el) => (carouselItemRefs.current[gi] = el)}
                        className="flex-[0_0_auto] w-[180px] sm:w-[220px] md:w-[260px] lg:w-[300px]"
                      >
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          whileInView={{ opacity: 1, scale: 1 }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.3 }}
                          className="relative w-full aspect-[10/16] rounded-2xl overflow-hidden border border-white/10 bg-black/20 group cursor-pointer shadow-lg"
                        >
                          <AnimatePresence>
                            {!playingArr[gi] ? (
                              <motion.div
                                key="thumbnail"
                                initial={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 z-10"
                                onClick={() => togglePlay(gi)}
                              >
                                {(item.thumbnail?.includes("cloudinary.com") || !item.thumbnail?.match(/\.(mp4|webm|mov|ogg)$/i)) ? (
                                  <img
                                    src={item.thumbnail}
                                    alt={item.title}
                                    width={300}
                                    height={480}
                                    loading="lazy"
                                    className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-all duration-500 group-hover:scale-105"
                                  />
                                ) : (
                                  <video
                                    src={item.thumbnail}
                                    preload="metadata"
                                    className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity"
                                  />
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-transparent to-transparent pointer-events-none" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border-2 border-white/30 shadow-2xl group-hover:scale-110 transition-all duration-300">
                                    <Play className="h-7 w-7 sm:h-8 sm:w-8 text-white ml-1" fill="white" />
                                  </div>
                                </div>
                              </motion.div>
                            ) : (
                              <motion.div
                                key="video"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="absolute inset-0 z-0 bg-black"
                              >
                                {/* Loading Spinner for Gallery Video */}
                                <AnimatePresence>
                                  {galleryBuffering[gi] && (
                                    <motion.div
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      exit={{ opacity: 0 }}
                                      className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px]"
                                    >
                                      <div className="flex flex-col items-center gap-2">
                                        <div className="w-10 h-10 border-3 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>

                                <video
                                  ref={(el) => {
                                    if (el) videoRefs.current[gi] = el;
                                  }}
                                  src={item.src as any}
                                  className="w-full h-full object-cover"
                                  playsInline
                                  autoPlay
                                  loop
                                  onWaiting={() => setGalleryBuffering(prev => {
                                    const arr = [...prev];
                                    arr[gi] = true;
                                    return arr;
                                  })}
                                  onPlaying={() => setGalleryBuffering(prev => {
                                    const arr = [...prev];
                                    arr[gi] = false;
                                    return arr;
                                  })}
                                  onCanPlay={() => setGalleryBuffering(prev => {
                                    const arr = [...prev];
                                    arr[gi] = false;
                                    return arr;
                                  })}
                                />
                              </motion.div>
                            )}
                          </AnimatePresence>

                          <button
                            onClick={() => togglePlay(gi)}
                            className="absolute inset-0 z-20 group/play"
                            aria-label={playingArr[gi] ? "Pause video" : "Play video"}
                          >
                            {playingArr[gi] && (
                              <div className="absolute top-2 right-2 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center border border-white/30 hover:bg-black/80 hover:border-white/50 transition-all">
                                <Pause className="h-4 w-4 sm:h-5 sm:w-5 text-white" fill="white" />
                              </div>
                            )}
                          </button>
                        </motion.div>
                      </div>
                    );
                  })
                )}

              </div>
            </div>

            {/* Mobile navigation buttons - Only if has data */}
            {videoPreviewsMerged.length > 1 && (
              <div className="flex md:hidden items-center justify-center gap-3 mt-12">
                <button
                  onClick={scrollPrev}
                  disabled={!canScrollPrev}
                  className="rounded-full w-10 h-10 bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center hover:bg-black/80 hover:border-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg"
                  aria-label="Xem video trước đó"
                >
                  <ChevronLeft className="h-5 w-5 text-white" />
                </button>
                <button
                  onClick={scrollNext}
                  disabled={!canScrollNext}
                  className="rounded-full w-10 h-10 bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center hover:bg-black/80 hover:border-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg"
                  aria-label="Xem video tiếp theo"
                >
                  <ChevronRight className="h-5 w-5 text-white" />
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

