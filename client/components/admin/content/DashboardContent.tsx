import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface Metrics { totalUsers: number; totalMovies: number; revenueTotal: number; revenueCount: number; avgRevenuePerUser: number; totalShowtimes: number; totalToys: number; totalTransactions: number }
interface Props { metrics: Metrics; showtimesByDay: Array<{ label: string; value: number }>; revenueByDay: Array<{ label: string; value: number }> }

export default function DashboardContent({ metrics, showtimesByDay, revenueByDay }: Props) {
  const BarChart = ({ data, max }: { data: Array<{ label: string; value: number }>; max?: number }) => {
    const m = max ?? Math.max(1, ...data.map(d => d.value))
    return (
      <div className="flex items-end gap-2 h-28">
        {data.map(d => (
          <div key={d.label} className="flex flex-col items-center">
            <div style={{ height: `${(d.value / m) * 100}%` }} className="w-6 bg-blue-500 rounded-sm" />
            <span className="text-[10px] mt-1">{d.label}</span>
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardHeader><CardTitle>Phim</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold">{metrics.totalMovies}</div><Badge variant="secondary" className="mt-2">Tổng số phim</Badge></CardContent></Card>
        <Card><CardHeader><CardTitle>Lịch chiếu hôm nay</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold">{metrics.totalShowtimes}</div><Badge variant="secondary" className="mt-2">Số suất chiếu</Badge></CardContent></Card>
        <Card><CardHeader><CardTitle>Doanh thu hôm nay</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold">{metrics.revenueTotal.toLocaleString('en-US')}</div><Badge variant="secondary" className="mt-2">Số đơn: {metrics.revenueCount}</Badge></CardContent></Card>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card><CardHeader><CardTitle>Suất chiếu 7 ngày</CardTitle></CardHeader><CardContent><BarChart data={showtimesByDay} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Doanh thu 7 ngày</CardTitle></CardHeader><CardContent><BarChart data={revenueByDay} /></CardContent></Card>
      </div>
    </div>
  )
}
