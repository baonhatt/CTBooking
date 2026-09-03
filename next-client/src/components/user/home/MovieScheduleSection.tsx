'use client';

import { useEffect, useMemo, useState } from 'react';
import { Calendar, Clock, Loader2, Sparkles, Ticket, MapPin, ChevronRight } from 'lucide-react';
import { getPublicSchedule, type PublicShowtime } from '@/lib/api/schedule';
import { useBranch } from '@/hooks/useBranch';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useRouter, useSearchParams } from 'next/navigation';

const HOUR_GROUPS = [
  {
    key: 'morning',
    label: 'Buổi Sáng',
    icon: '🌅',
    startHour: 0,
    endHour: 12,
    badgeClass: 'text-amber-400 bg-amber-500/15 border-amber-500/30'
  },
  {
    key: 'noon',
    label: 'Buổi Trưa',
    icon: '☀️',
    startHour: 12,
    endHour: 14,
    badgeClass: 'text-yellow-400 bg-yellow-500/15 border-yellow-500/30'
  },
  {
    key: 'afternoon',
    label: 'Buổi Chiều',
    icon: '🌤️',
    startHour: 14,
    endHour: 18,
    badgeClass: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/30'
  },
  {
    key: 'evening',
    label: 'Buổi Tối',
    icon: '🌙',
    startHour: 18,
    endHour: 24,
    badgeClass: 'text-purple-400 bg-purple-500/15 border-purple-500/30'
  }
];

