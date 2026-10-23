'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Clock, MapPin, ChevronRight, Sparkles, Film, Compass, Ticket } from 'lucide-react';
import { getPublicSchedule, type PublicShowtime } from '@/lib/api/schedule';
import { getActiveTickets } from '@/lib/api/products';
import { useBranch } from '@/hooks/useBranch';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useRouter, useSearchParams } from 'next/navigation';
import { optimizeCloudinaryUrl } from '@/lib/utils';

function nowInVietnam(): string {
  return new Date().toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Ho_Chi_Minh'
  });
}

// Compute shortest rotation angle so clock hands glide smoothly without 360 jump
function getShortestAngle(prevAngle: number, targetAngle: number): number {
  const normPrev = ((prevAngle % 360) + 360) % 360;
  const normTarget = ((targetAngle % 360) + 360) % 360;
  let diff = normTarget - normPrev;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return prevAngle + diff;
}

// Convert "HH:MM" to { hourAngle, minuteAngle }
function timeToClockAngles(timeStr: string): { hourAngle: number; minuteAngle: number } {
  if (!timeStr) return { hourAngle: 0, minuteAngle: 0 };
  const [h = 0, m = 0] = timeStr.split(':').map(Number);
  const hour12 = h % 12;
  const hourAngle = hour12 * 30 + m * 0.5;
  const minuteAngle = m * 6;
  return { hourAngle, minuteAngle };
}

