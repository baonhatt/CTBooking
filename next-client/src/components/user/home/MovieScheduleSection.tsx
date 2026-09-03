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

  // Identify next upcoming slot or live slot
  const liveSlot = useMemo(() => allItems.find((s) => now >= s.start_time && now < s.end_time), [allItems, now]);
  const nextSlot = useMemo(() => allItems.find((s) => s.start_time > now), [allItems, now]);

  // Active selected/hovered slot ID
  const [activeSlotId, setActiveSlotId] = useState<number | null>(null);

  // Initialize active slot
  useEffect(() => {
    if (allItems.length > 0 && activeSlotId === null) {
      if (liveSlot) {
        setActiveSlotId(liveSlot.id);
      } else if (nextSlot) {
        setActiveSlotId(nextSlot.id);
      } else {
        setActiveSlotId(allItems[0].id);
      }
    }
  }, [allItems, liveSlot, nextSlot, activeSlotId]);

  const activeSlot = useMemo(() => {
    return allItems.find((s) => s.id === activeSlotId) || allItems[0] || null;
  }, [allItems, activeSlotId]);

  // Smooth Analog Clock Hand Angles (Cumulative for shortest path)
  const [hourHandAngle, setHourHandAngle] = useState(0);
  const [minuteHandAngle, setMinuteHandAngle] = useState(0);
  const prevHourRef = useRef(0);
  const prevMinuteRef = useRef(0);
  const isInitializedRef = useRef(false);

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

  // Showtime Markers along the clock bezel
  const slotMarkers = useMemo(() => {
    return allItems.map((slot) => {
      const { hourAngle } = timeToClockAngles(slot.start_time);
      const rad = (hourAngle - 90) * (Math.PI / 180);
      const r = 126;
      return {
        ...slot,
        angle: hourAngle,
        x: 140 + r * Math.cos(rad),
        y: 140 + r * Math.sin(rad)
      };
    });
  }, [allItems]);

  // Handle Book Ticket: Append movie item to booking flow
  const handleBookSlot = (slot: PublicShowtime) => {
    const rawPackages = ticketsData?.items || [];
    // Find ticket package matching this movie or default to first package
    const matchedPackage =
      rawPackages.find((pkg: any) => (pkg.movies || []).some((m: any) => Number(m.id) === Number(slot.movie_id))) ||
      rawPackages[0];

    const branchId = selectedBranch?.id;

    // Save direct booking item into sessionStorage
    try {
      sessionStorage.setItem(
        'directBookingItem',
        JSON.stringify({
          packageId: matchedPackage?.id || 1,
          type: 'movie',
          name: matchedPackage?.name || 'Vé Phim Cinesphere',
          price: Number(matchedPackage?.price || 0),
          movies: matchedPackage?.movies || [
            { id: slot.movie_id, title: slot.movie_title, duration_min: slot.movie_duration_min }
          ],
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
      className="relative py-14 sm:py-20 px-3 bg-gradient-to-b from-[#050915] via-[#070e24] to-[#050915] overflow-hidden"
    >
      {/* Sci-Fi Ambient Glows */}
      <div className="absolute top-1/4 left-1/4 w-[450px] h-[450px] rounded-full bg-cyan-500/10 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[450px] h-[450px] rounded-full bg-purple-600/10 blur-[140px] pointer-events-none" />

      <div className="container mx-auto max-w-6xl relative z-10">
        {/* Header Title */}
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs font-bold uppercase tracking-wider mb-3 backdrop-blur-md">
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span>Đồng Hồ Suất Chiếu Cinesphere</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
            Lịch chiếu phim{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-fuchsia-400">
              hàng ngày
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-2">
            Rê chuột hoặc chạm vào các múi giờ trên đồng hồ để xoay kim chỉ và hiển thị phim tương ứng.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 text-slate-300 text-xs mt-3">
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 font-medium">
              <MapPin className="w-3 h-3 text-cyan-400" />
              {selectedBranch?.name || 'Cinesphere'}
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 font-medium">
              <Clock className="w-3 h-3 text-purple-400" />
              {opensAt && closesAt ? `Mở cửa: ${opensAt} – ${closesAt}` : 'Mở cửa hàng ngày'}
            </span>
          </div>
        </div>

        {/* Content Body */}
        {isLoadingSchedule ? (
          <div className="flex items-center justify-center py-20 text-slate-400 gap-3 text-sm bg-white/5 rounded-3xl border border-white/10">
            <Clock className="w-6 h-6 animate-spin text-cyan-400" />
            <span>Đang nạp đồng hồ lịch chiếu...</span>
          </div>
        ) : allItems.length === 0 ? (
          <div className="text-center py-16 px-4 bg-white/5 rounded-3xl border border-white/10 backdrop-blur-md">
            <p className="text-lg font-bold text-cyan-200">Chưa có lịch chiếu hôm nay</p>
            <p className="text-xs text-slate-400 mt-1">
              {selectedBranch?.name
                ? `${selectedBranch.name} chưa cấu hình lịch chiếu.`
                : 'Vui lòng chọn chi nhánh để xem lịch chiếu.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-slate-950/80 border border-white/15 rounded-3xl p-5 sm:p-8 backdrop-blur-2xl shadow-[0_25px_70px_rgba(0,0,0,0.8)]">
            {/* 1. LEFT COLUMN: TRUE LUXURY ANALOG CHRONOMETER CLOCK */}
            <div className="lg:col-span-6 flex flex-col items-center justify-center relative select-none">
              <div className="relative w-[300px] h-[300px] sm:w-[360px] sm:h-[360px] flex items-center justify-center">
                {/* Radial Glow Halo behind Bezel */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-cyan-500/20 via-blue-600/20 to-purple-600/25 blur-3xl pointer-events-none" />

                {/* SVG Analog Clock Face (ViewBox 0 0 280 280, Center: 140, 140) */}
                <svg
                  className="w-full h-full relative z-10 drop-shadow-[0_10px_35px_rgba(0,0,0,0.9)]"
                  viewBox="0 0 280 280"
                >
                  <defs>
                    {/* Bezel Metallic Gradient */}
                    <linearGradient id="analog-bezel-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
                      <stop offset="30%" stopColor="#1e293b" />
                      <stop offset="70%" stopColor="#0f172a" />
                      <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.5" />
                    </linearGradient>

                    {/* Dial Face Sunburst Gradient */}
                    <radialGradient id="analog-dial-grad" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#0a1532" />
                      <stop offset="75%" stopColor="#050a1b" />
                      <stop offset="100%" stopColor="#02050f" />
                    </radialGradient>

                    {/* Sword Hour Hand Gradient */}
                    <linearGradient id="analog-hour-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#e2e8f0" />
                      <stop offset="50%" stopColor="#ffffff" />
                      <stop offset="100%" stopColor="#94a3b8" />
                    </linearGradient>

                    {/* Needle Minute Hand Gradient */}
                    <linearGradient id="analog-minute-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#38bdf8" />
                      <stop offset="50%" stopColor="#22d3ee" />
                      <stop offset="100%" stopColor="#0284c7" />
                    </linearGradient>
                  </defs>

                  {/* Outer Luxury Brushed Bezel */}
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

                  {/* Watch Dial Face */}
                  <circle cx="140" cy="140" r="132" fill="url(#analog-dial-grad)" />

                  {/* Chronograph Concentric Track Rings */}
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

                  {/* 60 Minute & Hour Ticks */}
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

                  {/* 12 Hour Numerals (1 to 12) */}
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

                  {/* Brand Mark on Dial */}
                  <text
                    x="140"
                    y="78"
                    textAnchor="middle"
                    fill="#38bdf8"
                    fontSize="6.5"
                    fontWeight="bold"
                    letterSpacing="2px"
                    opacity="0.85"
                  >
                    CINESPHERE
                  </text>
                  <text x="140" y="86" textAnchor="middle" fill="#64748b" fontSize="4.5" letterSpacing="1px">
                    CHRONOMETER 8K
                  </text>

                  {/* Subdial Window at 6 o'clock: Digital Selected Time Readout */}
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

                  {/* Interactive Showtime Luminescent Pips along Bezel */}
                  {slotMarkers.map((slot) => {
                    const isSelected = activeSlot?.id === slot.id;
                    const isLive = now >= slot.start_time && now < slot.end_time;

                    return (
                      <g
                        key={slot.id}
                        onClick={() => setActiveSlotId(slot.id)}
                        onMouseEnter={() => setActiveSlotId(slot.id)}
                        className="cursor-pointer group/marker"
                      >
                        {/* Larger hit target for mouse/touch */}
                        <circle cx={slot.x} cy={slot.y} r="10" fill="transparent" />

                        {/* Static subtle halo ring for selected only (No pulsing bubble) */}
                        {isSelected && (
                          <circle
                            cx={slot.x}
                            cy={slot.y}
                            r="7.5"
                            fill="none"
                            stroke="#38bdf8"
                            strokeWidth="1.5"
                            strokeOpacity="0.85"
                          />
                        )}

                        {/* Luminescent Pip */}
                        <circle
                          cx={slot.x}
                          cy={slot.y}
                          r={isSelected ? '5' : '3.5'}
                          fill={isSelected ? '#38bdf8' : isLive ? '#22d3ee' : '#cbd5e1'}
                          stroke={isSelected ? '#ffffff' : '#030712'}
                          strokeWidth={isSelected ? '2' : '1.5'}
                          className="transition-all duration-300"
                        />
                      </g>
                    );
                  })}

                  {/* ================= CLOCK HANDS (TRUE CSS ROTATION AROUND AXIS 140, 140) ================= */}

                  {/* 1. HOUR HAND (Kim Giờ xoay mượt theo trục tâm) */}
                  <g
                    style={{
                      transform: `rotate(${hourHandAngle}deg)`,
                      transformOrigin: '140px 140px',
                      transition: 'transform 0.75s cubic-bezier(0.25, 1, 0.5, 1)',
                      willChange: 'transform'
                    }}
                  >
                    {/* Hour Hand Body */}
                    <path
                      d="M 137.5 140 L 138.5 86 L 140 76 L 141.5 86 L 142.5 140 L 141 150 L 139 150 Z"
                      fill="url(#analog-hour-grad)"
                      filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.8))"
                    />
                    {/* Hour Hand Luminous Inlay */}
                    <line x1="140" y1="130" x2="140" y2="88" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" />
                  </g>

                  {/* 2. MINUTE HAND (Kim Phút xoay mượt theo trục tâm) */}
                  <g
                    style={{
                      transform: `rotate(${minuteHandAngle}deg)`,
                      transformOrigin: '140px 140px',
                      transition: 'transform 0.8s cubic-bezier(0.25, 1, 0.5, 1)',
                      willChange: 'transform'
                    }}
                  >
                    {/* Minute Hand Body */}
                    <path
                      d="M 138 140 L 139 52 L 140 42 L 141 52 L 142 140 L 141 155 L 139 155 Z"
                      fill="url(#analog-minute-grad)"
                      filter="drop-shadow(0px 2px 5px rgba(6,182,212,0.6))"
                    />
                    {/* Minute Hand Center Highlight Line */}
                    <line x1="140" y1="130" x2="140" y2="54" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" />
                  </g>

                  {/* 3. CENTER CROWN / PIVOT CAP (Trục Tâm Đồng Hồ Tinh Tế) */}
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

              {/* Subtitle helper */}
            </div>

            {/* 2. RIGHT COLUMN: MOVIE SHOWCASE & DIRECT BOOKING ACTION */}
            <div className="lg:col-span-6 flex flex-col justify-between h-full space-y-6">
              {activeSlot ? (
                <div className="bg-gradient-to-br from-slate-900/95 via-[#081333]/90 to-slate-950/95 rounded-2xl p-5 sm:p-6 border border-cyan-500/30 shadow-[0_0_35px_rgba(6,182,212,0.15)] flex flex-col sm:flex-row gap-5 items-center sm:items-start transition-all duration-300">
                  {/* Movie Poster */}
                  <div className="w-28 h-40 sm:w-36 sm:h-48 rounded-xl overflow-hidden bg-slate-950 shrink-0 border border-white/20 shadow-2xl relative group">
                    {activeSlot.movie_cover_image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={
                          optimizeCloudinaryUrl(activeSlot.movie_cover_image, 300, 'auto:good') ||
                          activeSlot.movie_cover_image
                        }
                        alt={activeSlot.movie_title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 bg-slate-900">
                        <Film className="w-8 h-8 mb-1 text-slate-600" />
                        <span className="text-[10px]">Cinesphere</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                  </div>

                  {/* Movie Info & Details */}
                  <div className="flex-1 min-w-0 space-y-3.5 text-center sm:text-left">
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                      <span className="px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-xs font-black">
                        {activeSlot.start_time} – {activeSlot.end_time}
                      </span>

                      {now >= activeSlot.start_time && now < activeSlot.end_time ? (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-bold uppercase tracking-wider">
                          ● Đang chiếu
                        </span>
                      ) : activeSlot.id === nextSlot?.id ? (
                        <span className="px-2.5 py-1 rounded-full bg-blue-500/20 border border-blue-400/40 text-blue-300 text-[10px] font-bold uppercase tracking-wider">
                          Suất kế tiếp
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-white/10 text-slate-300 text-[10px] font-medium">
                          Sắp chiếu
                        </span>
                      )}
                    </div>

                    <h3 className="text-xl sm:text-2xl font-black text-white leading-tight">
                      {activeSlot.movie_title}
                    </h3>

                    <div className="flex items-center justify-center sm:justify-start gap-3 text-xs text-slate-400 font-medium">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-cyan-400" />
                        Thời lượng: {activeSlot.movie_duration_min || '--'} phút
                      </span>
                      <span>•</span>
                      <span>Độ nét 8K / Âm thanh vòm</span>
                    </div>

                    {/* Action Button: Directly Appends Item to Booking Page */}
                    <div className="pt-2">
                      <Button
                        onClick={() => handleBookSlot(activeSlot)}
                        className="w-full sm:w-auto px-7 py-5 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-fuchsia-600 hover:from-fuchsia-600 hover:to-cyan-500 text-white font-bold shadow-[0_0_25px_rgba(6,182,212,0.45)] transition-all duration-300 hover:scale-[1.03] active:scale-95 cursor-pointer"
                      >
                        <span className="flex items-center gap-2 text-sm">
                          <Ticket className="w-4 h-4" />
                          Đặt vé suất này ({activeSlot.start_time})
                          <ChevronRight className="w-4 h-4" />
                        </span>
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* ALL SHOWTIMES QUICK TIMELINE STRIP */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-bold text-slate-300">Tất cả các suất chiếu trong ngày:</span>
                  <span className="text-[11px] text-cyan-400 font-semibold">{allItems.length} suất chiếu</span>
                </div>

                <div className="flex flex-wrap items-center gap-2 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
                  {allItems.map((slot) => {
                    const isSelected = activeSlot?.id === slot.id;
                    const isLive = now >= slot.start_time && now < slot.end_time;

                    return (
                      <button
                        key={slot.id}
                        onClick={() => setActiveSlotId(slot.id)}
                        onMouseEnter={() => setActiveSlotId(slot.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer border ${
                          isSelected
                            ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black border-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.6)] scale-105'
                            : isLive
                              ? 'bg-cyan-950/60 border-cyan-500/50 text-cyan-300'
                              : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300 hover:text-white'
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