const MOVIE_BADGE_PALETTE = [
  'bg-blue-600/60 text-blue-100 border-blue-400/30',
  'bg-cyan-600/60 text-cyan-100 border-cyan-400/30',
  'bg-teal-600/60 text-teal-100 border-teal-400/30',
  'bg-emerald-600/60 text-emerald-100 border-emerald-400/30',
  'bg-orange-600/60 text-orange-100 border-orange-400/30',
  'bg-purple-600/60 text-purple-100 border-purple-400/30'
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

export default function MovieScheduleSection() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectedBranch } = useBranch();
  const [selectedGroupKey, setSelectedGroupKey] = useState<string>('all');
  const [now, setNow] = useState(nowInVietnam);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(nowInVietnam()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const { data: scheduleData, isLoading } = useQuery({
    queryKey: ['publicSchedule', selectedBranch?.id],
    queryFn: () => getPublicSchedule(selectedBranch?.id),
    staleTime: 60 * 1000
  });

  const items: PublicShowtime[] = scheduleData?.items || [];
  const opensAt = scheduleData?.opens_at;
  const closesAt = scheduleData?.closes_at;

  const nextSlotId = useMemo(() => {
    const upcoming = items.find((slot) => slot.start_time > now);
    return upcoming?.id ?? null;
  }, [items, now]);

  const filteredItems = useMemo(() => {
    if (selectedGroupKey === 'all') return items;
    const group = HOUR_GROUPS.find((g) => g.key === selectedGroupKey);
    if (!group) return items;
    return items.filter((slot) => {
      const hour = Number(slot.start_time.slice(0, 2));
      return hour >= group.startHour && hour < group.endHour;
    });
  }, [items, selectedGroupKey]);

  const handleBookSlot = (slot: PublicShowtime) => {
    const params = new URLSearchParams(searchParams.toString());
    if (selectedBranch?.id) {
      params.set('branch_id', String(selectedBranch.id));
    }
    params.set('movie_id', String(slot.movie_id));
    router.push(`/booking?${params.toString()}`);
  };

  return (
    <section
      id="schedule"
      className="relative py-16 sm:py-20 px-2 bg-gradient-to-b from-[#050915] via-[#070e24] to-[#050915] overflow-hidden"
    >
      {/* Background Ambient Effects */}
      <div className="absolute top-1/2 -left-20 w-80 h-80 rounded-full bg-blue-500/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-purple-500/10 blur-[120px] pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs font-bold uppercase tracking-widest backdrop-blur-md shadow-sm">
              <Calendar className="w-4 h-4 text-cyan-400" />
              <span>Suất Chiếu Trong Ngày</span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
              Lịch chiếu phim{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400">
                hôm nay
              </span>
            </h2>
            <div className="flex flex-wrap items-center gap-3 text-slate-300 text-xs sm:text-sm">
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 font-medium">
                <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                {selectedBranch?.name || 'Cinesphere'}
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 font-medium">
                <Clock className="w-3.5 h-3.5 text-purple-400" />
                {opensAt && closesAt ? `Mở cửa: ${opensAt} – ${closesAt}` : 'Mở cửa hàng ngày'}
              </span>
            </div>
          </div>

          {/* Time Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none touch-pan-x max-w-full">
            <button
              onClick={() => setSelectedGroupKey('all')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-300 ${
                selectedGroupKey === 'all'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20'
                  : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white border border-white/10'
              }`}
            >
              Tất cả ({items.length})
            </button>
            {HOUR_GROUPS.map((g) => {
              const groupSlots = items.filter((s) => {
                const hour = Number(s.start_time.slice(0, 2));
                return hour >= g.startHour && hour < g.endHour;
              });
              return (
                <button
                  key={g.key}
                  onClick={() => setSelectedGroupKey(g.key)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-300 flex items-center gap-1.5 ${
                    selectedGroupKey === g.key
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20'
                      : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white border border-white/10'
                  }`}
                >
                  <span>{g.icon}</span>
                  <span>{g.label}</span>
                  <span className="text-[10px] opacity-75">({groupSlots.length})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Body */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-slate-400 gap-3 text-base bg-white/5 rounded-2xl border border-white/10">
            <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
            <span>Đang tải lịch chiếu hôm nay...</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-16 px-4 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
            <p className="text-lg font-bold text-cyan-200">Không tìm thấy suất chiếu</p>
            <p className="text-sm text-slate-400 mt-1">
              {selectedBranch?.name
                ? `${selectedBranch.name} chưa có suất chiếu phù hợp cho khoảng thời gian này.`
                : 'Vui lòng chọn chi nhánh để xem lịch chiếu.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map((slot) => {
              const isLive = now >= slot.start_time && now < slot.end_time;
              const isNext = !isLive && slot.id === nextSlotId;

              return (
                <div
                  key={slot.id}
                  className={`group relative p-4 rounded-2xl border transition-all duration-300 flex flex-col justify-between ${
                    isLive
                      ? 'bg-gradient-to-br from-cyan-950/40 via-slate-900/60 to-slate-950 border-cyan-400/60 shadow-[0_0_25px_rgba(6,182,212,0.2)]'
                      : isNext
                        ? 'bg-gradient-to-br from-blue-950/30 via-slate-900/60 to-slate-950 border-blue-400/40'
                        : 'bg-slate-900/60 hover:bg-slate-900 border-white/10 hover:border-cyan-500/40'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Top Row: Time & Status Badges */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-black text-cyan-300 tracking-tight tabular-nums">
                          {slot.start_time}
                        </span>
                        <span className="text-xs text-slate-400">– {slot.end_time}</span>
                      </div>

                      {isLive && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-cyan-300 bg-cyan-500/20 px-2 py-0.5 rounded-full border border-cyan-400/40 animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                          Đang chiếu
                        </span>
                      )}

                      {isNext && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-blue-300 bg-blue-500/20 px-2 py-0.5 rounded-full border border-blue-400/40">
                          Suất kế tiếp
                        </span>
                      )}
                    </div>

                    {/* Movie Title Badge */}
                    <div>
                      <span
                        className={`text-xs sm:text-sm font-bold px-2.5 py-1 rounded-lg border inline-block max-w-full truncate ${badgeClassForMovie(slot.movie_id)}`}
                      >
                        🎬 {slot.movie_title}
                      </span>
                    </div>
                  </div>

                  {/* Bottom Action Row */}
                  <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-400 font-medium">
                      Thời lượng: {slot.movie_duration_min || '--'} phút
                    </span>

                    <Button
                      size="sm"
                      onClick={() => handleBookSlot(slot)}
                      className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-blue-600 hover:to-cyan-500 text-white text-xs font-bold rounded-xl px-3.5 py-1.5 shadow-md transition-all duration-300 hover:scale-105"
                    >
                      <span>Đặt vé</span>
                      <ChevronRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
