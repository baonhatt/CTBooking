'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Clock, Clapperboard, Star, Calendar } from 'lucide-react';

const SHOWTIME_SCHEDULE = [
    { time: '10:00', titles: ['Vũ Trụ', '8 Kỳ Quan Thế Giới'] },
    { time: '10:30', titles: ['Đại Dương', 'Khủng Long'] },
    { time: '11:00', titles: ['Vũ Trụ', 'Khủng Long'] },
    { time: '11:30', titles: ['Lòng Đất', 'Vùng Đất Ma'] },
    { time: '12:00', titles: ['Vũ Trụ', '8 Kỳ Quan Thế Giới'] },
    { time: '12:30', titles: ['Đại Dương', 'Khủng Long'] },
    { time: '13:00', titles: ['Vũ Trụ', 'Khủng Long'] },
    { time: '13:30', titles: ['Lòng Đất', 'Vùng Đất Ma'] },
    { time: '14:00', titles: ['Vũ Trụ', '8 Kỳ Quan Thế Giới'] },
    { time: '14:30', titles: ['Đại Dương', 'Khủng Long'] },
    { time: '15:00', titles: ['Vũ Trụ', 'Khủng Long'] },
    { time: '15:30', titles: ['Lòng Đất', 'Vùng Đất Ma'] },
    { time: '16:00', titles: ['Vũ Trụ', '8 Kỳ Quan Thế Giới'] },
    { time: '16:30', titles: ['Đại Dương', 'Khủng Long'] },
    { time: '17:00', titles: ['Vũ Trụ', 'Khủng Long'] },
    { time: '17:30', titles: ['Lòng Đất', 'Vùng Đất Ma'] },
    { time: '18:00', titles: ['Vũ Trụ', '8 Kỳ Quan Thế Giới'] },
    { time: '18:30', titles: ['Đại Dương', 'Khủng Long'] },
    { time: '19:00', titles: ['Vũ Trụ', 'Khủng Long'] },
    { time: '19:30', titles: ['Lòng Đất', 'Vùng Đất Ma'] },
    { time: '20:00', titles: ['Vũ Trụ', '8 Kỳ Quan Thế Giới'] },
    { time: '20:30', titles: ['Đại Dương', 'Khủng Long'] },
    { time: '21:00', titles: ['Vũ Trụ', 'Khủng Long'] },
    { time: '21:30', titles: ['Lòng Đất', 'Vùng Đất Ma'] },
];

