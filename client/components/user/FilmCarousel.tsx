import { useMemo, useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Play, Clock, Star, Calendar, Ticket } from 'lucide-react';
import { getAllActiveMoviesToday, getMovieById } from '@/lib/api';
import { optimizeCloudinaryUrl, generateCloudinarySrcSet, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { movieStore } from '@/store/movieStore';
import useEmblaCarousel from 'embla-carousel-react';
import type { EmblaCarouselType } from 'embla-carousel';

interface FilmCarouselProps {
  onSelectFilm?: () => void;
}

export default function FilmCarousel({ onSelectFilm }: FilmCarouselProps) {
  const navigate = useNavigate();
  const [selectedMovieId, setSelectedMovieId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [storeUpdateTrigger, setStoreUpdateTrigger] = useState(0);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [lastTapTime, setLastTapTime] = useState(0);
  const isTouchDevice = useMemo(
    () =>
      typeof window !== 'undefined' &&
      ('ontouchstart' in window || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)),
    []
  );

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

  const { data } = useQuery({
    queryKey: ['activeMovies'],
    queryFn: ({ signal }) => getAllActiveMoviesToday({ signal }),
    staleTime: 60000
  });

  const films = useMemo(() => {
    const fetched =
      data?.activeMovies
        ?.filter((m: any) => m.id != null && typeof m.id === 'number')
        ?.map((m: any) => ({
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
        })) || [];

    return fetched;
  }, [data]);

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
    emblaApi.on('reInit', onSelect);
    emblaApi.on('select', onSelect);

    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, onSelect]);

  // Navigation handlers
  const scrollPrev = useCallback(() => {
    emblaApi?.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    emblaApi?.scrollNext();
  }, [emblaApi]);

  const handleOpen = async (film: any) => {
    if (typeof film.id === 'string' && film.id.startsWith('placeholder')) {
      return;
    }
    if (!film.id || typeof film.id !== 'number') {
      console.error('Invalid film ID:', film);
      return;
    }
    onSelectFilm?.();
    setSelectedMovieId(film.id);
    setIsModalOpen(true);

    // Check if movie is in store, if not fetch and store it
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
      // Movie is already in store, trigger update to show it
      setStoreUpdateTrigger((prev) => prev + 1);
    }
  };

  // Get movie details from store
  const movieDetails = useMemo(() => {
    if (!selectedMovieId) return null;
    return movieStore.getMovie(selectedMovieId);
  }, [selectedMovieId, storeUpdateTrigger]);

  const handleBookTicket = () => {
    // Close the modal
    setIsModalOpen(false);

    // Save selected movie to localStorage for Booking page to pick up
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
    navigate('/booking');
  };

  return (
    <section
      id="films"
      className="relative py-20 px-2 bg-gradient-to-b from-[#050915] via-[#0b1226] to-[#0e1b3d] overflow-hidden"
    >
      <div className="absolute inset-0 opacity-60 neon-noise pointer-events-none" />
      <div className="absolute -left-10 -top-10 w-72 h-72 rounded-full bg-cyan-500/15 blur-3xl" />
      <div className="absolute right-0 bottom-0 w-96 h-96 rounded-full bg-fuchsia-500/10 blur-[120px]" />

      <div className="container mx-auto px-3 relative z-10">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-cyan-200">Phim</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white mt-2">Thư viện phim hologram 8K</h2>
            <p className="text-gray-300 mt-2 max-w-2xl">
              Lướt qua các suất chiếu đa chiều. Chọn phim để mở chi tiết và chuyển tới bước đặt vé ngay.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              className="rounded-full border border-white/15 text-white hover:border-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={scrollPrev}
              disabled={!canScrollPrev}
              aria-label="Xem phim trước đó"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              className="rounded-full border border-white/15 text-white hover:border-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={scrollNext}
              disabled={!canScrollNext}
              aria-label="Xem phim tiếp theo"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {films.length > 0 ? (
          <div ref={emblaRef} className="overflow-hidden pb-4 w-full ">
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
                        // @ts-ignore
                        fetchpriority={index === 0 ? 'high' : 'low'}
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
                        <div
                          onClick={() => {
                            handleOpen(film);
                          }}
                          className="inline-flex hover:bg-white/20 items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-sm text-white"
                        >
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

      {/* Movie Details Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex  z-[9999] flex-col bg-gradient-to-br from-[#0b1226] via-[#0e1b3d] to-[#050915] border border-cyan-500/30 text-white p-0 shadow-[0_0_50px_rgba(59,130,246,0.3)]">
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
                            ? JSON.parse(movieDetails.genres)
                            : [];
                        return Array.isArray(genres) && genres.length > 0 ? genres.join(' • ') : 'Chưa phân loại';
                      } catch {
                        return 'Chưa phân loại';
                      }
                    })()
                  : 'Thông tin chi tiết về bộ phim'}
              </DialogDescription>
            </DialogHeader>

            <div className="grid md:grid-cols-2 gap-6">
              {isLoadingDetails || !movieDetails ? (
                <div className="col-span-full flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-400 mx-auto mb-4"></div>
                    <p className="text-gray-400">Đang tải thông tin phim...</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Movie Poster */}
                  <div className="relative rounded-xl overflow-hidden border border-cyan-500/30 aspect-[2/3] shadow-[0_0_30px_rgba(59,130,246,0.2)]">
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

                  {/* Movie Info */}
                  <div className="space-y-4">
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

          {/* Fixed Footer with Buttons */}
          {movieDetails && (
            <div className=" flex justify-end gap-3 px-6 py-4 border-t border-white/10 bg-gradient-to-br from-[#0b1226] via-[#0e1b3d] to-[#050915] shrink-0">
              <Button
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                className="border-white/20 text-black hover:bg-white/10 hover:text-white hover:border-cyan-400/50 transition-all"
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
