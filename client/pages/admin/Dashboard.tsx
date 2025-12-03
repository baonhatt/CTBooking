import React, { useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import DashboardContent from "@/components/admin/content/DashboardContent";
import {
  getDashboardMetrics,
  getRevenueByDate,
  getRevenue7Days,
  getRevenueByMonth,
} from "@/lib/api";

export default function DashboardPage() {
  const [metrics, setMetrics] = useState({
    totalMovies: 0,
    totalShowtimes: 0,
    totalToys: 0,
    totalUsers: 0,
    totalTransactions: 0,
    revenueTotal: 0,
  });

  // Date picker state
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [dateFilterType, setDateFilterType] = useState<"all" | "day" | "month">("all");
  const [dateStatus, setDateStatus] = useState<"all" | "paid">("paid");
  const [dateRevenue, setDateRevenue] = useState({ total: 0, count: 0 });

  // 7-day chart state
  const [revenue7DaysData, setRevenue7DaysData] = useState<
    Array<{ day: string; revenue: number }>
  >([]);

  // Monthly chart state
  const [revenueByMonthYear, setRevenueByMonthYear] = useState(
    new Date().getFullYear()
  );
  const [revenueByMonthData, setRevenueByMonthData] = useState<
    Array<{ month: number; revenue: number }>
  >([]);

  // Load metrics on mount
  useEffect(() => {
    (async () => {
      try {
        const data = await getDashboardMetrics();
        setMetrics(data);
      } catch (err) {
        console.error("Failed to load metrics:", err);
      }
    })();
  }, []);

  // Load all revenue on mount
  useEffect(() => {
    (async () => {
      try {
        const data = await getRevenueByDate(undefined, dateStatus);
        setDateRevenue({ total: data.total, count: data.count });
      } catch (err) {
        console.error("Failed to load date revenue:", err);
      }
    })();
  }, [dateStatus]);

  // Handle date filter apply
  const handleApplyDateFilter = async () => {
    try {
      if (dateFilterType === "all") {
        const data = await getRevenueByDate(undefined, dateStatus);
        setDateRevenue({ total: data.total, count: data.count });
      } else if (dateFilterType === "day") {
        const data = await getRevenueByDate(selectedDate, dateStatus);
        setDateRevenue({ total: data.total, count: data.count });
      } else if (dateFilterType === "month") {
        // For month filtering, extract year-month and query all days in that month
        const [year, month] = selectedDate.split("-");
        const data = await getRevenueByMonth(parseInt(year), parseInt(month), dateStatus);
        if ('total' in data) {
          setDateRevenue({ total: data.total, count: data.count });
        }
      }
    } catch (err) {
      console.error("Failed to apply date filter:", err);
    }
  };

  // Load 7-day revenue on mount
  useEffect(() => {
    (async () => {
      try {
        const data = await getRevenue7Days();
        setRevenue7DaysData(data.data);
      } catch (err) {
        console.error("Failed to load 7-day revenue:", err);
      }
    })();
  }, []);

  // Load monthly revenue when year changes
  useEffect(() => {
    (async () => {
      try {
        const data = await getRevenueByMonth(revenueByMonthYear, undefined, dateStatus);
        if ('data' in data) {
          setRevenueByMonthData(data.data);
        }
      } catch (err) {
        console.error("Failed to load monthly revenue:", err);
      }
    })();
  }, [revenueByMonthYear, dateStatus]);

  return (
    <AdminLayout
      active="dashboard"
      setActive={() => { }}
      adminEmailState={localStorage.getItem("adminEmail") || "admin@email.com"}
      handleLogout={() => { }}
    >
      <DashboardContent
        metrics={metrics}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        dateRevenue={dateRevenue}
        onApplyDateFilter={handleApplyDateFilter}
        dateFilterType={dateFilterType}
        setDateFilterType={setDateFilterType}
        revenue7DaysData={revenue7DaysData}
        revenueByMonthYear={revenueByMonthYear}
        setRevenueByMonthYear={setRevenueByMonthYear}
        revenueByMonthData={revenueByMonthData}
        dateStatus={dateStatus}
        setDateStatus={setDateStatus}
      />
    </AdminLayout>
  );
}
