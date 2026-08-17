import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
        Film,
        Package,
        Users,
        CreditCard,
        TrendingUp,
        TrendingDown,
        Loader2,
        RefreshCcw,
        Trophy,
        Activity,
        CheckCircle2,
        Clock
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

interface Metrics {
        totalMovies: number;
        totalToys: number;
        totalUsers: number;
        totalTransactions: number;
        revenueTotal: number;
        revenueByMethod: { cash: number; momo: number; vnpay: number; vietqr: number };
        topTicketsWeek: Array<{ id: number; title: string; revenue: number; count: number }>;
        paymentStats: Array<{ method: string; revenue: number; count: number }>;
        topVipUsers: Array<{ userId: number; email: string; totalSpent: number; bookingCount: number }>;
        ticketUsage: { used: number; total: number };
        paymentHealth: { paid: number; pending: number; failed: number };
        bookingHours: number[];
}

interface Props {
        metrics: Metrics;
        selectedDate: string;
        setSelectedDate: (date: string) => void;
        dateRevenue: {
                total: number;
                count: number;
                revenueByMethod: { cash: number; momo: number; vnpay: number; vietqr: number };
        };
        onApplyDateFilter: () => void;
        dateFilterType: 'year' | 'day' | 'month';
        setDateFilterType: (type: 'year' | 'day' | 'month') => void;
        revenue7DaysData: Array<{ day: string; revenue: number }>;
        selectedYear: number;
        setSelectedYear: (year: number) => void;
        revenueByMonthData: Array<{ month: number; revenue: number }>;
        isPageLoading?: boolean;
        isTopTicketsLoading?: boolean;
        isRevenueLoading?: boolean;
        topPeriod: string;
        setTopPeriod: (period: string) => void;
        onRefresh: () => void;
        branches?: any[];
        selectedBranchId?: number | 'all' | null;
        setSelectedBranchId?: (id: number | 'all' | null) => void;
        canViewRevenue?: boolean;
}

