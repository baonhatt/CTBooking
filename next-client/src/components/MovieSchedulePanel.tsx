'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Clock, Calendar, Loader2 } from 'lucide-react';
import { getPublicSchedule, type PublicShowtime } from '@/lib/api/schedule';

const HOUR_GROUPS = [
  {
    label: 'Buổi Sáng',
    icon: '🌅',
    startHour: 0,
    endHour: 12,
    headerClass: 'from-amber-500/20 to-orange-500/5',
    badgeClass: 'text-amber-400 bg-amber-500/15 border-amber-500/30'
  },
  {
    label: 'Buổi Trưa',
    icon: '☀️',
    startHour: 12,
    endHour: 14,
    headerClass: 'from-yellow-500/20 to-amber-500/5',
    badgeClass: 'text-yellow-400 bg-yellow-500/15 border-yellow-500/30'
  },
  {
    label: 'Buổi Chiều',
    icon: '🌤️',
    startHour: 14,
    endHour: 18,
    headerClass: 'from-blue-500/20 to-cyan-500/5',
    badgeClass: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/30'
  },
  {
    label: 'Buổi Tối',
    icon: '🌙',
    startHour: 18,
    endHour: 24,
    headerClass: 'from-purple-500/20 to-indigo-500/5',
    badgeClass: 'text-purple-400 bg-purple-500/15 border-purple-500/30'
  }
];

const MOVIE_BADGE_PALETTE = [
  'bg-blue-600/70 text-blue-100',
  'bg-cyan-700/70 text-cyan-100',
  'bg-teal-700/70 text-teal-100',
  'bg-emerald-700/70 text-emerald-100',
  'bg-orange-700/70 text-orange-100',
  'bg-red-800/70 text-red-100',
  'bg-violet-700/70 text-violet-100',
  'bg-pink-700/70 text-pink-100'
];

function badgeClassForMovie(movieId: number) {
  return MOVIE_BADGE_PALETTE[Math.abs(movieId) % MOVIE_BADGE_PALETTE.length];
}

function nowInVietnam(): string {
  return new Date().toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Ho_Chi_Minh'
  });
}

interface MovieSchedulePanelProps {
  isOpen: boolean;
  onClose: () => void;
  branchId?: number | null;
  branchName?: string | null;
}

