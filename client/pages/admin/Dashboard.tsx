import React, { useEffect, useMemo, useState } from "react"
import AdminLayout from "@/components/admin/AdminLayout"
import DashboardContent from "@/components/admin/content/DashboardContent"
import { getMoviesAdmin, getShowtimes, getAdminRevenue } from "@/lib/api"

export default function DashboardPage() {
  const [totalMovies, setTotalMovies] = useState(0)
  const [showtimesToday, setShowtimesToday] = useState(0)
  const [revenueTotal, setRevenueTotal] = useState(0)
  const [revenueCount, setRevenueCount] = useState(0)
  const [showtimesByDay, setShowtimesByDay] = useState<Array<{ label: string; value: number }>>([])
  const [revenueByDay, setRevenueByDay] = useState<Array<{ label: string; value: number }>>([])

  useEffect(() => {
    const now = new Date()
    const todayStart = new Date(now); todayStart.setHours(0,0,0,0)
    const todayEnd = new Date(now); todayEnd.setHours(23,59,59,999)
    const iso = (d: Date) => d.toISOString()

    ;(async () => {
      try {
        const [moviesRes, showtimesResToday, revenueResToday] = await Promise.all([
          getMoviesAdmin({ page: 1, pageSize: 1 }),
          getShowtimes({ page: 1, pageSize: 1, from: iso(todayStart), to: iso(todayEnd) }),
          getAdminRevenue({ from: iso(todayStart), to: iso(now) })
        ])
        setTotalMovies(moviesRes.total || 0)
        setShowtimesToday(showtimesResToday.total || 0)
        setRevenueTotal(revenueResToday.total || 0)
        setRevenueCount(revenueResToday.count || 0)

        const last7Start = new Date(now); last7Start.setDate(last7Start.getDate() - 6); last7Start.setHours(0,0,0,0)
        const stRes = await getShowtimes({ page: 1, pageSize: 500, from: iso(last7Start), to: iso(todayEnd) })
        const buckets: Record<string, number> = {}
        for (const s of stRes.items || []) {
          const d = new Date(s.start_time)
          const key = `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`
          buckets[key] = (buckets[key] || 0) + 1
        }
        const series: Array<{ label: string; value: number }> = []
        for (let i=6; i>=0; i--) {
          const d = new Date(now); d.setDate(d.getDate()-i); d.setHours(0,0,0,0)
          const key = `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`
          series.push({ label: key.slice(5), value: buckets[key] || 0 })
        }
        setShowtimesByDay(series)

        const revSeries: Array<{ label: string; value: number }> = []
        for (let i=6; i>=0; i--) {
          const dStart = new Date(now); dStart.setDate(dStart.getDate()-i); dStart.setHours(0,0,0,0)
          const dEnd = new Date(dStart); dEnd.setHours(23,59,59,999)
          const r = await getAdminRevenue({ from: iso(dStart), to: iso(dEnd) })
          revSeries.push({ label: `${(dStart.getMonth()+1).toString().padStart(2,'0')}-${dStart.getDate().toString().padStart(2,'0')}`, value: r.total || 0 })
        }
        setRevenueByDay(revSeries)
      } catch {}
    })()
  }, [])

  const metrics = useMemo(() => ({
    totalUsers: 0,
    totalMovies,
    revenueTotal,
    revenueCount,
    avgRevenuePerUser: 0,
    totalShowtimes: showtimesToday,
    totalToys: 0,
    totalTransactions: 0,
  }), [totalMovies, revenueTotal, revenueCount, showtimesToday])

  return (
    <AdminLayout active="dashboard" setActive={() => {}} adminEmailState={localStorage.getItem("adminEmail") || "admin@email.com"} handleLogout={() => {}}>
      <DashboardContent metrics={metrics} showtimesByDay={showtimesByDay} revenueByDay={revenueByDay} />
    </AdminLayout>
  )
}