export default function MovieScheduleSection() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectedBranch } = useBranch();
  const [now, setNow] = useState(nowInVietnam);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(nowInVietnam()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  // Fetch Public Schedule
  const { data: scheduleData, isLoading: isLoadingSchedule } = useQuery({
    queryKey: ['publicSchedule', selectedBranch?.id],
    queryFn: () => getPublicSchedule(selectedBranch?.id),
    staleTime: 60 * 1000
  });

  // Fetch Active Tickets for direct booking append
  const { data: ticketsData } = useQuery({
    queryKey: ['activeTickets', selectedBranch?.id],
    queryFn: ({ signal }) => getActiveTickets(selectedBranch?.id, { signal }),
    staleTime: 60 * 1000
  });

  const allItems: PublicShowtime[] = scheduleData?.items || [];
  const opensAt = scheduleData?.opens_at;
  const closesAt = scheduleData?.closes_at;

  function timeToMinutes(t: string): number {
    if (!t) return 0;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }

  // Priority slot: đang chiếu → sắp chiếu gần nhất → suất cuối ngày (fallback)
  const prioritySlot = useMemo(() => {
    if (allItems.length === 0) return null;
    const sorted = [...allItems].sort((a, b) => a.start_time.localeCompare(b.start_time));
    const live = sorted.find((s) => now >= s.start_time && now < s.end_time);
    if (live) return live;
    const upcoming = sorted.find((s) => s.start_time > now);
    if (upcoming) return upcoming;
    return sorted[sorted.length - 1];
  }, [allItems, now]);

  const nextSlot = useMemo(() => {
    const sorted = [...allItems].sort((a, b) => a.start_time.localeCompare(b.start_time));
    return sorted.find((s) => s.start_time > now);
  }, [allItems, now]);

  // ── 3-MODE STATE ───────────────────────────────────────────────────────────
  // AUTO     : focusMode='auto'     → activeSlot = prioritySlot (đang/sắp chiếu)
  // PREVIEW  : hoveredSlotId set   → activeSlot = hovered slot (revert on leave)
  // SELECTED : focusMode='selected' → activeSlot = selectedSlotId (không auto-revert)
  // ---------------------------------------------------------------------------
  type FocusMode = 'auto' | 'selected';
  const [focusMode, setFocusMode] = useState<FocusMode>('auto');
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [hoveredSlotId, setHoveredSlotId] = useState<number | null>(null);

  // Derived: slot hiện tại đang được focus
  const activeSlot = useMemo(() => {
    // PREVIEW luôn được ưu tiên cao nhất (hover tạm)
    if (hoveredSlotId !== null) {
      const found = allItems.find((s) => s.id === hoveredSlotId);
      if (found) return found;
    }
    // SELECTED: user đã click chọn
    if (focusMode === 'selected' && selectedSlotId !== null) {
      const found = allItems.find((s) => s.id === selectedSlotId);
      if (found) return found;
    }
    // AUTO: luôn dùng priority slot
    return prioritySlot || allItems[0] || null;
  }, [allItems, hoveredSlotId, focusMode, selectedSlotId, prioritySlot]);

  // AUTO mode: khi prioritySlot thay đổi (now tick) → tự update nếu đang ở AUTO
  useEffect(() => {
    if (focusMode === 'auto' && prioritySlot) {
      setSelectedSlotId(null);
    }
  }, [prioritySlot, focusMode]);

  // Preload all movie covers into memory cache to eliminate any image loading flash/flicker
  useEffect(() => {
    if (!allItems || allItems.length === 0) return;
    const uniqueCovers = Array.from(new Set(allItems.map((s) => s.movie_cover_image).filter(Boolean)));
    uniqueCovers.forEach((cover) => {
      if (cover) {
        const img = new Image();
        img.src = optimizeCloudinaryUrl(cover, 300, 'auto:good') || cover;
      }
    });
  }, [allItems]);

  // Smooth Analog Clock Hand Angles (Cumulative for shortest path)
  const [hourHandAngle, setHourHandAngle] = useState(0);
  const [minuteHandAngle, setMinuteHandAngle] = useState(0);
  const prevHourRef = useRef(0);
  const prevMinuteRef = useRef(0);
  const isInitializedRef = useRef(false);

  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);

  // PREVIEW: hover → set hoveredSlotId tạm thời (debounce nhẹ chống flicker)
  const handleSlotHover = (slotId: number) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => setHoveredSlotId(slotId), 60);
  };

  // PREVIEW end: mouse leave → clear hover → revert về AUTO hoặc SELECTED
  const handleSlotLeave = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setHoveredSlotId(null);
  };

  // SELECTED: click slot
  // - Nếu click lại slot đang selected → deselect, về AUTO
  // - Nếu click slot khác → chuyển SELECTED sang slot đó
  const handleSlotClick = (slotId: number) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setHoveredSlotId(null);
    if (focusMode === 'selected' && selectedSlotId === slotId) {
      // Deselect → về AUTO
      setFocusMode('auto');
      setSelectedSlotId(null);
    } else {
      setFocusMode('selected');
      setSelectedSlotId(slotId);
    }
  };

  // Deselect về AUTO khi click bên ngoài section (reset)
  const handleSectionLeave = () => {
    if (focusMode === 'selected') return; // giữ nguyên khi đang SELECTED
    setHoveredSlotId(null);
  };

  useEffect(() => {
    return () => { if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current); };
  }, []);

  useEffect(() => {
    if (!activeSlot) return;
    const { hourAngle: targetHour, minuteAngle: targetMinute } = timeToClockAngles(activeSlot.start_time);

    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      prevHourRef.current = targetHour;
      prevMinuteRef.current = targetMinute;
      setHourHandAngle(targetHour);
      setMinuteHandAngle(targetMinute);
      return;
    }

    const nextHour = getShortestAngle(prevHourRef.current, targetHour);
    const nextMinute = getShortestAngle(prevMinuteRef.current, targetMinute);

    prevHourRef.current = nextHour;
    prevMinuteRef.current = nextMinute;

    setHourHandAngle(nextHour);
    setMinuteHandAngle(nextMinute);
  }, [activeSlot]);

  // 60 Minute ticks on the watch face (ViewBox 280 x 280, center at 140, 140)
  const clockTicks = useMemo(() => {
    return Array.from({ length: 60 }, (_, i) => {
      const angle = i * 6;
      const isHourTick = i % 5 === 0;
      const rad = (angle - 90) * (Math.PI / 180);
      const outerR = 126;
      const innerR = isHourTick ? 116 : 122;
      return {
        key: i,
        isHourTick,
        x1: 140 + innerR * Math.cos(rad),
        y1: 140 + innerR * Math.sin(rad),
        x2: 140 + outerR * Math.cos(rad),
        y2: 140 + outerR * Math.sin(rad)
      };
    });
  }, []);

  // 12 Hour Numerals (1 to 12)
  const clockNumerals = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const val = i === 0 ? 12 : i;
      const angle = (val % 12) * 30;
      const rad = (angle - 90) * (Math.PI / 180);
      const r = 102;
      return {
        val,
        x: 140 + r * Math.cos(rad),
        y: 140 + r * Math.sin(rad)
      };
    });
  }, []);

  // [CHANGED] Chỉ tính vị trí dot của activeSlot (bỏ nhiều dots rối trên bezel)
  const activeSlotMarker = useMemo(() => {
    if (!activeSlot) return null;
    const { hourAngle } = timeToClockAngles(activeSlot.start_time);
    const rad = (hourAngle - 90) * (Math.PI / 180);
    const r = 126;
    return { x: 140 + r * Math.cos(rad), y: 140 + r * Math.sin(rad) };
  }, [activeSlot]);

  // Handle Book Ticket: Append movie item to booking flow
  const handleBookSlot = (slot: PublicShowtime) => {
    const rawPackages = ticketsData?.items || [];
    // Find ticket package matching this movie or default to first package
    const matchedPackage =
      rawPackages.find((pkg: any) => (pkg.movies || []).some((m: any) => Number(m.id) === Number(slot.movie_id))) ||
      rawPackages[0];

    const branchId = selectedBranch?.id;

    const branchPkgMovies = (matchedPackage?.movies || []).filter((m: any) => {
      if (!branchId) return true;
      if (m.branch_id && m.branch_id !== branchId) return false;
      return true;
    });

    const finalSlotMovies =
      branchPkgMovies.length > 0
        ? branchPkgMovies
        : [{ id: slot.movie_id, title: slot.movie_title, duration_min: slot.movie_duration_min, cover_image: slot.movie_cover_image }];

    // Save direct booking item into sessionStorage
    try {
      sessionStorage.setItem(
        'directBookingItem',
        JSON.stringify({
          packageId: matchedPackage?.id || 1,
          type: 'movie',
          name: matchedPackage?.name || 'Vé Phim Cinesphere',
          price: Number(matchedPackage?.price || 0),
          movies: finalSlotMovies,
          quantity: 1,
          branchId,
          preferredMovieId: slot.movie_id,
          showtime: slot.start_time
        })
      );
    } catch {}

    // Also store selected film for seamless compatibility
    try {
      localStorage.setItem(
        'selectedFilm',
        JSON.stringify({
          id: slot.movie_id,
          title: slot.movie_title,
          cover_image: slot.movie_cover_image
        })
      );
    } catch {}

    const params = new URLSearchParams();
    if (branchId) params.set('branch_id', String(branchId));
    params.set('direct', '1');
    params.set('movie_id', String(slot.movie_id));
    if (matchedPackage?.id) params.set('package_id', String(matchedPackage.id));
    params.set('time', slot.start_time);

    router.push(`/booking?${params.toString()}`);
  };

  return (
    <section
      id="schedule"
      className="relative py-8 sm:py-20 px-2 sm:px-3 bg-gradient-to-b from-[#050915] via-[#070e24] to-[#050915] overflow-hidden"
    >
      {/* Sci-Fi Ambient Glows */}
      <div className="absolute top-1/4 left-1/4 w-[350px] sm:w-[450px] h-[350px] sm:h-[450px] rounded-full bg-cyan-500/10 blur-[120px] sm:blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[350px] sm:w-[450px] h-[350px] sm:h-[450px] rounded-full bg-purple-600/10 blur-[120px] sm:blur-[140px] pointer-events-none" />

      <div className="container mx-auto max-w-6xl relative z-10">
        {/* Header Title */}
        <div className="text-center max-w-2xl mx-auto mb-5 sm:mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[11px] sm:text-xs font-bold uppercase tracking-wider mb-2 sm:mb-3 backdrop-blur-md">
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span>Đồng Hồ Suất Chiếu Cinesphere</span>
          </div>
          <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
            Lịch chiếu phim{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-fuchsia-400">
              hàng ngày
            </span>
          </h2>

          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-slate-300 text-[11px] sm:text-xs mt-2.5 sm:mt-3">
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-white/5 border border-white/10 font-medium">
              <MapPin className="w-3 h-3 text-cyan-400" />
              {selectedBranch?.name || 'Cinesphere'}
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-white/5 border border-white/10 font-medium">
              <Clock className="w-3 h-3 text-purple-400" />
              {opensAt && closesAt ? `Mở cửa: ${opensAt} – ${closesAt}` : 'Mở cửa hàng ngày'}
            </span>
          </div>
        </div>

        {/* Content Body */}
        {isLoadingSchedule ? (
          <div className="flex items-center justify-center py-16 sm:py-20 text-slate-400 gap-3 text-xs sm:text-sm bg-white/5 rounded-2xl sm:rounded-3xl border border-white/10">
            <Clock className="w-5 h-5 sm:w-6 sm:h-6 animate-spin text-cyan-400" />
            <span>Đang nạp đồng hồ lịch chiếu...</span>
          </div>
        ) : allItems.length === 0 ? (
          <div className="text-center py-12 sm:py-16 px-4 bg-white/5 rounded-2xl sm:rounded-3xl border border-white/10 backdrop-blur-md">
            <p className="text-base sm:text-lg font-bold text-cyan-200">Chưa có lịch chiếu hôm nay</p>
            <p className="text-xs text-slate-400 mt-1">
              {selectedBranch?.name
                ? `${selectedBranch.name} chưa cấu hình lịch chiếu.`
                : 'Vui lòng chọn chi nhánh để xem lịch chiếu.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-8 items-center bg-slate-950/80 border border-white/15 rounded-2xl sm:rounded-3xl p-3.5 sm:p-8 backdrop-blur-2xl shadow-[0_25px_70px_rgba(0,0,0,0.8)]">
            {/* 1. LEFT COLUMN: COMPACT & SHARP ANALOG CLOCK */}
            <div className="lg:col-span-6 flex flex-col items-center justify-center relative select-none py-1 sm:py-2">
              <div className="relative w-[220px] h-[220px] sm:w-[300px] sm:h-[300px] lg:w-[340px] lg:h-[340px] flex items-center justify-center">
                {/* Radial Glow Halo behind Bezel */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-cyan-500/20 via-blue-600/20 to-purple-600/25 blur-2xl sm:blur-3xl pointer-events-none" />

                {/* SVG Analog Clock Face (ViewBox 0 0 280 280, Center: 140, 140) */}
                <svg
                  className="w-full h-full relative z-10 drop-shadow-[0_10px_35px_rgba(0,0,0,0.9)]"
                  viewBox="0 0 280 280"
                >
                  <defs>
                    <linearGradient id="analog-bezel-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
                      <stop offset="30%" stopColor="#1e293b" />
                      <stop offset="70%" stopColor="#0f172a" />
                      <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.5" />
                    </linearGradient>
                    <radialGradient id="analog-dial-grad" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#0a1532" />
                      <stop offset="75%" stopColor="#050a1b" />
                      <stop offset="100%" stopColor="#02050f" />
                    </radialGradient>
                    <linearGradient id="analog-hour-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#e2e8f0" />
                      <stop offset="50%" stopColor="#ffffff" />
                      <stop offset="100%" stopColor="#94a3b8" />
                    </linearGradient>
                    <linearGradient id="analog-minute-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#38bdf8" />
                      <stop offset="50%" stopColor="#22d3ee" />
                      <stop offset="100%" stopColor="#0284c7" />
                    </linearGradient>
                  </defs>
                  <circle
                    cx="140"
                    cy="140"
                    r="138"
                    fill="url(#analog-bezel-grad)"
                    stroke="#0284c7"
                    strokeWidth="1"
                    strokeOpacity="0.3"
                  />
                  <circle
                    cx="140"
                    cy="140"
                    r="135"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="0.5"
                    strokeOpacity="0.15"
                  />
                  <circle cx="140" cy="140" r="132" fill="url(#analog-dial-grad)" />
                  <circle
                    cx="140"
                    cy="140"
                    r="114"
                    fill="none"
                    stroke="rgba(56,189,248,0.12)"
                    strokeWidth="1"
                    strokeDasharray="2 4"
                  />
                  <circle cx="140" cy="140" r="90" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                  <circle
                    cx="140"
                    cy="140"
                    r="62"
                    fill="none"
                    stroke="rgba(56,189,248,0.15)"
                    strokeWidth="0.75"
                    strokeDasharray="1 3"
                  />
                  {clockTicks.map((t) => (
                    <line
                      key={t.key}
                      x1={t.x1}
                      y1={t.y1}
                      x2={t.x2}
                      y2={t.y2}
                      stroke={t.isHourTick ? '#38bdf8' : 'rgba(255,255,255,0.2)'}
                      strokeWidth={t.isHourTick ? '2' : '0.8'}
                      strokeLinecap="round"
                    />
                  ))}
                  {clockNumerals.map((num) => (
                    <text
                      key={num.val}
                      x={num.x}
                      y={num.y + 3.5}
                      textAnchor="middle"
                      fill={num.val % 3 === 0 ? '#38bdf8' : '#94a3b8'}
                      fontSize={num.val % 3 === 0 ? '11' : '9.5'}
                      fontWeight="bold"
                      fontFamily="sans-serif"
                      letterSpacing="-0.5px"
                      className="transition-colors duration-300"
                    >
                      {num.val}
                    </text>
                  ))}
                  <g transform="translate(140, 195)">
                    <rect
                      x="-32"
                      y="-12"
                      width="64"
                      height="22"
                      rx="6"
                      fill="#030712"
                      stroke="#0ea5e9"
                      strokeWidth="1"
                      strokeOpacity="0.4"
                    />
                    <text
                      x="0"
                      y="3"
                      textAnchor="middle"
                      fill="#22d3ee"
                      fontSize="9.5"
                      fontWeight="900"
                      fontFamily="monospace"
                    >
                      {activeSlot?.start_time || '--:--'}
                    </text>
                  </g>
                  {/* Dot duy nhất trên bezel: pulse khi live+AUTO, fuchsia khi SELECTED, cyan khi PREVIEW */}
                  {activeSlotMarker && (() => {
                    const isLiveSlot = activeSlot ? now >= activeSlot.start_time && now < activeSlot.end_time : false;
                    const showPulse = isLiveSlot && focusMode === 'auto';
                    const dotColor = focusMode === 'selected' ? '#d946ef' : '#38bdf8';
                    const ringColor = focusMode === 'selected' ? '#d946ef' : (showPulse ? '#34d399' : '#38bdf8');
                    return (
                      <g className="pointer-events-none">
                        {/* Pulse ring chỉ khi đang chiếu + AUTO mode */}
                        {showPulse && (
                          <circle
                            cx={activeSlotMarker.x}
                            cy={activeSlotMarker.y}
                            r="11"
                            fill="none"
                            stroke="#34d399"
                            strokeWidth="1"
                            strokeOpacity="0.4"
                            className="animate-ping"
                          />
                        )}
                        <circle
                          cx={activeSlotMarker.x}
                          cy={activeSlotMarker.y}
                          r="8"
                          fill="none"
                          stroke={ringColor}
                          strokeWidth="1.5"
                          strokeOpacity="0.5"
                          className="transition-all duration-500"
                        />
                        <circle
                          cx={activeSlotMarker.x}
                          cy={activeSlotMarker.y}
                          r="4.5"
                          fill={dotColor}
                          stroke="#ffffff"
                          strokeWidth="1.5"
                          className="transition-all duration-500"
                        />
                      </g>
                    );
                  })()}
                  <g
                    style={{
                      transform: `rotate(${hourHandAngle}deg)`,
                      transformOrigin: '140px 140px',
                      transition: 'transform 0.75s cubic-bezier(0.25, 1, 0.5, 1)'
                    }}
                  >
                    <path
                      d="M 137.5 140 L 138.5 86 L 140 76 L 141.5 86 L 142.5 140 L 141 150 L 139 150 Z"
                      fill="url(#analog-hour-grad)"
                      filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.8))"
                    />
                  </g>
                  <g
                    style={{
                      transform: `rotate(${minuteHandAngle}deg)`,
                      transformOrigin: '140px 140px',
                      transition: 'transform 0.8s cubic-bezier(0.25, 1, 0.5, 1)'
                    }}
                  >
                    <path
                      d="M 138 140 L 139 52 L 140 42 L 141 52 L 142 140 L 141 155 L 139 155 Z"
                      fill="url(#analog-minute-grad)"
                      filter="drop-shadow(0px 2px 5px rgba(6,182,212,0.6))"
                    />
                  </g>
                  <circle
                    cx="140"
                    cy="140"
                    r="8.5"
                    fill="#0f172a"
                    stroke="#38bdf8"
                    strokeWidth="2"
                    filter="drop-shadow(0 2px 4px rgba(0,0,0,0.9))"
                  />
                  <circle cx="140" cy="140" r="5" fill="#0284c7" />
                  <circle cx="140" cy="140" r="2.5" fill="#ffffff" />
                </svg>
              </div>

            </div>

            {/* 2. RIGHT COLUMN: HORIZONTAL MOVIE SHOWCASE & DIRECT BOOKING ACTION */}
            <div className="lg:col-span-6 flex flex-col justify-between h-full space-y-3.5 sm:space-y-6">
              {activeSlot ? (
                <div className={`bg-gradient-to-br from-slate-900/95 via-[#081333]/90 to-slate-950/95 rounded-xl sm:rounded-2xl p-3.5 sm:p-6 border transition-all duration-300 flex flex-row gap-3.5 sm:gap-5 items-center sm:items-start ${
                  focusMode === 'selected'
                    ? 'border-fuchsia-500/50 shadow-[0_0_35px_rgba(168,85,247,0.2)]'
                    : 'border-cyan-500/30 shadow-[0_0_35px_rgba(6,182,212,0.15)]'
                }`}>
                  <div className="w-20 h-28 sm:w-36 sm:h-48 rounded-lg sm:rounded-xl overflow-hidden bg-slate-950 shrink-0 border border-white/20 shadow-xl relative group">
                    {activeSlot.movie_cover_image ? (
                      <img
                        key={activeSlot.movie_id}
                        src={
                          optimizeCloudinaryUrl(activeSlot.movie_cover_image, 300, 'auto:good') ||
                          activeSlot.movie_cover_image
                        }
                        alt={activeSlot.movie_title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 bg-slate-900">
                        <Film className="w-6 h-6 sm:w-8 sm:h-8 mb-1 text-slate-600" />
                        <span className="text-[9px] sm:text-[10px]">Cinesphere</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                  </div>

                  <div className="flex-1 min-w-0 space-y-1.5 sm:space-y-3.5 text-left">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <span className="px-2 py-0.5 sm:px-3 sm:py-1 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-[11px] sm:text-xs font-black">
                        {activeSlot.start_time} – {activeSlot.end_time}
                      </span>

                      {now >= activeSlot.start_time && now < activeSlot.end_time ? (
                        <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">
                          ● Đang chiếu
                        </span>
                      ) : activeSlot.id === nextSlot?.id ? (
                        <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-blue-500/20 border border-blue-400/40 text-blue-300 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">
                          Suất kế tiếp
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-white/10 text-slate-300 text-[9px] sm:text-[10px] font-medium">
                          Sắp chiếu
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm sm:text-2xl font-black text-white leading-tight line-clamp-1 sm:line-clamp-2">
                      {activeSlot.movie_title}
                    </h3>

                    <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs text-slate-400 font-medium">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-cyan-400" />
                        {activeSlot.movie_duration_min || '--'} phút
                      </span>
                      <span>•</span>
                      <span>8K / Âm vòm</span>
                    </div>

                    {/* Nút Đặt vé: chỉ hiện ở SELECTED mode */}
                    {focusMode === 'selected' && (
                      <div className="pt-1 sm:pt-2 flex items-center gap-2">
                        <Button
                          onClick={() => handleBookSlot(activeSlot)}
                          className="px-4 py-2 sm:px-6 sm:py-4 rounded-lg sm:rounded-xl bg-gradient-to-r from-fuchsia-500 via-purple-600 to-blue-600 hover:from-blue-600 hover:to-fuchsia-500 text-white font-bold shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all duration-300 hover:scale-[1.02] active:scale-95 cursor-pointer text-xs sm:text-sm"
                        >
                          <span className="flex items-center gap-1.5 sm:gap-2">
                            <Ticket className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            Đặt vé suất này
                            <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          </span>
                        </Button>
                        <button
                          onClick={() => { setFocusMode('auto'); setSelectedSlotId(null); }}
                          className="text-[10px] sm:text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer underline underline-offset-2"
                        >
                          Bỏ chọn
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {/* ALL SHOWTIMES QUICK TIMELINE STRIP */}
              <div className="space-y-1.5 sm:space-y-2.5">
                <div className="flex items-center justify-between text-[11px] sm:text-xs text-slate-400">
                  <span className="font-bold text-slate-300">Tất cả các suất chiếu:</span>
                  <span className="text-[10px] sm:text-[11px] text-cyan-400 font-semibold">
                    {allItems.length} suất chiếu
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-1.5 sm:flex sm:flex-wrap sm:gap-2 sm:max-h-36 sm:overflow-y-auto sm:pr-1 custom-scrollbar">
                  {allItems.map((slot) => {
                    const isActiveDisplay = activeSlot?.id === slot.id;
                    const isPinned = focusMode === 'selected' && selectedSlotId === slot.id;
                    const isLive = now >= slot.start_time && now < slot.end_time;
                    const isPast = slot.end_time < now;

                    return (
                      <button
                        key={slot.id}
                        onClick={() => !isPast && handleSlotClick(slot.id)}
                        onMouseEnter={() => !isPast && handleSlotHover(slot.id)}
                        onMouseLeave={handleSlotLeave}
                        disabled={isPast}
                        title={isPast ? 'Suất đã kết thúc' : undefined}
                        className={`w-full py-2 rounded-lg text-xs font-bold transition-all duration-200 border text-center sm:w-auto sm:px-3 sm:py-1.5 sm:shrink ${
                          isPast
                            ? 'opacity-35 cursor-not-allowed bg-white/3 border-white/5 text-slate-500'
                            : isPinned
                              ? 'bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white font-black border-fuchsia-300 shadow-[0_0_15px_rgba(168,85,247,0.5)] scale-105 cursor-pointer'
                              : isActiveDisplay
                                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black border-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.6)] scale-105 cursor-pointer'
                                : isLive
                                  ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300 cursor-pointer hover:bg-emerald-900/60'
                                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300 hover:text-white cursor-pointer'
                        }`}
                      >
                        {slot.start_time}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
