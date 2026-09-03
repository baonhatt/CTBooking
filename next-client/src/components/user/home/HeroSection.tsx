'use client';

import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { LazyMotion, domAnimation, m, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { Play, Sparkles, Waves, Clock, Star, Calendar, Ticket, Gamepad2, ChevronLeft, ChevronRight, Image as ImageIcon, MapPin, Eye } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useQuery } from '@tanstack/react-query';
import { movieStore } from '@/store/movieStore';
import { getMovieById, getActiveMoviesToday } from '@/lib/api/movies';
import { optimizeCloudinaryUrl, optimizeCloudinaryVideoUrl, getCloudinaryThumbnail } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useBranch } from '@/hooks/useBranch';
import { setCookie } from '@/lib/cookies';

export default function HeroSection({
  initialMovies = [],
  heroMedia = null
}: {
  initialMovies?: any[];
  heroMedia?: any;
}) {
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const springConfig = { damping: 20, stiffness: 50 };
  const springX = useSpring(pointerX, springConfig);
  const springY = useSpring(pointerY, springConfig);
  const blobX = useTransform(springX, (val) => val * -0.5);
  const blobY = useTransform(springY, (val) => val * -0.5);
  const cardX = useTransform(springX, (val) => val * 0.08);
  const cardY = useTransform(springY, (val) => val * 0.08);
  const rectRef = useRef<DOMRect | null>(null);

  const onMouseEnter = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    rectRef.current = e.currentTarget.getBoundingClientRect();
  };

  const lastMoveTime = useRef(0);
  const THROTTLE_MS = 16;
  const onMove = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    const now = Date.now();
    if (now - lastMoveTime.current < THROTTLE_MS) return;
    lastMoveTime.current = now;
    if (!rectRef.current) {
      rectRef.current = e.currentTarget.getBoundingClientRect();
    }
    const { clientX, clientY } = e;
    const rect = rectRef.current;
    const x = ((clientX - rect.left) / rect.width - 0.5) * 20;
    const y = ((clientY - rect.top) / rect.height - 0.5) * 20;
    pointerX.set(x);
    pointerY.set(y);
  };

  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedMovieId, setSelectedMovieId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [storeUpdateTrigger, setStoreUpdateTrigger] = useState(0);
  const [showBranchConfirmDialog, setShowBranchConfirmDialog] = useState(false);
  const SECTION_ID = 'hero-main';
  const { selectedBranch, dontShowConfirm, toggleDontShowConfirm } = useBranch();

  // Prefetch booking page để tránh lag khi user bấm đặt vé
  useEffect(() => {
    router.prefetch('/booking');
    router.prefetch('/vr');
  }, [router]);

  const [isDesktopHero, setIsDesktopHero] = useState(false);
  useEffect(() => {
    setIsDesktopHero(window.matchMedia('(min-width: 1024px)').matches);
    const mq = window.matchMedia('(min-width: 1024px)');
    const apply = () => setIsDesktopHero(mq.matches);
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const heroVideoSrc = useMemo(
    () => optimizeCloudinaryVideoUrl(heroMedia?.url, isDesktopHero ? 720 : 480, 'auto:low'),
    [heroMedia, isDesktopHero]
  );
  const heroVideoThumbnail = useMemo(
    () => getCloudinaryThumbnail(heroMedia?.url, isDesktopHero ? 448 : 360),
    [heroMedia, isDesktopHero]
  );

  const { data: movies = initialMovies } = useQuery({
    queryKey: ['activeMovies', selectedBranch?.id],
    queryFn: () => getActiveMoviesToday(selectedBranch?.id),
    initialData: initialMovies,
    staleTime: 5 * 60 * 1000 // 5 minutes cache to prevent duplicate client refetch on mount
  });

  // Extract and memoize branch banners
  const branchBanners = useMemo<string[]>(() => {
    if (!selectedBranch?.banner_images) return [];
    try {
      if (Array.isArray(selectedBranch.banner_images)) {
        return selectedBranch.banner_images.filter((url) => typeof url === 'string' && url.trim().length > 0);
      }
      const parsed = JSON.parse(selectedBranch.banner_images);
      if (Array.isArray(parsed)) {
        return parsed.filter((url) => typeof url === 'string' && url.trim().length > 0);
      }
    } catch {
      if (typeof selectedBranch.banner_images === 'string' && selectedBranch.banner_images.startsWith('http')) {
        return [selectedBranch.banner_images];
      }
    }
    return [];
  }, [selectedBranch]);

  const activeBanners = branchBanners;

  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState(1);
  const [isCarouselHovered, setIsCarouselHovered] = useState(false);

  // Reset index when branch changes
  useEffect(() => {
    setCurrentBannerIndex(0);
  }, [selectedBranch?.id]);

  // Preload only next banner image at responsive resolution
  useEffect(() => {
    if (!activeBanners || activeBanners.length <= 1) return;
    const nextIndex = (currentBannerIndex + 1) % activeBanners.length;
    const nextUrl = activeBanners[nextIndex];
    if (nextUrl) {
      const img = new Image();
      const targetWidth = isDesktopHero ? 1600 : 768;
      img.src = optimizeCloudinaryUrl(nextUrl, targetWidth, 'auto:good') || nextUrl;
    }
  }, [activeBanners, currentBannerIndex, isDesktopHero]);

  // Auto carousel slide timer (4.5s)
  useEffect(() => {
    if (isCarouselHovered || activeBanners.length <= 1) return;
    const interval = setInterval(() => {
      setSlideDirection(1);
      setCurrentBannerIndex((prev) => (prev + 1) % activeBanners.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [isCarouselHovered, activeBanners.length]);

  const handlePrevBanner = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSlideDirection(-1);
    setCurrentBannerIndex((prev) => (prev - 1 + activeBanners.length) % activeBanners.length);
  };

  const handleNextBanner = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSlideDirection(1);
    setCurrentBannerIndex((prev) => (prev + 1) % activeBanners.length);
  };

  const handleBannerClick = () => {
    const bookingSection = document.getElementById('promotions') || document.getElementById('films');
    bookingSection?.scrollIntoView({ behavior: 'smooth' });
  };

  const movieDetails = useMemo(() => {
    if (!selectedMovieId) return null;
    return movieStore.getMovie(selectedMovieId);
  }, [selectedMovieId, storeUpdateTrigger]);

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? '100%' : '-100%',
      opacity: 0,
      scale: 0.95
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
      transition: {
        x: { type: 'spring' as const, stiffness: 300, damping: 30 },
        opacity: { duration: 0.4 },
        scale: { duration: 0.4 }
      }
    },
    exit: (direction: number) => ({
      x: direction > 0 ? '-100%' : '100%',
      opacity: 0,
      scale: 0.95,
      transition: {
        x: { type: 'spring' as const, stiffness: 300, damping: 30 },
        opacity: { duration: 0.3 }
      }
    })
  };

  return (
    <LazyMotion features={domAnimation} strict>
      <section
        id="hero"
        className="relative overflow-hidden bg-gradient-to-b from-[#030712] via-[#070b1e] to-[#050915] text-white"
        onMouseMove={isDesktopHero ? onMove : undefined}
      >
        {/* Cyber Ambient Background Glows - Ultra-fast CSS Radial Gradients (0% GPU blur overhead) */}
        <div className="absolute -left-32 -top-10 w-[650px] h-[650px] rounded-full bg-[radial-gradient(circle,_rgba(6,182,212,0.22)_0%,_transparent_70%)] pointer-events-none" />
        <m.div
          className="absolute -right-32 top-20 w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,_rgba(217,70,239,0.2)_0%,_transparent_70%)] pointer-events-none"
          style={{ x: blobX, y: blobY, translateZ: 0 }}
        />

        {/* ================= TOP SECTION: WIDESCREEN BANNER CAROUSEL (Chỉ hiện khi chi nhánh có banner) ================= */}
        {branchBanners.length > 0 && (
          <div className="container mx-auto px-4 sm:px-6 pt-24 sm:pt-28 pb-4">
            <div
              className="relative w-full aspect-[16/9] sm:aspect-[19/8] lg:aspect-[2.1/1] min-h-[240px] sm:min-h-[320px] lg:min-h-[400px] rounded-2xl sm:rounded-3xl overflow-hidden border border-white/20 bg-slate-950 shadow-[0_15px_50px_rgba(0,0,0,0.8)] group cursor-pointer"
              onClick={handleBannerClick}
              onMouseEnter={() => setIsCarouselHovered(true)}
              onMouseLeave={() => setIsCarouselHovered(false)}
            >
              {/* Active Slide Banner Image with Smooth Animation */}
              <AnimatePresence initial={false} custom={slideDirection} mode="popLayout">
                <m.div
                  key={currentBannerIndex}
                  custom={slideDirection}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={1}
                  onDragEnd={(e, { offset, velocity }) => {
                    const swipe = Math.abs(offset.x) * velocity.x;
                    if (swipe < -10000) {
                      handleNextBanner();
                    } else if (swipe > 10000) {
                      handlePrevBanner();
                    }
                  }}
                  className="absolute inset-0 w-full h-full flex items-center justify-center bg-slate-950"
                >
                  {/* Main Banner Image: Spans 100% full width from edge to edge */}
                  <img
                    src={
                      optimizeCloudinaryUrl(
                        activeBanners[currentBannerIndex],
                        isDesktopHero ? 1600 : 768,
                        'auto:good'
                      ) || activeBanners[currentBannerIndex]
                    }
                    alt={`Cinesphere Banner ${currentBannerIndex + 1}`}
                    className="w-full min-w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-[1.03]"
                    loading="eager"
                    fetchPriority="high"
                  />
                  {/* Subtle dark gradient overlay at top & bottom edges of banner for badge legibility */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none z-10" />
                </m.div>
              </AnimatePresence>

              {/* Top Badges Overlay */}
              <div className="absolute top-3.5 sm:top-5 left-4 sm:left-6 right-4 sm:right-6 hidden sm:flex items-center justify-between z-20 pointer-events-none">
                <div className="flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/20 shadow-md">
                  <MapPin className="w-3.5 h-3.5 text-cyan-400 animate-bounce" />
                  <span className="text-xs sm:text-sm font-bold text-white tracking-wide">
                    {selectedBranch?.name || 'Cinesphere'}
                  </span>
                </div>

                <div className="flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-full bg-cyan-950/85 backdrop-blur-md border border-cyan-500/50 shadow-md">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_10px_rgba(34,211,238,0.9)]" />
                  <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-cyan-300">
                    ✨ ƯU ĐÃI CHI NHÁNH
                  </span>
                </div>
              </div>

              {/* Side Navigation Arrows (2 Bên Cạnh Banner) */}
              {activeBanners.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={handlePrevBanner}
                    aria-label="Banner trước"
                    className="hidden sm:flex absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 z-30 p-2.5 sm:p-3.5 rounded-full bg-black/50 hover:bg-black/90 backdrop-blur-md border border-white/20 hover:border-cyan-400 text-white transition-all duration-300 hover:scale-110 active:scale-95 shadow-2xl items-center justify-center cursor-pointer group"
                  >
                    <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 group-hover:-translate-x-0.5 transition-transform" />
                  </button>

                  <button
                    type="button"
                    onClick={handleNextBanner}
                    aria-label="Banner tiếp theo"
                    className="hidden sm:flex absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 z-30 p-2.5 sm:p-3.5 rounded-full bg-black/50 hover:bg-black/90 backdrop-blur-md border border-white/20 hover:border-cyan-400 text-white transition-all duration-300 hover:scale-110 active:scale-95 shadow-2xl items-center justify-center cursor-pointer group"
                  >
                    <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </>
              )}

              {/* Bottom Slide Indicator Overlay */}
              {activeBanners.length > 1 && (
                <div className="absolute bottom-3 sm:bottom-4 right-4 sm:right-6 z-20 pointer-events-auto">
                  <div className="flex items-center gap-1.5 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 shadow-lg">
                    {activeBanners.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSlideDirection(idx > currentBannerIndex ? 1 : -1);
                          setCurrentBannerIndex(idx);
                        }}
                        aria-label={`Chuyển đến banner ${idx + 1}`}
                        className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                          idx === currentBannerIndex
                            ? 'w-5 bg-gradient-to-r from-cyan-400 to-blue-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]'
                            : 'w-1.5 bg-white/30 hover:bg-white/60'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= BOTTOM SECTION: HERO SECTION CONTENT (TYPOGRAPHY, CTA & FEATURES) ================= */}
        <div
          className={`container mx-auto px-4 sm:px-6 py-8 sm:py-12 pb-14 sm:pb-18 relative z-10 ${
            branchBanners.length === 0 ? 'pt-24 sm:pt-32' : ''
          }`}
        >
          <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left Column: Brand, Slogan, Description & CTA Action Buttons */}
            <m.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="lg:col-span-7 space-y-6"
            >
              <div className="space-y-3">
                <m.h1
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-5xl sm:text-6xl lg:text-7xl font-black leading-none tracking-tight flex flex-col gap-1.5"
                >
                  <span className="bg-gradient-to-r from-cyan-300 via-blue-400 to-fuchsia-400 bg-clip-text text-transparent drop-shadow-[0_10px_40px_rgba(56,189,248,0.5)] py-1">
                    CINESPHERE
                  </span>
                  <span className="text-white text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">
                    Huyễn cảnh không gian
                  </span>
                </m.h1>

                <m.p
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-base sm:text-lg text-gray-200 leading-relaxed max-w-2xl font-normal"
                >
                  Dùng không gian nhỏ mô phỏng thế giới vô biên. Mỗi suất chiếu là một hành trình nhập vai với độ phân
                  giải 8K và âm thanh đa tầng bao quanh.
                </m.p>
              </div>

              {/* Action Buttons */}
              <m.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="flex flex-wrap items-center gap-4 pt-1"
              >
                <Button
                  className="group rounded-xl px-8 py-6 text-sm sm:text-base font-bold bg-gradient-to-r from-cyan-500 via-blue-600 to-fuchsia-500 hover:from-fuchsia-500 hover:via-cyan-400 hover:to-blue-600 text-white shadow-[0_0_30px_rgba(6,182,212,0.4)] transition-all duration-300 hover:shadow-[0_0_40px_rgba(236,72,153,0.6)] hover:scale-[1.02] active:scale-95 cursor-pointer"
                  onClick={() => {
                    const bookingSection = document.getElementById('promotions');
                    bookingSection?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  <span className="flex items-center gap-2">
                    Đặt vé ngay
                    <Play className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </Button>

                <Button
                  variant="outline"
                  className="rounded-xl px-6 py-6 text-sm sm:text-base font-bold border-cyan-400/40 bg-cyan-500/10 hover:bg-cyan-500/20 hover:border-cyan-400 text-cyan-300 transition-all flex items-center gap-2 cursor-pointer shadow-md"
                  onClick={() => {
                    const scheduleSection = document.getElementById('schedule');
                    scheduleSection?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  <Calendar className="h-5 w-5 text-cyan-400" />
                  Lịch chiếu hôm nay
                </Button>

                <Button
                  className="group rounded-xl px-8 py-6 text-sm sm:text-base font-bold bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 hover:from-pink-600 hover:via-purple-600 hover:to-fuchsia-600 text-white shadow-[0_0_30px_rgba(168,85,247,0.4)] transition-all duration-300 hover:scale-[1.02] active:scale-95 cursor-pointer"
                  onClick={() => {
                    const vrSection = document.getElementById('vr');
                    vrSection?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  <span className="flex items-center gap-2">
                    <Gamepad2 className="h-5 w-5" />
                    Trải nghiệm VR
                  </span>
                </Button>

                {heroMedia?.url && (
                  <Button
                    variant="outline"
                    className="rounded-xl px-5 py-6 text-sm font-semibold border-white/20 bg-white/5 hover:bg-white/10 hover:border-cyan-400 text-slate-100 transition-all flex items-center gap-2 cursor-pointer shadow-md"
                    onClick={() => setIsVideoModalOpen(true)}
                  >
                    <Play className="h-4 w-4 text-cyan-400" />
                    Xem Video 8K
                  </Button>
                )}
              </m.div>
            </m.div>

            {/* Right Column: 3 Sci-Fi Feature Glass Tiles */}
            <m.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
              className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-4"
            >
              {[
                { icon: Waves, title: 'Âm thanh đa tầng', desc: 'Định vị 360° bao quanh không gian', color: 'from-cyan-400 to-blue-500' },
                { icon: Sparkles, title: 'Hiệu ứng vũ trụ', desc: 'Hào quang, photon, tinh vân huyền ảo', color: 'from-fuchsia-500 to-purple-600' },
                { icon: Play, title: 'Độ phân giải 8K', desc: 'Màn hình đa chiều siêu nét đỉnh cao', color: 'from-blue-400 to-cyan-500' }
              ].map(({ icon: Icon, title, desc, color }, idx) => (
                <m.div
                  key={title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + idx * 0.1, duration: 0.45 }}
                  whileHover={{ scale: 1.03, x: 4 }}
                  className="rounded-2xl p-4 sm:p-5 border border-white/15 bg-white/5 backdrop-blur-xl hover:border-cyan-400/50 hover:bg-white/10 transition-all duration-300 cursor-default shadow-lg flex items-center gap-4"
                  style={{ x: cardX, y: cardY, translateZ: 0 }}
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-md shrink-0`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-white text-base mb-0.5">{title}</p>
                    <p className="text-xs sm:text-sm text-gray-300 font-normal">{desc}</p>
                  </div>
                </m.div>
              ))}
            </m.div>
          </div>
        </div>
      </section>

      {/* Video Preview Dialog */}
      {heroMedia?.url && (
        <Dialog open={isVideoModalOpen} onOpenChange={setIsVideoModalOpen}>
          <DialogContent className="max-w-4xl bg-slate-950/95 border-white/10 text-white p-2 sm:p-4 rounded-2xl overflow-hidden">
            <DialogHeader className="p-2 pb-0">
              <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                <Play className="w-4 h-4 text-cyan-400" /> Video Giới Thiệu Cinesphere 8K
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Không gian điện ảnh siêu thực & thế giới thực tế ảo nhập vai
              </DialogDescription>
            </DialogHeader>
            <div className="aspect-video w-full rounded-xl overflow-hidden bg-black mt-3 border border-white/10">
              <video
                src={heroVideoSrc}
                controls
                autoPlay
                className="w-full h-full object-contain"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Branch confirmation dialog */}
      <AlertDialog open={showBranchConfirmDialog} onOpenChange={setShowBranchConfirmDialog}>
        <AlertDialogContent className="bg-[#0f172a] border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-white">Xác nhận chi nhánh</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-300">
              Bạn đang đặt vé tại chi nhánh <span className="font-bold text-blue-400">{selectedBranch?.name}</span>.
              <br />
              <br />
              Nếu muốn đổi chi nhánh, hãy chọn ở dropdown trên header trước khi đặt vé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col items-stretch gap-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="dont-show-branch-confirm-hero"
                checked={dontShowConfirm}
                onCheckedChange={(checked) => toggleDontShowConfirm(checked as boolean)}
              />
              <label htmlFor="dont-show-branch-confirm-hero" className="text-sm text-gray-300 cursor-pointer">
                Không nhắc lại lần sau
              </label>
            </div>
            <div className="flex gap-2 mt-2">
              <AlertDialogCancel className="bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:text-white flex-1">
                Hủy bỏ
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setShowBranchConfirmDialog(false);
                  const params = new URLSearchParams(searchParams.toString());
                  router.push(`/booking${params.toString() ? `?${params.toString()}` : ''}`);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white flex-1"
              >
                Tiếp tục
              </AlertDialogAction>
            </div>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </LazyMotion>
  );
}
