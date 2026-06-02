'use client';

import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { LazyMotion, domAnimation, m, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { Play, Sparkles, Waves, Clock, Star, Calendar, Ticket } from 'lucide-react';
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

// Local static assets served from Next.js public/ folder
const heroImage1 = '/images/1.webp';
const heroImage9 = '/images/9.webp';

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

        const [currentPosterIndex, setCurrentPosterIndex] = useState(0);
        const videoRef = useRef<HTMLVideoElement>(null);
        const videoContainerRef = useRef<HTMLDivElement>(null);
        const [isVideoPlaying, setIsVideoPlaying] = useState(false);
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

        const [hasStarted, setHasStarted] = useState(false);
        const moviePosters = useMemo(() => [heroImage1, heroImage9], []);

        const { data: movies = initialMovies } = useQuery({
                queryKey: ['activeMovies', selectedBranch?.id],
                queryFn: () => getActiveMoviesToday(selectedBranch?.id),
                initialData: initialMovies,
                staleTime: 0 // Fetch real-time data when branch changes
        });

        // Preload first poster immediately, second on idle — mirrors React implementation
        useEffect(() => {
                const first = moviePosters[0];
                if (!first) return;
                const img = new Image();
                img.src = first;
                if (moviePosters.length < 2) return;
                let cancelled = false;
                const loadSecond = () => {
                        if (cancelled) return;
                        const img2 = new Image();
                        img2.src = moviePosters[1];
                };
                let idleId: number | undefined;
                let timeoutId: number | undefined;
                if (typeof requestIdleCallback !== 'undefined') {
                        idleId = requestIdleCallback(loadSecond) as unknown as number;
                } else {
                        timeoutId = window.setTimeout(loadSecond, 400) as unknown as number;
                }
                return () => {
                        cancelled = true;
                        if (idleId !== undefined) cancelIdleCallback(idleId);
                        if (timeoutId !== undefined) clearTimeout(timeoutId);
                };
        }, [moviePosters]);

        useEffect(() => {
                if (moviePosters.length <= 1) return;
                const interval = setInterval(() => {
                        setCurrentPosterIndex((prev) => (prev + 1) % moviePosters.length);
                }, 5000);
                return () => clearInterval(interval);
        }, [moviePosters.length]);

        useEffect(() => {
                const video = videoRef.current;
                if (!video) return;
                const PREVIEW_TIME = 1;
                const handleLoadedMetadata = () => {
                        video.currentTime = PREVIEW_TIME;
                };
                video.addEventListener('loadedmetadata', handleLoadedMetadata);
                video.pause();
                setIsVideoPlaying(false);
                if (video.readyState >= 1) {
                        video.currentTime = PREVIEW_TIME;
                }
                return () => {
                        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
                };
        }, [heroVideoSrc]);

        useEffect(() => {
                const handleGlobalPlay = (e: any) => {
                        if (e.detail?.id !== SECTION_ID) {
                                if (videoRef.current && !videoRef.current.paused) {
                                        videoRef.current.pause();
                                        setIsVideoPlaying(false);
                                }
                        }
                };
                window.addEventListener('cinesphere-video-play', handleGlobalPlay);
                return () => window.removeEventListener('cinesphere-video-play', handleGlobalPlay);
        }, []);

        const notifyGlobalPlay = useCallback(() => {
                window.dispatchEvent(
                        new CustomEvent('cinesphere-video-play', {
                                detail: { id: SECTION_ID }
                        })
                );
        }, []);

        useEffect(() => {
                if (!videoContainerRef.current) return;
                const observer = new IntersectionObserver(
                        (entries) => {
                                entries.forEach((entry) => {
                                        if (!entry.isIntersecting) {
                                                if (videoRef.current && !videoRef.current.paused) {
                                                        videoRef.current.pause();
                                                        setIsVideoPlaying(false);
                                                }
                                        }
                                });
                        },
                        { threshold: 0.1 }
                );
                observer.observe(videoContainerRef.current);
                return () => observer.disconnect();
        }, []);

        const toggleVideoPlayback = async () => {
                if (!hasStarted) {
                        setHasStarted(true);
                        setIsVideoPlaying(true);
                        notifyGlobalPlay();
                        return;
                }
                const video = videoRef.current;
                if (!video) return;
                try {
                        if (video.paused) {
                                await video.play();
                                setIsVideoPlaying(true);
                                notifyGlobalPlay();
                        } else {
                                video.pause();
                                setIsVideoPlaying(false);
                        }
                } catch (error) {
                        console.error('Error toggling video playback:', error);
                }
        };

        const handleBookTicket = () => {
                if (!selectedMovieId) return;
                if (movieDetails) {
                        try {
                                const movie = movies.find((m: any) => m.id === movieDetails.id);
                                if (movie) {
                                        localStorage.setItem(
                                                'selectedFilm',
                                                JSON.stringify({
                                                        id: movie.id,
                                                        title: movie.title,
                                                        poster: movie.cover_image
                                                })
                                        );
                                        setCookie('selected_branch_id', String(selectedBranch?.id ?? ''), 60 * 60 * 24 * 30);
                                }
                        } catch { }
                }
                setIsModalOpen(false);

                // Show branch confirmation dialog if not disabled
                if (!dontShowConfirm && selectedBranch) {
                        setShowBranchConfirmDialog(true);
                        return;
                }

                const params = new URLSearchParams(searchParams.toString());
                setCookie('selected_branch_id', String(selectedBranch?.id ?? ''), 60 * 60 * 24 * 30);
                router.push(`/booking${params.toString() ? `?${params.toString()}` : ''}`);
        };

        const movieDetails = useMemo(() => {
                if (!selectedMovieId) return null;
                return movieStore.getMovie(selectedMovieId);
        }, [selectedMovieId, storeUpdateTrigger]);

        return (
                <LazyMotion features={domAnimation} strict>
                        <section
                                id="hero"
                                className="relative min-h-[85vh] lg:min-h-screen overflow-hidden bg-gradient-to-br from-[#050915] via-[#0b1226] to-[#0e1b3d] text-white pt-16 sm:pt-24"
                                onMouseMove={isDesktopHero ? onMove : undefined}
                                onMouseEnter={isDesktopHero ? onMouseEnter : undefined}
                        >
                                <div className="absolute inset-0 bg-black">
                                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.4),transparent_30%),radial-gradient(circle_at_80%_30%,rgba(236,72,153,0.3),transparent_35%),radial-gradient(circle_at_50%_70%,rgba(34,211,238,0.35),transparent_30%)]" />
                                        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/50 to-[#050915]/95" />
                                </div>

                                <div className="absolute -left-24 top-10 w-[520px] h-[520px] rounded-full bg-cyan-500/15 blur-[120px] animate-pulse pointer-events-none" />
                                <m.div
                                        className="absolute -right-16 top-32 w-[420px] h-[420px] rounded-full bg-fuchsia-500/15 blur-[120px] pointer-events-none"
                                        style={{ x: blobX, y: blobY, translateZ: 0 }}
                                />

                                <div className="container mx-auto px-4 relative z-10 min-h-[calc(85vh-4rem)] lg:min-h-[calc(100vh-6rem)] flex flex-col justify-center py-8 sm:py-20">
                                        <div className="grid lg:grid-cols-2 gap-10 lg:gap-12 items-center">
                                                <m.div
                                                        initial={{ opacity: 0, x: -30 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ duration: 0.8, ease: 'easeOut' }}
                                                        className="max-w-3xl space-y-6"
                                                >
                                                        <m.h1
                                                                initial={{ opacity: 0, y: 20 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                transition={{ delay: 0.3 }}
                                                                className="text-6xl md:text-6xl lg:text-7xl font-extrabold leading-none tracking-tight flex flex-col gap-2"
                                                        >
                                                                <span className="bg-gradient-to-r from-cyan-300 via-blue-400 to-fuchsia-400 bg-clip-text text-transparent drop-shadow-[0_10px_40px_rgba(56,189,248,0.5)] py-2">
                                                                        CINESPHERE
                                                                </span>
                                                                <span className="text-white text-3xl md:text-3xl lg:text-5xl">Huyễn cảnh không gian</span>
                                                        </m.h1>

                                                        <m.p
                                                                initial={{ opacity: 0, y: 20 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                transition={{ delay: 0.4 }}
                                                                className="text-lg md:text-xl text-gray-200 leading-relaxed max-w-2xl"
                                                        >
                                                                Dùng không gian nhỏ mô phỏng thế giới vô biên. Mỗi suất chiếu là một hành trình nhập vai với độ phân
                                                                giải 8K và âm thanh đa tầng bao quanh
                                                        </m.p>

                                                        <m.div
                                                                initial={{ opacity: 0, y: 20 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                transition={{ delay: 0.5 }}
                                                                className="flex flex-wrap items-center gap-4 pt-2"
                                                        >
                                                                <Button
                                                                        className="group rounded-2xl px-9 py-8 text-base md:text-lg font-semibold bg-gradient-to-r from-cyan-400 via-blue-600 to-fuchsia-500 hover:from-fuchsia-500 hover:via-cyan-400 hover:to-blue-600 text-white shadow-[0_0_40px_rgba(59,130,246,0.6)] transition-all duration-500 hover:shadow-[0_0_60px_rgba(236,72,153,0.8)] hover:scale-105"
                                                                        onClick={() => {
                                                                                const bookingSection = document.getElementById('promotions');
                                                                                bookingSection?.scrollIntoView({ behavior: 'smooth' });
                                                                        }}
                                                                >
                                                                        <span className="flex items-center gap-2">
                                                                                Đặt vé ngay
                                                                                <Play className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                                                                        </span>
                                                                </Button>
                                                        </m.div>

                                                        <m.div
                                                                initial={{ opacity: 0, y: 20 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                transition={{ delay: 0.6 }}
                                                                className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl pt-4"
                                                        >
                                                                {[
                                                                        { icon: Waves, title: 'Âm thanh đa tầng', desc: 'Định vị 360° bao quanh' },
                                                                        { icon: Sparkles, title: 'Hiệu ứng vũ trụ', desc: 'Hào quang, photon, nebula' },
                                                                        { icon: Play, title: 'Độ phân giải 8K', desc: 'Màn hình đa chiều siêu nét' }
                                                                ].map(({ icon: Icon, title, desc }, idx) => (
                                                                        <m.div
                                                                                key={title}
                                                                                initial={{ opacity: 0, y: 24 }}
                                                                                animate={{ opacity: 1, y: 0 }}
                                                                                transition={{ delay: 0.7 + idx * 0.1, duration: 0.45 }}
                                                                                whileHover={{ scale: 1.05, y: -5 }}
                                                                                className="glass-tile rounded-2xl p-5 border border-white/15 bg-white/10 backdrop-blur-md hover:border-cyan-300/50 transition-all duration-300 cursor-pointer"
                                                                                style={{ x: cardX, y: cardY, translateZ: 0 }}
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
                                                                        </m.div>
                                                                ))}
                                                        </m.div>
                                                </m.div>

                                                <m.div
                                                        initial={{ opacity: 0, x: 30 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
                                                        className="relative z-40 w-full max-w-[min(100%,20rem)] sm:max-w-md mx-auto mt-4 lg:mt-0"
                                                >
                                                        <div
                                                                ref={videoContainerRef}
                                                                className="relative w-full aspect-[9/16] rounded-2xl sm:rounded-3xl overflow-hidden border-2 border-white/20 bg-black backdrop-blur-xl shadow-2xl group cursor-pointer"
                                                                onClick={!hasStarted ? toggleVideoPlayback : undefined}
                                                        >
                                                                <AnimatePresence mode="wait">
                                                                        {!hasStarted ? (
                                                                                <m.div
                                                                                        key="placeholder"
                                                                                        initial={{ opacity: 1 }}
                                                                                        exit={{ opacity: 0 }}
                                                                                        className="absolute inset-0 z-10"
                                                                                >
                                                                                        <img
                                                                                                src={heroVideoThumbnail || heroMedia?.url}
                                                                                                alt="Cinesphere Cinematic Experience"
                                                                                                width={448}
                                                                                                height={796}
                                                                                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                                                                                loading="eager"
                                                                                                fetchPriority="high"
                                                                                        />
                                                                                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors">
                                                                                                <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border-2 border-white/30 shadow-2xl group-hover:scale-110 transition-transform">
                                                                                                        <Play className="h-10 w-10 text-white ml-1" fill="white" />
                                                                                                </div>
                                                                                        </div>
                                                                                </m.div>
                                                                        ) : (
                                                                                <m.div
                                                                                        key="video"
                                                                                        initial={{ opacity: 0 }}
                                                                                        animate={{ opacity: 1 }}
                                                                                        className="absolute inset-0 z-0"
                                                                                >
                                                                                        <video
                                                                                                ref={videoRef}
                                                                                                src={heroVideoSrc}
                                                                                                className="w-full h-full object-cover bg-black"
                                                                                                loop
                                                                                                playsInline
                                                                                                autoPlay
                                                                                                onPlay={() => setIsVideoPlaying(true)}
                                                                                                onPause={() => setIsVideoPlaying(false)}
                                                                                        />
                                                                                        <div
                                                                                                className="absolute inset-0 z-10"
                                                                                                onClick={(e) => {
                                                                                                        e.stopPropagation();
                                                                                                        toggleVideoPlayback();
                                                                                                }}
                                                                                        >
                                                                                                <button
                                                                                                        className="absolute inset-0 flex items-center justify-center"
                                                                                                        aria-label={isVideoPlaying ? 'Pause video' : 'Play video'}
                                                                                                >
                                                                                                        <m.div
                                                                                                                animate={{
                                                                                                                        scale: isVideoPlaying ? 0 : 1,
                                                                                                                        opacity: isVideoPlaying ? 0 : 1
                                                                                                                }}
                                                                                                                className="w-16 h-16 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center border border-white/20"
                                                                                                        >
                                                                                                                <Play className="h-8 w-8 text-white ml-1" fill="white" />
                                                                                                        </m.div>
                                                                                                </button>
                                                                                        </div>
                                                                                </m.div>
                                                                        )}
                                                                </AnimatePresence>

                                                                <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-30 pointer-events-none">
                                                                        <div className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_10px_rgba(34,197,94,0.8)] animate-pulse" />
                                                                        <div className="px-3 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/20">
                                                                                <span className="text-xs text-white font-medium">8K VISION</span>
                                                                        </div>
                                                                </div>

                                                                <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent z-30 pointer-events-none">
                                                                        <p className="text-white font-semibold text-sm">Experience the Future</p>
                                                                        <p className="text-gray-300 text-xs">Phòng chiếu 360° Đa Chiều</p>
                                                                </div>
                                                        </div>
                                                </m.div>
                                        </div>
                                </div>
                        </section>

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
