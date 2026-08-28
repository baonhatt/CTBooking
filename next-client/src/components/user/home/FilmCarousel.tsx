'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Play, Clock, Star, Ticket } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getMovieById, getActiveMoviesToday } from '@/lib/api/movies';
import { useBranch } from '@/hooks/useBranch';
import { optimizeCloudinaryUrl, generateCloudinarySrcSet, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle
} from '@/components/ui/drawer';
import { movieStore } from '@/store/movieStore';
import useEmblaCarousel from 'embla-carousel-react';
import type { EmblaCarouselType } from 'embla-carousel';

interface FilmCarouselProps {
  initialFilms?: any[];
  onSelectFilm?: () => void;
}

export default function FilmCarousel({ initialFilms = [], onSelectFilm }: FilmCarouselProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [selectedMovieId, setSelectedMovieId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [storeUpdateTrigger, setStoreUpdateTrigger] = useState(0);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [lastTapTime, setLastTapTime] = useState(0);

  useEffect(() => {
    setMounted(true);
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Embla Carousel setup with optimized options for mobile
  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      align: 'start',
      dragFree: false,
      containScroll: 'trimSnaps',
      slidesToScroll: 1,
      breakpoints: {
        '(min-width: 768px)': { slidesToScroll: 2 }
      }
    },
    []
  );

  const { selectedBranch } = useBranch();
  // staleTime = 0: coi dữ liệu luôn cũ => refetch ngay khi đổi branch
  const { data: activeFilms = initialFilms } = useQuery({
    queryKey: ['activeMovies', selectedBranch?.id],
    queryFn: () => getActiveMoviesToday(selectedBranch?.id),
    initialData: initialFilms,
    enabled: mounted,
    staleTime: 0
  });

  const films = useMemo(() => {
    return activeFilms
      .filter((m: any) => m.id != null && typeof m.id === 'number')
      .map((m: any) => ({
        id: m.id,
        title: m.title,
        genre: (() => {
          try {
            const parsed = JSON.parse(m.genres);
            return Array.isArray(parsed) ? parsed.join(' • ') : 'Sci‑Fi';
          } catch {
            return 'Sci‑Fi';
          }
        })(),
        poster:
          m.cover_image ||
          'https://images.unsplash.com/photo-1464375117522-1311d6a5b81f?auto=format&fit=crop&w=900&q=80'
      }));
  }, [activeFilms]);

  // Update scroll buttons state
  const onSelect = useCallback((emblaApi: EmblaCarouselType) => {
    if (!emblaApi) return;
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, []);

  // Prefetch booking page để tránh lag khi user bấm đặt vé
  useEffect(() => {
    router.prefetch('/booking');
  }, [router]);

  // Setup Embla event listeners
  useEffect(() => {
    if (!emblaApi) return;
    onSelect(emblaApi);
    emblaApi.on('reInit', onSelect);
    emblaApi.on('select', onSelect);

    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, onSelect]);

  const scrollPrev = useCallback(() => {
    emblaApi?.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    emblaApi?.scrollNext();
  }, [emblaApi]);

  const handleOpen = async (film: any) => {
    if (!film.id || typeof film.id !== 'number') {
      return;
    }
    onSelectFilm?.();
    setSelectedMovieId(film.id);
    setIsModalOpen(true);

    const cachedMovie = movieStore.getMovie(film.id);
    if (!cachedMovie) {
      setIsLoadingDetails(true);
      try {
        const details = await getMovieById(film.id);
        if (details) {
          movieStore.setMovie(details);
          setStoreUpdateTrigger((prev) => prev + 1);
        }
      } catch (error) {
        console.error(`Failed to fetch details for movie ${film.id}:`, error);
      } finally {
        setIsLoadingDetails(false);
      }
    } else {
      setStoreUpdateTrigger((prev) => prev + 1);
    }
  };

  const movieDetails = useMemo(() => {
    if (!selectedMovieId) return null;
    return movieStore.getMovie(selectedMovieId);
  }, [selectedMovieId, storeUpdateTrigger]);

  const handleBookTicket = () => {
    setIsModalOpen(false);
    if (movieDetails) {
      localStorage.setItem(
        'selectedFilm',
        JSON.stringify({
          id: movieDetails.id,
          title: movieDetails.title,
          cover_image: movieDetails.cover_image
        })
      );
    }
    router.push('/booking');
  };

  const MovieContent = () => (
    <div className={cn('overflow-y-auto scrollbar-neon flex-1', isMobile ? 'px-4 pt-2 pb-6' : 'px-6 pt-6 pb-4')}>
      <div className={cn('grid gap-6', !isMobile && 'md:grid-cols-2')}>
        {isLoadingDetails || !movieDetails ? (
          <div className="col-span-full flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-400 mx-auto mb-4"></div>
              <p className="text-gray-400">Đang tải thông tin phim...</p>
            </div>
          </div>
        ) : (
          <>
            <div
              className={cn(
                'relative rounded-xl overflow-hidden border border-cyan-500/30 shadow-[0_0_30px_rgba(59,130,246,0.2)]',
                isMobile ? 'aspect-video mx-auto w-full max-w-sm' : 'aspect-[2/3]'
              )}
            >
              <img
                src={
                  optimizeCloudinaryUrl(movieDetails.cover_image, 800) ||
                  'https://images.unsplash.com/photo-1464375117522-1311d6a5b81f?auto=format&fit=crop&w=900&q=80'
                }
                alt={movieDetails.title}
                width={400}
                height={600}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
            </div>

            <div className="space-y-4">
              {isMobile && (
                <div className="space-y-1">
                  <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-blue-400 to-fuchsia-400">
                    {movieDetails.title}
                  </h2>
                  <p className="text-gray-400 text-sm">
                    {(() => {
                      try {
                        const genres = Array.isArray(movieDetails.genres)
                          ? movieDetails.genres
                          : typeof movieDetails.genres === 'string'
                            ? JSON.parse(movieDetails.genres as string)
                            : [];
                        return Array.isArray(genres) && genres.length > 0 ? genres.join(' • ') : 'Chưa phân loại';
                      } catch {
                        return 'Chưa phân loại';
                      }
                    })()}
                  </p>
                </div>
              )}

              <div>
                <h3 className="text-base font-semibold text-cyan-300 mb-2 flex items-center gap-2">
                  <span className="w-1 h-4 bg-gradient-to-b from-cyan-400 to-blue-500 rounded-full"></span>
                  Mô tả
                </h3>
                <p className="text-gray-300 leading-relaxed text-sm">
                  {movieDetails.description || 'Chưa có mô tả cho bộ phim này.'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                {movieDetails.rating !== null && movieDetails.rating !== undefined && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-white/10">
                    <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                    <span className="text-white font-medium text-sm">{movieDetails.rating.toFixed(1)} / 10</span>
                  </div>
                )}
                {movieDetails.duration_min && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-white/10">
                    <Clock className="h-4 w-4 text-cyan-400" />
                    <span className="text-white font-medium text-sm">{movieDetails.duration_min} phút</span>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );

  const MovieFooter = () =>
    movieDetails && (
      <div
        className={cn(
          'flex gap-3 border-t border-white/10 bg-gradient-to-br from-[#0b1226] via-[#0e1b3d] to-[#050915] shrink-0',
          isMobile ? 'p-4 justify-between sticky bottom-0' : 'px-6 py-4 justify-end'
        )}
      >
        <Button
          variant="outline"
          onClick={() => setIsModalOpen(false)}
          className="border-white/20 text-white hover:bg-white/10 hover:text-white hover:border-cyan-400/50 transition-all flex-1 md:flex-none"
        >
          Đóng
        </Button>
        <Button
          onClick={handleBookTicket}
          className="bg-gradient-to-r from-cyan-400 via-blue-600 to-fuchsia-500 hover:from-fuchsia-500 hover:via-cyan-400 hover:to-blue-600 text-white font-semibold shadow-[0_0_30px_rgba(59,130,246,0.4)] hover:shadow-[0_0_40px_rgba(236,72,153,0.6)] transition-all duration-300 hover:scale-105 flex-1 md:flex-none"
        >
          <Ticket className="h-4 w-4 mr-2" />
          Đặt vé ngay
        </Button>
      </div>
    );

  return (
    <section
      id="films"
      className="relative py-20 px-2 bg-gradient-to-b from-[#050915] via-[#070b1e] to-[#050915] overflow-hidden"
    >
      <div className="absolute inset-0 opacity-60 neon-noise pointer-events-none" />
      <div className="absolute -left-10 -top-10 w-72 h-72 rounded-full bg-cyan-500/15 blur-3xl pointer-events-none" />
      <div className="absolute right-0 bottom-0 w-96 h-96 rounded-full bg-fuchsia-500/10 blur-[120px] pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs font-bold uppercase tracking-widest backdrop-blur-md shadow-[0_0_20px_rgba(6,182,212,0.2)]">
              <Ticket className="w-4 h-4 text-cyan-400" />
              <span>Thư Viện Phim Chiếu Rạp</span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
              Thư viện phim{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-blue-400">
                hologram 8K
              </span>
            </h2>
            <p className="text-slate-300 text-sm sm:text-base max-w-2xl leading-relaxed">
              Lướt qua các suất chiếu đa chiều. Chọn phim để mở chi tiết và chuyển tới bước đặt vé ngay.
            </p>
          </div>
          <div className="flex items-center gap-3 self-end md:self-auto">
            <Button
              variant="ghost"
              className="w-10 h-10 rounded-xl bg-white/[0.07] hover:bg-white/[0.15] border border-white/15 text-white hover:border-cyan-400/50 hover:shadow-[0_0_15px_rgba(6,182,212,0.3)] disabled:opacity-30 transition-all flex items-center justify-center p-0"
              onClick={scrollPrev}
              disabled={!canScrollPrev}
              aria-label="Xem phim trước đó"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              className="w-10 h-10 rounded-xl bg-white/[0.07] hover:bg-white/[0.15] border border-white/15 text-white hover:border-cyan-400/50 hover:shadow-[0_0_15px_rgba(6,182,212,0.3)] disabled:opacity-30 transition-all flex items-center justify-center p-0"
              onClick={scrollNext}
              disabled={!canScrollNext}
              aria-label="Xem phim tiếp theo"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {!mounted ? (
          <div className="w-full">
            <div className="container mx-auto px-3 relative z-10">
              <div className="h-8 w-24 bg-white/10 rounded mb-3" />
              <div className="h-10 w-96 max-w-full bg-white/10 rounded mb-2" />
              <div className="h-5 w-[min(32rem,100%)] bg-white/10 rounded" />
            </div>
          </div>
        ) : films.length > 0 ? (
          <div ref={emblaRef} className="overflow-hidden pb-4 w-full">
            <div className="flex -ml-6 mx-5 touch-pan-y">
              {films.map((film, index) => (
                <motion.div
                  key={film.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05, duration: 0.45 }}
                  className="flex-[0_0_auto] min-w-[240px] md:min-w-[280px] pl-6"
                >
                  <motion.button
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex((prev) => (prev === index ? null : prev))}
                    onTouchStart={() => {
                      setHoveredIndex(index);
                      setLastTapTime(Date.now());
                    }}
                    onClick={() => {
                      handleOpen(film);
                    }}
                    className="group relative w-full rounded-3xl overflow-hidden border border-white/10 bg-slate-900 backdrop-blur-lg shadow-[0_0_30px_rgba(59,130,246,0.2)] hover:shadow-[0_0_40px_rgba(236,72,153,0.25)] transition-all duration-300"
                  >
                    <div className="relative h-80 w-full overflow-hidden will-change-transform">
                      <div
                        className="absolute inset-0 bg-center bg-cover blur-md object-cover scale-110 opacity-30"
                        style={{ backgroundImage: `url(${optimizeCloudinaryUrl(film.poster, 100, 'auto:low')})` }}
                      />
                      <img
                        src={optimizeCloudinaryUrl(film.poster, 400)}
                        srcSet={generateCloudinarySrcSet(film.poster, [300, 400, 600])}
                        sizes="(max-width: 768px) 280px, 400px"
                        alt={film.title}
                        width={280}
                        height={320}
                        loading={index === 0 ? 'eager' : 'lazy'}
                        fetchPriority={index === 0 ? 'high' : 'low'}
                        decoding="async"
                        className="absolute object-cover inset-0 w-full h-full transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                      <div
                        className={`absolute bottom-4 left-4 right-4 space-y-2 text-left opacity-0 transition-opacity duration-300 ${
                          hoveredIndex === index ? 'opacity-100' : 'group-hover:opacity-100'
                        }`}
                      >
                        <p className="text-xs uppercase tracking-[0.18em] text-cyan-200">{film.genre}</p>
                        <h3 className="text-xl font-semibold text-white drop-shadow-lg">{film.title}</h3>
                        <div className="inline-flex hover:bg-white/20 items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-sm text-white transition-colors">
                          <Play className="h-4 w-4 text-cyan-300" />
                          Mở chi tiết
                        </div>
                      </div>
                    </div>
                  </motion.button>
                </motion.div>
              ))}
            </div>
          </div>
        ) : (
          <div className="w-full text-center text-gray-400 py-20 bg-white/5 rounded-xl border border-white/10 backdrop-blur-sm">
            <p className="text-xl font-medium text-cyan-100 mb-2">Không có phim</p>
            <p className="text-sm">Hiện tại chưa có phim nào đang chiếu. Vui lòng quay lại sau.</p>
          </div>
        )}
      </div>

      {isMobile ? (
        <Drawer open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DrawerContent className="bg-gradient-to-br from-[#0b1226] via-[#0e1b3d] to-[#050915] border-t border-cyan-500/30 text-white p-0 max-h-[96vh]">
            <DrawerHeader className="text-left sr-only">
              <DrawerTitle>{movieDetails?.title || 'Chi tiết phim'}</DrawerTitle>
              <DrawerDescription>Thông tin chi tiết về phim</DrawerDescription>
            </DrawerHeader>
            <MovieContent />
            <MovieFooter />
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] flex z-[9999] flex-col bg-gradient-to-br from-[#0b1226] via-[#0e1b3d] to-[#050915] border border-cyan-500/30 text-white p-0 shadow-[0_0_50px_rgba(59,130,246,0.3)]">
            <div className="overflow-y-auto scrollbar-neon flex-1 px-6 pt-6 pb-4">
              <DialogHeader className="mb-4">
                <DialogTitle
                  className={cn(
                    'text-3xl font-bold mb-2',
                    !movieDetails && 'sr-only',
                    movieDetails &&
                      'text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-blue-400 to-fuchsia-400'
                  )}
                >
                  {movieDetails?.title || 'Chi tiết phim'}
                </DialogTitle>
                <DialogDescription className={cn('text-gray-300 text-sm', !movieDetails && 'sr-only')}>
                  {movieDetails
                    ? (() => {
                        try {
                          const genres = Array.isArray(movieDetails.genres)
                            ? movieDetails.genres
                            : typeof movieDetails.genres === 'string'
                              ? JSON.parse(movieDetails.genres as string)
                              : [];
                          return Array.isArray(genres) && genres.length > 0 ? genres.join(' • ') : 'Chưa phân loại';
                        } catch {
                          return 'Chưa phân loại';
                        }
                      })()
                    : 'Thông tin chi tiết về bộ phim'}
                </DialogDescription>
              </DialogHeader>
              <MovieContent />
            </div>
            <MovieFooter />
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}