const HOUR_GROUPS = [
    { label: 'Buổi Sáng', icon: '🌅', range: ['10:00', '11:30'], headerClass: 'from-amber-500/20 to-orange-500/5', badgeClass: 'text-amber-400 bg-amber-500/15 border-amber-500/30' },
    { label: 'Buổi Trưa', icon: '☀️', range: ['12:00', '13:30'], headerClass: 'from-yellow-500/20 to-amber-500/5', badgeClass: 'text-yellow-400 bg-yellow-500/15 border-yellow-500/30' },
    { label: 'Buổi Chiều', icon: '🌤️', range: ['14:00', '17:30'], headerClass: 'from-blue-500/20 to-cyan-500/5', badgeClass: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/30' },
    { label: 'Buổi Tối', icon: '🌙', range: ['18:00', '21:30'], headerClass: 'from-purple-500/20 to-indigo-500/5', badgeClass: 'text-purple-400 bg-purple-500/15 border-purple-500/30' },
];

const MOVIE_BADGE_COLORS: Record<string, string> = {
    'Vũ Trụ': 'bg-blue-600/70 text-blue-100',
    '8 Kỳ Quan Thế Giới': 'bg-cyan-700/70 text-cyan-100',   
    'Đại Dương': 'bg-teal-700/70 text-teal-100',
    'Khủng Long': 'bg-emerald-700/70 text-emerald-100',
    'Lòng Đất': 'bg-orange-700/70 text-orange-100',
    'Vùng Đất Ma': 'bg-red-800/70 text-red-100',
};

interface MovieSchedulePanelProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function MovieSchedulePanel({ isOpen, onClose }: MovieSchedulePanelProps) {
    const panelRef = useRef<HTMLDivElement | null>(null);
    const [mounted, setMounted] = useState(isOpen);

    useEffect(() => {
        if (isOpen) {
            setMounted(true);
            return;
        }

        const timeout = window.setTimeout(() => setMounted(false), 300);
        return () => window.clearTimeout(timeout);
    }, [isOpen]);

    // Close on outside click
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

    // Prevent overscroll from leaking to the background while keeping inner scroll active
    useEffect(() => {
        const originalOverscrollBehavior = document.body.style.overscrollBehavior;

        if (isOpen) {
            document.body.style.overscrollBehavior = 'contain';
        }

        return () => {
            document.body.style.overscrollBehavior = originalOverscrollBehavior;
        };
    }, [isOpen]);

    const getSlotsForGroup = (group: typeof HOUR_GROUPS[0]) => {
        const startIdx = SHOWTIME_SCHEDULE.findIndex(s => s.time === group.range[0]);
        const endIdx   = SHOWTIME_SCHEDULE.findIndex(s => s.time === group.range[1]);
        return SHOWTIME_SCHEDULE.slice(startIdx, endIdx + 1);
    };

    if (!mounted) {
        return null;
    }

    return (
        <>
            {/* Floating button removed — header dispatches `open-movie-schedule` now */}

            {/* ─── BACKDROP ─── */}
            <div
                aria-hidden="true"
                className={`fixed inset-0 z-50 bg-black/60 transition-opacity duration-300 will-change-[opacity] ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            />

            {/* ─── PANEL ─── */}
            {/* Desktop: right sidebar | Mobile: bottom sheet */}
            <div
                ref={panelRef}
                className={`
                    fixed z-50
                    bottom-0 left-0 right-0 h-[88vh]
                    lg:bottom-auto lg:top-0 lg:left-auto lg:right-0 lg:h-screen lg:w-[380px] lg:max-h-screen
                    transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] opacity-0 touch-pan-y
                    ${isOpen
                        ? 'translate-y-0 lg:translate-x-0 opacity-100'
                        : 'translate-y-full lg:translate-y-0 lg:translate-x-full opacity-0 pointer-events-none'}
                `}
            >
                <div className="h-full flex flex-col bg-gradient-to-b from-[#070d1e] via-[#09112a] to-[#0b1432] border-t lg:border-t-0 lg:border-l border-white/10 shadow-2xl rounded-t-3xl lg:rounded-none overflow-hidden">

                    {/* ── HEADER ── */}
                    <div className="relative shrink-0 px-5 py-4 lg:pt-7 lg:pb-5 border-b border-white/10">
                        {/* Rainbow top bar */}
                        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-400" />

                        {/* Mobile drag handle */}
                        <div className="lg:hidden flex justify-center mb-4">
                            <div className="w-10 h-1 bg-white/20 rounded-full" />
                        </div>

                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <div className="flex items-center gap-2 mb-0.5">
                                    <Calendar className="w-4 h-4 text-blue-400" />
                                    <h2 className="text-base lg:text-lg font-extrabold text-white tracking-tight">
                                        Lịch Chiếu Phim
                                    </h2>
                                </div>
                                <p className="text-xs text-gray-400 flex items-center gap-1">
                                    <Clock className="w-3 h-3 shrink-0" />
                                    Hoạt động:&nbsp;
                                    <span className="font-semibold text-cyan-400">10:00 – 22:00</span>
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                className="shrink-0 p-2 rounded-full bg-white/8 hover:bg-white/15 text-gray-400 hover:text-white transition-colors"
                                aria-label="Đóng"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Combo badge */}
                        <div className="mt-3">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-600/25 to-blue-600/25 border border-purple-500/35 text-purple-300 text-[11px] font-bold tracking-wide uppercase">
                                <Star className="w-3 h-3 fill-purple-400 text-purple-400" />
                                Combo Thám Hiểm
                            </span>
                        </div>
                    </div>

                    {/* ── LEGEND ── */}
                    <div className="shrink-0 px-5 py-2.5 border-b border-white/5 flex flex-wrap gap-x-3 gap-y-1.5">
                        {Object.entries(MOVIE_BADGE_COLORS).map(([name, cls]) => (
                            <span key={name} className="flex items-center gap-1 text-[10px] text-gray-400">
                                <span className={`w-2.5 h-2.5 rounded-sm flex-shrink-0 ${cls.split(' ')[0]}`} />
                                {name}
                            </span>
                        ))}
                    </div>

                    {/* ── SCHEDULE (scrollable) ── */}
                    <div className="flex-1 min-h-0 overflow-y-scroll overscroll-y-contain schedule-scroll px-4 lg:px-5 py-4 space-y-4">
                        {HOUR_GROUPS.map((group) => {
                            const slots = getSlotsForGroup(group);
                            return (
                                <div key={group.label}>
                                    {/* Group header */}
                                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r ${group.headerClass} mb-2`}>
                                        <span className="text-sm">{group.icon}</span>
                                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${group.badgeClass}`}>
                                            {group.label}
                                        </span>
                                        <span className="ml-auto text-[10px] text-gray-600">{slots.length} suất</span>
                                    </div>

                                    {/* Slot rows */}
                                    <div className="space-y-1">
                                        {slots.map((slot) => {
                                            return (
                                                <div
                                                    key={slot.time}
                                                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/3 border border-white/6 hover:bg-white/5 transition-colors"
                                                >
                                                    {/* Time */}
                                                    <div className="shrink-0 w-12 text-right">
                                                        <span className="text-sm font-black tabular-nums text-blue-300">
                                                            {slot.time}
                                                        </span>
                                                    </div>

                                                    {/* Separator */}
                                                    <div className="shrink-0 w-px h-7 bg-white/10" />

                                                    {/* Info */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-[10px] mb-1 leading-none text-gray-500">
                                                            Thám hiểm:
                                                        </div>
                                                        <div className="flex flex-wrap gap-1">
                                                            {slot.titles.map((title, i) => (
                                                                <span
                                                                    key={i}
                                                                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${MOVIE_BADGE_COLORS[title] ?? 'bg-slate-600/70 text-slate-100'}`}
                                                                >
                                                                    {title}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                        <div className="h-2" />
                    </div>

                    {/* ── FOOTER ── */}
                    <div className="shrink-0 px-5 py-3 border-t border-white/8 bg-black/20 flex items-center justify-between gap-3">
                        {/* <p className="text-[11px] text-gray-500 leading-tight">
                            Lịch chiếu mang tính chất tham khảo.<br />
                            Vui lòng chọn ngày giờ khi đặt vé.
                        </p>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="shrink-0 px-4 py-2 rounded-xl bg-white/8 hover:bg-white/15 text-gray-300 hover:text-white text-xs font-semibold transition-colors"
                        >
                            Đóng
                        </button> */}
                    </div>
                </div>
            </div>
        </>
    );
}
