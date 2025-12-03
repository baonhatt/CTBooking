import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Metrics {
  totalMovies: number;
  totalShowtimes: number;
  totalToys: number;
  totalUsers: number;
  totalTransactions: number;
  revenueTotal: number;
}

interface Props {
  metrics: Metrics;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  dateRevenue: { total: number; count: number };
  onApplyDateFilter: () => void;
  dateFilterType: "all" | "day" | "month";
  setDateFilterType: (type: "all" | "day" | "month") => void;
  revenue7DaysData: Array<{ day: string; revenue: number }>;
  revenueByMonthYear: number;
  setRevenueByMonthYear: (year: number) => void;
  revenueByMonthData: Array<{ month: number; revenue: number }>;
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
}: Props) {
  const BarChart = ({
    data,
    max,
    dataKey,
  }: {
    data: Array<any>;
    max?: number;
    dataKey: string;
  }) => {
    const values = data.map((d) => d[dataKey as keyof typeof d]);
    const maxValue = max ?? Math.max(1, ...values);
    const minBarHeight = 4;

    return (
      <div className="w-full flex justify-center">
        <div className="flex items-end justify-center gap-6 h-64">
          {data.map((d, idx) => {
            const value = d[dataKey as keyof typeof d];
            const percentage = (value / maxValue) * 100;
            const height = Math.max(minBarHeight, (percentage / 100) * 240);

            return (
              <div key={idx} className="flex flex-col items-center">
                <div
                  style={{ height: `${height}px` }}
                  className="w-12 bg-blue-500 rounded-sm hover:bg-blue-600 transition-all cursor-pointer"
                  title={`${d.day || d.month || d.label}: ${value.toLocaleString()}`}
                />
                <span className="text-sm mt-3 text-gray-700 font-medium">
                  {d.day || d.month || d.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  return (
    <div className="space-y-6">
      {/* Top Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Phim</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{metrics.totalMovies}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Lịch chiếu</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {metrics.totalShowtimes}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Đồ chơi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{metrics.totalToys}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Người dùng</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{metrics.totalUsers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Giao dịch</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {metrics.totalTransactions}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Total Revenue */}
      <Card>
        <CardHeader>
          <CardTitle>Tổng doanh thu: {metrics.revenueTotal.toLocaleString("en-US")}</CardTitle>
        </CardHeader>
      </Card>

      {/* Date Revenue Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Doanh thu theo ngày</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Filter Type Selection */}
            <div className="flex gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="filterType"
                  value="all"
                  checked={dateFilterType === "all"}
                  onChange={(e) => setDateFilterType(e.target.value as "all" | "day" | "month")}
                  className="w-4 h-4"
                />
                <span className="text-sm">Tất cả</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="filterType"
                  value="day"
                  checked={dateFilterType === "day"}
                  onChange={(e) => setDateFilterType(e.target.value as "all" | "day" | "month")}
                  className="w-4 h-4"
                />
                <span className="text-sm">Theo ngày</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="filterType"
                  value="month"
                  checked={dateFilterType === "month"}
                  onChange={(e) => setDateFilterType(e.target.value as "all" | "day" | "month")}
                  className="w-4 h-4"
                />
                <span className="text-sm">Theo tháng</span>
              </label>
            </div>

            {/* Date/Month Picker */}
            {dateFilterType !== "all" && (
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="text-sm text-gray-600 block mb-1">
                    {dateFilterType === "day" ? "Chọn ngày" : "Chọn tháng"}
                  </label>
                  <input
                    type={dateFilterType === "day" ? "date" : "month"}
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="border rounded px-3 py-2 text-sm w-full"
                  />
                </div>
                <button
                  onClick={onApplyDateFilter}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded text-sm font-medium transition-colors"
                >
                  Xác nhận
                </button>
              </div>
            )}

            {/* Display Results */}
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <div className="text-sm text-gray-600">Doanh thu</div>
                <div className="text-3xl font-semibold">
                  {dateRevenue.total.toLocaleString("en-US")}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Số giao dịch</div>
                <div className="text-3xl font-semibold">{dateRevenue.count}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 7-Day Revenue Chart */}
      <Card className="w-fit">
        <CardHeader>
          <CardTitle>Doanh thu 7 ngày gần nhất</CardTitle>
        </CardHeader>
        <CardContent>
          <BarChart data={revenue7DaysData} dataKey="revenue" />
        </CardContent>
      </Card>

      {/* Monthly Revenue Chart */}
      <Card className="w-fit">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Doanh thu 12 tháng</CardTitle>
            <select
              value={revenueByMonthYear}
              onChange={(e) => setRevenueByMonthYear(Number(e.target.value))}
              className="border rounded px-3 py-1 text-sm"
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
        <CardContent>
          <BarChart
            data={revenueByMonthData.map((d) => ({
              ...d,
              label: monthNames[d.month - 1],
            }))}
            dataKey="revenue"
          />
        </CardContent>
      </Card>
    </div>
  );
}