export default function MovieSchedulePanel({ isOpen, onClose, branchId, branchName }: MovieSchedulePanelProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [items, setItems] = useState<PublicShowtime[]>([]);
  const [opensAt, setOpensAt] = useState<string | null>(null);
  const [closesAt, setClosesAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [now, setNow] = useState(nowInVietnam);

  useEffect(() => {
    if (!isOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setInterval(() => setNow(nowInVietnam()), 30000);
    setNow(nowInVietnam());
    return () => window.clearInterval(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const data = await getPublicSchedule(branchId ?? undefined);
        if (cancelled) return;
        setItems(data.items);
        setOpensAt(data.opens_at);
        setClosesAt(data.closes_at);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, branchId]);

  const legend = useMemo(() => {
    const map = new Map<number, string>();
    for (const slot of items) {
      if (!map.has(slot.movie_id)) map.set(slot.movie_id, slot.movie_title);
    }
    return Array.from(map, ([id, title]) => ({ id, title }));
  }, [items]);

  const nextSlotId = useMemo(() => {
    const upcoming = items.find((slot) => slot.start_time > now);
    return upcoming?.id ?? null;
  }, [items, now]);

  const getSlotsForGroup = (startHour: number, endHour: number) =>
    items.filter((slot) => {
      const hour = Number(slot.start_time.slice(0, 2));
      return hour >= startHour && hour < endHour;
    });

  return (
    <>
      {/* Backdrop z-[70] & click to close */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fixed inset-0 z-[70] bg-black/80 backdrop-blur-md transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Drawer Panel */}
      <div
        ref={panelRef}
        className={`
          fixed z-[75]
          bottom-0 left-0 right-0 max-h-[85dvh]
          lg:bottom-auto lg:top-0 lg:left-auto lg:right-0 lg:h-screen lg:w-[400px] lg:max-h-screen
          transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
          ${
            isOpen
              ? 'translate-y-0 lg:translate-x-0 opacity-100'
              : 'translate-y-full lg:translate-y-0 lg:translate-x-full opacity-0 pointer-events-none'
          }
        `}
      >
        <div className="h-full flex flex-col bg-gradient-to-b from-[#070d1e] via-[#09112a] to-[#0b1432] border-t lg:border-t-0 lg:border-l border-white/15 shadow-[0_-10px_40px_rgba(0,0,0,0.8)] rounded-t-3xl lg:rounded-none overflow-hidden">
          {/* Header */}
          <div className="relative shrink-0 px-5 py-4 lg:pt-7 lg:pb-5 border-b border-white/10">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-400" />

            {/* Mobile Touch Drag Indicator */}
            <div className="lg:hidden flex justify-center mb-3">
              <div className="w-12 h-1.5 bg-white/30 rounded-full" />
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <Calendar className="w-4 h-4 text-cyan-400" />
                  <h2 className="text-base lg:text-lg font-extrabold text-white tracking-tight">Lịch Chiếu Phim</h2>
                </div>
                <p className="text-xs text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3 shrink-0" />
                  {opensAt && closesAt ? (
                    <>
                      Giờ mở cửa:&nbsp;
                      <span className="font-semibold text-cyan-400">
                        {opensAt} – {closesAt}
                      </span>
                    </>
                  ) : (
                    <span>Lặp lại hàng ngày</span>
                  )}
                </p>
                {branchName && <p className="text-[11px] text-slate-400 mt-0.5 font-medium">{branchName}</p>}
              </div>
              <button
                onClick={onClose}
                className="shrink-0 p-2 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors active:scale-95"
                aria-label="Đóng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Legend */}
          {legend.length > 0 && (
            <div className="shrink-0 px-5 py-2.5 bg-black/20 border-b border-white/5 flex flex-wrap gap-x-3 gap-y-1.5">
              {legend.map((movie) => (
                <span key={movie.id} className="flex items-center gap-1.5 text-[10px] text-slate-300 font-medium">
                  <span
                    className={`w-2.5 h-2.5 rounded-sm flex-shrink-0 ${badgeClassForMovie(movie.id).split(' ')[0]}`}
                  />
                  {movie.title}
                </span>
              ))}
            </div>
          )}

          {/* Schedule Slots Body (Purely View-only) */}
          <div className="flex-1 overflow-y-auto overscroll-contain schedule-scroll px-4 lg:px-5 py-4 space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-slate-400 gap-2 text-sm">
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                Đang tải lịch chiếu...
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-16 px-4">
                <p className="text-sm font-semibold text-white">Chưa có lịch chiếu</p>
                <p className="text-xs text-slate-400 mt-1">
                  {branchName ? `${branchName} chưa cấu hình lịch chiếu.` : 'Vui lòng chọn chi nhánh.'}
                </p>
              </div>
            ) : (
              HOUR_GROUPS.map((group) => {
                const slots = getSlotsForGroup(group.startHour, group.endHour);
                if (!slots.length) return null;
                return (
                  <div key={group.label}>
                    <div
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r ${group.headerClass} mb-2`}
                    >
                      <span className="text-sm">{group.icon}</span>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${group.badgeClass}`}
                      >
                        {group.label}
                      </span>
                      <span className="ml-auto text-[10px] text-slate-400 font-semibold">{slots.length} suất</span>
                    </div>

                    <div className="space-y-1.5">
                      {slots.map((slot) => {
                        const isLive = now >= slot.start_time && now < slot.end_time;
                        const isNext = !isLive && slot.id === nextSlotId;
                        return (
                          <div
                            key={slot.id}
                            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border transition-all duration-200 ${
                              isLive
                                ? 'bg-cyan-500/15 border-cyan-400/50 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                                : isNext
                                  ? 'bg-white/8 border-blue-400/40'
                                  : 'bg-white/5 border-white/10'
                            }`}
                          >
                            <div className="shrink-0 w-12 text-right">
                              <span className="text-sm font-black tabular-nums text-cyan-300">
                                {slot.start_time}
                              </span>
                            </div>
                            <div className="shrink-0 w-px h-7 bg-white/15" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] leading-none text-slate-400">
                                  {slot.start_time} – {slot.end_time}
                                </span>
                                {isLive && (
                                  <span className="text-[9px] font-bold uppercase tracking-wide text-cyan-300 bg-cyan-500/25 px-1.5 py-0.5 rounded border border-cyan-500/40">
                                    Đang chiếu
                                  </span>
                                )}
                                {isNext && (
                                  <span className="text-[9px] font-bold uppercase tracking-wide text-blue-300 bg-blue-500/25 px-1.5 py-0.5 rounded border border-blue-500/40">
                                    Suất kế
                                  </span>
                                )}
                              </div>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded inline-block truncate max-w-full ${badgeClassForMovie(slot.movie_id)}`}
                              >
                                {slot.movie_title}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
            <div className="h-4" />
          </div>
        </div>
      </div>
    </>
  );
}


