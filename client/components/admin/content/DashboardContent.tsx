import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Film, Package, Users, CreditCard, TrendingUp, TrendingDown } from "lucide-react";

interface Metrics {
  totalMovies: number;
  totalToys: number;
  totalUsers: number;
  totalTransactions: number;
  revenueTotal: number;
  revenueByMethod: { cash: number; momo: number; vnpay: number };
  topMoviesWeek: Array<{ id: number; title: string; revenue: number }>;
}

interface Props {
  metrics: Metrics;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  dateRevenue: { total: number; count: number; revenueByMethod: { cash: number; momo: number; vnpay: number } };
  onApplyDateFilter: () => void;
  dateFilterType: "all" | "day" | "month";
  setDateFilterType: (type: "all" | "day" | "month") => void;
  dateStatus: "all" | "paid";
  setDateStatus: (s: "all" | "paid") => void;
  revenue7DaysData: Array<{ day: string; revenue: number }>;
  revenueByMonthYear: number;
  setRevenueByMonthYear: (year: number) => void;
  revenueByMonthData: Array<{ month: number; revenue: number }>;
  isLoading?: boolean;
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
  revenueByMonthYear,
  setRevenueByMonthYear,
  revenueByMonthData,
  dateStatus,
  setDateStatus,
  isLoading = false,
}: Props) {
  // Color palette from brand guide
  const colors = {
    primary: "#5347CE",
    secondary: "#887CFD",
    accent: "#4896FE",
    teal: "#16C8C7",
  };

  const BarChart = ({
    data,
    max,
    dataKey,
    colorScheme = "gradient",
  }: {
    data: Array<any>;
    max?: number;
    dataKey: string;
    colorScheme?: "gradient" | "single";
  }) => {
    const values = data.map((d) => d[dataKey as keyof typeof d]);
    const maxValue = max ?? Math.max(1, ...values);
    const minBarHeight = 8;
    const barColors = [colors.primary, colors.secondary, colors.accent, colors.teal];

    return (
      <div className="w-full">
        <div className="flex items-end justify-between gap-3 h-48 px-2">
          {data.map((d, idx) => {
            const value = d[dataKey as keyof typeof d];
            const percentage = (value / maxValue) * 100;
            const height = Math.max(minBarHeight, (percentage / 100) * 180);
            const color = colorScheme === "gradient"
              ? barColors[idx % barColors.length]
              : colors.primary;

            return (
              <div key={idx} className="flex flex-col items-center flex-1 max-w-16 group">
                <div className="relative w-full flex justify-center mb-2">
                  <div className="opacity-0 group-hover:opacity-100 absolute -top-8 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap transition-opacity">
                    {value.toLocaleString()} đ
                  </div>
                </div>
                <div
                  style={{ height: `${height}px`, backgroundColor: color }}
                  className="w-full max-w-10 rounded-t-lg transition-all duration-300 hover:opacity-80 cursor-pointer"
                />
                <span className="text-xs mt-2 text-gray-500 font-medium">
                  {d.day || d.month || d.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Mini donut chart for payment methods
  const DonutChart = ({ data }: { data: { cash: number; momo: number; vnpay: number } }) => {
    const total = data.cash + data.momo + data.vnpay;
    if (total === 0) return null;

    const percentages = {
      cash: (data.cash / total) * 100,
      momo: (data.momo / total) * 100,
      vnpay: (data.vnpay / total) * 100,
    };

    const circumference = 2 * Math.PI * 40;
    let offset = 0;

    const segments = [
      { key: "cash", color: colors.primary, percent: percentages.cash },
      { key: "momo", color: colors.secondary, percent: percentages.momo },
      { key: "vnpay", color: colors.teal, percent: percentages.vnpay },
    ];

    return (
      <div className="flex items-center gap-6">
        <svg width="100" height="100" viewBox="0 0 100 100">
          {segments.map((seg, i) => {
            const dashLength = (seg.percent / 100) * circumference;
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
              />
            );
          })}
        </svg>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors.primary }}></div>
            <span className="text-sm text-gray-600">Tiền mặt</span>
            <span className="text-sm font-semibold ml-auto">{data.cash.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors.secondary }}></div>
            <span className="text-sm text-gray-600">MoMo</span>
            <span className="text-sm font-semibold ml-auto">{data.momo.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors.teal }}></div>
            <span className="text-sm text-gray-600">VNPay</span>
            <span className="text-sm font-semibold ml-auto">{data.vnpay.toLocaleString()}</span>
          </div>
        </div>
      </div>
    );
  };

  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  const StatCard = ({
    title,
    value,
    icon: Icon,
    trend,
    color
  }: {
    title: string;
    value: number | string;
    icon: any;
    trend?: number;
    color: string;
  }) => (
    <Card className="bg-white border-0 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">{title}</p>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-gray-900">
                  {typeof value === "number" ? value.toLocaleString() : value}
                </span>
                {trend !== undefined && (
                  <span className={`flex items-center text-xs font-medium ${trend >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {trend >= 0 ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
                    {Math.abs(trend)}%
                  </span>
                )}
              </div>
            )}
          </div>
          <div
            className="p-3 rounded-xl"
            style={{ backgroundColor: `${color}15` }}
          >
            <Icon className="w-5 h-5" style={{ color }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 p-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500">Tổng quan hoạt động kinh doanh</p>
        </div>
      </div>

      {/* Top Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Phim"
          value={metrics.totalMovies}
          icon={Film}
          color={colors.primary}
        />
        <StatCard
          title="Đồ chơi"
          value={metrics.totalToys}
          icon={Package}
          color={colors.secondary}
        />
        <StatCard
          title="Người dùng"
          value={metrics.totalUsers}
          icon={Users}
          color={colors.accent}
        />
        <StatCard
          title="Giao dịch"
          value={metrics.totalTransactions}
          icon={CreditCard}
          color={colors.teal}
        />
      </div>

      {/* Revenue Overview & Filter */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Total */}
        <Card className="lg:col-span-2 bg-white border-0 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold text-gray-900">Tổng quan doanh thu</CardTitle>
              {/* Filter tabs */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                {[
                  { key: "all", label: "Tất cả" },
                  { key: "day", label: "Ngày" },
                  { key: "month", label: "Tháng" },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setDateFilterType(tab.key as "all" | "day" | "month")}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${dateFilterType === tab.key
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                      }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {dateFilterType !== "all" && (
              <div className="flex gap-3 items-end mb-6">
                <div className="flex-1">
                  <label className="text-sm text-gray-500 block mb-1.5">
                    {dateFilterType === "day" ? "Chọn ngày" : "Chọn tháng"}
                  </label>
                  <input
                    type={dateFilterType === "day" ? "date" : "month"}
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="border border-gray-200 rounded-lg px-4 py-2.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-opacity-50"
                    style={{ ['--tw-ring-color' as any]: colors.primary } as React.CSSProperties}
                  />
                </div>
                <button
                  onClick={onApplyDateFilter}
                  className="px-6 py-2.5 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90"
                  style={{ backgroundColor: colors.primary }}
                >
                  Xác nhận
                </button>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Tổng doanh thu</p>
                <p className="text-3xl font-bold" style={{ color: colors.primary }}>
                  {isLoading ? <Skeleton className="h-9 w-40" /> : `${dateRevenue.total.toLocaleString()} đ`}
                </p>
                <p className="text-sm text-gray-500 mt-1">{dateRevenue.count} giao dịch</p>
              </div>
              <DonutChart data={dateRevenue.revenueByMethod} />
            </div>
          </CardContent>
        </Card>

        {/* Top Movies */}
        <Card className="bg-white border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold text-gray-900">Top phim tuần này</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : metrics.topMoviesWeek.length === 0 ? (
              <div className="text-sm text-gray-400 text-center py-8">Chưa có dữ liệu</div>
            ) : (
              <div className="space-y-3">
                {metrics.topMoviesWeek.map((m, idx) => (
                  <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                      style={{ backgroundColor: [colors.primary, colors.secondary, colors.accent][idx] }}
                    >
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{m.title || `Phim #${m.id}`}</p>
                    </div>
                    <span className="text-sm font-semibold" style={{ color: colors.primary }}>
                      {m.revenue.toLocaleString()} đ
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 7-Day Revenue Chart */}
        <Card className="bg-white border-0 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold text-gray-900">Doanh thu 7 ngày</CardTitle>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">Đã thanh toán</span>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <BarChart data={revenue7DaysData} dataKey="revenue" colorScheme="gradient" />
          </CardContent>
        </Card>

        {/* Monthly Revenue Chart */}
        <Card className="bg-white border-0 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold text-gray-900">Doanh thu theo tháng</CardTitle>
              <select
                value={revenueByMonthYear}
                onChange={(e) => setRevenueByMonthYear(Number(e.target.value))}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-opacity-50 bg-white"
              >
                {Array.from({ length: 5 }).map((_, idx) => {
                  const year = new Date().getFullYear() - 2 + idx;
                  return (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  );
                })}
              </select>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <BarChart

              data={revenueByMonthData.map((d) => ({
                ...d,
                label: monthNames[d.month - 1],
              }))}
              dataKey="revenue"
              colorScheme="single"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