export default function DashboardContent({
        metrics,
        selectedDate,
        setSelectedDate,
        dateRevenue,
        onApplyDateFilter,
        dateFilterType,
        setDateFilterType,
        revenue7DaysData,
        selectedYear,
        setSelectedYear,
        revenueByMonthData,
        isPageLoading = false,
        isTopTicketsLoading = false,
        isRevenueLoading = false,
        topPeriod,
        setTopPeriod,
        onRefresh,
        branches = [],
        selectedBranchId = null,
        setSelectedBranchId = () => { },
        canViewRevenue = true
}: Props) {
        const LoadingOverlay = () => (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-[1px] rounded-2xl animate-in fade-in duration-300">
                        <div className="flex flex-col items-center gap-2">
                                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                                <span className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em]">Đang xử lý...</span>
                        </div>
                </div>
        );

        const colors = {
                primary: '#2563EB',
                secondary: '#3B82F6',
                accent: '#60A5FA',
                teal: '#10B981',
                emerald: '#10B981'
        };

        const BarChart = ({
                data,
                max,
                dataKey,
                colorScheme = 'gradient'
        }: {
                data: Array<any>;
                max?: number;
                dataKey: string;
                colorScheme?: 'gradient' | 'single';
        }) => {
                const values = data.map((d) => d[dataKey as keyof typeof d]);
                const maxValue = Math.max(1, max ?? Math.max(1, ...values));
                const minBarHeight = 8;
                const barColors = [colors.primary, colors.secondary, colors.accent, colors.teal];

                return (
                        <div className="w-full">
                                <div className="flex items-end justify-between gap-2 h-48 px-1">
                                        {data.map((d, idx) => {
                                                const value = d[dataKey as keyof typeof d];
                                                const percentage = (value / maxValue) * 100;
                                                // Ensure 0 is truly flat, and small values have a minimum visible height
                                                const height = value === 0 ? 4 : Math.max(8, (percentage / 100) * 180);

                                                return (
                                                        <div key={idx} className="flex flex-col items-center flex-1 max-w-16 group relative">
                                                                {/* Tooltip */}
                                                                <div className="opacity-0 group-hover:opacity-100 absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-2 py-1.5 rounded-lg whitespace-nowrap transition-all duration-200 pointer-events-none z-20 shadow-lg border border-gray-700 flex flex-col items-center mb-1">
                                                                        <span className="font-bold">{value.toLocaleString()} đ</span>
                                                                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
                                                                </div>

                                                                <div
                                                                        style={{ height: `${height}px` }}
                                                                        className={`w-full max-w-10 rounded-t-lg transition-all duration-500 hover:brightness-110 cursor-pointer shadow-sm ${colorScheme === 'gradient' ? '' : 'bg-blue-600/80'
                                                                                }`}
                                                                >
                                                                        {colorScheme === 'gradient' && (
                                                                                <div
                                                                                        className="w-full h-full rounded-t-lg"
                                                                                        style={{
                                                                                                background: `linear-gradient(to top, ${barColors[idx % barColors.length]}80, ${barColors[idx % barColors.length]})`
                                                                                        }}
                                                                                />
                                                                        )}
                                                                </div>
                                                                <span className="text-[10px] mt-2 text-slate-400 font-bold uppercase tracking-tight">
                                                                        {d.day || d.month || d.label}
                                                                </span>
                                                        </div>
                                                );
                                        })}
                                </div>
                        </div>
                );
        };

        const DonutChart = ({ data }: { data: { cash: number; momo: number; vnpay: number; vietqr: number } }) => {
                const total = (data.cash || 0) + (data.momo || 0) + (data.vnpay || 0) + (data.vietqr || 0);
                if (total === 0)
                        return (
                                <div className="flex flex-col items-center justify-center h-24 w-24 rounded-full border-2 border-dashed border-slate-100 italic text-[10px] text-slate-300">
                                        No Data
                                </div>
                        );

                const segments = [
                        { key: 'VietQR', color: colors.teal, val: data.vietqr || 0 },
                        { key: 'MoMo', color: colors.secondary, val: data.momo || 0 },
                        { key: 'VNPay', color: colors.accent, val: data.vnpay || 0 },
                        { key: 'Tiền mặt', color: colors.primary, val: data.cash || 0 }
                ].filter((s) => s.val > 0);

                const circumference = 2 * Math.PI * 40;
                let offset = 0;

                return (
                        <div className="flex items-center gap-8">
                                <div className="relative w-28 h-28">
                                        <svg className="w-full h-full" viewBox="0 0 100 100">
                                                {segments.map((seg) => {
                                                        const percent = (seg.val / total) * 100;
                                                        const dashLength = (percent / 100) * circumference;
                                                        const currentOffset = offset;
                                                        offset += dashLength;
                                                        return (
                                                                <circle
                                                                        key={seg.key}
                                                                        cx="50"
                                                                        cy="50"
                                                                        r="40"
                                                                        fill="none"
                                                                        stroke={seg.color}
                                                                        strokeWidth="12"
                                                                        strokeDasharray={`${dashLength} ${circumference}`}
                                                                        strokeDashoffset={-currentOffset}
                                                                        transform="rotate(-90 50 50)"
                                                                        className="transition-all duration-1000 ease-out"
                                                                />
                                                        );
                                                })}
                                        </svg>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                <span className="text-[10px] uppercase font-bold text-slate-400">Total</span>
                                                <span className="text-xs font-black text-slate-900">{Math.round(total / 1000)}k</span>
                                        </div>
                                </div>
                                <div className="grid grid-cols-1 gap-2.5">
                                        {segments.map((seg) => (
                                                <div key={seg.key} className="flex items-center gap-3">
                                                        <div className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: seg.color }}></div>
                                                        <div className="flex flex-col">
                                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-0.5">
                                                                        {seg.key}
                                                                </span>
                                                                <span className="text-xs font-black text-slate-900 leading-none">{seg.val.toLocaleString()} đ</span>
                                                        </div>
                                                </div>
                                        ))}
                                </div>
                        </div>
                );
        };

        const monthNames = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];

        const StatCard = ({ title, value, icon: Icon, color, trend }: any) => (
                <Card className="bg-white border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.1)] rounded-xl overflow-hidden group">
                        <CardContent className="p-5 relative">
                                <div className="flex items-start justify-between relative z-10">
                                        <div className="space-y-1">
                                                <span className="text-sm font-semibold text-[#6B7280] uppercase">{title}</span>
                                                {isPageLoading ? (
                                                        <Skeleton className="h-8 w-24 rounded-lg" />
                                                ) : (
                                                        <div className="flex items-baseline gap-2">
                                                                <h3 className="text-2xl font-bold text-[#2563EB]">
                                                                        {typeof value === 'number' ? value.toLocaleString() : value}
                                                                </h3>
                                                                {trend && (
                                                                        <span
                                                                                className={`text-xs font-semibold flex items-center ${trend > 0 ? 'text-emerald-500' : 'text-slate-400'}`}
                                                                        >
                                                                                {trend > 0 ? <TrendingUp size={12} className="mr-0.5" /> : null}
                                                                                {trend}%
                                                                        </span>
                                                                )}
                                                        </div>
                                                )}
                                        </div>
                                        <div
                                                className={`p-2 rounded-lg group-hover:scale-110 transition-transform duration-300`}
                                                style={{ backgroundColor: `${color}15` }}
                                        >
                                                <Icon className="w-6 h-6" style={{ color: '#2563EB' }} />
                                        </div>
                                </div>
                        </CardContent>
                </Card>
        );

        return (
                <div className="space-y-8 p-1 font-sans">
                        {/* Header section standardized */}
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border shadow-sm">
                                <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                                <div className="w-2 h-8 bg-blue-600 rounded-full"></div>
                                                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Thống kê hệ thống</h1>
                                        </div>
                                        <p className="text-xs text-slate-500 font-medium pl-4 uppercase tracking-[0.2em]">
                                                Dữ liệu đã thanh toán • Cập nhật trực tiếp
                                        </p>
                                </div>
                                <div className="flex items-center gap-3">
                                        <select
                                                value={selectedYear}
                                                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-xl font-bold text-sm border-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer outline-none"
                                        >
                                                {[0, 1, 2, 3].map((offset) => {
                                                        const y = new Date().getFullYear() - offset;
                                                        return (
                                                                <option key={y} value={y}>
                                                                        NĂM {y}
                                                                </option>
                                                        );
                                                })}
                                        </select>

                                        {branches.length > 0 && (
                                                <select
                                                        value={selectedBranchId || 'all'}
                                                        onChange={(e) => setSelectedBranchId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                                                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-xl font-bold text-sm border-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer outline-none"
                                                >
                                                        <option value="all">Tất cả chi nhánh</option>
                                                        {branches.map((branch) => (
                                                                <option key={branch.id} value={branch.id}>
                                                                        {branch.name}
                                                                </option>
                                                        ))}
                                                </select>
                                        )}

                                        <button
                                                onClick={onRefresh}
                                                className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all active:scale-95 group"
                                                title="Làm mới dữ liệu"
                                        >
                                                <RefreshCcw
                                                        size={18}
                                                        className={`${isPageLoading ? 'animate-spin text-blue-600' : 'group-hover:rotate-180 transition-transform duration-500'}`}
                                                />
                                        </button>
                                        <div className="bg-emerald-100 text-emerald-700 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm border border-emerald-200 uppercase tracking-wider">
                                                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                                                Real-time Metrics
                                        </div>
                                </div>
                        </div>

                        {/* Primary Metrics Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                <StatCard title={`Phim mới (${selectedYear})`} value={metrics.totalMovies} icon={Film} color={colors.primary} />
                                <StatCard
                                        title={`Quà / Đồ chơi mới (${selectedYear})`}
                                        value={metrics.totalToys}
                                        icon={Package}
                                        color={colors.secondary}
                                />
                                <StatCard
                                        title={`Khách hàng mới (${selectedYear})`}
                                        value={metrics.totalUsers}
                                        icon={Users}
                                        color={colors.accent}
                                />
                                <StatCard
                                        title={`Giao dịch (${selectedYear})`}
                                        value={metrics.totalTransactions}
                                        icon={CreditCard}
                                        color={colors.teal}
                                />
                        </div>

                        {canViewRevenue && (
                        <>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                {/* Revenue Focus Card */}
                                <Card className="lg:col-span-2 bg-white border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.1)] rounded-xl overflow-hidden flex flex-col relative">
                                        {isRevenueLoading && <LoadingOverlay />}
                                        <CardHeader className="p-5 border-b border-[#E5E7EB]">
                                                <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                                <div className="p-2 bg-blue-50 text-[#2563EB] rounded-lg">
                                                                        <TrendingUp size={18} />
                                                                </div>
                                                                <h2 className="text-lg font-semibold text-[#111827] tracking-tight uppercase">Phân tích thu chi</h2>
                                                        </div>
                                                        <div className="flex bg-slate-100/80 p-1 rounded-xl items-center">
                                                                {[
                                                                        { id: 'year', label: 'NĂM' },
                                                                        { id: 'day', label: 'NGÀY' },
                                                                        { id: 'month', label: 'THÁNG' }
                                                                ].map((btn) => (
                                                                        <button
                                                                                key={btn.id}
                                                                                onClick={() => setDateFilterType(btn.id as any)}
                                                                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black tracking-widest transition-all duration-300 ${dateFilterType === btn.id
                                                                                        ? 'bg-white text-blue-600 shadow-sm'
                                                                                        : 'text-slate-400 hover:text-slate-600'
                                                                                        }`}
                                                                        >
                                                                                {btn.label}
                                                                        </button>
                                                                ))}
                                                        </div>
                                                </div>
                                        </CardHeader>
                                        <CardContent className="p-5">
                                                {dateFilterType !== 'year' && (
                                                        <div className="flex flex-wrap gap-4 items-end mb-8 animate-in fade-in slide-in-from-top-4 duration-300 bg-slate-50/50 p-4 rounded-2xl border border-slate-100/50">
                                                                <div className="flex-1 min-w-[200px]">
                                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 pl-1">
                                                                                CHỌN THỜI GIAN
                                                                        </p>
                                                                        <div className="relative group">
                                                                                <input
                                                                                        type={dateFilterType === 'day' ? 'date' : 'month'}
                                                                                        value={selectedDate}
                                                                                        onChange={(e) => setSelectedDate(e.target.value)}
                                                                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 shadow-sm group-hover:border-blue-300 focus:ring-4 ring-blue-500/10 transition-all outline-none"
                                                                                />
                                                                        </div>
                                                                </div>
                                                                <Button
                                                                        onClick={onApplyDateFilter}
                                                                        className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20 px-8 rounded-xl text-white font-black h-[46px] transition-all hover:-translate-y-0.5"
                                                                >
                                                                        ÁP DỤNG BỘ LỌC
                                                                </Button>
                                                        </div>
                                                )}

                                                {/* Quick Insights when filter is hidden (fills the gap) */}
                                                {dateFilterType === 'year' && (
                                                        <div className="mb-8 grid grid-cols-2 sm:grid-cols-3 gap-4 animate-in fade-in zoom-in duration-500">
                                                                <div className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100 flex items-center gap-3">
                                                                        <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                                                                                <TrendingUp size={18} />
                                                                        </div>
                                                                        <div>
                                                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-tight">Cổng số 1</p>
                                                                                <p className="text-sm font-black text-slate-900 uppercase">
                                                                                        {metrics.paymentStats?.[0]?.method || '...'}
                                                                                </p>
                                                                        </div>
                                                                </div>

                                                                <div className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100 flex items-center gap-3">
                                                                        <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                                                                                <CreditCard size={18} />
                                                                        </div>
                                                                        <div>
                                                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-tight">Tổng thu cổng 1</p>
                                                                                <p className="text-sm font-black text-slate-900">
                                                                                        {metrics.paymentStats?.[0]?.revenue?.toLocaleString() || 0} đ
                                                                                </p>
                                                                        </div>
                                                                </div>

                                                                <div className="hidden sm:flex bg-slate-50/50 p-3 rounded-2xl border border-slate-100 items-center gap-3">
                                                                        <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
                                                                                <Users size={18} />
                                                                        </div>
                                                                        <div>
                                                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-tight">Giao dịch cổng 1</p>
                                                                                <p className="text-sm font-black text-slate-900">
                                                                                        {metrics.paymentStats?.[0]?.count || 0} <span className="text-[10px] text-slate-400">ĐƠN</span>
                                                                                </p>
                                                                        </div>
                                                                </div>
                                                        </div>
                                                )}

                                                <div className="flex flex-col md:flex-row items-center justify-between gap-12 py-4 min-h-[160px]">
                                                        <div className="space-y-2 text-center md:text-left">
                                                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.3em]">
                                                                        Của{' '}
                                                                        {dateFilterType === 'day'
                                                                                ? 'HÔM NAY'
                                                                                : dateFilterType === 'month'
                                                                                        ? 'THÁNG NÀY'
                                                                                        : `NĂM ${selectedYear}`}
                                                                </p>
                                                                <div className="text-4xl font-black text-slate-900 tracking-tight">
                                                                        {isRevenueLoading ? (
                                                                                <Skeleton className="h-12 w-48 rounded-xl" />
                                                                        ) : (
                                                                                `${dateRevenue.total.toLocaleString()} đ`
                                                                        )}
                                                                </div>
                                                                <p className="text-xs font-bold text-blue-600 bg-blue-50 inline-flex px-3 py-1 rounded-full uppercase tracking-widest">
                                                                        {dateRevenue.count} Giao dịch đã xác thực
                                                                </p>
                                                        </div>
                                                        <DonutChart data={dateRevenue.revenueByMethod} />
                                                </div>
                                        </CardContent>
                                </Card>

                                {/* Top Ticket Packages Period Filtered */}
                                <Card className="bg-white border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.1)] rounded-xl flex flex-col relative">
                                        {isTopTicketsLoading && <LoadingOverlay />}
                                        <CardHeader className="p-5 border-b border-[#E5E7EB] space-y-4">
                                                <div className="flex items-center justify-between">
                                                        <CardTitle className="text-lg font-semibold text-[#111827] flex items-center gap-2">
                                                                <Package className="w-5 h-5 text-[#2563EB]" /> TOP 5 GÓI VÉ
                                                        </CardTitle>
                                                        <span className="text-[10px] font-black bg-amber-100 text-amber-700 px-2 py-1 rounded-md uppercase tracking-tighter">
                                                                THEO {topPeriod === 'week' ? 'TUẦN' : topPeriod === 'month' ? 'THÁNG' : 'NĂM'}
                                                        </span>
                                                </div>

                                                <div className="flex bg-amber-50/50 p-1 rounded-xl items-center">
                                                        {[
                                                                { id: 'week', label: 'TUẦN' },
                                                                { id: 'month', label: 'THÁNG' },
                                                                { id: 'year', label: 'NĂM' }
                                                        ].map((btn) => (
                                                                <button
                                                                        key={btn.id}
                                                                        onClick={() => setTopPeriod(btn.id)}
                                                                        className={`flex-1 py-1.5 rounded-lg text-[9px] font-black tracking-widest transition-all duration-300 ${topPeriod === btn.id
                                                                                ? 'bg-white text-amber-600 shadow-sm border border-amber-100'
                                                                                : 'text-amber-400 hover:text-amber-500 hover:bg-amber-100/30'
                                                                                }`}
                                                                >
                                                                        {btn.label}
                                                                </button>
                                                        ))}
                                                </div>
                                        </CardHeader>
                                        <CardContent className="p-5 flex-1 min-h-[320px]">
                                                <div className="space-y-2">
                                                        {isTopTicketsLoading ? (
                                                                Array.from({ length: 5 }).map((_, i) => (
                                                                        <div key={i} className="flex items-center gap-4 p-3">
                                                                                <Skeleton className="w-8 h-8 rounded-lg" />
                                                                                <div className="flex-1">
                                                                                        <Skeleton className="h-4 w-3/4 mb-2" />
                                                                                        <Skeleton className="h-2 w-1/2" />
                                                                                </div>
                                                                        </div>
                                                                ))
                                                        ) : metrics.topTicketsWeek.length === 0 ? (
                                                                <div className="py-12 text-center space-y-3">
                                                                        <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                                                                                <Package className="w-6 h-6 text-slate-200" />
                                                                        </div>
                                                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Không có dữ liệu</p>
                                                                </div>
                                                        ) : (
                                                                metrics.topTicketsWeek.map((pkg, idx) => (
                                                                        <div
                                                                                key={idx}
                                                                                className="group flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition-all cursor-default border border-transparent hover:border-slate-100"
                                                                        >
                                                                                <div
                                                                                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black shadow-sm ${idx === 0
                                                                                                ? 'bg-amber-500 text-white'
                                                                                                : idx === 1
                                                                                                        ? 'bg-slate-300 text-white'
                                                                                                        : idx === 2
                                                                                                                ? 'bg-orange-400 text-white'
                                                                                                                : 'bg-slate-50 text-slate-400'
                                                                                                }`}
                                                                                >
                                                                                        {idx + 1}
                                                                                </div>
                                                                                <div className="flex-1 min-w-0">
                                                                                        <p className="text-sm font-black text-slate-800 truncate group-hover:text-blue-600 transition-colors uppercase tracking-tight">
                                                                                                {pkg.title}
                                                                                        </p>
                                                                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                                                                                Doanh thu: {pkg.revenue.toLocaleString()} đ
                                                                                        </p>
                                                                                </div>
                                                                                <div className="text-right">
                                                                                        <p className="text-xs font-black text-slate-900">
                                                                                                {pkg.count} <span className="text-[9px] text-slate-400">VÉ</span>
                                                                                        </p>
                                                                                        <div className="flex items-center justify-end gap-1 mt-0.5">
                                                                                                {idx < 3 ? (
                                                                                                        <>
                                                                                                                <TrendingUp className="w-2.5 h-2.5 text-emerald-500" />
                                                                                                                <span className="text-[9px] font-black text-emerald-500 uppercase">TOP {idx + 1}</span>
                                                                                                        </>
                                                                                                ) : (
                                                                                                        <span className="text-[9px] font-bold text-slate-300 uppercase">Ổn định</span>
                                                                                                )}
                                                                                        </div>
                                                                                </div>
                                                                        </div>
                                                                ))
                                                        )}
                                                </div>
                                        </CardContent>
                                </Card>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* TOP VIP USERS */}
                                <Card className="bg-white border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.1)] rounded-xl flex flex-col overflow-hidden relative">
                                        {isPageLoading && <LoadingOverlay />}
                                        <div className="p-5 bg-white text-[#111827] flex justify-between items-center border-b border-[#E5E7EB]">
                                                <div>
                                                        <h3 className="text-sm font-semibold uppercase tracking-widest">Top VIP Users {selectedYear}</h3>
                                                        <p className="text-[10px] text-[#6B7280] font-bold uppercase tracking-widest">
                                                                Dựa trên doanh thực thực tế
                                                        </p>
                                                </div>
                                                <div className="p-2 bg-blue-50 rounded-lg">
                                                        <Trophy size={18} className="text-[#2563EB]" />
                                                </div>
                                        </div>
                                        <div className="divide-y divide-slate-50 flex-1 flex flex-col min-h-[350px]">
                                                {metrics.topVipUsers?.length === 0 ? (
                                                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-300 bg-slate-50/50">
                                                                <Users size={32} className="mb-2 opacity-20" />
                                                                <p className="text-[10px] font-bold uppercase italic tracking-widest">Không có dữ liệu</p>
                                                        </div>
                                                ) : (
                                                        metrics.topVipUsers?.map((user, idx) => (
                                                                <div
                                                                        key={user.userId}
                                                                        className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors group"
                                                                >
                                                                        <div className="flex items-center gap-4">
                                                                                <div
                                                                                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs border ${idx === 0
                                                                                                ? 'bg-amber-100 text-amber-700 border-amber-200'
                                                                                                : idx === 1
                                                                                                        ? 'bg-slate-100 text-slate-700 border-slate-200'
                                                                                                        : idx === 2
                                                                                                                ? 'bg-orange-100 text-orange-700 border-orange-200'
                                                                                                                : 'bg-slate-50 text-slate-400 border-slate-100'
                                                                                                }`}
                                                                                >
                                                                                        {idx + 1}
                                                                                </div>
                                                                                <div>
                                                                                        <p className="text-xs font-bold text-slate-900 mb-0.5 group-hover:text-blue-600 transition-colors uppercase tracking-tight truncate max-w-[150px]">
                                                                                                {user.email.split('@')[0]}
                                                                                        </p>
                                                                                        <div className="flex items-center gap-2">
                                                                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                                                                                                        {user.bookingCount} Giao dịch
                                                                                                </span>
                                                                                        </div>
                                                                                </div>
                                                                        </div>
                                                                        <div className="text-right">
                                                                                <p className="text-xs font-black text-slate-900">{user.totalSpent.toLocaleString()} đ</p>
                                                                                <div className="flex items-center justify-end gap-1 mt-0.5">
                                                                                        <span className="text-[9px] font-bold text-blue-500 uppercase tracking-tighter">
                                                                                                Doanh thu đạt
                                                                                        </span>
                                                                                </div>
                                                                        </div>
                                                                </div>
                                                        ))
                                                )}
                                        </div>
                                </Card>

                                {/* SYSTEM HEALTH & OPERATIONS */}
                                <Card className="bg-white border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.1)] rounded-xl flex flex-col overflow-hidden relative">
                                        {isPageLoading && <LoadingOverlay />}
                                        <div className="p-5 bg-white text-[#111827] flex justify-between items-center border-b border-[#E5E7EB]">
                                                <div>
                                                        <h3 className="text-sm font-semibold uppercase tracking-widest">Hệ thống & Vận hành</h3>
                                                        <p className="text-[10px] text-[#6B7280] font-bold uppercase tracking-widest">
                                                                Chỉ số hiệu suất thời gian thực
                                                        </p>
                                                </div>
                                                <div className="p-2 bg-blue-50 rounded-lg">
                                                        <Activity size={18} className="text-[#2563EB]" />
                                                </div>
                                        </div>

                                        <div className="p-5 space-y-8 flex-1">
                                                {/* 1. Ticket Usage Gauge */}
                                                <div className="space-y-4">
                                                        <div className="flex justify-between items-end">
                                                                <div>
                                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                                                                Tỷ lệ sử dụng vé
                                                                        </p>
                                                                        <h4 className="text-lg font-black text-slate-900">
                                                                                {metrics.ticketUsage.used} / {metrics.ticketUsage.total}{' '}
                                                                                <span className="text-[10px] text-slate-400 font-bold uppercase">Vé đã quét</span>
                                                                        </h4>
                                                                </div>
                                                                <span className="text-2xl font-black text-blue-600">
                                                                        {metrics.ticketUsage.total > 0
                                                                                ? Math.round((metrics.ticketUsage.used / metrics.ticketUsage.total) * 100)
                                                                                : 0}
                                                                        %
                                                                </span>
                                                        </div>
                                                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
                                                                <div
                                                                        className="h-full bg-blue-600 transition-all duration-1000 ease-out"
                                                                        style={{
                                                                                width: `${metrics.ticketUsage.total > 0 ? (metrics.ticketUsage.used / metrics.ticketUsage.total) * 100 : 0}%`
                                                                        }}
                                                                />
                                                        </div>
                                                </div>

                                                {/* 2. Payment Success Rate */}
                                                <div className="space-y-4">
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sức khỏe thanh toán</p>
                                                        <div className="flex gap-1 h-3 rounded-full overflow-hidden">
                                                                {(() => {
                                                                        const total =
                                                                                metrics.paymentHealth.paid + metrics.paymentHealth.pending + metrics.paymentHealth.failed;
                                                                        if (total === 0) return <div className="w-full bg-slate-100" />;
                                                                        return (
                                                                                <>
                                                                                        <div
                                                                                                className="bg-emerald-500 transition-all duration-500"
                                                                                                style={{ width: `${(metrics.paymentHealth.paid / total) * 100}%` }}
                                                                                                title="Thành công"
                                                                                        />
                                                                                        <div
                                                                                                className="bg-amber-400 transition-all duration-500"
                                                                                                style={{ width: `${(metrics.paymentHealth.pending / total) * 100}%` }}
                                                                                                title="Chờ xử lý"
                                                                                        />
                                                                                        <div
                                                                                                className="bg-rose-500 transition-all duration-500"
                                                                                                style={{ width: `${(metrics.paymentHealth.failed / total) * 100}%` }}
                                                                                                title="Thất bại"
                                                                                        />
                                                                                </>
                                                                        );
                                                                })()}
                                                        </div>
                                                        <div className="grid grid-cols-3 gap-2">
                                                                <div className="flex items-center gap-1.5">
                                                                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                                                        <span className="text-[9px] font-black text-slate-600 uppercase">
                                                                                Paid: {metrics.paymentHealth.paid}
                                                                        </span>
                                                                </div>
                                                                <div className="flex items-center gap-1.5">
                                                                        <div className="w-2 h-2 rounded-full bg-amber-400" />
                                                                        <span className="text-[9px] font-black text-slate-600 uppercase">
                                                                                Pend: {metrics.paymentHealth.pending}
                                                                        </span>
                                                                </div>
                                                                <div className="flex items-center gap-1.5">
                                                                        <div className="w-2 h-2 rounded-full bg-rose-500" />
                                                                        <span className="text-[9px] font-black text-slate-600 uppercase">
                                                                                Fail: {metrics.paymentHealth.failed}
                                                                        </span>
                                                                </div>
                                                        </div>
                                                </div>

                                                {/* 3. Peak Hour Distribution */}
                                                <div className="space-y-4 pt-2">
                                                        <div className="flex items-center justify-between">
                                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                                                        Khung giờ đặt vé (Heatmap 24h)
                                                                </p>
                                                                <Clock size={12} className="text-slate-400" />
                                                        </div>
                                                        <div className="flex items-end justify-between h-16 gap-0.5">
                                                                {metrics.bookingHours.map((count, h) => {
                                                                        const max = Math.max(...metrics.bookingHours, 1);
                                                                        const height = (count / max) * 100;
                                                                        return (
                                                                                <div
                                                                                        key={h}
                                                                                        className="flex-1 bg-blue-100/80 hover:bg-blue-600 transition-all duration-300 rounded-t-sm relative group"
                                                                                        style={{ height: `${Math.max(height, 5)}%` }}
                                                                                >
                                                                                        <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[8px] py-1 px-1.5 rounded whitespace-nowrap z-50 pointer-events-none transition-all shadow-lg border border-gray-700">
                                                                                                <span className="font-black">{h}h:</span> {count} đơn
                                                                                        </div>
                                                                                </div>
                                                                        );
                                                                })}
                                                        </div>
                                                        <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest px-0.5 border-t border-slate-50 pt-2">
                                                                <span>00h</span>
                                                                <span>06h</span>
                                                                <span>12h</span>
                                                                <span>18h</span>
                                                                <span>23h</span>
                                                        </div>
                                                </div>
                                        </div>
                                </Card>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-1 gap-8 pt-4">
                                {/* 7-DAY BAR CHART FULL WIDTH */}
                                <Card className="bg-white border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.1)] rounded-xl p-5 space-y-8">
                                        <div className="flex justify-between items-center">
                                                <div>
                                                        <h3 className="text-xl font-semibold text-[#111827] tracking-tight uppercase">
                                                                Performance 7 Ngày ({selectedYear})
                                                        </h3>
                                                        <p className="text-xs text-[#6B7280] font-bold uppercase tracking-widest pl-1">
                                                                Phân tích hiệu suất doanh thu ngắn hạn
                                                        </p>
                                                </div>
                                                <Badge className="bg-emerald-100 text-emerald-700 border-none shadow-none text-[10px] font-bold rounded-lg px-3 py-1 uppercase">
                                                        Live Monitoring
                                                </Badge>
                                        </div>
                                        <BarChart data={revenue7DaysData} dataKey="revenue" colorScheme="gradient" />
                                </Card>

                                {/* MONTHLY CHART FULL WIDTH */}
                                <Card className="bg-white border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.1)] rounded-xl p-5 space-y-8">
                                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                                <div className="space-y-1">
                                                        <h3 className="text-xl font-semibold text-[#111827] tracking-tight uppercase">
                                                                Thống kê tăng trưởng năm {selectedYear}
                                                        </h3>
                                                        <p className="text-xs text-[#6B7280] font-bold uppercase tracking-widest pl-1">
                                                                Phân tích dòng tiền theo tháng
                                                        </p>
                                                </div>
                                        </div>
                                        <BarChart
                                                data={revenueByMonthData.map((d) => ({
                                                        ...d,
                                                        label: monthNames[d.month - 1]
                                                }))}
                                                dataKey="revenue"
                                                colorScheme="single"
                                                max={Math.max(...revenueByMonthData.map((d) => d.revenue), 1000000)}
                                        />
                                </Card>
                        </div>
                        </>
                        )}


                </div>
        );
}
